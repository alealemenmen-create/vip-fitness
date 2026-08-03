"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { nombreAlumnoPublicado } from "@/lib/nombre";
import { obtenerReportes } from "@/app/admin/alumnos/data";
import type { FormState } from "@/app/admin/alumnos/actions";
import { construirReporteVip } from "@/lib/asistente/reportes";
import { borrarDatosCategoria } from "@/lib/asistente/eliminacion";
import type { ResultadoReporteVip } from "@/lib/asistente/tipos";
import type { RespuestaIaVip } from "@/lib/asistente/tipos";
import { consultarConHerramientasVip } from "@/lib/ai/asistenteConsultas";

export type EstadoAsistente = {
  respuesta: ResultadoReporteVip | null;
  respuestaIA: RespuestaIaVip | null;
  error: string | null;
};

const SolicitudSchema = z.object({
  tipo: z.enum(["atencion", "nutricion", "entrenamiento", "progreso"]),
  busqueda: z.string().trim().max(80),
});

const PreguntaSchema = z.string().trim().min(5).max(500);

export async function consultarAsistenteVip(
  _estado: EstadoAsistente,
  formData: FormData
): Promise<EstadoAsistente> {
  const sesion = await requireRol(["entrenador", "admin"]);
  const modo = String(formData.get("modo") ?? "reporte");
  const resultado = SolicitudSchema.safeParse({
    tipo: String(formData.get("tipo") ?? "atencion"),
    busqueda: String(formData.get("busqueda") ?? ""),
  });
  if (!resultado.success) {
    return { respuesta: null, respuestaIA: null, error: "No fue posible validar los filtros del reporte." };
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("alumno_perfil")
    .select("user_id, objetivo, perfiles!alumno_perfil_user_id_fkey(nombre, rol)");

  const alumnos = (data ?? [])
    .filter((fila) => {
      const rol = (fila.perfiles as unknown as { rol: string } | null)?.rol;
      return rol === "alumno" || fila.user_id === sesion.userId;
    })
    .map((fila) => ({
      id: fila.user_id,
      nombre: nombreAlumnoPublicado(
        (fila.perfiles as unknown as { nombre: string } | null)?.nombre ?? "Alumno"
      ),
      objetivo: fila.objetivo,
    }));

  const reportes = await obtenerReportes(supabase, alumnos);
  if (modo === "ia") {
    const pregunta = PreguntaSchema.safeParse(String(formData.get("pregunta") ?? ""));
    if (!pregunta.success) {
      return { respuesta: null, respuestaIA: null, error: "Escribe una pregunta breve y concreta." };
    }
    const consulta = await consultarConHerramientasVip({
      solicitud: pregunta.data,
      usuarioId: sesion.userId,
      supabase,
      reportes,
    });
    return { respuesta: consulta.reporte, respuestaIA: consulta.respuesta, error: consulta.error };
  }
  return {
    respuesta: construirReporteVip(resultado.data.tipo, reportes, resultado.data.busqueda),
    respuestaIA: null,
    error: null,
  };
}

/**
 * El paso humano que la IA nunca puede dar sola: relee la solicitud
 * `pendiente` de `solicitudes_eliminacion_datos` (la fuente de verdad es esa
 * fila, no nada que llegue del cliente) y recién ahí ejecuta el borrado real.
 * Mismo `FormState` que `eliminarAlumno` para poder reusar
 * `EliminarPerfilBoton` tal cual — la confirmación en dos pasos que ya usa
 * la app para su acción más destructiva.
 */
export async function confirmarEliminacionDatos(_prevState: FormState, formData: FormData): Promise<FormState> {
  const sesion = await requireRol(["entrenador", "admin"]);
  const solicitudId = String(formData.get("solicitud_id") || "");
  if (!solicitudId) return { error: "Falta la solicitud.", ok: false };

  const admin = createAdminClient();
  const { data: solicitud } = await admin
    .from("solicitudes_eliminacion_datos")
    .select("id, alumno_id, categoria, estado")
    .eq("id", solicitudId)
    .maybeSingle();

  if (!solicitud) return { error: "No se encontró la solicitud de borrado.", ok: false };
  if (solicitud.estado !== "pendiente") {
    return { error: "Esta solicitud ya fue confirmada o cancelada.", ok: false };
  }

  // Se reclama la solicitud ANTES de borrar (update condicionado a que siga
  // `pendiente`, igual que `cancelarEliminacionDatos`): si dos confirmaciones
  // llegan casi juntas, la segunda no encuentra fila que actualizar y no
  // ejecuta `borrarDatosCategoria` una segunda vez.
  const { data: reclamada } = await admin
    .from("solicitudes_eliminacion_datos")
    .update({ estado: "confirmado", confirmado_por: sesion.userId, confirmado_en: new Date().toISOString() })
    .eq("id", solicitudId)
    .eq("estado", "pendiente")
    .select("id")
    .maybeSingle();

  if (!reclamada) {
    return { error: "Esta solicitud ya fue confirmada o cancelada.", ok: false };
  }

  await borrarDatosCategoria(admin, solicitud.alumno_id, solicitud.categoria);

  revalidatePath(`/admin/alumnos/${solicitud.alumno_id}`);
  revalidatePath("/admin/asistente");
  return { error: null, ok: true };
}

/** Descarta la propuesta sin borrar nada — queda igual en la tabla como
 * auditoría, solo cambia de estado. */
export async function cancelarEliminacionDatos(_prevState: FormState, formData: FormData): Promise<FormState> {
  await requireRol(["entrenador", "admin"]);
  const solicitudId = String(formData.get("solicitud_id") || "");
  if (!solicitudId) return { error: "Falta la solicitud.", ok: false };

  const admin = createAdminClient();
  await admin
    .from("solicitudes_eliminacion_datos")
    .update({ estado: "cancelado" })
    .eq("id", solicitudId)
    .eq("estado", "pendiente");

  revalidatePath("/admin/asistente");
  return { error: null, ok: true };
}
