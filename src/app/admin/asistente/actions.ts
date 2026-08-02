"use server";

import { z } from "zod";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { nombreAlumnoPublicado } from "@/lib/nombre";
import { obtenerReportes } from "@/app/admin/alumnos/data";
import { construirReporteVip } from "@/lib/asistente/reportes";
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
