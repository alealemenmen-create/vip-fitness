"use server";

import { revalidatePath } from "next/cache";
import { revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { TAG_RANKING } from "@/lib/ranking/data";
import { eliminarMovimientosDeSesiones } from "@/lib/ranking/movimientos";

export type ResolverBorradoState = { error: string | null; ok: boolean };

/**
 * El entrenador aprueba el pedido y borra el registro de verdad.
 *
 * Borrar destruye historial sin vuelta atrás, así que la decisión es del
 * entrenador y no del alumno (ver `solicitarBorradoSesion`). Acá se hace todo
 * lo que el borrado arrastra:
 *
 * - La sesión y, en cascada, sus ejercicios, sus series y sus recomendaciones
 *   de Impulso VIP (migraciones 0001 y 0043).
 * - Los Puntos VIP, que viven en `puntos_vip_movimientos` indexados por clave
 *   y no por clave foránea: no se van solos, hay que borrarlos.
 * - El número de calendario queda libre, así que el alumno puede volver a
 *   hacer esa sesión. Es el objetivo: la marcó hecha sin querer, se borra y la
 *   hace de nuevo.
 *
 * La solicitud NO se borra: queda como constancia de qué se borró, quién lo
 * pidió y quién lo aprobó.
 */
export async function aprobarBorradoSesion(
  _prevState: ResolverBorradoState,
  formData: FormData
): Promise<ResolverBorradoState> {
  const sesion = await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) return { error: "Falta la solicitud.", ok: false };

  const supabase = await createClient();
  const { data: solicitud } = await supabase
    .from("solicitudes_borrado_sesion")
    .select("id, alumno_id, sesion_id, estado")
    .eq("id", id)
    .maybeSingle();

  if (!solicitud) return { error: "No se encontró la solicitud.", ok: false };
  if (solicitud.estado !== "pendiente") return { error: "Esa solicitud ya estaba resuelta.", ok: false };

  if (solicitud.sesion_id) {
    /**
     * La sesión primero, los puntos después.
     *
     * Estaba al revés, con el argumento de que unos puntos de menos eran
     * mejores que unos puntos huérfanos, "porque se recalculan al volver a
     * cerrar la sesión". No se recalculan: una sesión ya cerrada no se vuelve
     * a cerrar nunca. Así que si el `delete` fallaba —que era justo el caso
     * que ese código estaba previendo— el alumno se quedaba sin los puntos de
     * una sesión que seguía existiendo en su historial, sin aviso para nadie y
     * sin forma de recuperarlos salvo a mano contra la base.
     *
     * En este orden, el fallo probable (una clave foránea que bloquea el
     * borrado) no toca nada: la solicitud sigue pendiente y se puede
     * reintentar. Y si lo que falla es el borrado de los puntos, quedan
     * huérfanos pero recuperables — `eliminarMovimientosDeSesiones` borra por
     * clave, así que reintentar la aprobación los limpia.
     */
    const admin = createAdminClient();
    const { error } = await admin
      .from("sesiones_entrenamiento")
      .delete()
      .eq("id", solicitud.sesion_id)
      .eq("alumno_id", solicitud.alumno_id);

    if (error) return { error: "No se pudo borrar el registro. Falta correr la migración 0075.", ok: false };

    await eliminarMovimientosDeSesiones(solicitud.alumno_id, [solicitud.sesion_id]);
  }

  await supabase
    .from("solicitudes_borrado_sesion")
    .update({ estado: "borrada", resuelto_en: new Date().toISOString(), resuelto_por: sesion.userId })
    .eq("id", id);

  revalidateTag(TAG_RANKING, { expire: 0 });
  revalidatePath("/admin/borrados");
  return { error: null, ok: true };
}

/** Rechaza el pedido. La sesión queda intacta y el alumno la sigue viendo. */
export async function rechazarBorradoSesion(
  _prevState: ResolverBorradoState,
  formData: FormData
): Promise<ResolverBorradoState> {
  const sesion = await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) return { error: "Falta la solicitud.", ok: false };

  const supabase = await createClient();
  const { error } = await supabase
    .from("solicitudes_borrado_sesion")
    .update({ estado: "rechazada", resuelto_en: new Date().toISOString(), resuelto_por: sesion.userId })
    .eq("id", id)
    .eq("estado", "pendiente");

  if (error) return { error: "No se pudo actualizar la solicitud.", ok: false };

  revalidatePath("/admin/borrados");
  return { error: null, ok: true };
}
