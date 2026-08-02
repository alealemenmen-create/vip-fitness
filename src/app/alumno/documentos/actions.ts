"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAlumno } from "@/lib/auth";

export type AccionState = { error: string | null; ok: boolean };

/**
 * El alumno quita un plan de su propia lista ("Mis planes"). Solo borra SU
 * asignación en `documento_asignaciones` — el archivo y las asignaciones de
 * otros alumnos quedan intactos, porque el mismo PDF puede estar repartido a
 * varios (ver comentario en admin/documentos/actions.ts).
 *
 * `alumnoId` sale de `requireAlumno()`, nunca del cliente: así no hay forma de
 * mandar el id de otro alumno en el FormData. Si un entrenador está viendo el
 * portal de otro alumno (`soloLectura`), no puede borrar nada desde acá.
 */
export async function eliminarMiDocumento(
  _prevState: AccionState,
  formData: FormData
): Promise<AccionState> {
  const { alumnoId, soloLectura } = await requireAlumno();
  if (soloLectura) return { error: "No puedes borrar documentos desde esta vista.", ok: false };

  const documentoId = String(formData.get("documento_id") || "");
  if (!documentoId) return { error: "Falta el documento.", ok: false };

  const supabase = await createClient();
  const { error } = await supabase
    .from("documento_asignaciones")
    .delete()
    .eq("documento_id", documentoId)
    .eq("alumno_id", alumnoId);

  if (error) return { error: "No fue posible quitar el plan.", ok: false };

  revalidatePath("/alumno/documentos");
  return { error: null, ok: true };
}
