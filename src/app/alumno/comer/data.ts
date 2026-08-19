import "server-only";
import { createClient } from "@/lib/supabase/server";
import { ultimosNDiasISO } from "@/lib/date";
import { obtenerDocumentos } from "@/app/alumno/documentos/data";
import { medidaDeAlimento } from "@/lib/alimentos/medidaCasera";
import {
  horaDeComida,
  horasVacias,
  sumarAlimentos,
  sumarTotales,
  LIMITE_BUSQUEDA_ALIMENTOS,
  type AlimentoCatalogo,
  type AlimentoEnComida,
  type DocumentoDieta,
  type EstadoDia,
  type HoraDia,
  type PlanAlimentacion,
  type ResumenDiaComidas,
} from "./tipos";

// Los tipos y las funciones puras viven en ./tipos, que NO lleva `server-only`,
// para que los componentes cliente puedan importarlos sin arrastrar este módulo
// (y con él el cliente de Supabase) al bundle del navegador.
export * from "./tipos";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export async function obtenerPlanAlimentacion(
  supabase: SupabaseServerClient,
  alumnoId: string
): Promise<PlanAlimentacion> {
  const { data: plan } = await supabase
    .from("planes_alimentacion")
    .select("id, kcal_objetivo, prot_objetivo, carb_objetivo, grasa_objetivo")
    .eq("alumno_id", alumnoId)
    .eq("activo", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!plan) return null;

  const { data: comidas } = await supabase
    .from("plan_comidas")
    .select("nombre, hora, kcal, descripcion")
    .eq("plan_id", plan.id)
    .order("orden");

  return {
    kcalObjetivo: plan.kcal_objetivo,
    protObjetivo: plan.prot_objetivo,
    carbObjetivo: plan.carb_objetivo,
    grasaObjetivo: plan.grasa_objetivo,
    comidas: (comidas ?? []).map((c) => ({
      nombre: c.nombre,
      // Postgres devuelve "08:00:00"; al alumno le mostramos "08:00".
      hora: c.hora ? String(c.hora).slice(0, 5) : null,
      kcal: c.kcal,
      descripcion: c.descripcion,
    })),
  };
}

export async function obtenerDocumentoDieta(
  supabase: SupabaseServerClient,
  alumnoId: string
): Promise<DocumentoDieta> {
  // Se reusa la lectura de la pestaña Documentos, que ya resuelve las
  // asignaciones de la migración 0027 y su respaldo al esquema viejo. Evita
  // tener dos consultas distintas que puedan quedar desincronizadas.
  const documentos = await obtenerDocumentos(supabase, alumnoId);
  const dieta = documentos.find((d) => d.tipo === "alimentacion" && d.url);

  if (!dieta?.url) return null;

  return { nombreArchivo: dieta.nombreArchivo, url: dieta.url };
}

const COLUMNAS_ALIMENTO =
  "id, nombre, marca, categoria, porcion_base, unidad, kcal, prot, carb, grasa, medida_nombre, medida_gramos, fibra, azucares, sodio";

// Respaldo cuando existen las marcas de 0038 pero aún faltan medidas o
// micronutrientes de otras migraciones.
const COLUMNAS_ALIMENTO_MARCA_BASICAS =
  "id, nombre, marca, categoria, porcion_base, unidad, kcal, prot, carb, grasa";

// Sin las columnas de la migración 0013 (medida) y 0033 (micronutrientes),
// por si todavía no se corrieron en la base (ya pasó con 0009 y 0010: el
// código iba adelantado al esquema).
const COLUMNAS_ALIMENTO_BASICAS =
  "id, nombre, categoria, porcion_base, unidad, kcal, prot, carb, grasa";

type FilaAlimento = {
  id: string;
  nombre: string;
  marca?: string | null;
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
};

function aCatalogo(a: FilaAlimento): AlimentoCatalogo {
  // Alimentos viejos del catálogo (de antes de la migración 0013, o que se
  // sembraron sin medida) no tienen medida_nombre/medida_gramos guardados. Se
  // deduce del nombre al vuelo para que el alumno igual pueda elegir
  // "cucharada"/"vaso"/"unidad" en vez de quedar forzado a pesar todo en
  // gramos — no se reescribe la fila, solo se completa lo que falta al mostrarla.
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
    marca: a.marca ?? null,
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

/**
 * Busca alimentos por nombre o marca en la base. Con un catálogo de miles de items ya
 * no se puede mandar entero al teléfono ni filtrar en el cliente (Supabase
 * además corta en 1000 filas por consulta), así que la búsqueda vive acá.
 */
export async function buscarAlimentos(
  supabase: SupabaseServerClient,
  texto: string,
  limite = LIMITE_BUSQUEDA_ALIMENTOS
): Promise<AlimentoCatalogo[]> {
  const q = texto.trim();
  if (q.length < 2) return [];

  // El % de PostgREST necesita escape de los comodines que traiga el usuario.
  const escapado = q.replace(/[%_]/g, (c) => `\\${c}`);

  /**
   * Se busca en dos pasadas para que lo que EMPIEZA con lo escrito salga
   * primero. Ordenando solo por nombre, buscar "papa" devolvía "Carne al horno
   * con papas" y "Charquicán de papas" antes que la papa misma, porque la C va
   * antes que la P. Con una sola consulta no alcanza: el alimento buscado puede
   * quedar fuera del límite.
   */
  const consultar = (columnas: string, campo: "nombre" | "marca", patron: string, tope: number) =>
    supabase
      .from("alimentos")
      .select(columnas)
      .eq("activo", true)
      .ilike(campo, patron)
      .order("nombre")
      .limit(tope);

  const buscarPorNombre = async (patron: string, tope: number) => {
    const intento = await consultar(COLUMNAS_ALIMENTO, "nombre", patron, tope);
    const { data } = intento.error
      ? await consultar(COLUMNAS_ALIMENTO_BASICAS, "nombre", patron, tope)
      : intento;
    return (data ?? []) as unknown as FilaAlimento[];
  };

  const buscarPorMarca = async (patron: string, tope: number) => {
    const intento = await consultar(COLUMNAS_ALIMENTO, "marca", patron, tope);
    if (!intento.error) return (intento.data ?? []) as unknown as FilaAlimento[];

    // Si solo faltan medidas/micronutrientes, todavía podemos buscar por
    // marca. Si falta la propia migración 0038, esta segunda consulta también
    // falla y se vuelve una lista vacía sin romper el buscador por nombre.
    const respaldo = await consultar(COLUMNAS_ALIMENTO_MARCA_BASICAS, "marca", patron, tope);
    return respaldo.error ? [] : (respaldo.data ?? []) as unknown as FilaAlimento[];
  };

  // Prioridad deliberada: nombre que empieza, marca que empieza, nombre que
  // contiene y marca que contiene. Así "leche" encuentra primero el alimento
  // y "Soprole" encuentra sus productos sin volver a consultar internet.
  // Son consultas independientes: en paralelo conservan la prioridad del
  // arreglo sin multiplicar por cuatro el tiempo que espera el teléfono.
  const grupos = await Promise.all([
    buscarPorNombre(`${escapado}%`, limite),
    buscarPorMarca(`${escapado}%`, limite),
    buscarPorNombre(`%${escapado}%`, limite),
    buscarPorMarca(`%${escapado}%`, limite),
  ]);
  const vistos = new Set<string>();
  const ordenados: FilaAlimento[] = [];
  for (const grupo of grupos) {
    for (const alimento of grupo) {
      if (vistos.has(alimento.id)) continue;
      vistos.add(alimento.id);
      ordenados.push(alimento);
      if (ordenados.length >= limite) return ordenados.map(aCatalogo);
    }
  }

  return ordenados.map(aCatalogo);
}

/** Solo para procesos del servidor que necesitan el catálogo completo (el
 * emparejado del PDF de alimentación). Nunca mandarlo al cliente. */
export async function obtenerCatalogoAlimentos(
  supabase: SupabaseServerClient
): Promise<AlimentoCatalogo[]> {
  const PAGINA = 1000; // tope por consulta de PostgREST
  const filas: FilaAlimento[] = [];

  async function consultarPagina(desde: number, columnas: string) {
    return supabase
      .from("alimentos")
      .select(columnas)
      .eq("activo", true)
      .order("nombre")
      .range(desde, desde + PAGINA - 1);
  }

  let columnas = COLUMNAS_ALIMENTO;
  for (let desde = 0; ; desde += PAGINA) {
    const intento = await consultarPagina(desde, columnas);
    let resultado = intento;
    if (intento.error && columnas === COLUMNAS_ALIMENTO) {
      columnas = COLUMNAS_ALIMENTO_BASICAS;
      resultado = await consultarPagina(desde, columnas);
    }
    const pagina = (resultado.data ?? []) as unknown as FilaAlimento[];
    filas.push(...pagina);
    if (pagina.length < PAGINA) break;
  }

  return filas.map(aCatalogo);
}

export async function obtenerRegistrosRango(
  supabase: SupabaseServerClient,
  alumnoId: string,
  desde: string,
  hasta: string
): Promise<Record<string, HoraDia[]>> {
  const { data: registros } = await supabase
    .from("registros_diarios")
    .select(
      "fecha, comidas_registradas(id, tipo_comida, omitida, observacion, " +
        "alimentos_consumidos(id, alimento_id, cantidad, unidad, " +
        "alimentos(nombre, kcal, prot, carb, grasa, porcion_base)))"
    )
    .eq("alumno_id", alumnoId)
    .gte("fecha", desde)
    .lte("fecha", hasta);

  type FilaAlimentoConsumido = {
    id: string;
    alimento_id: string;
    cantidad: number;
    unidad: string;
    alimentos: {
      nombre: string;
      kcal: number;
      prot: number;
      carb: number;
      grasa: number;
      porcion_base: number;
    } | null;
  };
  type FilaComida = {
    id: string;
    tipo_comida: string;
    omitida: boolean;
    observacion: string | null;
    alimentos_consumidos: FilaAlimentoConsumido[] | null;
  };
  type FilaRegistro = { fecha: string; comidas_registradas: FilaComida[] | null };

  const porFecha: Record<string, HoraDia[]> = {};

  for (const registro of (registros ?? []) as unknown as FilaRegistro[]) {
    const horas = horasVacias();

    for (const c of registro.comidas_registradas ?? []) {
      const alimentos: AlimentoEnComida[] = [];
      for (const consumido of c.alimentos_consumidos ?? []) {
        const a = consumido.alimentos;
        if (!a) continue;
        const factor = a.porcion_base > 0 ? consumido.cantidad / a.porcion_base : 0;
        alimentos.push({
          id: consumido.id,
          alimentoId: consumido.alimento_id,
          nombre: a.nombre,
          cantidad: consumido.cantidad,
          unidad: consumido.unidad,
          kcal: a.kcal * factor,
          prot: a.prot * factor,
          carb: a.carb * factor,
          grasa: a.grasa * factor,
        });
      }

      // Una comida sin alimentos y sin omitir es una fila fantasma (la crean
      // `marcarComidaOmitida` y la observación): no se muestra como comida.
      if (alimentos.length === 0 && !c.omitida && !c.observacion) continue;

      horas[horaDeComida(c.tipo_comida)].comidas.push({
        tipoComida: c.tipo_comida,
        comidaId: c.id,
        omitida: c.omitida,
        observacion: c.observacion,
        alimentos,
        totales: sumarAlimentos(alimentos),
      });
    }

    for (const h of horas) h.totales = sumarTotales(h.comidas);
    porFecha[registro.fecha] = horas;
  }

  return porFecha;
}

/** Resumen de los últimos `dias` días (incluye los sin registro) para que el
 * entrenador vea kcal consumidas y detecte huecos, sin repetir el detalle
 * completo de cada comida. */
export async function obtenerResumenComidas(
  supabase: SupabaseServerClient,
  alumnoId: string,
  dias = 14
): Promise<ResumenDiaComidas[]> {
  const fechas = ultimosNDiasISO(dias);
  const desde = fechas[fechas.length - 1];
  const hasta = fechas[0];

  // Igual que en obtenerCalendarioMes: un solo select anidado en vez de 3
  // consultas encadenadas (registros -> comidas -> alimentos).
  const { data: registros } = await supabase
    .from("registros_diarios")
    .select(
      "fecha, comidas_registradas(omitida, alimentos_consumidos(cantidad, alimentos(kcal, porcion_base)))"
    )
    .eq("alumno_id", alumnoId)
    .gte("fecha", desde)
    .lte("fecha", hasta);

  const porFecha = new Map<string, { kcal: number; atendidas: number }>();
  for (const r of registros ?? []) {
    const comidas =
      (r.comidas_registradas as unknown as
        | {
            omitida: boolean;
            alimentos_consumidos:
              | { cantidad: number; alimentos: { kcal: number; porcion_base: number } | null }[]
              | null;
          }[]
        | null) ?? [];

    let kcal = 0;
    for (const c of comidas) {
      if (c.omitida) continue;
      for (const a of c.alimentos_consumidos ?? []) {
        if (!a.alimentos) continue;
        if (a.alimentos.porcion_base > 0) {
          kcal += (a.cantidad / a.alimentos.porcion_base) * a.alimentos.kcal;
        }
      }
    }
    porFecha.set(r.fecha, { kcal, atendidas: comidas.length });
  }

  return fechas.map((fecha) => {
    const acc = porFecha.get(fecha) ?? { kcal: 0, atendidas: 0 };
    const estado: EstadoDia = acc.atendidas === 0 ? "vacio" : acc.atendidas < 3 ? "parcial" : "completo";
    return { fecha, estado, kcal: Math.round(acc.kcal) };
  });
}
