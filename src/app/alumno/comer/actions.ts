"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAlumno } from "@/lib/auth";
import { TAG_RANKING } from "@/lib/ranking/data";
import { buscarAlimentos } from "./data";
import { etiquetaDeHora, type AlimentoCatalogo } from "./tipos";
import {
  buscarEnOFF,
  buscarPorCodigoOFF,
  type ResultadoOFF,
  type ResultadoProductoOFF,
} from "@/lib/alimentos/openFoodFacts";
import { deducirMedidaCasera, medidaDeAlimento } from "@/lib/alimentos/medidaCasera";
import { recalcularAlimentacionDia } from "@/lib/ranking/movimientos";
import { fechaEnVentanaValida } from "@/lib/date";
import { registrarActividadAlumno } from "@/lib/ingresos/data";

/**
 * El buscador por texto de Open Food Facts (`cgi/search.pl`) no manda
 * cabeceras CORS para orígenes de terceros, así que llamarlo directo desde el
 * navegador del alumno fallaba con un error de conexión genérico. Pasa por
 * acá, servidor a servidor, donde CORS no aplica.
 */
export async function buscarEnOFFAction(texto: string, pais: "chile" | "global"): Promise<ResultadoOFF> {
  return buscarEnOFF(texto, pais);
}

/** El endpoint de código de barras sí manda CORS y funcionaría directo desde
 * el navegador, pero se centraliza acá igual, por consistencia. */
export async function buscarPorCodigoOFFAction(codigo: string): Promise<ResultadoProductoOFF> {
  return buscarPorCodigoOFF(codigo);
}

async function obtenerORegistroDiario(
  supabase: Awaited<ReturnType<typeof createClient>>,
  alumnoId: string,
  fecha: string
): Promise<string> {
  const { data: existente } = await supabase
    .from("registros_diarios")
    .select("id")
    .eq("alumno_id", alumnoId)
    .eq("fecha", fecha)
    .maybeSingle();

  if (existente) return existente.id;

  // Sin este límite, cualquiera podía navegar a /alumno/comer/<fecha vieja>
  // y fabricar un día entero de comida a la medida exacta de su meta de
  // calorías, cobrando el puntaje "cerrado" (máximo) de un día que nunca
  // ocurrió — ver auditoría de puntos VIP. Un registro que YA existe (un día
  // real, ya creado dentro de la ventana permitida) se sigue pudiendo editar
  // sin este chequeo: acá solo se bloquea FABRICAR uno nuevo fuera de fecha.
  if (!fechaEnVentanaValida(fecha)) {
    throw new Error("Solo se puede registrar comida de hoy o de ayer.");
  }

  const { data: nuevo, error } = await supabase
    .from("registros_diarios")
    .insert({ alumno_id: alumnoId, fecha })
    .select("id")
    .single();

  if (error || !nuevo) throw new Error("No fue posible crear el registro del día.");
  return nuevo.id;
}

async function obtenerOComida(
  supabase: Awaited<ReturnType<typeof createClient>>,
  registroDiarioId: string,
  tipoComida: string
): Promise<string> {
  const { data: existente } = await supabase
    .from("comidas_registradas")
    .select("id")
    .eq("registro_diario_id", registroDiarioId)
    .eq("tipo_comida", tipoComida)
    .maybeSingle();

  if (existente) return existente.id;

  const { data: nueva, error } = await supabase
    .from("comidas_registradas")
    .insert({ registro_diario_id: registroDiarioId, tipo_comida: tipoComida })
    .select("id")
    .single();

  if (error || !nueva) throw new Error("No fue posible crear la comida.");
  return nueva.id;
}

export type ComerActionState = { error: string | null; puntos?: number; consumidoId?: string };

/** Lo que se devuelve cuando el entrenador está mirando la cuenta de un alumno:
 * ahí no se puede escribir, y hay que decirlo en vez de guardar en el lugar
 * equivocado. */
const ERROR_SOLO_LECTURA =
  "Estás viendo la cuenta de un alumno en modo lectura. Sal de esa vista para cargar comidas.";

async function fechaRealDeComida(
  supabase: Awaited<ReturnType<typeof createClient>>,
  comidaId: string,
  alumnoId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("comidas_registradas")
    .select("registros_diarios(fecha, alumno_id)")
    .eq("id", comidaId)
    .maybeSingle();
  const registro = data?.registros_diarios as { fecha: string; alumno_id: string } | null | undefined;
  return registro?.alumno_id === alumnoId ? registro.fecha : null;
}

async function fechaRealDeAlimentoConsumido(
  supabase: Awaited<ReturnType<typeof createClient>>,
  alimentoConsumidoId: string,
  alumnoId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("alimentos_consumidos")
    .select("comidas_registradas(registros_diarios(fecha, alumno_id))")
    .eq("id", alimentoConsumidoId)
    .maybeSingle();
  const comida = data?.comidas_registradas as
    | { registros_diarios: { fecha: string; alumno_id: string } | null }
    | null
    | undefined;
  const registro = comida?.registros_diarios;
  return registro?.alumno_id === alumnoId ? registro.fecha : null;
}

/**
 * De quién es el diario que se está por tocar.
 *
 * Antes esto era `auth.getUser().id` a secas, y ahí estaba el problema: cuando
 * un entrenador entra en "ver como alumno", el usuario autenticado sigue siendo
 * EL ENTRENADOR. Así que agregar un alimento desde esa vista lo guardaba en el
 * diario del propio entrenador, no en el del alumno que se veía en pantalla.
 * En el celular se veía como que a veces cargaba y a veces no: la lista
 * optimista mostraba el alimento, y al refrescar la pantalla volvía a leer el
 * diario DEL ALUMNO, donde nunca se había escrito nada, y desaparecía.
 *
 * `requireAlumno()` es la única fuente de verdad sobre de quién es la pantalla,
 * y además dice si la vista es de solo lectura.
 */
async function alumnoDelDiario(): Promise<
  { ok: true; alumnoId: string } | { ok: false; error: string }
> {
  const { alumnoId, soloLectura } = await requireAlumno();
  if (soloLectura) return { ok: false, error: ERROR_SOLO_LECTURA };
  return { ok: true, alumnoId };
}

async function registrarCambioAlimentacion(alumnoId: string, accion: string): Promise<void> {
  await registrarActividadAlumno(alumnoId, "alimentacion_cambio", { accion }).catch(() => {});
}

export async function agregarAlimentoAComida(
  fecha: string,
  tipoComida: string,
  alimentoId: string,
  cantidad: number,
  unidad: string
): Promise<ComerActionState> {
  // Fuera del try a propósito: si la sesión venció, `requireAlumno` dispara un
  // redirect, y en Next eso viaja como excepción. Atraparlo acá lo convertiría
  // en un "no fue posible guardar" y el alumno quedaría trabado en una pantalla
  // muerta en vez de ir al login.
  const quien = await alumnoDelDiario();
  if (!quien.ok) return { error: quien.error };

  try {
    const supabase = await createClient();
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      return { error: "Ingresa una cantidad válida." };
    }

    const registroId = await obtenerORegistroDiario(supabase, quien.alumnoId, fecha);
    const comidaId = await obtenerOComida(supabase, registroId, tipoComida);

    const { data: consumido, error } = await supabase
      .from("alimentos_consumidos")
      .insert({ comida_id: comidaId, alimento_id: alimentoId, cantidad, unidad })
      .select("id")
      .single();

    if (error) return { error: "No fue posible agregar el alimento." };

    await registrarCambioAlimentacion(quien.alumnoId, "agregar_alimento");

    // Desde la migración 0037 se conserva la hora real del primer alimento de
    // esta comida. Si la comida ya existía, no se sobreescribe la primera hora.
    await supabase
      .from("comidas_registradas")
      .update({ registrado_en: new Date().toISOString(), omitida: false })
      .eq("id", comidaId)
      .is("registrado_en", null);

    const puntos = await recalcularAlimentacionDia(quien.alumnoId, fecha);
    revalidateTag(TAG_RANKING, { expire: 0 });
    revalidatePath(`/alumno/comer/${fecha}`);
    revalidatePath("/alumno/inicio");
    revalidatePath("/portal-v2/nutricion");
    revalidatePath("/portal-v2/progreso");
    return { error: null, puntos, consumidoId: consumido?.id };
  } catch (error) {
    if (error instanceof Error && error.message.includes("hoy o de ayer")) {
      return { error: error.message };
    }
    return { error: "No fue posible guardar. Revisa tu conexión e intenta nuevamente." };
  }
}

/** Agrega un alimento a la franja horaria elegida en la línea de tiempo. */
export async function agregarAlimentoAHora(
  fecha: string,
  hora: number,
  alimentoId: string,
  cantidad: number,
  unidad: string
): Promise<ComerActionState> {
  if (!Number.isInteger(hora) || hora < 0 || hora > 23) {
    return { error: "Hora inválida." };
  }
  return agregarAlimentoAComida(fecha, etiquetaDeHora(hora), alimentoId, cantidad, unidad);
}

/** Borra una comida entera (y sus alimentos, por la cascada de la FK). */
export async function eliminarComida(comidaId: string, fechaSolicitada: string): Promise<ComerActionState> {
  void fechaSolicitada;
  // Fuera del try por el redirect de sesión vencida — ver `agregarAlimentoAComida`.
  const quien = await alumnoDelDiario();
  if (!quien.ok) return { error: quien.error };

  try {
    const supabase = await createClient();
    // La fecha también se relee del servidor. Antes el cliente podía mandar
    // una fecha distinta: se borraba la comida correcta, pero se recalculaban
    // los puntos de otro día y el ranking quedaba desincronizado.
    const fecha = await fechaRealDeComida(supabase, comidaId, quien.alumnoId);
    if (!fecha) return { error: "No encontramos esa comida en tu diario." };
    const { error } = await supabase.from("comidas_registradas").delete().eq("id", comidaId);
    if (error) return { error: "No fue posible eliminar la comida." };

    await registrarCambioAlimentacion(quien.alumnoId, "eliminar_comida");

    await recalcularAlimentacionDia(quien.alumnoId, fecha);
    revalidateTag(TAG_RANKING, { expire: 0 });
    revalidatePath(`/alumno/comer/${fecha}`);
    revalidatePath("/alumno/inicio");
    return { error: null };
  } catch {
    return { error: "No fue posible eliminar. Revisa tu conexión e intenta nuevamente." };
  }
}

/** Snake_case de una fila de `alimentos` (con medida y micronutrientes) al
 * tipo de dominio. */
function filaACatalogo(a: {
  id: string;
  nombre: string;
  categoria: string | null;
  porcion_base: number;
  unidad: string;
  kcal: number;
  prot: number;
  carb: number;
  grasa: number;
  medida_nombre?: string | null;
  medida_gramos?: number | null;
  fibra?: number | null;
  azucares?: number | null;
  sodio?: number | null;
}): AlimentoCatalogo {
  // Mismo respaldo que `aCatalogo` en data.ts: si la fila no tiene medida
  // casera guardada, se deduce del nombre para no dejar al alumno pesando
  // todo en gramos.
  const medida = medidaDeAlimento({
    nombre: a.nombre,
    categoria: a.categoria,
    unidad: a.unidad,
    medidaNombre: a.medida_nombre,
    medidaGramos: a.medida_gramos,
  });
  return {
    id: a.id,
    nombre: a.nombre,
    categoria: a.categoria,
    porcionBase: a.porcion_base,
    unidad: a.unidad,
    kcal: a.kcal,
    prot: a.prot,
    carb: a.carb,
    grasa: a.grasa,
    medidaNombre: medida?.nombre ?? null,
    medidaGramos: medida?.gramos ?? null,
    fibra: a.fibra ?? null,
    azucares: a.azucares ?? null,
    sodio: a.sodio ?? null,
  };
}

const COLUMNAS_ALIMENTO =
  "id, nombre, categoria, porcion_base, unidad, kcal, prot, carb, grasa, medida_nombre, medida_gramos, fibra, azucares, sodio";

export type ProductoOFFInput = {
  offId: string;
  nombre: string;
  marca: string | null;
  kcal: number;
  prot: number;
  carb: number;
  grasa: number;
  fibra: number | null;
  azucares: number | null;
  sodio: number | null;
  medidaNombre: string | null;
  medidaGramos: number | null;
  imagenUrl: string | null;
};

/**
 * El alumno eligió un producto de Open Food Facts: se copia a nuestra base
 * (para no depender de la API para volver a consultarlo) y de ahí en
 * adelante se trata como cualquier otro alimento del catálogo.
 *
 * A diferencia de `crearAlimentoPersonalizado`, nace `aprobado = true` y con
 * `creado_por = null`: entra directo al catálogo compartido, porque viene de
 * una base de datos externa ya curada, no de que un alumno haya tipeado
 * cualquier cosa. Mismo motivo por el que usa cliente admin: la política
 * `alimentos_write` solo deja escribir a entrenador/admin.
 *
 * Si el producto ya se había importado antes (este alumno u otro), se
 * reutiliza la fila en vez de duplicarla.
 */
export async function importarAlimentoOFF(
  producto: ProductoOFFInput
): Promise<{ error: string | null; alimento: AlimentoCatalogo | null }> {
  const fallo = (error: string) => ({ error, alimento: null });

  // Fuera del try por el redirect de sesión vencida — ver `agregarAlimentoAComida`.
  const quien = await alumnoDelDiario();
  if (!quien.ok) return fallo(quien.error);

  try {
    const supabase = await createClient();

    const nombre = producto.nombre.trim().slice(0, 80);
    if (!nombre) return fallo("Producto sin nombre válido.");

    // No todos los productos de Open Food Facts traen su porción de envase
    // (serving_size): sin eso, "Aceite vegetal" quedaba medido solo en gramos,
    // que nadie usa así en la práctica. `deducirMedidaCasera` es la misma
    // función que ya usa el catálogo curado para saber que el aceite se mide
    // en cucharadas, la leche en vasos, el huevo en unidades, etc. — se usa acá
    // de respaldo cuando el producto no trae su propia medida.
    const medidaRespaldo = producto.medidaNombre ? null : deducirMedidaCasera(nombre);
    const medidaNombre = producto.medidaNombre ?? medidaRespaldo?.nombre ?? null;
    const medidaGramos = producto.medidaNombre ? producto.medidaGramos : (medidaRespaldo?.gramos ?? null);

    const { data: existente } = await supabase
      .from("alimentos")
      .select(COLUMNAS_ALIMENTO)
      .eq("off_id", producto.offId)
      .maybeSingle();
    if (existente) return { error: null, alimento: filaACatalogo(existente) };

    /**
     * Ya hay un alimento con ese nombre: se REUSA en vez de fallar.
     *
     * Antes esto devolvía "Ya existe X: búscalo en el buscador", y era un
     * callejón sin salida: el producto aparecía en la lista de Open Food Facts
     * justamente porque el homónimo local no había salido entre los resultados
     * (quedó fuera del tope de 7, o está inactivo). El socio tocaba el
     * producto, leía "búscalo en el buscador", buscaba, y no encontraba nada.
     *
     * Devolver la fila existente es además lo correcto: el alimento que el
     * socio quiere registrar ya está en el catálogo.
     */
    const { data: repetido } = await supabase
      .from("alimentos")
      .select(COLUMNAS_ALIMENTO)
      .ilike("nombre", nombre.replace(/[%_]/g, (c) => `\\${c}`))
      .limit(1)
      .maybeSingle();
    if (repetido) return { error: null, alimento: filaACatalogo(repetido) };

    const { data, error } = await createAdminClient()
      .from("alimentos")
      .insert({
        nombre,
        porcion_base: 100,
        unidad: "g",
        kcal: producto.kcal,
        prot: producto.prot,
        carb: producto.carb,
        grasa: producto.grasa,
        fibra: producto.fibra,
        azucares: producto.azucares,
        sodio: producto.sodio,
        marca: producto.marca,
        off_id: producto.offId,
        imagen_url: producto.imagenUrl,
        origen: "openfoodfacts",
        aprobado: true,
        medida_nombre: medidaNombre,
        medida_gramos: medidaGramos,
      })
      .select(COLUMNAS_ALIMENTO)
      .single();

    if (error || !data) {
      // Alguien más importó el mismo código justo antes: se reutiliza esa fila.
      if (error?.code === "23505") {
        const { data: porOffId } = await supabase
          .from("alimentos")
          .select(COLUMNAS_ALIMENTO)
          .eq("off_id", producto.offId)
          .maybeSingle();
        if (porOffId) return { error: null, alimento: filaACatalogo(porOffId) };
      }
      return fallo("No fue posible agregar este producto a tu catálogo.");
    }

    return { error: null, alimento: filaACatalogo(data) };
  } catch {
    return fallo("No fue posible guardar. Revisa tu conexión e intenta nuevamente.");
  }
}

export type AlimentoPersonalizado = {
  nombre: string;
  porcionBase: number;
  unidad: string;
  kcal: number;
  prot: number;
  carb: number;
  grasa: number;
  /** Código de barras, cuando se llega acá desde el escáner y el producto no
   * estaba en Open Food Facts. Se guarda igual, para que si aparece después
   * en OFF no quede duplicado. */
  offId?: string | null;
};

/**
 * Crea un alimento que no está en el catálogo del gimnasio.
 *
 * Va con cliente admin a propósito: la política `alimentos_write` (migración
 * 0001) solo deja escribir a entrenador/admin, y no se toca — el permiso se
 * concede acá, en el servidor, después de verificar la sesión y validar los
 * números.
 *
 * Nace PENDIENTE (`aprobado = false`, migración 0030): el alumno lo usa al
 * instante porque la política de lectura deja ver lo propio, pero no aparece
 * en el buscador de los demás hasta que el entrenador lo acepte desde
 * /admin/alimentos.
 */
export async function crearAlimentoPersonalizado(
  datos: AlimentoPersonalizado
): Promise<{ error: string | null; alimento: AlimentoCatalogo | null }> {
  const fallo = (error: string) => ({ error, alimento: null });

  // Fuera del try por el redirect de sesión vencida — ver `agregarAlimentoAComida`.
  const quien = await alumnoDelDiario();
  if (!quien.ok) return fallo(quien.error);
  const alumnoId = quien.alumnoId;

  try {
    const supabase = await createClient();

    const nombre = datos.nombre.trim();
    if (nombre.length < 2) return fallo("Ponle un nombre al alimento.");
    if (nombre.length > 80) return fallo("El nombre es demasiado largo.");

    const numeros = [datos.porcionBase, datos.kcal, datos.prot, datos.carb, datos.grasa];
    if (numeros.some((n) => !Number.isFinite(n) || n < 0)) {
      return fallo("Revisa los valores: no pueden ser negativos.");
    }
    if (datos.porcionBase <= 0) return fallo("La porción debe ser mayor que cero.");

    const unidad = datos.unidad.trim() || "g";
    const offId = datos.offId?.trim() || null;

    if (offId) {
      const { data: porCodigo } = await supabase
        .from("alimentos")
        .select("nombre")
        .eq("off_id", offId)
        .maybeSingle();
      if (porCodigo) return fallo(`Ese código ya está guardado como "${porCodigo.nombre}": búscalo en el buscador.`);
    }

    // Se avisa antes de chocar contra el índice único, que devolvería un
    // "no fue posible" sin explicar por qué. `ilike` sin comodines compara el
    // nombre completo sin distinguir mayúsculas.
    const { data: repetido } = await supabase
      .from("alimentos")
      .select("nombre")
      .ilike("nombre", nombre.replace(/[%_]/g, (c) => `\\${c}`))
      .limit(1)
      .maybeSingle();

    if (repetido) return fallo(`Ya existe "${repetido.nombre}": búscalo en el buscador.`);

    // Solo tiene sentido si la porción quedó en gramos: medida_gramos siempre
    // es "cuántos gramos equivale 1 medida", así que mezclarlo con una
    // porción en otra unidad (ml, unidad, etc.) daría una conversión falsa.
    const medidaSugerida = unidad.toLowerCase() === "g" ? deducirMedidaCasera(nombre) : null;

    const { data, error } = await createAdminClient()
      .from("alimentos")
      .insert({
        nombre,
        categoria: "Personalizado",
        porcion_base: datos.porcionBase,
        unidad,
        kcal: datos.kcal,
        prot: datos.prot,
        carb: datos.carb,
        grasa: datos.grasa,
        creado_por: alumnoId,
        aprobado: false,
        off_id: offId,
        medida_nombre: medidaSugerida?.nombre ?? null,
        medida_gramos: medidaSugerida?.gramos ?? null,
      })
      .select("id, nombre, categoria, porcion_base, unidad, kcal, prot, carb, grasa")
      .single();

    if (error || !data) return fallo("No fue posible crear el alimento.");

    return {
      error: null,
      alimento: {
        id: data.id,
        nombre: data.nombre,
        categoria: data.categoria,
        porcionBase: data.porcion_base,
        unidad: data.unidad,
        kcal: data.kcal,
        prot: data.prot,
        carb: data.carb,
        grasa: data.grasa,
        medidaNombre: medidaSugerida?.nombre ?? null,
        medidaGramos: medidaSugerida?.gramos ?? null,
        fibra: null,
        azucares: null,
        sodio: null,
      },
    };
  } catch {
    return fallo("No fue posible guardar. Revisa tu conexión e intenta nuevamente.");
  }
}

export async function quitarAlimentoDeComida(alimentoConsumidoId: string, fechaSolicitada: string): Promise<ComerActionState> {
  void fechaSolicitada;
  const quien = await alumnoDelDiario();
  if (!quien.ok) return { error: quien.error };
  const supabase = await createClient();
  const fecha = await fechaRealDeAlimentoConsumido(supabase, alimentoConsumidoId, quien.alumnoId);
  if (!fecha) return { error: "No encontramos ese alimento en tu diario." };
  const { error } = await supabase.from("alimentos_consumidos").delete().eq("id", alimentoConsumidoId);
  if (error) return { error: "No fue posible eliminar el alimento." };
  await registrarCambioAlimentacion(quien.alumnoId, "quitar_alimento");
  await recalcularAlimentacionDia(quien.alumnoId, fecha);
  revalidateTag(TAG_RANKING, { expire: 0 });
  revalidatePath(`/alumno/comer/${fecha}`);
  revalidatePath("/alumno/inicio");
  revalidatePath("/portal-v2/nutricion");
  revalidatePath("/portal-v2/progreso");
  return { error: null };
}

export async function actualizarCantidadAlimento(
  alimentoConsumidoId: string,
  cantidad: number,
  fechaSolicitada: string
): Promise<ComerActionState> {
  void fechaSolicitada;
  // Faltaba el chequeo de solo-lectura que sí tienen las demás escrituras: un
  // entrenador mirando la cuenta de un alumno podía editar cantidades desde
  // esa vista. RLS lo frenaba igual, pero devolvía un error genérico en vez
  // de explicar por qué.
  const quien = await alumnoDelDiario();
  if (!quien.ok) return { error: quien.error };

  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    return { error: "Ingresa una cantidad válida." };
  }
  const supabase = await createClient();
  const fecha = await fechaRealDeAlimentoConsumido(supabase, alimentoConsumidoId, quien.alumnoId);
  if (!fecha) return { error: "No encontramos ese alimento en tu diario." };
  const { error } = await supabase
    .from("alimentos_consumidos")
    .update({ cantidad })
    .eq("id", alimentoConsumidoId);

  if (error) return { error: "No fue posible actualizar la cantidad." };

  await registrarCambioAlimentacion(quien.alumnoId, "actualizar_cantidad");

  const puntos = await recalcularAlimentacionDia(quien.alumnoId, fecha);
  revalidateTag(TAG_RANKING, { expire: 0 });
  revalidatePath(`/alumno/comer/${fecha}`);
  revalidatePath("/alumno/inicio");
  revalidatePath("/portal-v2/nutricion");
  revalidatePath("/portal-v2/progreso");
  return { error: null, puntos };
}

export async function marcarComidaOmitida(
  fecha: string,
  tipoComida: string,
  omitida: boolean
): Promise<void> {
  const supabase = await createClient();
  const quien = await alumnoDelDiario();
  if (!quien.ok) return;
  const registroId = await obtenerORegistroDiario(supabase, quien.alumnoId, fecha);
  const comidaId = await obtenerOComida(supabase, registroId, tipoComida);

  await supabase.from("comidas_registradas").update({ omitida }).eq("id", comidaId);
  await registrarCambioAlimentacion(quien.alumnoId, omitida ? "omitir_comida" : "restaurar_comida");
  await recalcularAlimentacionDia(quien.alumnoId, fecha);
  revalidateTag(TAG_RANKING, { expire: 0 });
  revalidatePath(`/alumno/comer/${fecha}`);
  revalidatePath("/alumno/inicio");
}

export async function actualizarObservacionComida(
  fecha: string,
  tipoComida: string,
  observacion: string
): Promise<void> {
  const supabase = await createClient();
  const quien = await alumnoDelDiario();
  if (!quien.ok) return;
  const registroId = await obtenerORegistroDiario(supabase, quien.alumnoId, fecha);
  const comidaId = await obtenerOComida(supabase, registroId, tipoComida);

  await supabase
    .from("comidas_registradas")
    .update({ observacion: observacion || null })
    .eq("id", comidaId);
  await registrarCambioAlimentacion(quien.alumnoId, "actualizar_observacion");
  revalidatePath(`/alumno/comer/${fecha}`);
}

/** Búsqueda de alimentos para el buscador del alumno. Vive en el servidor
 * porque el catálogo tiene miles de items y no se puede mandar entero al
 * teléfono. */
export async function buscarAlimentosAction(texto: string): Promise<AlimentoCatalogo[]> {
  const supabase = await createClient();
  // Buscar sí se permite en la vista de solo lectura: el entrenador puede
  // querer mirar el catálogo mientras revisa la cuenta de un alumno. Lo que no
  // se permite es escribir, y eso lo cortan las acciones de arriba.
  await requireAlumno();
  return buscarAlimentos(supabase, texto);
}
