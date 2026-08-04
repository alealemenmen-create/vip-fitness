"use server";

import { revalidatePath } from "next/cache";
import { requireAlumno } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export type FormState = { error: string | null; ok: boolean };
const okState: FormState = { error: null, ok: true };

function fail(mensaje: string): FormState {
  return { error: mensaje, ok: false };
}

/**
 * El alumno carga su propia meta nutricional (los mismos 4 números que hoy
 * carga el entrenador desde `guardarMacrosVariosAlumnos`), sin pasar por PDF
 * ni por el entrenador. Mismo destino final: una fila en `planes_alimentacion`
 * marcada `activo`, que es de ahí de donde ya lee Nutrición.
 *
 * `createAdminClient()` y no el cliente de sesión: la política de escritura de
 * `planes_alimentacion` (migración 0012) solo deja escribir a
 * `es_admin_o_entrenador()`. Acá el alumno solo puede tocar SU PROPIA fila
 * (`alumnoId` sale de `requireAlumno()`, no de un campo del formulario), así
 * que saltar la RLS es seguro — el control de acceso ya lo hizo `requireAlumno`.
 */
export async function guardarMisMacros(_prevState: FormState, formData: FormData): Promise<FormState> {
  const { alumnoId, soloLectura } = await requireAlumno();
  if (soloLectura) return fail("No podés editar esto en modo solo lectura.");

  const entero = (texto: FormDataEntryValue | null) => {
    const s = String(texto ?? "").trim();
    if (s === "") return null;
    const n = Number(s);
    return Number.isFinite(n) ? Math.max(0, Math.round(n)) : null;
  };

  const kcalObjetivo = entero(formData.get("kcal_objetivo"));
  const protObjetivo = entero(formData.get("prot_objetivo"));
  const carbObjetivo = entero(formData.get("carb_objetivo"));
  const grasaObjetivo = entero(formData.get("grasa_objetivo"));

  if (kcalObjetivo === null) return fail("Falta la meta de calorías.");

  const supabase = createAdminClient();

  const { data: plan, error: errorPlan } = await supabase
    .from("planes_alimentacion")
    .insert({
      alumno_id: alumnoId,
      documento_id: null,
      kcal_objetivo: kcalObjetivo,
      prot_objetivo: protObjetivo,
      carb_objetivo: carbObjetivo,
      grasa_objetivo: grasaObjetivo,
      created_by: alumnoId,
    })
    .select("id")
    .single();

  if (errorPlan || !plan) return fail("No fue posible guardar. Intenta nuevamente.");

  await supabase
    .from("planes_alimentacion")
    .update({ activo: false })
    .eq("alumno_id", alumnoId)
    .eq("activo", true)
    .neq("id", plan.id);

  revalidatePath("/alumno/macros");
  revalidatePath("/alumno/comer");
  revalidatePath("/alumno/inicio");
  return okState;
}
