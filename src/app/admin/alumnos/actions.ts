"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRol, COOKIE_VISTA_ALUMNO } from "@/lib/auth";
import { enviarCorreo, plantillaCredenciales } from "@/lib/email/resend";
import { cambiarCorreoDeUsuario } from "@/lib/cuenta/correo";
import { generarPassword } from "@/lib/cuenta/password";

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
  const sesion = await requireRol(["entrenador", "admin"]);

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
  await requireRol(["entrenador", "admin"]);

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
  const sesion = await requireRol(["entrenador", "admin"]);
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
  const sesion = await requireRol(["entrenador", "admin"]);
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
  const sesion = await requireRol(["entrenador", "admin"]);
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
  const { error } = await supabase.from("perfiles").update({ nombre }).eq("id", perfilId);
  if (error) return fail("No fue posible guardar el nombre. Intenta nuevamente.");

  revalidatePath("/admin/alumnos");
  revalidatePath(`/admin/alumnos/${perfilId}`);
  return okState;
}

export async function crearEntrenador(_prevState: FormState, formData: FormData): Promise<FormState> {
  await requireRol(["entrenador", "admin"]);

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
export async function entrarComoAlumno(formData: FormData): Promise<void> {
  await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();

  const alumnoId = String(formData.get("alumno_id") || "");

  const { data: alumno } = await supabase
    .from("alumno_perfil")
    .select("user_id")
    .eq("user_id", alumnoId)
    .maybeSingle();

  if (!alumno) return;

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

  redirect("/alumno/inicio");
}

/** Sale del modo "ver como alumno" y vuelve al panel del alumno visitado. */
export async function salirDeVistaAlumno(): Promise<void> {
  const cookieStore = await cookies();
  const alumnoId = cookieStore.get(COOKIE_VISTA_ALUMNO)?.value;
  cookieStore.delete(COOKIE_VISTA_ALUMNO);
  redirect(alumnoId ? `/admin/alumnos/${alumnoId}` : "/admin/alumnos");
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

  const { error } = notaId
    ? await supabase.from("notas_entrenador").update(camposEditables).eq("id", notaId)
    : await supabase.from("notas_entrenador").insert({
        ...camposEditables,
        alumno_id: alumnoId,
        entrenador_id: sesion.userId,
      });

  if (error) return fail("No fue posible guardar la nota. Revisa tu conexión e intenta nuevamente.");

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

  const { error } = await supabase
    .from("alumno_perfil")
    .update({
      objetivo: objetivo || null,
      proximo_control_fecha: proximoControlFecha || null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", alumnoId);

  if (error) {
    return fail("No fue posible guardar los cambios. Revisa tu conexión e intenta nuevamente.");
  }

  revalidatePath(`/admin/alumnos/${alumnoId}`);
  revalidatePath("/alumno/inicio");
  return okState;
}
