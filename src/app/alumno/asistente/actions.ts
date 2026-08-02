"use server";

import { z } from "zod";
import { requireAlumno } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { obtenerContextoAlumnoVip, responderConHistorialLocal } from "@/lib/asistente/alumno";
import { responderAlumnoVip, type RespuestaAlumnoVip } from "@/lib/ai/asistenteAlumno";

export type EstadoAsistenteAlumno = {
  respuesta: RespuestaAlumnoVip | null;
  error: string | null;
};

const PreguntaSchema = z.string().trim().min(5).max(500);

export async function preguntarAsistenteAlumno(
  _estado: EstadoAsistenteAlumno,
  formData: FormData
): Promise<EstadoAsistenteAlumno> {
  const sesion = await requireAlumno();
  if (sesion.soloLectura) return { respuesta: null, error: "Sal del modo entrenador para usar el asistente personal." };
  const pregunta = PreguntaSchema.safeParse(String(formData.get("pregunta") ?? ""));
  if (!pregunta.success) return { respuesta: null, error: "Escribe una pregunta breve y concreta." };

  const supabase = await createClient();
  const contexto = await obtenerContextoAlumnoVip(supabase, sesion.alumnoId);
  const respuestaLocal = responderConHistorialLocal(pregunta.data, contexto);
  if (respuestaLocal) {
    return { respuesta: { texto: respuestaLocal, aviso: null, costoUsd: 0 }, error: null };
  }
  return responderAlumnoVip(sesion.alumnoId, pregunta.data, contexto);
}
