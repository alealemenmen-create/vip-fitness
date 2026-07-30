"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/auth";
import { extraerRutinaDesdePdf, type RutinaExtraida } from "@/lib/ai/extraerRutina";
import { extraerPlanAlimentacionDesdePdf } from "@/lib/ai/extraerPlanAlimentacion";
import { obtenerCatalogoAlimentos } from "@/app/alumno/comer/data";
import {
  resolverPlan,
  calcularAporte,
  type PlanResuelto,
  type AlimentoResuelto,
} from "@/lib/alimentos/emparejar";

const TAMANO_MAXIMO_PDF = 15 * 1024 * 1024; // 15 MB

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
  if (file.type !== "application/pdf") {
    return { error: "Solo se aceptan archivos PDF.", storagePath: null };
  }
  if (file.size > TAMANO_MAXIMO_PDF) {
    return { error: "El archivo supera el tamaño máximo permitido (15 MB).", storagePath: null };
  }

  const storagePath = `${alumnoId}/rutina-${Date.now()}.pdf`;
  const bytes = await file.arrayBuffer();

  const { error: errorSubida } = await supabase.storage
    .from("documentos")
    .upload(storagePath, bytes, { contentType: "application/pdf" });

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
  if (file.type !== "application/pdf") return fallo("Solo se aceptan archivos PDF.");
  if (file.size > TAMANO_MAXIMO_PDF) {
    return fallo("El archivo supera el tamaño máximo permitido (15 MB).");
  }

  const storagePath = `${alumnoId}/alimentacion-${Date.now()}.pdf`;
  const bytes = await file.arrayBuffer();

  const { error: errorSubida } = await supabase.storage
    .from("documentos")
    .upload(storagePath, bytes, { contentType: "application/pdf" });

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
  const resultado = await extraerPlanAlimentacionDesdePdf(base64);

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

  const resultado = await extraerRutinaDesdePdf(base64);

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

  await supabase.storage.from("documentos").remove([documento.storage_path]);

  const { error } = await supabase.from("documentos").delete().eq("id", documentoId);

  if (error) {
    return { error: "No fue posible eliminar el documento. Intenta nuevamente." };
  }

  revalidatePath(`/admin/alumnos/${documento.alumno_id}`);
  revalidatePath("/alumno/documentos");
  return { error: null };
}

export type PublicarRutinaState = { error: string | null; ok: boolean };

export async function confirmarYPublicarRutina(
  alumnoId: string,
  datos: RutinaExtraida
): Promise<PublicarRutinaState> {
  const sesion = await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();

  if (!datos.dias.length) {
    return { error: "La rutina no tiene días para publicar.", ok: false };
  }
  for (const dia of datos.dias) {
    if (!dia.nombre.trim()) return { error: "Todos los días necesitan un nombre.", ok: false };
    if (dia.tipo === "entrenamiento" && dia.ejercicios.length === 0) {
      return { error: `El día "${dia.nombre}" no tiene ejercicios.`, ok: false };
    }
    for (const ej of dia.ejercicios) {
      if (!ej.nombre.trim()) return { error: "Hay un ejercicio sin nombre.", ok: false };
      if (!Number.isFinite(ej.series) || ej.series <= 0) {
        return { error: `"${ej.nombre}" necesita un número de series válido.`, ok: false };
      }
    }
  }

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
      created_by: sesion.userId,
    })
    .select("id")
    .single();

  if (errorRutina || !nuevaRutina) {
    return { error: "No fue posible crear la rutina. Intenta nuevamente.", ok: false };
  }

  for (let i = 0; i < datos.dias.length; i++) {
    const dia = datos.dias[i];
    const { data: nuevoDia, error: errorDia } = await supabase
      .from("rutina_dias")
      .insert({
        rutina_id: nuevaRutina.id,
        numero_dia: dia.numero || i + 1,
        nombre: dia.nombre,
        orden: i + 1,
        tipo: dia.tipo,
        descripcion: dia.descripcion,
      })
      .select("id")
      .single();

    if (errorDia || !nuevoDia) {
      return { error: "No fue posible guardar los días de la rutina.", ok: false };
    }

    if (dia.ejercicios.length > 0) {
      const { error: errorEjercicios } = await supabase.from("rutina_dia_ejercicios").insert(
        dia.ejercicios.map((ej, idx) => ({
          dia_id: nuevoDia.id,
          orden: idx + 1,
          nombre: ej.nombre,
          series_programadas: ej.series,
          reps_programadas: ej.reps || "10-12",
          descanso_segundos: ej.descansoSegundos,
          tecnica_tipo: ej.tecnicaTipo,
          tecnica_instruccion: ej.tecnicaInstruccion,
          observacion: ej.observacion,
          grupo_muscular: ej.grupoMuscular,
        }))
      );

      if (errorEjercicios) {
        return { error: "No fue posible guardar los ejercicios de la rutina.", ok: false };
      }
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
  revalidatePath("/alumno/entrenar");
  revalidatePath("/alumno/inicio");
  return { error: null, ok: true };
}
