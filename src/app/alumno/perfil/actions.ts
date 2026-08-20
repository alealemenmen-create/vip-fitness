"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAlumno } from "@/lib/auth";
import { cambiarCorreoDeUsuario } from "@/lib/cuenta/correo";
import { SEXOS } from "@/lib/solicitudes/campos";
import { segundosDescansoPermitidos, validarDatosPersonales } from "@/lib/perfil/configuracion";
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

  const validacion = validarDatosPersonales({
    nombre: String(formData.get("nombre") || ""),
    fechaNacimiento: String(formData.get("fecha_nacimiento") || ""),
    estaturaCm: String(formData.get("estatura_cm") || ""),
    condicionMedica: String(formData.get("condicion_medica") || ""),
    restriccionAlimenticia: String(formData.get("restriccion_alimenticia") || ""),
    telefono: String(formData.get("telefono") || ""),
    sexo: String(formData.get("sexo") || ""),
  });
  if (!validacion.ok) return fail(validacion.error);

  const { datos } = validacion;
  // Lista cerrada, igual que en el registro público: el check de la base
  // rechazaría cualquier otro valor con un error mucho menos claro.
  if (datos.sexo && !SEXOS.some((s) => s.valor === datos.sexo)) return fail("Elige una opción válida.");

  const { error } = await supabase.rpc("actualizar_mi_perfil_personal_v2", {
    p_nombre: datos.nombre,
    p_fecha_nacimiento: datos.fechaNacimiento,
    p_estatura_cm: datos.estaturaCm,
    p_condicion_medica: datos.condicionMedica,
    p_restriccion_alimenticia: datos.restriccionAlimenticia,
    p_telefono: datos.telefono,
    p_sexo: datos.sexo as Sexo | null,
  });

  if (error) {
    console.error("[perfil] guardado atómico falló:", error);
    return fail(error.message.includes("actualizar_mi_perfil_personal_v2")
      ? "La actualización segura del perfil aún no está disponible. Ningún dato fue modificado."
      : "No fue posible guardar tus datos. Ningún cambio parcial fue aplicado.");
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
  const { data, error } = await supabase
    .from("alumno_perfil")
    .update({
      temporizador_descanso: activo,
      temporizador_descanso_desactivado_por_alumno: !activo,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", alumnoId)
    .select("user_id")
    .maybeSingle();

  if (error || !data) {
    console.error("[perfil] no se pudo guardar temporizador_descanso:", error?.message ?? "fila no encontrada");
    return fail("No pudimos guardar el temporizador. Tu configuración anterior se conserva.");
  }

  revalidatePath("/alumno/perfil");
  revalidatePath("/alumno/entrenar");
  revalidatePath("/portal-v2/perfil");
  revalidatePath("/portal-v2/mas");
  return okState;
}

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
  if (!segundosDescansoPermitidos(segundos)) return fail("El tiempo de descanso no es válido.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("alumno_perfil")
    .update({ segundos_descanso_preferido: segundos, updated_at: new Date().toISOString() })
    .eq("user_id", alumnoId)
    .select("user_id")
    .maybeSingle();

  if (error || !data) {
    console.error("[perfil] no se pudo guardar segundos_descanso_preferido:", error?.message ?? "fila no encontrada");
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
  const { data: actualizado, error } = await supabase
    .from("alumno_perfil")
    .update({ tema_boton: tema, updated_at: new Date().toISOString() })
    .eq("user_id", alumnoId)
    .select("user_id")
    .maybeSingle();

  if (error || !actualizado) {
    console.error("[perfil] no se pudo guardar tema_boton:", error?.message ?? "0 filas afectadas");
  }
}
