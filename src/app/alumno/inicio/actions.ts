"use server";

import { revalidatePath, updateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAlumno } from "@/lib/auth";
import { TAG_RANKING } from "@/lib/ranking/data";
import { hoyISO } from "@/lib/date";

export type GuardarSeguimientoState = { error: string | null; guardado: boolean; puntos?: number };

export async function guardarSeguimiento(
  _prevState: GuardarSeguimientoState,
  formData: FormData
): Promise<GuardarSeguimientoState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Tu sesión expiró. Vuelve a iniciar sesión.", guardado: false };

  const entrenoHoy = formData.get("entreno_hoy");
  const cumplioAlimentacion = formData.get("cumplio_alimentacion");
  const aguaLitros = formData.get("agua_litros");
  const horasSueno = formData.get("horas_sueno");
  const energia = formData.get("energia");
  const molestias = String(formData.get("molestias") || "").trim();
  const comentario = String(formData.get("comentario") || "").trim();

  const { error } = await supabase.from("seguimientos_diarios").upsert(
    {
      alumno_id: user.id,
      fecha: hoyISO(),
      entreno_hoy: entrenoHoy === null ? null : entrenoHoy === "true",
      cumplio_alimentacion: cumplioAlimentacion === null ? null : cumplioAlimentacion === "true",
      agua_litros: aguaLitros ? Number(aguaLitros) : null,
      horas_sueno: horasSueno ? Number(horasSueno) : null,
      energia: energia ? Number(energia) : null,
      molestias: molestias || null,
      comentario: comentario || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "alumno_id,fecha" }
  );

  if (error) {
    return {
      error: "No fue posible guardar tu seguimiento. Revisa tu conexión e intenta nuevamente.",
      guardado: false,
    };
  }

  updateTag(TAG_RANKING);
  revalidatePath("/alumno/inicio");
  return { error: null, guardado: true };
}

/** Aceptar o rechazar una invitación a un torneo. Usa siempre el ID del
 * alumno de la SESIÓN (no lo que venga en el formulario) para que nadie
 * pueda responder invitaciones ajenas. */
export async function responderInvitacionTorneo(formData: FormData): Promise<void> {
  const { alumnoId, soloLectura } = await requireAlumno();
  if (soloLectura) return;

  const torneoId = String(formData.get("torneo_id") || "");
  const decision = String(formData.get("decision") || "");
  if (!torneoId || (decision !== "aceptado" && decision !== "rechazado")) return;

  const admin = createAdminClient();
  await admin
    .from("torneo_participantes")
    .update({ estado: decision })
    .eq("torneo_id", torneoId)
    .eq("alumno_id", alumnoId);

  revalidatePath("/alumno/inicio");
  revalidatePath("/alumno/ranked");
  revalidatePath("/admin/torneos");
}
