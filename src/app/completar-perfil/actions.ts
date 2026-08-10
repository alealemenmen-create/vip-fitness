"use server";

import { revalidatePath } from "next/cache";
import { requireAlumno } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { guardarFicha } from "@/lib/perfil-alumno/datos";
import type { EstadoFicha } from "@/components/student/FichaAlumnoForm";
import type { SupabaseClient } from "@supabase/supabase-js";

/** El alumno guardando su propia ficha, desde el cuestionario de ingreso o
 * desde "Mi entrenamiento". La misma validación en los dos casos. */
export async function guardarMiFicha(_estado: EstadoFicha, formData: FormData): Promise<EstadoFicha> {
  const { alumnoId, soloLectura } = await requireAlumno();
  if (soloLectura) return { error: "Estás viendo este perfil en modo solo lectura.", ok: false };

  const supabase = await createClient();
  const resultado = await guardarFicha(supabase as unknown as SupabaseClient, alumnoId, formData);
  if (!resultado.ok) return resultado;

  revalidatePath("/alumno", "layout");
  revalidatePath("/admin/generador");
  return resultado;
}
