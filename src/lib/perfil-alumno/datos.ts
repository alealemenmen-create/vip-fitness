import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FICHA_VACIA, REFERENCIAS_FISICAS, TEMAS_SALUD, sufijoTiene, type FichaAlumno } from "./ficha";

/** Lectura y escritura de la ficha, en un solo lugar.
 *
 * Los tres formularios que existen (cuestionario de ingreso, "Mi
 * entrenamiento" y el panel del entrenador) mandan exactamente los mismos
 * campos y terminan acá. Si mañana se agrega una pregunta, se agrega una vez. */

export async function leerFicha(db: SupabaseClient, alumnoId: string): Promise<FichaAlumno> {
  const [{ data: personal }, { data: entrenamiento }] = await Promise.all([
    db.from("alumno_perfil").select("fecha_nacimiento, sexo, estatura_cm, telefono").eq("user_id", alumnoId).maybeSingle(),
    db.from("perfiles_entrenamiento").select("*").eq("alumno_id", alumnoId).maybeSingle(),
  ]);

  return {
    ...FICHA_VACIA,
    fechaNacimiento: personal?.fecha_nacimiento ?? null,
    sexo: personal?.sexo ?? null,
    estaturaCm: personal?.estatura_cm ?? null,
    telefono: personal?.telefono ?? null,
    objetivoPrincipal: entrenamiento?.objetivo_principal ?? null,
    objetivoSecundario: entrenamiento?.objetivo_secundario ?? null,
    categoriaReferencia: entrenamiento?.categoria_competencia ?? null,
    diasDisponibles: entrenamiento?.dias_disponibles ?? null,
    minutosSesion: entrenamiento?.minutos_sesion ?? null,
    experiencia: entrenamiento?.experiencia ?? null,
    cardioNivel: entrenamiento?.cardio_nivel ?? null,
    preferenciaEquipo: entrenamiento?.preferencia_equipo ?? null,
    actividadesAdicionales: entrenamiento?.actividades_adicionales ?? null,
    ejerciciosPreferidos: entrenamiento?.ejercicios_preferidos ?? null,
    ejerciciosNoDeseados: entrenamiento?.ejercicios_no_deseados ?? null,
    molestias: entrenamiento?.molestias ?? null,
    lesionesDiagnosticadas: entrenamiento?.lesiones_diagnosticadas ?? null,
    operacionesPrevias: entrenamiento?.operaciones_previas ?? null,
    condicionesMedicas: entrenamiento?.condiciones_medicas ?? null,
    medicamentosRelevantes: entrenamiento?.medicamentos_relevantes ?? null,
    autorizacionMedica: Boolean(entrenamiento?.autorizacion_medica),
    completadoEn: entrenamiento?.completado_en ?? null,
  };
}

const texto = (fd: FormData, nombre: string) => String(fd.get(nombre) || "").trim() || null;
const numero = (fd: FormData, nombre: string) => {
  const bruto = String(fd.get(nombre) || "").trim();
  if (!bruto) return null;
  const n = Number(bruto);
  return Number.isFinite(n) ? n : null;
};

export type ResultadoFicha = { error: string | null; ok: boolean };

/** Valida y guarda. Devuelve el primer error en lenguaje del alumno — no un
 * "campo inválido" genérico, que no le dice a nadie qué arreglar. */
export async function guardarFicha(
  db: SupabaseClient,
  alumnoId: string,
  formData: FormData
): Promise<ResultadoFicha> {
  const fechaNacimiento = texto(formData, "fecha_nacimiento");
  const sexo = texto(formData, "sexo");
  const objetivo = texto(formData, "objetivo_principal");
  const dias = numero(formData, "dias_disponibles");
  const minutos = numero(formData, "minutos_sesion");
  const experiencia = texto(formData, "experiencia");
  const categoria = texto(formData, "categoria_competencia") ?? "ninguna";

  if (!fechaNacimiento) return { error: "Falta tu fecha de nacimiento.", ok: false };
  if (!sexo) return { error: "Falta indicar el sexo.", ok: false };
  if (!objetivo) return { error: "Falta elegir el objetivo principal.", ok: false };
  if (!experiencia) return { error: "Falta indicar la experiencia entrenando.", ok: false };
  if (!REFERENCIAS_FISICAS.some((opcion) => opcion.value === categoria)) {
    return { error: "La referencia física seleccionada no es válida.", ok: false };
  }
  if (dias === null || dias < 1 || dias > 7) return { error: "Los días por semana tienen que estar entre 1 y 7.", ok: false };
  if (minutos === null || minutos < 20 || minutos > 180) return { error: "Los minutos por sesión tienen que estar entre 20 y 180.", ok: false };

  // Los cinco temas de salud: si contestó "sí", el detalle es obligatorio —
  // un "sí" sin explicación no le sirve a nadie.
  const salud: Record<string, string | null> = {};
  for (const tema of TEMAS_SALUD) {
    const respuesta = String(formData.get(sufijoTiene(tema.campo)) || "");
    if (respuesta !== "si" && respuesta !== "no") {
      return { error: `Falta contestar: ${tema.pregunta}`, ok: false };
    }
    const detalle = texto(formData, tema.campo);
    if (respuesta === "si" && !detalle) {
      return { error: `Contaste que sí en "${tema.pregunta}" — cuéntanos el detalle.`, ok: false };
    }
    salud[tema.campo] = respuesta === "si" ? detalle : null;
  }

  const requiereRevision = Object.values(salud).some(Boolean);
  const ahora = new Date().toISOString();

  const { error: errorPersonal } = await db
    .from("alumno_perfil")
    .update({
      fecha_nacimiento: fechaNacimiento,
      sexo,
      estatura_cm: numero(formData, "estatura_cm"),
      telefono: texto(formData, "telefono"),
    })
    .eq("user_id", alumnoId);
  if (errorPersonal) {
    console.error("[ficha] datos personales:", errorPersonal);
    return { error: "No fue posible guardar los datos personales.", ok: false };
  }

  const { error: errorEntrenamiento } = await db.from("perfiles_entrenamiento").upsert(
    {
      alumno_id: alumnoId,
      objetivo_principal: objetivo,
      objetivo_secundario: texto(formData, "objetivo_secundario"),
      categoria_competencia: categoria,
      dias_disponibles: dias,
      minutos_sesion: minutos,
      experiencia,
      cardio_nivel: texto(formData, "cardio_nivel"),
      preferencia_equipo: texto(formData, "preferencia_equipo"),
      actividades_adicionales: texto(formData, "actividades_adicionales"),
      ejercicios_preferidos: texto(formData, "ejercicios_preferidos"),
      ejercicios_no_deseados: texto(formData, "ejercicios_no_deseados"),
      ...salud,
      autorizacion_medica: formData.get("autorizacion_medica") === "si",
      declaracion_veracidad: true,
      requiere_revision: requiereRevision,
      completado_en: ahora,
      updated_at: ahora,
    },
    { onConflict: "alumno_id" }
  );
  if (errorEntrenamiento) {
    console.error("[ficha] perfil de entrenamiento:", errorEntrenamiento);
    return { error: "No fue posible guardar la ficha. Avísale a tu entrenador.", ok: false };
  }

  // El objetivo resumido de `alumno_perfil` lo siguen leyendo pantallas viejas.
  await db.from("alumno_perfil").update({ objetivo: objetivo.replaceAll("_", " ") }).eq("user_id", alumnoId);

  return { error: null, ok: true };
}
