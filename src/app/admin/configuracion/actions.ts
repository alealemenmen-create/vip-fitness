"use server";

import { revalidatePath, updateTag } from "next/cache";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TAG_CONFIG_SUPERVISION } from "@/lib/configuracion/supervision";
import { generarReconocimientosSemanales } from "@/lib/ai/reconocimientosSemanales";
import { generarMotivacionPeso } from "@/lib/ai/motivacionPeso";
import { generarNotasSemanalesAutomaticas } from "@/lib/ai/notasSemanales";
import { cambiarCorreoDeUsuario } from "@/lib/cuenta/correo";
import type { FormState } from "@/app/admin/alumnos/actions";

export type ConfiguracionState = {
  ok: boolean;
  mensaje: string;
};

const numeroEntero = (valor: FormDataEntryValue | null, min: number, max: number) => {
  const numero = Number(valor);
  if (!Number.isInteger(numero)) return null;
  return Math.max(min, Math.min(max, numero));
};

export async function actualizarConfiguracionReconocimientos(
  _prev: ConfiguracionState,
  formData: FormData
): Promise<ConfiguracionState> {
  const sesion = await requireRol(["entrenador", "admin"]);
  const maxPorSemana = numeroEntero(formData.get("maxPorSemana"), 1, 5);
  const minPuntaje = numeroEntero(formData.get("minPuntaje"), 0, 100);
  const diasSinEntrenar = numeroEntero(formData.get("diasSinEntrenar"), 1, 30);
  const pctAtencion = numeroEntero(formData.get("pctAtencion"), 0, 100);
  const pctDestacado = numeroEntero(formData.get("pctDestacado"), 1, 200);
  const comidasAtencion = numeroEntero(formData.get("comidasAtencion"), 0, 6);
  const comidasDestacado = numeroEntero(formData.get("comidasDestacado"), 1, 7);
  if (
    maxPorSemana === null ||
    minPuntaje === null ||
    diasSinEntrenar === null ||
    pctAtencion === null ||
    pctDestacado === null ||
    comidasAtencion === null ||
    comidasDestacado === null
  ) {
    return { ok: false, mensaje: "Revisa los valores de configuración." };
  }
  if (pctAtencion >= pctDestacado || comidasAtencion >= comidasDestacado) {
    return {
      ok: false,
      mensaje: "El nivel de atención debe ser menor que el nivel destacado.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("configuracion_gimnasio").upsert(
    {
      id: true,
      reconocimientos_activos: formData.get("activos") === "on",
      max_reconocimientos_semana: maxPorSemana,
      min_puntaje_reconocimiento: minPuntaje,
      incluir_entrenamiento: formData.get("entrenamiento") === "on",
      incluir_alimentacion: formData.get("alimentacion") === "on",
      incluir_ranking: formData.get("ranking") === "on",
      incluir_constancia: formData.get("constancia") === "on",
      dias_sin_entrenar_alerta: diasSinEntrenar,
      pct_entrenamiento_atencion: pctAtencion,
      pct_entrenamiento_destacado: pctDestacado,
      dias_comida_atencion: comidasAtencion,
      dias_comida_destacado: comidasDestacado,
      updated_by: sesion.userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (error) {
    return {
      ok: false,
      mensaje: "No se pudo guardar. Primero aplica la migración 0020 en Supabase.",
    };
  }

  // Los umbrales del semáforo van cacheados: sin esto, el entrenador guardaba
  // y seguía viendo el panel con los valores viejos.
  updateTag(TAG_CONFIG_SUPERVISION);
  revalidatePath("/admin/configuracion");
  revalidatePath("/admin/alumnos");
  return { ok: true, mensaje: "Configuración guardada." };
}

export async function cambiarMiCorreo(_prevState: FormState, formData: FormData): Promise<FormState> {
  const sesion = await requireRol(["entrenador", "admin"]);
  const nuevoCorreo = String(formData.get("correo") || "");

  const mensajeError = await cambiarCorreoDeUsuario(sesion.userId, nuevoCorreo);
  if (mensajeError) return { error: mensajeError, ok: false };

  return { error: null, ok: true };
}

export async function generarReconocimientosAhora(
  _prev: ConfiguracionState,
  _formData: FormData
): Promise<ConfiguracionState> {
  void _prev;
  void _formData;
  await requireRol(["entrenador", "admin"]);
  const [resultado, motivacion, notas] = await Promise.all([
    generarReconocimientosSemanales(true),
    generarMotivacionPeso(),
    generarNotasSemanalesAutomaticas(),
  ]);
  revalidatePath("/admin/configuracion");
  revalidatePath("/admin/alumnos");
  revalidatePath("/alumno/noticias");
  revalidatePath("/alumno", "layout");
  return {
    ok: resultado.ok && motivacion.ok && notas.ok,
    mensaje: `${resultado.mensaje} ${motivacion.mensaje} ${notas.mensaje}`,
  };
}
