"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TAG_CONFIG_SUPERVISION } from "@/lib/configuracion/supervision";
import { TAG_CONFIG_REGISTRO } from "@/lib/configuracion/registro";
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
  revalidateTag(TAG_CONFIG_SUPERVISION, { expire: 0 });
  revalidatePath("/admin/configuracion");
  revalidatePath("/admin/alumnos");
  return { ok: true, mensaje: "Configuración guardada." };
}

/** Texto opcional del formulario: se guarda como null cuando viene vacío, así
 * la pantalla de pago sabe que ese dato simplemente no hay que mostrarlo. */
const textoOpcional = (valor: FormDataEntryValue | null): string | null =>
  String(valor ?? "").trim() || null;

/**
 * Guarda la configuración del link público de inscripción.
 *
 * Los datos bancarios se guardan estén o no encendidos: el interruptor
 * `pago_activo` solo decide si se le muestran a quien se inscribe. Así se
 * puede dejar todo cargado durante la beta y encender el cobro el día que
 * corresponda, sin llenar formularios a última hora.
 */
export async function actualizarConfiguracionRegistro(
  _prev: ConfiguracionState,
  formData: FormData
): Promise<ConfiguracionState> {
  const sesion = await requireRol(["entrenador", "admin"]);

  const montoTexto = String(formData.get("pago_monto") ?? "").trim();
  const monto = montoTexto ? Number(montoTexto) : null;
  if (monto !== null && (!Number.isInteger(monto) || monto < 0)) {
    return { ok: false, mensaje: "El valor de la inscripción tiene que ser un número entero." };
  }

  // wa.me solo acepta dígitos con código de país; se limpia acá para que el
  // botón de WhatsApp no dependa de cómo se haya escrito el número.
  const whatsapp = String(formData.get("whatsapp") ?? "").replace(/\D/g, "") || null;

  const supabase = await createClient();
  const { error } = await supabase.from("configuracion_gimnasio").upsert(
    {
      id: true,
      registro_beta_aviso: formData.get("beta") === "on",
      pago_registro_activo: formData.get("pago_activo") === "on",
      pago_monto: monto,
      pago_banco: textoOpcional(formData.get("pago_banco")),
      pago_tipo_cuenta: textoOpcional(formData.get("pago_tipo_cuenta")),
      pago_numero_cuenta: textoOpcional(formData.get("pago_numero_cuenta")),
      pago_rut: textoOpcional(formData.get("pago_rut")),
      pago_titular: textoOpcional(formData.get("pago_titular")),
      pago_correo: textoOpcional(formData.get("pago_correo")),
      pago_instrucciones: textoOpcional(formData.get("pago_instrucciones")),
      whatsapp_gimnasio: whatsapp,
      updated_by: sesion.userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (error) {
    console.error("[configuracion] guardar registro falló:", error);
    return {
      ok: false,
      mensaje: "No se pudo guardar. Primero aplica la migración 0033 en Supabase.",
    };
  }

  // La configuración del registro va cacheada por etiqueta: sin esto, la
  // pantalla pública seguiría mostrando lo anterior.
  revalidateTag(TAG_CONFIG_REGISTRO, { expire: 0 });
  revalidatePath("/admin/configuracion");
  revalidatePath("/registro");
  revalidatePath("/login");
  return { ok: true, mensaje: "Configuración guardada." };
}

export async function cambiarMiCorreo(_prevState: FormState, formData: FormData): Promise<FormState> {
  const sesion = await requireRol(["entrenador", "admin"]);
  const nuevoCorreo = String(formData.get("correo") || "");

  const mensajeError = await cambiarCorreoDeUsuario(sesion.userId, nuevoCorreo);
  if (mensajeError) return { error: mensajeError, ok: false };

  return { error: null, ok: true };
}

export async function actualizarConfiguracionAsistente(
  _prev: ConfiguracionState,
  formData: FormData
): Promise<ConfiguracionState> {
  const sesion = await requireRol(["entrenador", "admin"]);
  const presupuesto = Number(formData.get("presupuesto"));
  if (!Number.isFinite(presupuesto) || presupuesto < 0 || presupuesto > 1000) {
    return { ok: false, mensaje: "El presupuesto debe estar entre US$0 y US$1.000." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("configuracion_gimnasio")
    .update({
      asistente_ia_activo: formData.get("activo") === "on",
      presupuesto_ia_mensual_usd: Math.round(presupuesto * 100) / 100,
      updated_by: sesion.userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", true);
  if (error) return { ok: false, mensaje: "No se pudo guardar. Aplica primero la migración 0037." };
  revalidatePath("/admin/configuracion");
  return { ok: true, mensaje: "Límite del Asistente VIP guardado." };
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
