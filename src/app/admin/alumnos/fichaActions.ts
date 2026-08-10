"use server";

import { revalidatePath } from "next/cache";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { guardarFicha } from "@/lib/perfil-alumno/datos";
import type { EstadoFicha } from "@/components/student/FichaAlumnoForm";
import type { SupabaseClient } from "@supabase/supabase-js";

/** El entrenador llenando la ficha de un alumno.
 *
 * Existe porque los alumnos contestan el cuestionario por WhatsApp o de viva
 * voz en la sala, y esa respuesta no tenía dónde entrar: el único que podía
 * escribir esta ficha era el propio alumno desde su teléfono. El resultado es
 * el mismo dato, así que el generador y el filtro de IA no distinguen quién lo
 * escribió.
 *
 * `alumnoId` va por `.bind()` desde el servidor, nunca en el formulario: si
 * viajara como campo oculto, cualquiera podría reescribir la ficha de otro. */
export async function guardarFichaDeAlumno(
  alumnoId: string,
  _estado: EstadoFicha,
  formData: FormData
): Promise<EstadoFicha> {
  await requireRol(["entrenador", "admin"]);
  if (!alumnoId) return { error: "No se pudo identificar al alumno.", ok: false };

  const supabase = await createClient();
  const resultado = await guardarFicha(supabase as unknown as SupabaseClient, alumnoId, formData);
  if (!resultado.ok) return resultado;

  revalidatePath(`/admin/alumnos/${alumnoId}`);
  revalidatePath("/admin/generador");
  return resultado;
}
