"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAlumno } from "@/lib/auth";

export type EnviarResenaState = { error: string | null; ok: boolean };

/** Reseña de la app: estrellas obligatorias, sugerencia libre opcional. Se
 * puede mandar más de una vez — no hay "ya opinaste" que bloquee. */
export async function enviarResenaApp(
  _prevState: EnviarResenaState,
  formData: FormData
): Promise<EnviarResenaState> {
  const { alumnoId, soloLectura } = await requireAlumno();
  if (soloLectura) {
    return { error: "Estás viendo la cuenta de un alumno en modo lectura.", ok: false };
  }

  const estrellas = Number(formData.get("estrellas"));
  const sugerencia = String(formData.get("sugerencia") || "").trim();
  const ruta = String(formData.get("ruta") || "").trim().slice(0, 300);

  if (!Number.isInteger(estrellas) || estrellas < 1 || estrellas > 5) {
    return { error: "Elegí una puntuación de 1 a 5 estrellas.", ok: false };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("resenas_app").insert({
    alumno_id: alumnoId,
    estrellas,
    sugerencia: sugerencia ? sugerencia.slice(0, 2000) : null,
    ruta: ruta || "/alumno/perfil",
  });

  if (error) {
    return { error: "No pudimos enviar tu reseña. Revisá tu conexión e intentá de nuevo.", ok: false };
  }

  revalidatePath("/admin/resenas");
  return { error: null, ok: true };
}
