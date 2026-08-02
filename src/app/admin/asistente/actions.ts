"use server";

import { z } from "zod";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { nombreAlumnoPublicado } from "@/lib/nombre";
import { obtenerReportes } from "@/app/admin/alumnos/data";
import { obtenerRanking } from "@/lib/ranking/data";
import {
  generarRespuestaAsistente,
  type RespuestaAsistenteVip,
} from "@/lib/ai/asistenteVip";

export type EstadoAsistente = {
  respuesta: RespuestaAsistenteVip | null;
  error: string | null;
};

const SolicitudSchema = z.string().trim().min(3).max(500);

export async function consultarAsistenteVip(
  _estado: EstadoAsistente,
  formData: FormData
): Promise<EstadoAsistente> {
  const sesion = await requireRol(["entrenador", "admin"]);
  const resultado = SolicitudSchema.safeParse(String(formData.get("solicitud") ?? ""));
  if (!resultado.success) {
    return { respuesta: null, error: "Escribe una solicitud breve y concreta." };
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

  const [reportes, ranking] = await Promise.all([
    obtenerReportes(supabase, alumnos),
    obtenerRanking("semana"),
  ]);

  const respuesta = await generarRespuestaAsistente(resultado.data, reportes, ranking);
  return { respuesta, error: respuesta.ok ? null : respuesta.resumen };
}
