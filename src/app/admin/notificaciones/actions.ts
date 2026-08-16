"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/auth";

/** Marca como leídas todas las notificaciones pendientes al abrir la
 * bandeja — mismo criterio que `marcarNoticiasVistas` del lado alumno. */
export async function marcarNotificacionesLeidas(): Promise<void> {
  await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();
  await supabase
    .from("notificaciones_entrenador")
    .update({ leida_en: new Date().toISOString() })
    .is("leida_en", null);
  revalidatePath("/admin/notificaciones");
}
