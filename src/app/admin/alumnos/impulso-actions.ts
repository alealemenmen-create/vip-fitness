"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/auth";

/** Marca una alerta de Impulso VIP como resuelta — no la borra, queda en el
 * historial de la ficha del alumno con su estado nuevo. RLS ya limita esto a
 * `es_entrenador_de(alumno_id)`, acá solo se valida el rol de la sesión. */
export async function resolverAlertaImpulso(formData: FormData): Promise<void> {
  const sesion = await requireRol(["entrenador", "admin"]);
  const alertaId = String(formData.get("alerta_id") || "");
  const alumnoId = String(formData.get("alumno_id") || "");
  if (!alertaId) return;

  const supabase = await createClient();
  await supabase
    .from("impulso_vip_alertas")
    .update({ estado: "resuelta", resuelto_en: new Date().toISOString(), resuelto_por: sesion.userId })
    .eq("id", alertaId);

  if (alumnoId) revalidatePath(`/admin/alumnos/${alumnoId}`);
}
