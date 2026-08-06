"use server";

import { revalidatePath, updateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRol } from "@/lib/auth";
import { guardarMovimiento } from "@/lib/ranking/movimientos";
import { TAG_RANKING } from "@/lib/ranking/data";
import type { TipoHallazgo } from "@/lib/auditoria/data";

export type FormState = { error: string | null; ok: boolean };
const okState: FormState = { error: null, ok: true };
function fail(mensaje: string): FormState {
  return { error: mensaje, ok: false };
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

  updateTag(TAG_RANKING);
  revalidatePath("/admin/auditoria");
  revalidatePath(`/admin/alumnos/${alumnoId}`);
  return okState;
}
