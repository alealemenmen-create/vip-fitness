"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAlumno } from "@/lib/auth";
import { cambiarCorreoDeUsuario } from "@/lib/cuenta/correo";
import { SEXOS } from "@/lib/solicitudes/campos";
import type { Sexo } from "@/lib/supabase/types";

export type FormState = { error: string | null; ok: boolean };
const okState: FormState = { error: null, ok: true };

function fail(mensaje: string): FormState {
  return { error: mensaje, ok: false };
}

export async function cambiarMiCorreo(_prevState: FormState, formData: FormData): Promise<FormState> {
  const { alumnoId, soloLectura } = await requireAlumno();
  if (soloLectura) return fail("No puedes editar el perfil en modo solo lectura.");

  const nuevoCorreo = String(formData.get("correo") || "");
  const mensajeError = await cambiarCorreoDeUsuario(alumnoId, nuevoCorreo);
  if (mensajeError) return fail(mensajeError);

  return okState;
}

export async function guardarDatosPersonales(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const { alumnoId, soloLectura } = await requireAlumno();
  if (soloLectura) return fail("No puedes editar el perfil en modo solo lectura.");

  const supabase = await createClient();

  const nombre = String(formData.get("nombre") || "").trim();
  const fechaNacimiento = String(formData.get("fecha_nacimiento") || "");
  const estaturaCm = String(formData.get("estatura_cm") || "");
  const condicionMedica = String(formData.get("condicion_medica") || "").trim();
  const restriccionAlimenticia = String(formData.get("restriccion_alimenticia") || "").trim();
  const telefono = String(formData.get("telefono") || "").trim();
  const sexo = String(formData.get("sexo") || "").trim();

  if (!nombre) return fail("Ingresa tu nombre.");
  if (estaturaCm && (Number(estaturaCm) <= 0 || Number(estaturaCm) > 260)) {
    return fail("Ingresa una estatura válida en centímetros.");
  }
  if (telefono && !/^[\d\s+()-]{8,20}$/.test(telefono)) {
    return fail("Ingresa un teléfono válido.");
  }
  // Lista cerrada, igual que en el registro público: el check de la base
  // rechazaría cualquier otro valor con un error mucho menos claro.
  if (sexo && !SEXOS.some((s) => s.valor === sexo)) return fail("Elige una opción válida.");

  const { error: errorPerfil } = await supabase
    .from("perfiles")
    .update({ nombre })
    .eq("id", alumnoId);

  if (errorPerfil) {
    console.error("[perfil] update perfiles falló:", errorPerfil);
    return fail("No fue posible guardar tu nombre. Intenta nuevamente.");
  }

  const { error: errorDatos } = await supabase
    .from("alumno_perfil")
    .update({
      fecha_nacimiento: fechaNacimiento || null,
      estatura_cm: estaturaCm ? Number(estaturaCm) : null,
      condicion_medica: condicionMedica || null,
      restriccion_alimenticia: restriccionAlimenticia || null,
      telefono: telefono || null,
      sexo: (sexo || null) as Sexo | null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", alumnoId);

  if (errorDatos) {
    console.error("[perfil] update alumno_perfil falló:", errorDatos);
    return fail("No fue posible guardar tus datos. Intenta nuevamente.");
  }

  revalidatePath("/alumno/perfil");
  revalidatePath("/alumno/inicio");
  revalidatePath("/portal-v2/perfil");
  revalidatePath("/portal-v2/mas");
  revalidatePath(`/admin/alumnos/${alumnoId}`);
  return okState;
}

/**
 * El alumno prende/apaga su propio temporizador de descanso — antes solo lo
 * tocaba el entrenador. Apagarlo desde acá marca
 * `temporizador_descanso_desactivado_por_alumno = true`, que en
 * `finalizarSesion` (`alumno/entrenar/actions.ts`) cambia el bono normal de
 * "Entrenamiento finalizado" (hasta 300 puntos) por una penalización fija de
 * -50 — el aviso antes de confirmar vive en el componente del cliente, no acá.
 */
export async function actualizarTemporizadorDescansoAlumno(activo: boolean): Promise<FormState> {
  const { alumnoId, soloLectura } = await requireAlumno();
  if (soloLectura) return fail("No puedes cambiar el temporizador en modo solo lectura.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("alumno_perfil")
    .update({
      temporizador_descanso: activo,
      temporizador_descanso_desactivado_por_alumno: !activo,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", alumnoId);

  if (error) {
    console.error("[perfil] no se pudo guardar temporizador_descanso:", error.message);
    return fail("No pudimos guardar el temporizador. Tu configuración anterior se conserva.");
  }

  revalidatePath("/alumno/perfil");
  revalidatePath("/alumno/entrenar");
  revalidatePath("/portal-v2/perfil");
  revalidatePath("/portal-v2/mas");
  return okState;
}

const SEGUNDOS_DESCANSO_VALIDOS = new Set([45, 60, 90, 120, 150]);

/**
 * El alumno elige un número fijo de segundos de descanso que reemplaza el
 * `descanso_segundos` programado por el entrenador en TODOS sus ejercicios
 * (o `null` para volver a lo que el entrenador programó, ejercicio por
 * ejercicio — el comportamiento de siempre). Lo consume
 * `obtenerSesionCompleta` en `alumno/entrenar/data.ts`.
 */
export async function actualizarSegundosDescansoPreferido(segundos: number | null): Promise<FormState> {
  const { alumnoId, soloLectura } = await requireAlumno();
  if (soloLectura) return fail("No puedes cambiar el descanso en modo solo lectura.");
  if (segundos !== null && !SEGUNDOS_DESCANSO_VALIDOS.has(segundos)) return fail("El tiempo de descanso no es válido.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("alumno_perfil")
    .update({ segundos_descanso_preferido: segundos, updated_at: new Date().toISOString() })
    .eq("user_id", alumnoId);

  if (error) {
    console.error("[perfil] no se pudo guardar segundos_descanso_preferido:", error.message);
    return fail("No pudimos guardar ese descanso. La configuración anterior se conserva.");
  }

  revalidatePath("/alumno/perfil");
  revalidatePath("/alumno/entrenar");
  revalidatePath("/portal-v2/perfil");
  revalidatePath("/portal-v2/mas");
  return okState;
}

/**
 * Guarda el tema de botones elegido en la cuenta (además de localStorage, que
 * sigue aplicándolo al instante sin esperar esta ida y vuelta al servidor).
 * Sin esto, entrar desde otro dispositivo o con el navegador limpio volvía
 * siempre al tema por defecto en vez de recordar la elección del alumno.
 */
export async function guardarTemaBoton(tema: string): Promise<void> {
  const { alumnoId, soloLectura } = await requireAlumno();
  if (soloLectura) return;
  if (tema !== "espejo" && tema !== "vip" && tema !== "masculino" && tema !== "femenino") return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("alumno_perfil")
    .update({ tema_boton: tema, updated_at: new Date().toISOString() })
    .eq("user_id", alumnoId);

  if (error) {
    console.error("[perfil] no se pudo guardar tema_boton:", error.message);
  }
}
