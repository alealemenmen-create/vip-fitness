"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, requireRol, COOKIE_VISTA_ALUMNO } from "@/lib/auth";
import { enviarCorreo, plantillaCredenciales } from "@/lib/email/resend";
import { cambiarCorreoDeUsuario } from "@/lib/cuenta/correo";
import { generarPassword } from "@/lib/cuenta/password";
import { esCodigoPlanEntrenamiento, PLANES_ENTRENAMIENTO } from "@/lib/planes-entrenamiento";

export type FormState = { error: string | null; ok: boolean };
const okState: FormState = { error: null, ok: true };

function fail(mensaje: string): FormState {
  return { error: mensaje, ok: false };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type FormStateCredenciales = FormState & {
  email?: string;
  password?: string;
  /** true si el correo con las credenciales salió de verdad; false si no hay
   * servicio de correo configurado (o falló el envío) — la UI muestra la
   * contraseña en pantalla como respaldo en ese caso. */
  correoEnviado?: boolean;
};
const failCred = (mensaje: string): FormStateCredenciales => ({ error: mensaje, ok: false });

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

/**
 * Crea al alumno con una contraseña generada al toque (sin depender de que
 * llegue ningún correo de invitación — el servicio de correo de prueba de
 * Supabase tiene un límite muy bajo, ver HANDOFF) y le manda por correo el
 * usuario y la contraseña. Si no hay un servicio de correo real configurado
 * (falta RESEND_API_KEY) o el envío falla, la contraseña se devuelve igual
 * en el estado para que la UI la muestre en pantalla como respaldo — el
 * entrenador no se queda sin poder darle acceso al alumno.
 */
export async function crearAlumnoYEnviarCorreo(
  _prevState: FormStateCredenciales,
  formData: FormData
): Promise<FormStateCredenciales> {
  const sesion = await requireAdmin();

  const nombre = String(formData.get("nombre") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const objetivo = String(formData.get("objetivo") || "").trim();

  if (!nombre) return failCred("Ingresa el nombre del alumno.");
  if (!EMAIL_RE.test(email)) return failCred("Ingresa un correo válido.");

  const password = generarPassword();
  const admin = createAdminClient();

  const { data: creado, error: errorCrear } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre },
  });

  if (errorCrear || !creado.user) {
    console.error("createUser error:", errorCrear);
    const yaExiste = errorCrear?.code === "email_exists" || errorCrear?.status === 422;
    return failCred(
      yaExiste
        ? "Ya existe una cuenta con ese correo."
        : "No fue posible crear la cuenta. Intenta nuevamente."
    );
  }

  const nuevoId = creado.user.id;

  const { error: errorPerfil } = await admin
    .from("perfiles")
    .insert({ id: nuevoId, nombre, rol: "alumno" });

  if (errorPerfil) {
    await admin.auth.admin.deleteUser(nuevoId);
    return failCred("No fue posible crear el perfil del alumno. Intenta nuevamente.");
  }

  const { error: errorAlumnoPerfil } = await admin
    .from("alumno_perfil")
    .insert({ user_id: nuevoId, entrenador_id: sesion.userId, objetivo: objetivo || null });

  if (errorAlumnoPerfil) {
    await admin.auth.admin.deleteUser(nuevoId);
    return failCred("No fue posible vincular al alumno contigo. Intenta nuevamente.");
  }

  // Si la migración 0020 ya está aplicada, la incorporación aparece como una
  // noticia breve. No se bloquea la creación del alumno si esa migración aún
  // está pendiente: el acceso y las credenciales son prioritarios.
  await admin.from("noticias_sistema").upsert(
    {
      clave_origen: `bienvenida:${nuevoId}`,
      tipo: "bienvenida",
      alumno_id: nuevoId,
    },
    { onConflict: "clave_origen", ignoreDuplicates: true }
  );

  const resultadoCorreo = await enviarCorreo({
    to: email,
    subject: "Tu cuenta en VIP Fitness está lista",
    html: plantillaCredenciales({ nombre, email, password, loginUrl: `${siteUrl()}/login` }),
  });

  revalidatePath("/admin/alumnos");
  revalidatePath("/alumno/noticias");
  revalidatePath("/alumno", "layout");
  return { error: null, ok: true, email, password, correoEnviado: resultadoCorreo.ok };
}

/**
 * Regenera la contraseña de un alumno que ya existe (típicamente porque
 * quedó trabado con una invitación por correo que nunca llegó) y se la
 * reenvía por correo, igual que al crearlo.
 */
export async function restablecerPasswordAlumno(
  _prevState: FormStateCredenciales,
  formData: FormData
): Promise<FormStateCredenciales> {
  await requireAdmin();

  const alumnoId = String(formData.get("alumno_id") || "");
  if (!alumnoId) return failCred("Falta el alumno.");

  const admin = createAdminClient();
  const [{ data: usuario, error: errorUsuario }, { data: perfil }] = await Promise.all([
    admin.auth.admin.getUserById(alumnoId),
    admin.from("perfiles").select("nombre").eq("id", alumnoId).single(),
  ]);
  if (errorUsuario || !usuario.user?.email) {
    return failCred("No se encontró la cuenta de este alumno.");
  }

  const password = generarPassword();
  const { error } = await admin.auth.admin.updateUserById(alumnoId, {
    password,
    email_confirm: true,
  });

  if (error) return failCred("No fue posible cambiar la contraseña. Intenta nuevamente.");

  const resultadoCorreo = await enviarCorreo({
    to: usuario.user.email,
    subject: "Tu contraseña de VIP Fitness cambió",
    html: plantillaCredenciales({
      nombre: perfil?.nombre ?? "",
      email: usuario.user.email,
      password,
      loginUrl: `${siteUrl()}/login`,
    }),
  });

  return { error: null, ok: true, email: usuario.user.email, password, correoEnviado: resultadoCorreo.ok };
}

/**
 * Elimina por completo a un alumno: usuario de Auth, perfil y todo lo que
 * cuelga de él (rutinas, sesiones, registros, notas, ranking, etc.) gracias a
 * `on delete cascade` desde `perfiles.id` — ver 0001_init.sql. Es irreversible.
 */
export async function eliminarAlumno(_prevState: FormState, formData: FormData): Promise<FormState> {
  const sesion = await requireAdmin();
  const alumnoId = String(formData.get("alumno_id") || "");
  if (!alumnoId) return fail("Falta el alumno.");

  const admin = createAdminClient();
  const { data: perfil } = await admin.from("perfiles").select("rol").eq("id", alumnoId).single();
  if (!perfil || perfil.rol !== "alumno") return fail("Este perfil no es un alumno eliminable.");

  const esCuentaDual = alumnoId === sesion.userId;
  if (esCuentaDual) return fail("No puedes eliminar tu propia cuenta desde aquí.");

  const { error } = await admin.auth.admin.deleteUser(alumnoId);
  if (error) return fail("No fue posible eliminar al alumno. Intenta nuevamente.");

  revalidatePath("/admin/alumnos");
  redirect("/admin/alumnos");
}

/**
 * Elimina a un entrenador. Protegido para no dejar el gimnasio sin ningún
 * entrenador y para que nadie se elimine a sí mismo por error.
 */
export async function eliminarEntrenador(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const sesion = await requireAdmin();
  const entrenadorId = String(formData.get("entrenador_id") || "");
  if (!entrenadorId) return fail("Falta el entrenador.");

  if (entrenadorId === sesion.userId) {
    return fail("No puedes eliminar tu propia cuenta de entrenador.");
  }

  const admin = createAdminClient();
  const { data: perfil } = await admin.from("perfiles").select("rol").eq("id", entrenadorId).single();
  if (!perfil || perfil.rol !== "entrenador") return fail("Este perfil no es un entrenador.");

  const { count } = await admin
    .from("perfiles")
    .select("id", { count: "exact", head: true })
    .eq("rol", "entrenador");
  if ((count ?? 0) <= 1) {
    return fail("No puedes eliminar al único entrenador del gimnasio.");
  }

  const { error } = await admin.auth.admin.deleteUser(entrenadorId);
  if (error) return fail("No fue posible eliminar al entrenador. Intenta nuevamente.");

  revalidatePath("/admin/alumnos");
  redirect("/admin/alumnos");
}

/** El entrenador/admin cambia el correo de cualquier alumno o entrenador —
 * bypass de la confirmación por correo de Supabase (misma lógica que
 * restablecerPasswordAlumno). */
export async function actualizarCorreoPerfil(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const sesion = await requireAdmin();
  const perfilId = String(formData.get("perfil_id") || "");
  const nuevoCorreo = String(formData.get("correo") || "");
  if (!perfilId) return fail("Falta el perfil.");

  if (perfilId === sesion.userId) {
    return fail("Para cambiar tu propio correo, usa la opción en Configuración.");
  }

  const mensajeError = await cambiarCorreoDeUsuario(perfilId, nuevoCorreo);
  if (mensajeError) return fail(mensajeError);

  revalidatePath(`/admin/alumnos/${perfilId}`);
  return okState;
}

/** Edita el nombre de un alumno o entrenador (solo el nombre; el correo se
 * gestiona en Supabase Auth y no se expone para edición aquí). */
export async function actualizarNombrePerfil(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  await requireRol(["entrenador", "admin"]);
  const perfilId = String(formData.get("perfil_id") || "");
  const nombre = String(formData.get("nombre") || "").trim();
  if (!nombre) return fail("Ingresa un nombre.");

  const supabase = await createClient();
  const { data: actualizado, error } = await supabase
    .from("perfiles")
    .update({ nombre })
    .eq("id", perfilId)
    .select("id")
    .maybeSingle();
  if (error || !actualizado) return fail("No fue posible guardar el nombre. Intenta nuevamente.");

  revalidatePath("/admin/alumnos");
  revalidatePath(`/admin/alumnos/${perfilId}`);
  return okState;
}

export async function crearEntrenador(_prevState: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const nombre = String(formData.get("nombre") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();

  if (!nombre) return fail("Ingresa el nombre del entrenador.");
  if (!EMAIL_RE.test(email)) return fail("Ingresa un correo válido.");

  const admin = createAdminClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const { data: invitado, error: errorInvite } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${siteUrl}/auth/set-password`,
    data: { nombre },
  });

  if (errorInvite || !invitado.user) {
    console.error("inviteUserByEmail (entrenador) error:", errorInvite);
    const yaExiste = errorInvite?.code === "email_exists" || errorInvite?.status === 422;
    return fail(
      yaExiste
        ? "Ya existe una cuenta con ese correo."
        : `No fue posible enviar la invitación (${errorInvite?.code ?? errorInvite?.status ?? "error desconocido"}). Revisa tu conexión e intenta nuevamente.`
    );
  }

  const { error: errorPerfil } = await admin
    .from("perfiles")
    .insert({ id: invitado.user.id, nombre, rol: "entrenador" });

  if (errorPerfil) {
    await admin.auth.admin.deleteUser(invitado.user.id);
    return fail("No fue posible crear el perfil del entrenador. Intenta nuevamente.");
  }

  revalidatePath("/admin/alumnos");
  return okState;
}

/** Le da al entrenador/admin logueado su propia fila de alumno_perfil, para
 * que pueda entrar a /alumno/* como un alumno real (mismo user_id, sin crear
 * una cuenta de Auth nueva). */
export async function crearMiPerfilAlumno(): Promise<void> {
  const sesion = await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();

  const { data: existente } = await supabase
    .from("alumno_perfil")
    .select("user_id")
    .eq("user_id", sesion.userId)
    .maybeSingle();

  if (!existente) {
    await supabase.from("alumno_perfil").insert({ user_id: sesion.userId });
  }

  revalidatePath("/admin/alumnos", "layout");
  redirect("/alumno/inicio");
}

/** Entra en modo "ver como alumno" (solo lectura) sobre otro alumno —
 * guarda su id en una cookie de corta duración que requireAlumno() lee. */
// Cookie aparte de COOKIE_VISTA_ALUMNO -- guarda el id de la fila de
// auditoría (accesos_vista_alumno) que hay que cerrar al salir, para no
// tener que adivinar "la más reciente sin cerrar" (ambiguo con varias
// pestañas/entrenadores). No es httpOnly-crítica por sí sola: solo apunta a
// una fila que ya está protegida por RLS a nombre del propio entrenador.
const COOKIE_VISTA_ALUMNO_ACCESO_ID = "vista_alumno_acceso_id";

/** "Ver como alumno" expone fotos de progreso, notas y datos personales —
 * queda un registro de quién entró, a quién y cuándo (migración 0117,
 * bloque 15.4/16 del handoff). Solo el admin puede leer esta tabla. */
export async function entrarComoAlumno(formData: FormData): Promise<void> {
  const sesion = await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();

  const alumnoId = String(formData.get("alumno_id") || "");

  const { data: alumno } = await supabase
    .from("alumno_perfil")
    .select("user_id")
    .eq("user_id", alumnoId)
    .maybeSingle();

  if (!alumno) return;

  const { data: acceso } = await supabase
    .from("accesos_vista_alumno")
    .insert({ entrenador_id: sesion.userId, alumno_id: alumnoId })
    .select("id")
    .single();

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_VISTA_ALUMNO, alumnoId, {
    httpOnly: true,
    maxAge: 60 * 60 * 8,
    path: "/",
    // `sameSite` y `secure` explícitos: sin declararlos, el navegador aplica su
    // propio criterio y no todos coinciden. Chrome de Android es el más
    // estricto con las cookies sin atributos y era el único que la descartaba,
    // por eso el problema no se veía en iPhone. Al perderse la cookie,
    // `requireAlumno` deja de reconocer la vista de alumno y manda al panel del
    // entrenador — el "me tira a mi perfil de alumnos" de mitad de sesión.
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  if (acceso) {
    cookieStore.set(COOKIE_VISTA_ALUMNO_ACCESO_ID, acceso.id, {
      httpOnly: true,
      maxAge: 60 * 60 * 8,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }

  redirect("/alumno/inicio");
}

/** Sale del modo "ver como alumno" y vuelve al panel del alumno visitado.
 * Cierra la fila de auditoría abierta en `entrarComoAlumno` -- si la cookie
 * del acceso no está (expiró, sesión vieja de antes de la migración 0117),
 * no hay nada que cerrar y sigue igual que antes. */
export async function salirDeVistaAlumno(): Promise<void> {
  const cookieStore = await cookies();
  const alumnoId = cookieStore.get(COOKIE_VISTA_ALUMNO)?.value;
  const accesoId = cookieStore.get(COOKIE_VISTA_ALUMNO_ACCESO_ID)?.value;
  if (accesoId) {
    const supabase = await createClient();
    await supabase
      .from("accesos_vista_alumno")
      .update({ finalizado_en: new Date().toISOString() })
      .eq("id", accesoId);
  }
  cookieStore.delete(COOKIE_VISTA_ALUMNO);
  cookieStore.delete(COOKIE_VISTA_ALUMNO_ACCESO_ID);
  redirect(alumnoId ? `/admin/alumnos/${alumnoId}` : "/admin/alumnos");
}

/** Habilita la experiencia V2 alumno por alumno durante el piloto cerrado.
 * Sólo el administrador puede ampliar el grupo; un entrenador puede seguir
 * supervisando V2, pero no autorizar cuentas por su cuenta. */
export async function actualizarAccesoPortalV2(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  await requireRol(["entrenador", "admin"]);
  const alumnoId = String(formData.get("alumno_id") || "");
  const habilitado = formData.get("habilitado") === "true";

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(alumnoId)) {
    return fail("El alumno indicado no es válido.");
  }

  const admin = createAdminClient();
  const { data: perfil } = await admin
    .from("perfiles")
    .select("id, rol")
    .eq("id", alumnoId)
    .maybeSingle();
  if (!perfil || perfil.rol !== "alumno") return fail("No se encontró una cuenta de alumno válida.");

  const { data: actualizado, error } = await admin
    .from("alumno_perfil")
    .update({ portal_v2_habilitado: habilitado, updated_at: new Date().toISOString() })
    .eq("user_id", alumnoId)
    .select("user_id")
    .maybeSingle();

  if (error || !actualizado) {
    return fail("No fue posible cambiar el acceso a Portal V2. Intenta nuevamente.");
  }

  revalidatePath(`/admin/alumnos/${alumnoId}`);
  revalidatePath("/alumno", "layout");
  revalidatePath("/portal-v2", "layout");
  return okState;
}

export async function guardarNota(_prevState: FormState, formData: FormData): Promise<FormState> {
  const sesion = await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();

  const notaId = String(formData.get("nota_id") || "");
  const alumnoId = String(formData.get("alumno_id") || "");
  const texto = String(formData.get("texto") || "").trim();
  const fechaInicio = String(formData.get("fecha_inicio") || "");
  const fechaFin = String(formData.get("fecha_fin") || "");
  const importante = formData.get("importante") === "true";
  const marcarNueva = formData.get("marcar_nueva") !== "false";

  if (!texto) return fail("Escribe el contenido de la nota.");
  if (!fechaInicio) return fail("Indica desde qué fecha debe aparecer la nota.");
  if (fechaFin && fechaFin < fechaInicio) {
    return fail("La fecha final no puede ser anterior a la fecha inicial.");
  }

  const camposEditables = {
    texto,
    fecha_inicio: fechaInicio,
    fecha_fin: fechaFin || null,
    importante,
    marcar_nueva: marcarNueva,
  };

  if (notaId) {
    const { data: actualizada, error } = await supabase
      .from("notas_entrenador")
      .update(camposEditables)
      .eq("id", notaId)
      .select("id")
      .maybeSingle();
    if (error || !actualizada) return fail("No fue posible guardar la nota. Revisa tu conexión e intenta nuevamente.");
  } else {
    const { error } = await supabase.from("notas_entrenador").insert({
      ...camposEditables,
      alumno_id: alumnoId,
      entrenador_id: sesion.userId,
    });
    if (error) return fail("No fue posible guardar la nota. Revisa tu conexión e intenta nuevamente.");
  }

  revalidatePath(`/admin/alumnos/${alumnoId}`);
  return okState;
}

export async function eliminarNota(formData: FormData): Promise<void> {
  await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();

  const notaId = String(formData.get("nota_id") || "");
  const alumnoId = String(formData.get("alumno_id") || "");
  if (!notaId) return;

  await supabase.from("notas_entrenador").delete().eq("id", notaId);
  revalidatePath(`/admin/alumnos/${alumnoId}`);
}

export async function actualizarPerfilAlumno(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();

  const alumnoId = String(formData.get("alumno_id") || "");
  const objetivo = String(formData.get("objetivo") || "").trim();
  const proximoControlFecha = String(formData.get("proximo_control_fecha") || "");
  const planEntrenamiento = String(formData.get("plan_entrenamiento") || "");
  const sesionesTexto = String(formData.get("sesiones_mensuales") || "");
  const diasTexto = String(formData.get("dias_entrenamiento_semana") || "");
  if (planEntrenamiento && !esCodigoPlanEntrenamiento(planEntrenamiento)) return fail("El plan seleccionado no es válido.");
  const sesionesMensuales = sesionesTexto ? Number(sesionesTexto) : null;
  const diasSemana = diasTexto ? Number(diasTexto) : null;
  if (sesionesMensuales !== null && (!Number.isInteger(sesionesMensuales) || sesionesMensuales < 1 || sesionesMensuales > 31)) {
    return fail("Las sesiones mensuales deben estar entre 1 y 31.");
  }
  if (diasSemana !== null && (!Number.isInteger(diasSemana) || diasSemana < 1 || diasSemana > 7)) {
    return fail("Los días semanales deben estar entre 1 y 7.");
  }

  const { data: actualizado, error } = await supabase
    .from("alumno_perfil")
    .update({
      objetivo: objetivo || null,
      proximo_control_fecha: proximoControlFecha || null,
      plan_entrenamiento: planEntrenamiento && esCodigoPlanEntrenamiento(planEntrenamiento) ? planEntrenamiento : null,
      sesiones_mensuales: planEntrenamiento ? sesionesMensuales : null,
      dias_entrenamiento_semana: planEntrenamiento ? diasSemana : null,
      plan_entrenamiento_pausado: planEntrenamiento
        ? formData.get("plan_entrenamiento_pausado") === "on"
        : false,
      // La casilla dice "no usar temporizador", así que marcada significa
      // apagado. Se invierte acá y no en la base para que la columna se lea
      // sola: `temporizador_descanso` true es el comportamiento normal.
      temporizador_descanso: formData.get("sin_temporizador_descanso") !== "on",
      // El entrenador lo está tocando él mismo desde acá — nunca penaliza,
      // sin importar en qué quedó. Solo penaliza cuando el ALUMNO lo apaga
      // desde su propio botón (ver src/app/alumno/perfil/actions.ts).
      temporizador_descanso_desactivado_por_alumno: false,
      // A diferencia de plan_entrenamiento_pausado, no depende de tener un
      // plan asignado: corta el acceso a toda la app igual.
      acceso_bloqueado: formData.get("acceso_bloqueado") === "on",
      acceso_bloqueado_motivo: String(formData.get("acceso_bloqueado_motivo") || "").trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", alumnoId)
    .select("user_id")
    .maybeSingle();

  // Este guardado incluye acceso_bloqueado -- el corte de acceso de un
  // alumno problemático. Confirmar solo `!error` no alcanza: si RLS u otra
  // condición bloquea el update sin devolver error, Supabase responde 0
  // filas afectadas y el admin vería "guardado" sin que el bloqueo se haya
  // aplicado de verdad. Mismo criterio que ya usa actualizarAccesoPortalV2
  // más arriba en este archivo.
  if (error || !actualizado) {
    return fail("No fue posible guardar los cambios. Revisa tu conexión e intenta nuevamente.");
  }

  revalidatePath(`/admin/alumnos/${alumnoId}`);
  revalidatePath("/alumno/inicio");
  revalidatePath("/alumno/entrenar");
  return okState;
}

/**
 * Corrección rápida del plan desde la lista de Alumnos, sin entrar a la
 * ficha completa — pedido explícito: "déjame los nombres de los alumnos con
 * su plan al ladito y un botón de editar... que yo pueda corregir estas
 * cosas". A diferencia de `actualizarPerfilAlumno`, esta acción SOLO toca las
 * columnas del plan: si reusara la otra con un formulario mínimo, `objetivo`
 * y `proximo_control_fecha` quedarían pisados a null por venir vacíos.
 */
export async function actualizarPlanRapido(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();

  const alumnoId = String(formData.get("alumno_id") || "");
  const planEntrenamiento = String(formData.get("plan_entrenamiento") || "");
  if (!alumnoId) return fail("Falta el alumno.");
  if (planEntrenamiento && !esCodigoPlanEntrenamiento(planEntrenamiento)) {
    return fail("El plan seleccionado no es válido.");
  }

  const plan = planEntrenamiento && esCodigoPlanEntrenamiento(planEntrenamiento)
    ? PLANES_ENTRENAMIENTO[planEntrenamiento]
    : null;

  const { data: actualizado, error } = await supabase
    .from("alumno_perfil")
    .update({
      plan_entrenamiento: plan?.codigo ?? null,
      sesiones_mensuales: plan?.sesionesMensuales ?? null,
      dias_entrenamiento_semana: plan?.diasSemana ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", alumnoId)
    .select("user_id")
    .maybeSingle();

  if (error || !actualizado) return fail("No fue posible guardar el plan. Revisa tu conexión e intenta nuevamente.");

  revalidatePath("/admin/alumnos");
  revalidatePath(`/admin/alumnos/${alumnoId}`);
  revalidatePath("/admin/generador");
  revalidatePath("/alumno/inicio");
  revalidatePath("/alumno/entrenar");
  return okState;
}
