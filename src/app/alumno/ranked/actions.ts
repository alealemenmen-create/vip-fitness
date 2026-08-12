"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAlumno } from "@/lib/auth";
import { TAG_RANKING } from "@/lib/ranking/data";
import { validarApuesta } from "@/lib/torneos/apuestas";
import { apuestasAbiertas, obtenerSaldoVip } from "@/lib/torneos/apuestas-data";

export type ApostarState = { error: string | null; ok: boolean };

function fail(mensaje: string): ApostarState {
  return { error: mensaje, ok: false };
}

/**
 * El alumno apuesta por un competidor de un torneo abierto.
 *
 * Todo se vuelve a verificar en el servidor aunque el formulario ya lo haya
 * comprobado: acá se mueven Puntos VIP que el alumno ganó entrenando, y el
 * formulario es solo una sugerencia de lo que el navegador dice querer.
 *
 * El `alumnoId` sale SIEMPRE de la sesión, nunca del formulario — si no,
 * cualquiera podría apostar el saldo de otro.
 */
export async function apostarEnTorneo(
  _prevState: ApostarState,
  formData: FormData
): Promise<ApostarState> {
  const { alumnoId, soloLectura } = await requireAlumno();
  if (soloLectura) {
    return fail("Estás viendo la cuenta de un alumno en modo lectura. No puedes apostar desde aquí.");
  }

  const torneoId = String(formData.get("torneo_id") || "");
  const porAlumnoId = String(formData.get("por_alumno_id") || "");
  const puntos = Number(formData.get("puntos"));
  if (!torneoId || !porAlumnoId) return fail("Falta elegir por quién apuestas.");

  const admin = createAdminClient();
  const { data: torneo } = await admin
    .from("torneos")
    .select("id, nombre, cerrado, fecha_inicio")
    .eq("id", torneoId)
    .maybeSingle();
  if (!torneo) return fail("Esta competencia ya no existe.");

  const { data: participantes } = await admin
    .from("torneo_participantes")
    .select("alumno_id, estado")
    .eq("torneo_id", torneoId);

  // Solo se puede apostar por quien ACEPTÓ competir: un pendiente puede
  // rechazar mañana y esa apuesta quedaría apuntando a nadie.
  const aceptados = (participantes ?? []).filter((p) => p.estado === "aceptado").map((p) => p.alumno_id);
  const invitados = (participantes ?? []).map((p) => p.alumno_id);
  if (!aceptados.includes(porAlumnoId)) {
    return fail("Ese alumno todavía no confirmó que compite.");
  }

  const { data: yaApostada } = await admin
    .from("torneo_apuestas")
    .select("id")
    .eq("torneo_id", torneoId)
    .eq("alumno_id", alumnoId)
    .maybeSingle();

  const saldo = await obtenerSaldoVip(alumnoId);
  // `invitados` y no `aceptados`: un invitado que todavía no responde sigue
  // pudiendo aceptar, y si mientras tanto apostó tendría motivo para perder.
  const validacion = validarApuesta({
    alumnoId,
    participantes: invitados,
    saldoDisponible: saldo,
    puntos,
    yaAposto: Boolean(yaApostada),
    apuestasAbiertas: apuestasAbiertas(torneo),
  });
  if (!validacion.ok) return fail(validacion.motivo);

  const { data: apuesta, error: errorApuesta } = await admin
    .from("torneo_apuestas")
    .insert({ torneo_id: torneoId, alumno_id: alumnoId, por_alumno_id: porAlumnoId, puntos })
    .select("id")
    .single();
  // El índice único (torneo_id, alumno_id) es la última defensa contra dos
  // envíos simultáneos del mismo formulario: si el segundo choca, no se
  // descuenta nada.
  if (errorApuesta || !apuesta) {
    return fail("No se pudo registrar tu apuesta. Puede que ya tengas una en esta competencia.");
  }

  const { error: errorDescuento } = await admin.from("puntos_vip_movimientos").upsert(
    {
      alumno_id: alumnoId,
      clave: `apuesta:${torneoId}`,
      categoria: "competencia" as const,
      puntos: -puntos,
      titulo: `Arena VIP · apuesta en ${torneo.nombre}`,
      detalle: `Arriesgaste ${puntos} Puntos VIP`,
      metadata: { torneoId, apostado: puntos, porAlumnoId },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "alumno_id,clave" }
  );
  if (errorDescuento) {
    // Sin descuento no hay apuesta: se deshace para no dejar al alumno con una
    // apuesta gratis que después cobraría.
    await admin.from("torneo_apuestas").delete().eq("id", apuesta.id);
    return fail("No se pudo descontar tu apuesta. Intenta nuevamente.");
  }

  revalidateTag(TAG_RANKING, { expire: 0 });
  revalidatePath("/alumno/ranked");
  revalidatePath("/alumno/inicio");
  return { error: null, ok: true };
}
