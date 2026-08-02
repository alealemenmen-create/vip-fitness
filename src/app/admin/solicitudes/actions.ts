"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRol } from "@/lib/auth";
import { generarPassword } from "@/lib/cuenta/password";
import { enviarCorreo, plantillaCredenciales } from "@/lib/email/resend";
import { EMAIL_RE, TELEFONO_RE } from "@/lib/solicitudes/campos";

export type SolicitudActionState = {
  error: string | null;
  ok: boolean;
  /** Credenciales del alumno recién creado — se muestran en pantalla para
   * pasarlas por WhatsApp cuando el correo no salió (mismo criterio que el
   * alta manual en CrearAlumnoForm). */
  email?: string;
  password?: string;
  correoEnviado?: boolean;
};

const fail = (mensaje: string): SolicitudActionState => ({ error: mensaje, ok: false });

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

/**
 * Acepta una solicitud del link público: crea la cuenta, vuelca los datos que
 * la persona declaró en su perfil de alumno y le manda las credenciales.
 *
 * Es el mismo camino que `crearAlumnoYEnviarCorreo` (alta manual), con dos
 * agregados: los campos de salud del formulario y el peso inicial, que entra
 * como primera medición para que el gráfico de progreso arranque desde el día
 * que se inscribió y no desde el primer control.
 */
export async function aceptarSolicitud(
  _prevState: SolicitudActionState,
  formData: FormData
): Promise<SolicitudActionState> {
  const sesion = await requireRol(["entrenador", "admin"]);
  const solicitudId = String(formData.get("solicitud_id") || "");
  if (!solicitudId) return fail("Falta la solicitud.");

  const admin = createAdminClient();

  const { data: solicitud } = await admin
    .from("solicitudes_registro")
    .select("*")
    .eq("id", solicitudId)
    .maybeSingle();

  if (!solicitud) return fail("No se encontró esta solicitud.");
  if (solicitud.estado !== "pendiente") {
    return fail("Esta solicitud ya fue resuelta.");
  }

  const password = generarPassword();

  const { data: creado, error: errorCrear } = await admin.auth.admin.createUser({
    email: solicitud.email,
    password,
    email_confirm: true,
    user_metadata: { nombre: solicitud.nombre },
  });

  if (errorCrear || !creado.user) {
    console.error("[solicitudes] createUser error:", errorCrear);
    const yaExiste = errorCrear?.code === "email_exists" || errorCrear?.status === 422;
    return fail(
      yaExiste
        ? "Ya existe una cuenta con ese correo. Si es la misma persona, rechaza la solicitud y trabaja con la cuenta que ya tiene."
        : "No fue posible crear la cuenta. Intenta nuevamente."
    );
  }

  const nuevoId = creado.user.id;

  const { error: errorPerfil } = await admin
    .from("perfiles")
    .insert({ id: nuevoId, nombre: solicitud.nombre, rol: "alumno" });

  if (errorPerfil) {
    await admin.auth.admin.deleteUser(nuevoId);
    return fail("No fue posible crear el perfil del alumno. Intenta nuevamente.");
  }

  const { error: errorAlumnoPerfil } = await admin.from("alumno_perfil").insert({
    user_id: nuevoId,
    entrenador_id: sesion.userId,
    objetivo: solicitud.objetivo,
    telefono: solicitud.telefono,
    sexo: solicitud.sexo,
    fecha_nacimiento: solicitud.fecha_nacimiento,
    estatura_cm: solicitud.estatura_cm,
    condicion_medica: solicitud.condicion_medica,
    restriccion_alimenticia: solicitud.restriccion_alimenticia,
  });

  if (errorAlumnoPerfil) {
    await admin.auth.admin.deleteUser(nuevoId);
    return fail("No fue posible vincular al alumno contigo. Intenta nuevamente.");
  }

  // El peso declarado en el registro queda como primera medición. No se
  // aborta el alta si falla: es un dato de arranque, no el acceso.
  if (solicitud.peso_kg) {
    const { error: errorPeso } = await admin.from("pesos_corporales").insert({
      alumno_id: nuevoId,
      peso_kg: solicitud.peso_kg,
      registrado_por: sesion.userId,
      observacion: "Peso declarado al inscribirse",
    });
    if (errorPeso) console.error("[solicitudes] peso inicial no se guardó:", errorPeso);
  }

  await admin.from("noticias_sistema").upsert(
    {
      clave_origen: `bienvenida:${nuevoId}`,
      tipo: "bienvenida",
      alumno_id: nuevoId,
    },
    { onConflict: "clave_origen", ignoreDuplicates: true }
  );

  const { error: errorEstado } = await admin
    .from("solicitudes_registro")
    .update({
      estado: "aceptada",
      revisada_por: sesion.userId,
      revisada_en: new Date().toISOString(),
      alumno_id: nuevoId,
    })
    .eq("id", solicitudId);

  // La cuenta ya existe: si esto falla, la solicitud quedaría "pendiente" para
  // siempre y un segundo click intentaría crear al alumno de nuevo (fallando
  // por correo duplicado). Se avisa con el detalle en vez de fingir éxito.
  if (errorEstado) {
    console.error("[solicitudes] no se pudo marcar como aceptada:", errorEstado);
    return fail(
      `La cuenta de ${solicitud.nombre} quedó creada, pero la solicitud no se marcó como aceptada. Recarga la página antes de volver a intentarlo.`
    );
  }

  const resultadoCorreo = await enviarCorreo({
    to: solicitud.email,
    subject: "Tu cuenta en VIP Fitness está lista",
    html: plantillaCredenciales({
      nombre: solicitud.nombre,
      email: solicitud.email,
      password,
      loginUrl: `${siteUrl()}/login`,
    }),
  });

  revalidatePath("/admin/solicitudes");
  revalidatePath("/admin/alumnos");
  revalidatePath("/admin", "layout");
  return {
    error: null,
    ok: true,
    email: solicitud.email,
    password,
    correoEnviado: resultadoCorreo.ok,
  };
}

/**
 * Corrige el correo o el teléfono de una solicitud pendiente.
 *
 * Existe porque el dato lo escribe alguien desde su teléfono y un error de
 * tipeo en el correo deja la solicitud imposible de aceptar: la cuenta se crea
 * con ese correo, y ahí es donde llegan las credenciales. Antes de esto la
 * única salida era rechazarla y pedirle que se inscribiera de nuevo.
 */
export async function corregirContactoSolicitud(
  _prevState: SolicitudActionState,
  formData: FormData
): Promise<SolicitudActionState> {
  await requireRol(["entrenador", "admin"]);
  const solicitudId = String(formData.get("solicitud_id") || "");
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const telefono = String(formData.get("telefono") || "").trim();
  if (!solicitudId) return fail("Falta la solicitud.");
  if (!EMAIL_RE.test(email)) return fail("Ingresa un correo válido.");
  if (!TELEFONO_RE.test(telefono)) return fail("Ingresa un teléfono válido.");

  const admin = createAdminClient();
  const { error } = await admin
    .from("solicitudes_registro")
    .update({ email, telefono })
    .eq("id", solicitudId);

  if (error) {
    // 23505 = el índice único de correo pendiente: ese correo ya tiene otra
    // solicitud esperando.
    if (error.code === "23505") return fail("Ya hay otra solicitud pendiente con ese correo.");
    return fail("No fue posible guardar los datos. Intenta nuevamente.");
  }

  revalidatePath("/admin/solicitudes");
  return { error: null, ok: true };
}

/**
 * Marca (o desmarca) el pago de una solicitud como verificado.
 *
 * La verificación es a ojo: el entrenador mira el comprobante, lo compara con
 * el movimiento en su cuenta y decide. La app no valida nada contra el banco
 * — solo deja registrado quién lo revisó y cuándo, para que después no haya
 * dudas de si esa inscripción se pagó o no.
 *
 * No bloquea el alta: aceptar sin pago verificado sigue siendo posible (hay
 * casos legítimos, como alguien que pagó en efectivo en el gimnasio), pero la
 * tarjeta lo avisa antes de crear la cuenta.
 */
export async function marcarPagoVerificado(
  _prevState: SolicitudActionState,
  formData: FormData
): Promise<SolicitudActionState> {
  const sesion = await requireRol(["entrenador", "admin"]);
  const solicitudId = String(formData.get("solicitud_id") || "");
  const verificado = formData.get("verificado") === "true";
  if (!solicitudId) return fail("Falta la solicitud.");

  const admin = createAdminClient();
  const { error } = await admin
    .from("solicitudes_registro")
    .update({
      pago_verificado: verificado,
      pago_verificado_por: verificado ? sesion.userId : null,
      pago_verificado_en: verificado ? new Date().toISOString() : null,
    })
    .eq("id", solicitudId);

  if (error) return fail("No fue posible guardar el estado del pago. Intenta nuevamente.");

  revalidatePath("/admin/solicitudes");
  return { error: null, ok: true };
}

/** Rechaza la solicitud. No se avisa por correo a propósito: es una
 * conversación que el entrenador tiene por WhatsApp, no un mail automático. */
export async function rechazarSolicitud(
  _prevState: SolicitudActionState,
  formData: FormData
): Promise<SolicitudActionState> {
  const sesion = await requireRol(["entrenador", "admin"]);
  const solicitudId = String(formData.get("solicitud_id") || "");
  const motivo = String(formData.get("motivo") || "").trim();
  if (!solicitudId) return fail("Falta la solicitud.");

  const admin = createAdminClient();
  const { error } = await admin
    .from("solicitudes_registro")
    .update({
      estado: "rechazada",
      revisada_por: sesion.userId,
      revisada_en: new Date().toISOString(),
      motivo_rechazo: motivo || null,
    })
    .eq("id", solicitudId)
    .eq("estado", "pendiente");

  if (error) return fail("No fue posible rechazar la solicitud. Intenta nuevamente.");

  revalidatePath("/admin/solicitudes");
  revalidatePath("/admin", "layout");
  return { error: null, ok: true };
}
