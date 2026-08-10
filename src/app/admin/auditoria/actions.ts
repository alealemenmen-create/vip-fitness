"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRol } from "@/lib/auth";
import { guardarMovimiento } from "@/lib/ranking/movimientos";
import { TAG_RANKING } from "@/lib/ranking/data";
import type { TipoHallazgo } from "@/lib/auditoria/data";
import { reconciliarObjetivos } from "@/lib/alimentacion/objetivos";

export type FormState = { error: string | null; ok: boolean };
const okState: FormState = { error: null, ok: true };
function fail(mensaje: string): FormState {
  return { error: mensaje, ok: false };
}

export type CorreccionMacrosState = FormState & { mensaje?: string | null };

/** Reutilizable: corrige todos los planes activos, no solo el alumno que hizo
 * visible el problema. Los casos matemáticamente imposibles quedan intactos
 * y se informan para que el entrenador cambie proteína/grasa conscientemente. */
export async function corregirMacrosActivos(
  _prevState: CorreccionMacrosState,
  _formData: FormData
): Promise<CorreccionMacrosState> {
  void _prevState;
  void _formData;
  await requireRol(["entrenador", "admin"]);
  const admin = createAdminClient();
  const { data: planes, error } = await admin
    .from("planes_alimentacion")
    .select("id, kcal_objetivo, prot_objetivo, carb_objetivo, grasa_objetivo")
    .eq("activo", true);
  if (error) return { ok: false, error: "No fue posible leer los planes activos." };

  let corregidos = 0;
  let imposibles = 0;
  for (const plan of planes ?? []) {
    const resultado = reconciliarObjetivos({
      kcalObjetivo: plan.kcal_objetivo,
      protObjetivo: plan.prot_objetivo,
      carbObjetivo: plan.carb_objetivo,
      grasaObjetivo: plan.grasa_objetivo,
    });
    if (resultado.error) {
      imposibles++;
      continue;
    }
    if (!resultado.ajustado) continue;
    const { error: errorUpdate } = await admin
      .from("planes_alimentacion")
      .update({ carb_objetivo: resultado.objetivos.carbObjetivo })
      .eq("id", plan.id)
      .eq("activo", true);
    if (!errorUpdate) corregidos++;
  }

  revalidatePath("/admin/auditoria");
  revalidatePath("/alumno/comer");
  return {
    ok: true,
    error: null,
    mensaje: `${corregidos} plan${corregidos === 1 ? "" : "es"} corregido${corregidos === 1 ? "" : "s"}.` +
      (imposibles > 0 ? ` ${imposibles} requiere${imposibles === 1 ? "" : "n"} revisión manual porque proteína y grasa exceden las calorías.` : ""),
  };
}

/** Deja constancia de la decisión del entrenador sobre un hallazgo, para que
 * no vuelva a aparecer en la próxima carga de `/admin/auditoria` (ver
 * `obtenerHallazgosPendientes` en `lib/auditoria/data.ts`, que filtra contra
 * esta tabla). */
async function registrarRevision(datos: {
  tipo: TipoHallazgo;
  referenciaId: string;
  alumnoId: string;
  estado: "descartado" | "penalizado";
  puntosAjustados: number | null;
  nota: string | null;
  revisorId: string;
}): Promise<void> {
  if (datos.tipo === "rutina_activa_deficiente") {
    throw new Error("Las rutinas se corrigen reemplazándolas; este hallazgo no se descarta.");
  }
  const admin = createAdminClient();
  const { error } = await admin.from("auditoria_revisiones").insert({
    tipo: datos.tipo,
    referencia_id: datos.referenciaId,
    alumno_id: datos.alumnoId,
    estado: datos.estado,
    puntos_ajustados: datos.puntosAjustados,
    nota: datos.nota,
    revisor_id: datos.revisorId,
  });
  if (error) throw new Error("No fue posible guardar la revisión: " + error.message);
}

/** Descartar = falso positivo: no se toca ni un punto del alumno, solo se
 * deja de mostrar este hallazgo puntual. */
export async function descartarHallazgo(formData: FormData): Promise<void> {
  const sesion = await requireRol(["entrenador", "admin"]);
  const tipo = String(formData.get("tipo") || "") as TipoHallazgo;
  const referenciaId = String(formData.get("referencia_id") || "");
  const alumnoId = String(formData.get("alumno_id") || "");
  if (!tipo || !referenciaId || !alumnoId) return;
  if (tipo === "rutina_activa_deficiente") return;

  await registrarRevision({
    tipo,
    referenciaId,
    alumnoId,
    estado: "descartado",
    puntosAjustados: null,
    nota: null,
    revisorId: sesion.userId,
  });

  revalidatePath("/admin/auditoria");
}

/**
 * Penalizar: resta puntos (categoría "ajuste", igual que
 * `registrarPenalizacionDescanso`) y — a diferencia de esa penalización
 * automática — le deja una nota importante al alumno explicando qué se
 * encontró y por qué se descontaron puntos. La idea del usuario fue
 * explícita: nunca actuar en silencio contra un alumno.
 */
export async function penalizarHallazgo(prevState: FormState, formData: FormData): Promise<FormState> {
  const sesion = await requireRol(["entrenador", "admin"]);
  const tipo = String(formData.get("tipo") || "") as TipoHallazgo;
  const referenciaId = String(formData.get("referencia_id") || "");
  const alumnoId = String(formData.get("alumno_id") || "");
  const fecha = String(formData.get("fecha") || "");
  const puntos = Math.abs(Math.round(Number(formData.get("puntos") || 0)));
  const nota = String(formData.get("nota") || "").trim();

  if (!tipo || !referenciaId || !alumnoId || !fecha) return fail("Faltan datos del hallazgo.");
  if (tipo === "rutina_activa_deficiente") {
    return fail("Una deficiencia de programación se corrige en la rutina; nunca se penaliza al alumno.");
  }
  if (!puntos) return fail("Indica cuántos puntos descontar.");
  if (!nota) return fail("Escribe la explicación que va a ver el alumno.");

  await guardarMovimiento({
    alumnoId,
    clave: `auditoria:${tipo}:${referenciaId}`,
    categoria: "ajuste",
    puntos: -puntos,
    titulo: "Ajuste por auditoría",
    detalle: nota,
    fecha,
    metadata: { tipo, referenciaId },
  });

  const admin = createAdminClient();
  await admin.from("notas_entrenador").insert({
    alumno_id: alumnoId,
    entrenador_id: sesion.userId,
    texto: `Se descontaron ${puntos} Puntos VIP por una revisión de auditoría: ${nota}`,
    fecha_inicio: fecha,
    importante: true,
    marcar_nueva: true,
  });

  await registrarRevision({
    tipo,
    referenciaId,
    alumnoId,
    estado: "penalizado",
    puntosAjustados: puntos,
    nota,
    revisorId: sesion.userId,
  });

  revalidateTag(TAG_RANKING, { expire: 0 });
  revalidatePath("/admin/auditoria");
  revalidatePath(`/admin/alumnos/${alumnoId}`);
  return okState;
}
