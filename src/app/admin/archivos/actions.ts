"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/auth";
import { extraerRutinaDesdePdf, type RutinaExtraida } from "@/lib/ai/extraerRutina";
import { extraerPlanAlimentacionDesdePdf } from "@/lib/ai/extraerPlanAlimentacion";
import { obtenerCatalogoAlimentos } from "@/app/alumno/comer/data";
import { obtenerBiblioteca } from "@/lib/ejercicios/data";
import { emparejarEjercicio } from "@/lib/ejercicios/emparejar";
import {
  resolverPlan,
  calcularAporte,
  type PlanResuelto,
  type AlimentoResuelto,
} from "@/lib/alimentos/emparejar";

const TAMANO_MAXIMO_PDF = 15 * 1024 * 1024; // 15 MB

/** Tipos aceptados al subir rutina o alimentación. El .txt sirve cuando el
 * entrenador arma la rutina escribiéndola en vez de exportar un PDF. */
const TIPOS_ACEPTADOS: Record<string, { extension: string; contentType: string }> = {
  "application/pdf": { extension: "pdf", contentType: "application/pdf" },
  "text/plain": { extension: "txt", contentType: "text/plain" },
};

/** El navegador a veces manda el tipo vacío; ahí decide la extensión. */
function tipoDelArchivo(file: File) {
  if (TIPOS_ACEPTADOS[file.type]) return TIPOS_ACEPTADOS[file.type];
  if (file.name.toLowerCase().endsWith(".txt")) return TIPOS_ACEPTADOS["text/plain"];
  if (file.name.toLowerCase().endsWith(".pdf")) return TIPOS_ACEPTADOS["application/pdf"];
  return null;
}

const ERROR_TIPO = "Solo se aceptan archivos PDF o TXT.";

/** Qué tipo guardó una ruta, para poder mandárselo bien a la IA. */
function tipoDeLaRuta(storagePath: string): "application/pdf" | "text/plain" {
  return storagePath.toLowerCase().endsWith(".txt") ? "text/plain" : "application/pdf";
}

export type SubirPdfState = { error: string | null; storagePath: string | null };

export async function subirRutinaPdf(
  _prevState: SubirPdfState,
  formData: FormData
): Promise<SubirPdfState> {
  const sesion = await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();

  const alumnoId = String(formData.get("alumno_id") || "");
  const file = formData.get("archivo") as File | null;

  if (!alumnoId) return { error: "Selecciona un alumno.", storagePath: null };
  if (!file || file.size === 0) return { error: "Selecciona un archivo PDF.", storagePath: null };
  const tipo = tipoDelArchivo(file);
  if (!tipo) return { error: ERROR_TIPO, storagePath: null };
  if (file.size > TAMANO_MAXIMO_PDF) {
    return { error: "El archivo supera el tamaño máximo permitido (15 MB).", storagePath: null };
  }

  const storagePath = `${alumnoId}/rutina-${Date.now()}.${tipo.extension}`;
  const bytes = await file.arrayBuffer();

  const { error: errorSubida } = await supabase.storage
    .from("documentos")
    .upload(storagePath, bytes, { contentType: tipo.contentType });

  if (errorSubida) {
    return {
      error: "No fue posible subir el archivo. Revisa tu conexión e intenta nuevamente.",
      storagePath: null,
    };
  }

  const { error: errorDocumento } = await supabase.from("documentos").insert({
    alumno_id: alumnoId,
    tipo: "rutina",
    nombre_archivo: file.name,
    storage_path: storagePath,
    entrenador_id: sesion.userId,
  });

  if (errorDocumento) {
    return {
      error: "El archivo se subió, pero no fue posible registrarlo. Contacta soporte.",
      storagePath: null,
    };
  }

  revalidatePath(`/admin/alumnos/${alumnoId}`);
  revalidatePath("/alumno/documentos");
  return { error: null, storagePath };
}

/**
 * Sube UN solo PDF que trae la rutina y la dieta juntas — el formato con el que
 * el entrenador realmente arma las guías, en vez de partirlo en dos archivos.
 *
 * El archivo se guarda una vez en Storage y se registra DOS veces en
 * `documentos`, con tipo 'rutina' y con tipo 'alimentacion', apuntando las dos
 * filas al mismo `storage_path`. Así el alumno lo encuentra tanto buscando su
 * rutina como buscando su dieta, sin duplicar el archivo ni tocar el esquema
 * (`documentos.tipo` solo acepta esos dos valores; ver migración 0001).
 *
 * Ojo: por eso `eliminarDocumento` NO puede borrar el objeto de Storage sin
 * antes revisar que ninguna otra fila lo esté usando.
 *
 * La IA después lee este mismo PDF pero **solo extrae la rutina**
 * (`analizarRutinaPdf`): la dieta no se analiza, queda como documento para que
 * el alumno la lea. Es una sola llamada a la IA por guía.
 */
export async function subirGuiaCompleta(
  _prevState: SubirPdfState,
  formData: FormData
): Promise<SubirPdfState> {
  const sesion = await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();

  const alumnoId = String(formData.get("alumno_id") || "");
  const file = formData.get("archivo") as File | null;

  if (!alumnoId) return { error: "Selecciona un alumno.", storagePath: null };
  if (!file || file.size === 0) return { error: "Selecciona un archivo PDF.", storagePath: null };
  const tipo = tipoDelArchivo(file);
  if (!tipo) return { error: ERROR_TIPO, storagePath: null };
  if (file.size > TAMANO_MAXIMO_PDF) {
    return { error: "El archivo supera el tamaño máximo permitido (15 MB).", storagePath: null };
  }

  const storagePath = `${alumnoId}/guia-${Date.now()}.${tipo.extension}`;
  const bytes = await file.arrayBuffer();

  const { error: errorSubida } = await supabase.storage
    .from("documentos")
    .upload(storagePath, bytes, { contentType: tipo.contentType });

  if (errorSubida) {
    return {
      error: "No fue posible subir el archivo. Revisa tu conexión e intenta nuevamente.",
      storagePath: null,
    };
  }

  const filaBase = {
    alumno_id: alumnoId,
    nombre_archivo: file.name,
    storage_path: storagePath,
    entrenador_id: sesion.userId,
  };

  const { error: errorDocumento } = await supabase
    .from("documentos")
    .insert([
      { ...filaBase, tipo: "rutina" },
      { ...filaBase, tipo: "alimentacion" },
    ]);

  if (errorDocumento) {
    // Sin fila en `documentos` el archivo quedaría huérfano en Storage, sin
    // forma de verlo ni de borrarlo desde la app.
    await supabase.storage.from("documentos").remove([storagePath]);
    return {
      error: "El archivo se subió, pero no fue posible registrarlo. Intenta nuevamente.",
      storagePath: null,
    };
  }

  revalidatePath(`/admin/alumnos/${alumnoId}`);
  revalidatePath("/alumno/documentos");
  revalidatePath("/alumno/comer");
  return { error: null, storagePath };
}

export type SubirDocumentoState = {
  error: string | null;
  ok: boolean;
  /** Ruta en Storage del PDF recién subido, para poder analizarlo con IA sin
   * volver a pedirlo. */
  storagePath: string | null;
  documentoId: string | null;
};

export async function subirDocumentoAlimentacion(
  _prevState: SubirDocumentoState,
  formData: FormData
): Promise<SubirDocumentoState> {
  const sesion = await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();

  const alumnoId = String(formData.get("alumno_id") || "");
  const file = formData.get("archivo") as File | null;

  const fallo = (error: string): SubirDocumentoState => ({
    error,
    ok: false,
    storagePath: null,
    documentoId: null,
  });

  if (!alumnoId) return fallo("Selecciona un alumno.");
  if (!file || file.size === 0) return fallo("Selecciona un archivo PDF.");
  const tipo = tipoDelArchivo(file);
  if (!tipo) return fallo(ERROR_TIPO);
  if (file.size > TAMANO_MAXIMO_PDF) {
    return fallo("El archivo supera el tamaño máximo permitido (15 MB).");
  }

  const storagePath = `${alumnoId}/alimentacion-${Date.now()}.${tipo.extension}`;
  const bytes = await file.arrayBuffer();

  const { error: errorSubida } = await supabase.storage
    .from("documentos")
    .upload(storagePath, bytes, { contentType: tipo.contentType });

  if (errorSubida) {
    return fallo("No fue posible subir el archivo. Revisa tu conexión e intenta nuevamente.");
  }

  const { data: documento, error: errorDocumento } = await supabase
    .from("documentos")
    .insert({
      alumno_id: alumnoId,
      tipo: "alimentacion",
      nombre_archivo: file.name,
      storage_path: storagePath,
      entrenador_id: sesion.userId,
    })
    .select("id")
    .single();

  if (errorDocumento || !documento) {
    return fallo("El archivo se subió, pero no fue posible registrarlo. Contacta soporte.");
  }

  revalidatePath(`/admin/alumnos/${alumnoId}`);
  revalidatePath("/alumno/documentos");
  return { error: null, ok: true, storagePath, documentoId: documento.id };
}

export type AnalizarPlanState = {
  error: string | null;
  /** Plan ya cruzado contra la tabla de alimentos del gimnasio. */
  plan: PlanResuelto | null;
  /** Totales que venían escritos en el PDF, para contrastar. */
  kcalDeclarada: number | null;
  notaLectura: string | null;
};

/**
 * Lee el PDF de alimentación con IA y lo cruza con la tabla de alimentos del
 * gimnasio. Se dispara solo cuando el entrenador aprieta el botón, nunca al
 * subir: cada análisis cuesta tokens. El emparejado corre acá y no en el
 * navegador porque el catálogo tiene miles de items.
 */
export async function analizarAlimentacionPdf(storagePath: string): Promise<AnalizarPlanState> {
  await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();

  const vacio = { plan: null, kcalDeclarada: null, notaLectura: null };

  const { data: archivo, error: errorDescarga } = await supabase.storage
    .from("documentos")
    .download(storagePath);

  if (errorDescarga || !archivo) {
    return { error: "No fue posible leer el archivo subido.", ...vacio };
  }

  const base64 = Buffer.from(await archivo.arrayBuffer()).toString("base64");
  const resultado = await extraerPlanAlimentacionDesdePdf(base64, tipoDeLaRuta(storagePath));

  if (!resultado.ok) return { error: resultado.error, ...vacio };

  const catalogo = await obtenerCatalogoAlimentos(supabase);

  return {
    error: null,
    plan: resolverPlan(resultado.datos, catalogo),
    kcalDeclarada: resultado.datos.kcalDeclarada,
    notaLectura: resultado.datos.notaLectura,
  };
}

/** Recalcula una fila cuando el entrenador elige a mano otro alimento. */
export async function recalcularAlimento(
  alimentoId: string,
  cantidad: number | null
): Promise<AlimentoResuelto | null> {
  await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();

  const { data } = await supabase
    .from("alimentos")
    .select("id, nombre, categoria, porcion_base, unidad, kcal, prot, carb, grasa")
    .eq("id", alimentoId)
    .maybeSingle();

  if (!data) return null;

  const alimento = {
    id: data.id,
    nombre: data.nombre,
    categoria: data.categoria,
    porcionBase: data.porcion_base,
    unidad: data.unidad,
    kcal: data.kcal,
    prot: data.prot,
    carb: data.carb,
    grasa: data.grasa,
    medidaNombre: null,
    medidaGramos: null,
  };

  return {
    nombrePdf: data.nombre,
    cantidad,
    unidadPdf: null,
    alimentoId: alimento.id,
    nombreCatalogo: alimento.nombre,
    unidadCatalogo: alimento.unidad,
    confianza: "exacta",
    unidadDudosa: false,
    aporte: calcularAporte(alimento, cantidad),
  };
}

export type GuardarPlanState = { error: string | null; ok: boolean };

/** Lo que el entrenador confirma después de revisar: ya son los números
 * finales, calculados con la tabla de alimentos del gimnasio. */
export type PlanParaGuardar = {
  kcalObjetivo: number | null;
  protObjetivo: number | null;
  carbObjetivo: number | null;
  grasaObjetivo: number | null;
  comidas: {
    nombre: string;
    hora: string | null;
    kcal: number | null;
    descripcion: string | null;
  }[];
};

/** Publica la meta calórica revisada por el entrenador y desactiva la
 * anterior (se conservan como historial, igual que las rutinas). */
export async function guardarPlanAlimentacion(
  alumnoId: string,
  datos: PlanParaGuardar,
  documentoId: string | null
): Promise<GuardarPlanState> {
  const sesion = await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();

  if (datos.kcalObjetivo === null && datos.comidas.length === 0) {
    return { error: "No hay nada que guardar: falta la meta de calorías.", ok: false };
  }

  const entero = (n: number | null) =>
    n === null || !Number.isFinite(n) ? null : Math.max(0, Math.round(n));

  const { data: plan, error: errorPlan } = await supabase
    .from("planes_alimentacion")
    .insert({
      alumno_id: alumnoId,
      documento_id: documentoId,
      kcal_objetivo: entero(datos.kcalObjetivo),
      prot_objetivo: entero(datos.protObjetivo),
      carb_objetivo: entero(datos.carbObjetivo),
      grasa_objetivo: entero(datos.grasaObjetivo),
      created_by: sesion.userId,
    })
    .select("id")
    .single();

  if (errorPlan || !plan) {
    return { error: "No fue posible guardar la meta. Intenta nuevamente.", ok: false };
  }

  if (datos.comidas.length > 0) {
    const { error: errorComidas } = await supabase.from("plan_comidas").insert(
      datos.comidas.map((c, i) => ({
        plan_id: plan.id,
        orden: i + 1,
        nombre: c.nombre || `Comida ${i + 1}`,
        hora: c.hora || null,
        kcal: entero(c.kcal),
        descripcion: c.descripcion,
      }))
    );

    if (errorComidas) {
      await supabase.from("planes_alimentacion").delete().eq("id", plan.id);
      return { error: "No fue posible guardar las comidas del plan.", ok: false };
    }
  }

  await supabase
    .from("planes_alimentacion")
    .update({ activo: false })
    .eq("alumno_id", alumnoId)
    .eq("activo", true)
    .neq("id", plan.id);

  revalidatePath(`/admin/alumnos/${alumnoId}`);
  revalidatePath("/alumno/comer");
  revalidatePath("/alumno/inicio");
  return { error: null, ok: true };
}

export type AnalizarPdfState = {
  error: string | null;
  datos: RutinaExtraida | null;
};

export async function analizarRutinaPdf(storagePath: string): Promise<AnalizarPdfState> {
  await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();

  const { data: archivo, error: errorDescarga } = await supabase.storage
    .from("documentos")
    .download(storagePath);

  if (errorDescarga || !archivo) {
    return { error: "No fue posible leer el archivo subido.", datos: null };
  }

  const bytes = Buffer.from(await archivo.arrayBuffer());
  const base64 = bytes.toString("base64");

  const resultado = await extraerRutinaDesdePdf(base64, tipoDeLaRuta(storagePath));

  if (!resultado.ok) {
    return { error: resultado.error, datos: null };
  }

  return { error: null, datos: resultado.datos };
}

export async function eliminarDocumento(documentoId: string): Promise<{ error: string | null }> {
  await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();

  const { data: documento } = await supabase
    .from("documentos")
    .select("alumno_id, storage_path")
    .eq("id", documentoId)
    .maybeSingle();

  if (!documento) return { error: null };

  // Primero la fila, después el archivo. Al revés (como estaba antes), si el
  // DELETE fallaba quedaba una fila apuntando a un archivo que ya no existe.
  const { error } = await supabase.from("documentos").delete().eq("id", documentoId);

  if (error) {
    return { error: "No fue posible eliminar el documento. Intenta nuevamente." };
  }

  // Una guía completa se registra dos veces (rutina y alimentación) sobre el
  // MISMO archivo — ver subirGuiaCompleta. Borrar el objeto de Storage acá sin
  // mirar dejaría a la otra mitad apuntando a la nada, así que el archivo solo
  // se elimina cuando ya no queda ninguna fila usándolo.
  const { count } = await supabase
    .from("documentos")
    .select("id", { count: "exact", head: true })
    .eq("storage_path", documento.storage_path);

  if ((count ?? 0) === 0) {
    await supabase.storage.from("documentos").remove([documento.storage_path]);
  }

  revalidatePath(`/admin/alumnos/${documento.alumno_id}`);
  revalidatePath("/alumno/documentos");
  revalidatePath("/alumno/comer");
  return { error: null };
}

export type SubirAVariosState = {
  error: string | null;
  /** Ruta del primero, para analizarlo con IA una sola vez. */
  storagePath: string | null;
  /** Id del documento del primero (lo necesita el editor del plan). */
  documentoId: string | null;
  alumnoIds: string[];
  fallidos: { nombre: string; error: string }[];
};

/** ⚠️ NO exportar: este archivo lleva "use server" y desde ahí solo se pueden
 * exportar funciones asíncronas. Un objeto exportado desde acá le llega al
 * cliente como `undefined` y revienta en tiempo de ejecución, sin que tsc ni
 * el build lo detecten. El estado inicial del cliente vive en el componente. */
const estadoVariosVacio: SubirAVariosState = {
  error: null,
  storagePath: null,
  documentoId: null,
  alumnoIds: [],
  fallidos: [],
};

/** Nombres de los alumnos elegidos, para poder decir cuál falló. */
async function nombresDe(alumnoIds: string[]): Promise<Map<string, string>> {
  const supabase = await createClient();
  const { data } = await supabase.from("perfiles").select("id, nombre").in("id", alumnoIds);
  return new Map((data ?? []).map((p) => [p.id, p.nombre]));
}

/**
 * Reparte una subida a varios alumnos llamando, una vez por alumno, a la acción
 * que ya funciona para uno solo. No se copia ni se reescribe esa lógica: cada
 * alumno queda exactamente igual que si se le hubiera subido de a uno, así el
 * archivo aparece en sus Documentos sin ningún caso nuevo.
 *
 * En paralelo, porque subir es esperar a la red: en serie, cuatro alumnos
 * tardaban cuatro veces lo de uno.
 */
async function repartir<T extends { error: string | null; storagePath: string | null }>(
  alumnoIds: string[],
  file: File,
  subirParaUno: (alumnoId: string, fd: FormData) => Promise<T>,
  documentoIdDe: (r: T) => string | null = () => null
): Promise<SubirAVariosState> {
  const nombres = await nombresDe(alumnoIds);

  const resultados = await Promise.all(
    alumnoIds.map(async (alumnoId) => {
      const fd = new FormData();
      fd.set("alumno_id", alumnoId);
      fd.set("archivo", file);
      return { alumnoId, r: await subirParaUno(alumnoId, fd) };
    })
  );

  const logrados: string[] = [];
  const fallidos: SubirAVariosState["fallidos"] = [];
  let primerPath: string | null = null;
  let primerDocumento: string | null = null;

  for (const { alumnoId, r } of resultados) {
    if (r.storagePath) {
      logrados.push(alumnoId);
      primerPath ??= r.storagePath;
      primerDocumento ??= documentoIdDe(r);
    } else {
      fallidos.push({
        nombre: nombres.get(alumnoId) ?? "Alumno",
        error: r.error ?? "No fue posible subir el archivo.",
      });
    }
  }

  return {
    error: logrados.length === 0 ? "No fue posible subir el archivo a ningún alumno." : null,
    storagePath: primerPath,
    documentoId: primerDocumento,
    alumnoIds: logrados,
    fallidos,
  };
}

function validarSubida(formData: FormData): { alumnoIds: string[]; file: File } | string {
  const alumnoIds = formData.getAll("alumno_ids").map(String).filter(Boolean);
  const file = formData.get("archivo") as File | null;
  if (!alumnoIds.length) return "Elige abajo a qué alumnos les subes este archivo.";
  if (!file || file.size === 0) return "Selecciona un archivo PDF.";
  return { alumnoIds, file };
}

/** La rutina en PDF, para todos los alumnos elegidos. */
export async function subirRutinaAVariosAlumnos(
  _prevState: SubirAVariosState,
  formData: FormData
): Promise<SubirAVariosState> {
  await requireRol(["entrenador", "admin"]);
  const v = validarSubida(formData);
  if (typeof v === "string") return { ...estadoVariosVacio, error: v };

  return repartir(v.alumnoIds, v.file, (_id, fd) =>
    subirRutinaPdf({ error: null, storagePath: null }, fd)
  );
}

/** El plan de alimentación en PDF, para todos los alumnos elegidos. */
export async function subirAlimentacionAVariosAlumnos(
  _prevState: SubirAVariosState,
  formData: FormData
): Promise<SubirAVariosState> {
  await requireRol(["entrenador", "admin"]);
  const v = validarSubida(formData);
  if (typeof v === "string") return { ...estadoVariosVacio, error: v };

  return repartir(
    v.alumnoIds,
    v.file,
    (_id, fd) =>
      subirDocumentoAlimentacion(
        { error: null, ok: false, storagePath: null, documentoId: null },
        fd
      ),
    (r) => r.documentoId
  );
}

export type SubirGuiaVariosState = SubirPdfState & {
  /** Alumnos a los que quedó subida, para publicarles después la rutina que
   * la IA extraiga de este mismo PDF. */
  alumnoIds: string[];
  fallidos: { nombre: string; error: string }[];
};

/**
 * Sube la MISMA guía a varios alumnos.
 *
 * Reutiliza `subirGuiaCompleta` tal cual, llamándola una vez por alumno con su
 * propio FormData. No se toca esa función ni se copia su lógica: es la que
 * funciona bien y cada alumno termina con el archivo en su carpeta y sus filas
 * en `documentos`, exactamente igual que si se hubiera subido de a uno. Así el
 * PDF aparece en Documentos de cada alumno sin ningún caso nuevo que pueda
 * fallar en la pantalla del alumno.
 *
 * Devuelve el `storagePath` del primero para poder analizar la rutina con IA
 * una sola vez y publicarla a todos.
 */
export async function subirGuiaAVariosAlumnos(
  _prevState: SubirGuiaVariosState,
  formData: FormData
): Promise<SubirGuiaVariosState> {
  await requireRol(["entrenador", "admin"]);

  const alumnoIds = formData.getAll("alumno_ids").map(String).filter(Boolean);
  const file = formData.get("archivo") as File | null;

  const vacio: SubirGuiaVariosState = {
    error: null,
    storagePath: null,
    alumnoIds: [],
    fallidos: [],
  };

  if (!alumnoIds.length) {
    return { ...vacio, error: "Selecciona al menos un alumno." };
  }
  if (!file || file.size === 0) {
    return { ...vacio, error: "Selecciona un archivo PDF." };
  }

  const supabase = await createClient();
  const { data: perfiles } = await supabase
    .from("perfiles")
    .select("id, nombre")
    .in("id", alumnoIds);
  const nombrePorId = new Map((perfiles ?? []).map((p) => [p.id, p.nombre]));

  // En paralelo, no una tras otra. Subir es esperar a la red, no calcular: en
  // serie, cuatro alumnos tardaban cuatro veces lo de uno y parecía que la IA
  // se había vuelto lenta, cuando la IA ni siquiera había arrancado.
  // (Publicar la rutina sí va en serie, porque ahí son varios INSERT
  // encadenados que se estorban entre sí — ver publicarRutinaAVariosAlumnos.)
  const resultados = await Promise.all(
    alumnoIds.map(async (alumnoId) => {
      const fd = new FormData();
      fd.set("alumno_id", alumnoId);
      fd.set("archivo", file);
      return { alumnoId, r: await subirGuiaCompleta({ error: null, storagePath: null }, fd) };
    })
  );

  const logrados: string[] = [];
  const fallidos: SubirGuiaVariosState["fallidos"] = [];
  let primerPath: string | null = null;

  for (const { alumnoId, r } of resultados) {
    if (r.storagePath) {
      logrados.push(alumnoId);
      primerPath ??= r.storagePath;
    } else {
      fallidos.push({
        nombre: nombrePorId.get(alumnoId) ?? "Alumno",
        error: r.error ?? "No fue posible subir el archivo.",
      });
    }
  }

  return {
    error: logrados.length === 0 ? "No fue posible subir el archivo a ningún alumno." : null,
    storagePath: primerPath,
    alumnoIds: logrados,
    fallidos,
  };
}

export type PublicarRutinaState = { error: string | null; ok: boolean };

export type PublicarAVariosState = {
  /** Error que impidió publicar a TODOS (validación previa). Si es null, mirar
   * `fallidos`: puede haber salido bien para unos y mal para otros. */
  error: string | null;
  publicados: number;
  fallidos: { alumnoId: string; nombre: string; error: string }[];
};

/**
 * Publica la MISMA rutina a varios alumnos, analizada una sola vez.
 *
 * Antes, para diez alumnos había que subir el PDF diez veces y gastar diez
 * llamadas a la IA. Desde la sección Documentos el archivo se sube una vez, se
 * analiza una vez, y esta acción reparte el resultado ya revisado.
 *
 * Va alumno por alumno a propósito, en vez de en paralelo: cada publicación
 * son varios INSERT encadenados, y lanzarlas todas juntas solo lograría que se
 * estorben entre sí (ver la nota del N+1 en el HANDOFF). Si uno falla, los
 * demás siguen: se informa cuáles quedaron afuera para poder reintentar solo
 * esos, en vez de dejar la operación entera a medias sin saber dónde.
 */
export async function publicarRutinaAVariosAlumnos(
  alumnoIds: string[],
  datos: RutinaExtraida
): Promise<PublicarAVariosState> {
  const sesion = await requireRol(["entrenador", "admin"]);

  if (alumnoIds.length === 0) {
    return { error: "Elige al menos un alumno para asignarle la rutina.", publicados: 0, fallidos: [] };
  }

  // Se valida UNA vez: la rutina es la misma para todos, así que repetirlo por
  // alumno solo gasta tiempo.
  const invalida = validarRutina(datos);
  if (invalida) return { error: invalida, publicados: 0, fallidos: [] };

  const supabase = await createClient();

  // La biblioteca también se carga una sola vez, no una por alumno.
  const [biblioteca, { data: perfiles }] = await Promise.all([
    obtenerBiblioteca(),
    supabase.from("perfiles").select("id, nombre").in("id", alumnoIds),
  ]);

  const nombrePorId = new Map((perfiles ?? []).map((p) => [p.id, p.nombre]));

  let publicados = 0;
  const fallidos: PublicarAVariosState["fallidos"] = [];

  for (const alumnoId of alumnoIds) {
    const resultado = await publicarUnaRutina(
      supabase,
      sesion.userId,
      alumnoId,
      datos,
      biblioteca
    );
    if (resultado.ok) {
      publicados++;
    } else {
      fallidos.push({
        alumnoId,
        nombre: nombrePorId.get(alumnoId) ?? "Alumno",
        error: resultado.error ?? "No fue posible publicar la rutina.",
      });
    }
  }

  revalidatePath("/alumno/entrenar");
  revalidatePath("/alumno/inicio");
  return { error: null, publicados, fallidos };
}

/** Revisa la rutina antes de tocar la base. Devuelve el error o null. */
function validarRutina(datos: RutinaExtraida): string | null {
  if (!datos.dias.length) return "La rutina no tiene días para publicar.";
  for (const dia of datos.dias) {
    if (!dia.nombre.trim()) return "Todos los días necesitan un nombre.";
    if (dia.tipo === "entrenamiento" && dia.ejercicios.length === 0) {
      return `El día "${dia.nombre}" no tiene ejercicios.`;
    }
    for (const ej of dia.ejercicios) {
      if (!ej.nombre.trim()) return "Hay un ejercicio sin nombre.";
      if (!Number.isFinite(ej.series) || ej.series <= 0) {
        return `"${ej.nombre}" necesita un número de series válido.`;
      }
    }
  }
  return null;
}

type Biblioteca = Awaited<ReturnType<typeof obtenerBiblioteca>>;

/**
 * Publica la rutina para UN alumno. Recibe la biblioteca ya cargada y los
 * datos ya validados para no repetir ese trabajo cuando se publica a varios.
 *
 * Escribe en 4 consultas fijas (rutina, días, ejercicios, desactivar previas)
 * en vez de 2 por cada día. Antes, publicar a 4 alumnos una rutina de 7 días
 * eran ~70 idas y vueltas a la base y tardaba 18,7 s medidos: el botón se veía
 * congelado. Los INSERT por lotes lo dejan en unas pocas.
 */
async function publicarUnaRutina(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  alumnoId: string,
  datos: RutinaExtraida,
  biblioteca: Biblioteca
): Promise<PublicarRutinaState> {
  const { data: rutinasPrevias } = await supabase
    .from("rutinas")
    .select("id, version")
    .eq("alumno_id", alumnoId)
    .eq("activa", true);

  const siguienteVersion = 1 + Math.max(0, ...(rutinasPrevias ?? []).map((r) => r.version));

  const { data: nuevaRutina, error: errorRutina } = await supabase
    .from("rutinas")
    .insert({
      alumno_id: alumnoId,
      nombre: datos.nombreRutina || "Rutina de entrenamiento",
      activa: true,
      version: siguienteVersion,
      created_by: userId,
    })
    .select("id")
    .single();

  if (errorRutina || !nuevaRutina) {
    return { error: "No fue posible crear la rutina. Intenta nuevamente.", ok: false };
  }

  // Todos los días de una vez. `orden` es el que vincula cada fila devuelta
  // con su día del borrador, porque el orden de la respuesta no está garantizado.
  const { data: diasCreados, error: errorDias } = await supabase
    .from("rutina_dias")
    .insert(
      datos.dias.map((dia, i) => ({
        rutina_id: nuevaRutina.id,
        numero_dia: dia.numero || i + 1,
        nombre: dia.nombre,
        orden: i + 1,
        tipo: dia.tipo,
        descripcion: dia.descripcion,
      }))
    )
    .select("id, orden");

  if (errorDias || !diasCreados || diasCreados.length !== datos.dias.length) {
    return { error: "No fue posible guardar los días de la rutina.", ok: false };
  }

  const idPorOrden = new Map(diasCreados.map((d) => [d.orden, d.id]));

  // Y todos los ejercicios de todos los días, también de una vez.
  const filasEjercicios = datos.dias.flatMap((dia, i) =>
    dia.ejercicios.map((ej, idx) => {
      const emparejado = emparejarEjercicio(ej.nombre, biblioteca);
      return {
        dia_id: idPorOrden.get(i + 1)!,
        orden: idx + 1,
        nombre: ej.nombre,
        series_programadas: ej.series,
        reps_programadas: ej.reps || "10-12",
        descanso_segundos: ej.descansoSegundos,
        tecnica_tipo: ej.tecnicaTipo,
        tecnica_instruccion: ej.tecnicaInstruccion,
        observacion: ej.observacion,
        // Si la biblioteca no lo tiene clasificado, vale lo que dijo la IA.
        grupo_muscular: emparejado?.ejercicio.grupoMuscular ?? ej.grupoMuscular,
        ejercicio_id: emparejado?.ejercicio.id ?? null,
      };
    })
  );

  if (filasEjercicios.length > 0) {
    const { error: errorEjercicios } = await supabase
      .from("rutina_dia_ejercicios")
      .insert(filasEjercicios);

    if (errorEjercicios) {
      return { error: "No fue posible guardar los ejercicios de la rutina.", ok: false };
    }
  }

  if (rutinasPrevias && rutinasPrevias.length > 0) {
    await supabase
      .from("rutinas")
      .update({ activa: false })
      .in(
        "id",
        rutinasPrevias.map((r) => r.id)
      );
  }

  revalidatePath(`/admin/alumnos/${alumnoId}`);
  return { error: null, ok: true };
}

export async function confirmarYPublicarRutina(
  alumnoId: string,
  datos: RutinaExtraida
): Promise<PublicarRutinaState> {
  const sesion = await requireRol(["entrenador", "admin"]);

  const invalida = validarRutina(datos);
  if (invalida) return { error: invalida, ok: false };

  const supabase = await createClient();
  // Se resuelve cada nombre del PDF contra la biblioteca para dejar guardado
  // el `ejercicio_id`. Lo que no empareje se publica igual con su nombre —
  // ver la nota de la migración 0026: bloquear la rutina entera porque un
  // ejercicio no está en la biblioteca sería peor que publicarla incompleta.
  const biblioteca = await obtenerBiblioteca();

  const resultado = await publicarUnaRutina(supabase, sesion.userId, alumnoId, datos, biblioteca);

  revalidatePath("/alumno/entrenar");
  revalidatePath("/alumno/inicio");
  return resultado;
}
