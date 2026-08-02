"use server";

import { z } from "zod";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { nombreAlumnoPublicado } from "@/lib/nombre";
import { obtenerReportes } from "@/app/admin/alumnos/data";
import { construirReporteVip } from "@/lib/asistente/reportes";
import type { ResultadoReporteVip } from "@/lib/asistente/tipos";

export type EstadoAsistente = {
  respuesta: ResultadoReporteVip | null;
  error: string | null;
};

const SolicitudSchema = z.object({
  tipo: z.enum(["atencion", "nutricion", "entrenamiento", "progreso"]),
  busqueda: z.string().trim().max(80),
});

export async function consultarAsistenteVip(
  _estado: EstadoAsistente,
  formData: FormData
): Promise<EstadoAsistente> {
  const sesion = await requireRol(["entrenador", "admin"]);
  const resultado = SolicitudSchema.safeParse({
    tipo: String(formData.get("tipo") ?? "atencion"),
    busqueda: String(formData.get("busqueda") ?? ""),
  });
  if (!resultado.success) {
    return { respuesta: null, error: "No fue posible validar los filtros del reporte." };
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
  return {
    respuesta: construirReporteVip(resultado.data.tipo, reportes, resultado.data.busqueda),
    error: null,
  };
}
