"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/auth";
import { detectarMedidaAlimento, type ResultadoDeteccion } from "@/lib/ai/detectarMedidaAlimento";

export type FormState = { error: string | null; ok: boolean };
const okState: FormState = { error: null, ok: true };

function fail(mensaje: string): FormState {
  return { error: mensaje, ok: false };
}

export async function guardarAlimento(_prevState: FormState, formData: FormData): Promise<FormState> {
  await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();

  const alimentoId = String(formData.get("alimento_id") || "");
  const nombre = String(formData.get("nombre") || "").trim();
  const categoria = String(formData.get("categoria") || "").trim();
  const porcionBase = Number(formData.get("porcion_base") || 100);
  const unidad = String(formData.get("unidad") || "g").trim();
  const kcal = Number(formData.get("kcal") || 0);
  const prot = Number(formData.get("prot") || 0);
  const carb = Number(formData.get("carb") || 0);
  const grasa = Number(formData.get("grasa") || 0);

  if (!nombre) return fail("Ingresa el nombre del alimento.");
  if (porcionBase <= 0) return fail("La porción base debe ser mayor a cero.");
  if (kcal < 0 || prot < 0 || carb < 0 || grasa < 0) return fail("Los valores nutricionales no pueden ser negativos.");

  const payload = { nombre, categoria: categoria || null, porcion_base: porcionBase, unidad, kcal, prot, carb, grasa };

  const { error } = alimentoId
    ? await supabase.from("alimentos").update(payload).eq("id", alimentoId)
    : await supabase.from("alimentos").insert(payload);

  if (error) return fail("No fue posible guardar el alimento. Revisa tu conexión e intenta nuevamente.");

  revalidatePath("/admin/alimentos");
  return okState;
}

/** El entrenador escribe el nombre del alimento y aprieta "Detectar con IA":
 * sugiere si se mide en gramos, mililitros, unidades, etc. sin tener que
 * adivinarlo a mano. Se dispara solo con el clic, nunca automático. */
export async function sugerirMedidaAlimento(
  nombre: string,
  categoria: string
): Promise<ResultadoDeteccion> {
  await requireRol(["entrenador", "admin"]);
  return detectarMedidaAlimento(nombre, categoria || null);
}

export async function alternarActivoAlimento(alimentoId: string, activo: boolean): Promise<void> {
  await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();
  await supabase.from("alimentos").update({ activo }).eq("id", alimentoId);
  revalidatePath("/admin/alimentos");
}
