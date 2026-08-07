"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRol } from "@/lib/auth";
import { TAG_RANKING } from "@/lib/ranking/data";
import { calcularResultadoTorneo } from "@/lib/torneos/puntos";
import { calcularValoresCompetencia } from "@/lib/torneos/metricas";
import { hoyISO } from "@/lib/date";
import type { TorneoMetrica, TorneoModalidad } from "@/lib/supabase/types";

export type FormState = { error: string | null; ok: boolean };
const okState: FormState = { error: null, ok: true };

function fail(mensaje: string): FormState {
  return { error: mensaje, ok: false };
}

const METRICAS: TorneoMetrica[] = ["peso_baja", "peso_sube", "asistencia", "progreso_vip", "manual"];
const MODALIDADES: TorneoModalidad[] = ["duelo", "reto_coach", "copa_constancia"];

export async function crearTorneo(_prevState: FormState, formData: FormData): Promise<FormState> {
  await requireRol(["entrenador", "admin"]);

  const nombre = String(formData.get("nombre") || "").trim();
  const descripcion = String(formData.get("descripcion") || "").trim();
  const modalidad = String(formData.get("modalidad") || "") as TorneoModalidad;
  const reglaPublica = String(formData.get("regla_publica") || "").trim();
  const metrica = String(formData.get("metrica") || "") as TorneoMetrica;
  const menorEsMejor = formData.get("menor_es_mejor") === "on";
  const unidadManual = String(formData.get("unidad_manual") || "").trim();
  const fechaInicio = String(formData.get("fecha_inicio") || "");
  const horaInicio = String(formData.get("hora_inicio") || "").trim();
  const fechaFin = String(formData.get("fecha_fin") || "");
  const horaFin = String(formData.get("hora_fin") || "").trim();
  const puntosEnJuego = Number(formData.get("puntos_en_juego") || 0);
  // "Lado A" y "Lado B (contrincante)" del formulario — se juntan en una
  // sola lista de participantes, cada uno arranca 'pendiente' hasta que
  // acepte o rechace desde su propio perfil.
  const alumnoIds = [
    ...new Set([...formData.getAll("lado_a").map(String), ...formData.getAll("lado_b").map(String)]),
  ];

  if (!nombre) return fail("Ingresa un nombre para el torneo.");
  if (!MODALIDADES.includes(modalidad)) return fail("Elige una modalidad válida.");
  if (!METRICAS.includes(metrica)) return fail("Elige una métrica válida.");
  if (reglaPublica.length < 12) return fail("Explica con claridad cómo se gana esta competencia.");
  if (!fechaInicio || !fechaFin) return fail("Completa las fechas del torneo.");
  if (fechaFin < fechaInicio) return fail("La fecha de fin no puede ser antes que la de inicio.");
  if (fechaInicio <= hoyISO()) return fail("Publica la competencia al menos un día antes de que comience.");
  if (!Number.isFinite(puntosEnJuego) || puntosEnJuego <= 0) {
    return fail("Los puntos en juego deben ser un número mayor a 0.");
  }
  if (alumnoIds.length < 2) return fail("Elige al menos 2 alumnos para que compitan.");
  if (modalidad === "duelo" && alumnoIds.length !== 2) {
    return fail("Un Duelo VIP debe tener exactamente 2 participantes.");
  }
  if (modalidad === "copa_constancia" && metrica !== "progreso_vip") {
    return fail("La Copa de Constancia se calcula con los Puntos VIP obtenidos durante el periodo.");
  }

  const diasDuracion =
    Math.floor(
      (new Date(`${fechaFin}T12:00:00Z`).getTime() -
        new Date(`${fechaInicio}T12:00:00Z`).getTime()) /
        86_400_000
    ) + 1;
  const maximoDias = modalidad === "duelo" ? 7 : 31;
  if (diasDuracion > maximoDias) {
    return fail(
      modalidad === "duelo"
        ? "Un Duelo VIP puede durar como máximo 7 días."
        : "La competencia puede durar como máximo 31 días."
    );
  }
  const rangoPremio =
    modalidad === "duelo"
      ? [300, 1_000]
      : modalidad === "reto_coach"
        ? [500, 3_000]
        : [1_000, 5_000];
  if (puntosEnJuego < rangoPremio[0] || puntosEnJuego > rangoPremio[1]) {
    return fail(
      `Para esta modalidad la bolsa debe estar entre ${rangoPremio[0]} y ${rangoPremio[1]} puntos.`
    );
  }

  const admin = createAdminClient();
  const sesion = await requireRol(["entrenador", "admin"]);

  const { data: torneo, error: errorTorneo } = await admin
    .from("torneos")
    .insert({
      nombre,
      descripcion: descripcion || null,
      modalidad,
      regla_publica: reglaPublica,
      metrica,
      menor_es_mejor: menorEsMejor,
      unidad_manual: metrica === "manual" ? unidadManual || null : null,
      fecha_inicio: fechaInicio,
      hora_inicio: horaInicio || null,
      fecha_fin: fechaFin,
      hora_fin: horaFin || null,
      puntos_en_juego: Math.round(puntosEnJuego),
      creado_por: sesion.userId,
    })
    .select("id")
    .single();

  if (errorTorneo || !torneo) {
    return fail("No se pudo crear el torneo. Intenta nuevamente.");
  }

  const { error: errorParticipantes } = await admin
    .from("torneo_participantes")
    .insert(alumnoIds.map((alumnoId) => ({ torneo_id: torneo.id, alumno_id: alumnoId })));

  if (errorParticipantes) {
    await admin.from("torneos").delete().eq("id", torneo.id);
    return fail("No se pudo agregar a los participantes. Intenta nuevamente.");
  }

  revalidatePath("/admin/torneos");
  revalidatePath("/alumno/noticias");
  revalidatePath("/alumno", "layout");
  return okState;
}

export async function cargarResultadoManual(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  await requireRol(["entrenador", "admin"]);

  const torneoId = String(formData.get("torneo_id") || "");
  const alumnoId = String(formData.get("alumno_id") || "");
  const valor = Number(formData.get("valor"));

  if (!torneoId || !alumnoId) return fail("Faltan datos.");
  if (!Number.isFinite(valor)) return fail("Ingresa un número válido.");

  const admin = createAdminClient();
  const { data: torneo } = await admin
    .from("torneos")
    .select("cerrado, metrica")
    .eq("id", torneoId)
    .maybeSingle();
  if (!torneo || torneo.cerrado || torneo.metrica !== "manual") {
    return fail("Esta competencia no admite resultados manuales.");
  }
  const { data: actualizado, error } = await admin
    .from("torneo_participantes")
    .update({ resultado_manual: valor })
    .eq("torneo_id", torneoId)
    .eq("alumno_id", alumnoId)
    .eq("estado", "aceptado")
    .select("alumno_id")
    .maybeSingle();

  if (error || !actualizado) return fail("No se pudo guardar el resultado. Verifica que el alumno haya aceptado.");

  revalidatePath("/admin/torneos");
  return okState;
}

export async function cerrarTorneo(_prevState: FormState, formData: FormData): Promise<FormState> {
  await requireRol(["entrenador", "admin"]);

  const torneoId = String(formData.get("torneo_id") || "");
  if (!torneoId) return fail("Falta el torneo.");

  const admin = createAdminClient();
  const { data: torneo } = await admin.from("torneos").select("*").eq("id", torneoId).single();
  if (!torneo) return fail("Torneo no encontrado.");
  if (torneo.cerrado) return fail("Este torneo ya está cerrado.");
  if (hoyISO() < torneo.fecha_fin) {
    return fail("La competencia todavía está en curso. Solo puede cerrarse desde su fecha final.");
  }

  const { data: todosParticipantes } = await admin
    .from("torneo_participantes")
    .select("alumno_id, resultado_manual, estado")
    .eq("torneo_id", torneoId);

  // Solo compiten (y se reparten puntos) los que aceptaron — un pendiente o
  // un rechazo no cuenta.
  const participantes = (todosParticipantes ?? []).filter((p) => p.estado === "aceptado");

  if (participantes.length < 2) {
    return fail("Hacen falta al menos 2 participantes que hayan ACEPTADO para cerrar el torneo.");
  }
  if (torneo.metrica === "manual" && participantes.some((p) => p.resultado_manual === null)) {
    return fail("Falta cargar el resultado de algún participante.");
  }

  const { data: perfiles } = await admin
    .from("perfiles")
    .select("id, nombre")
    .in(
      "id",
      participantes.map((p) => p.alumno_id)
    );
  const nombres = new Map((perfiles ?? []).map((p) => [p.id, p.nombre]));

  const valores = await calcularValoresCompetencia(
    admin,
    torneo.metrica,
    torneo.fecha_inicio,
    torneo.fecha_fin,
    participantes.map((p) => ({ alumnoId: p.alumno_id, resultadoManual: p.resultado_manual }))
  );

  if (![...valores.values()].some((medicion) => medicion.valido)) {
    return fail("Todavía no existe ningún resultado verificable para cerrar esta competencia.");
  }

  const resultados = calcularResultadoTorneo(
    participantes.map((p) => {
      const medicion = valores.get(p.alumno_id) ?? { valor: 0, valido: false };
      return {
        alumnoId: p.alumno_id,
        nombre: nombres.get(p.alumno_id) ?? "Alumno",
        valor: medicion.valor,
        valido: medicion.valido,
      };
    }),
    torneo.puntos_en_juego,
    torneo.menor_es_mejor
  );

  const { error: errorResultados } = await admin
    .from("torneo_resultados")
    .insert({ torneo_id: torneoId, resultados });
  if (errorResultados) return fail("No se pudo guardar el resultado. Intenta nuevamente.");

  const fechaCierre = hoyISO();
  const claveMovimiento = `arena:${torneoId}`;
  const { error: errorPremios } = await admin.from("puntos_vip_movimientos").upsert(
    resultados.map((resultado) => ({
      alumno_id: resultado.alumnoId,
      clave: claveMovimiento,
      categoria: "competencia" as const,
      puntos: resultado.puntosDelta,
      titulo: `Arena VIP · ${torneo.nombre}`,
      detalle: resultado.valido
        ? `Puesto #${resultado.puesto} · +${resultado.puntosDelta} puntos de la bolsa VIP`
        : "Sin resultado verificable · 0 puntos",
      fecha: fechaCierre,
      metadata: {
        torneoId,
        modalidad: torneo.modalidad,
        puesto: resultado.puesto,
        valor: resultado.valor,
        valido: resultado.valido,
      },
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "alumno_id,clave" }
  );
  if (errorPremios) {
    await admin.from("torneo_resultados").delete().eq("torneo_id", torneoId);
    return fail("No se pudo registrar la bolsa de premios. El torneo sigue abierto.");
  }

  const { error: errorCierre } = await admin
    .from("torneos")
    .update({ cerrado: true, cerrado_en: new Date().toISOString() })
    .eq("id", torneoId);
  if (errorCierre) {
    await Promise.all([
      admin.from("puntos_vip_movimientos").delete().eq("clave", claveMovimiento),
      admin.from("torneo_resultados").delete().eq("torneo_id", torneoId),
    ]);
    return fail("No se pudo cerrar la competencia. No se repartieron puntos.");
  }

  // El premio entra como movimiento auditable en semana, mes, año y acumulado.
  revalidateTag(TAG_RANKING, { expire: 0 });
  revalidatePath("/admin/torneos");
  revalidatePath("/alumno/ranked");
  revalidatePath("/alumno/inicio");
  revalidatePath("/alumno/noticias");
  revalidatePath("/alumno", "layout");
  return okState;
}

/**
 * Borra una competencia — pensada para pruebas de error, no para deshacer una
 * ya jugada de verdad.
 *
 * `torneo_participantes` y `torneo_resultados` tienen `on delete cascade`
 * hacia `torneos` (migración 0015) y se van solos. `puntos_vip_movimientos`
 * NO tiene esa relación —es un libro de movimientos aparte, sin llave foránea
 * a torneos— así que si la competencia ya se había cerrado y repartido bolsa,
 * hay que borrar esos movimientos a mano por su `clave` (`arena:{torneoId}`,
 * la misma que arma `cerrarTorneo`) o quedarían puntos fantasma sin ninguna
 * competencia detrás que los explique.
 */
export async function eliminarTorneo(_prevState: FormState, formData: FormData): Promise<FormState> {
  await requireRol(["entrenador", "admin"]);

  const torneoId = String(formData.get("torneo_id") || "");
  if (!torneoId) return fail("Falta el torneo.");

  const admin = createAdminClient();
  await admin.from("puntos_vip_movimientos").delete().eq("clave", `arena:${torneoId}`);
  const { error } = await admin.from("torneos").delete().eq("id", torneoId);
  if (error) return fail("No se pudo eliminar la competencia. Intenta nuevamente.");

  revalidateTag(TAG_RANKING, { expire: 0 });
  revalidatePath("/admin/torneos");
  revalidatePath("/alumno/ranked");
  revalidatePath("/alumno/inicio");
  revalidatePath("/alumno", "layout");
  return okState;
}
