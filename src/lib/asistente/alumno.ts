import "server-only";

import type { createClient } from "@/lib/supabase/server";
import { hoyISO, ultimosNDiasISO } from "@/lib/date";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type MarcaReciente = {
  ejercicio: string;
  grupo: string | null;
  fecha: string;
  pesoKg: number | null;
  pesoCorporal: boolean;
  repeticiones: number | null;
};

export type ContextoAlumnoVip = {
  recordatorios: string[];
  sesionesRecientes: { fecha: string; dia: string; estado: string }[];
  marcasRecientes: MarcaReciente[];
  progreso: { pesoActual: number | null; fechaPeso: string | null; ultimaFoto: string | null };
};

export async function obtenerContextoAlumnoVip(
  supabase: SupabaseServerClient,
  alumnoId: string
): Promise<ContextoAlumnoVip> {
  const hoy = hoyISO();
  const desde14 = ultimosNDiasISO(14)[13];
  const [{ data: sesiones }, { data: registroHoy }, { data: pesos }, { data: fotos }] = await Promise.all([
    supabase
      .from("sesiones_entrenamiento")
      .select("id, fecha, estado, rutina_dias(nombre)")
      .eq("alumno_id", alumnoId)
      .in("estado", ["completada", "finalizada_incompleta"])
      .gte("fecha", desde14)
      .order("fecha", { ascending: false })
      .limit(10),
    supabase
      .from("registros_diarios")
      .select("id, comidas_registradas(id, omitida)")
      .eq("alumno_id", alumnoId)
      .eq("fecha", hoy)
      .maybeSingle(),
    supabase
      .from("pesos_corporales")
      .select("fecha, peso_kg")
      .eq("alumno_id", alumnoId)
      .order("fecha", { ascending: false })
      .limit(1),
    supabase
      .from("fotos_progreso")
      .select("fecha_foto")
      .eq("alumno_id", alumnoId)
      .order("fecha_foto", { ascending: false })
      .limit(1),
  ]);

  const idsSesiones = (sesiones ?? []).map((sesion) => sesion.id);
  const { data: ejercicios } = idsSesiones.length
    ? await supabase
        .from("sesion_ejercicios")
        .select("id, sesion_id, rutina_dia_ejercicios(nombre, grupo_muscular)")
        .in("sesion_id", idsSesiones)
    : { data: [] };
  const idsEjercicios = (ejercicios ?? []).map((ejercicio) => ejercicio.id);
  const { data: series } = idsEjercicios.length
    ? await supabase
        .from("series_realizadas")
        .select("sesion_ejercicio_id, numero_serie, peso_kg, es_peso_corporal, reps_realizadas")
        .in("sesion_ejercicio_id", idsEjercicios)
        .order("numero_serie", { ascending: false })
    : { data: [] };

  const fechaPorSesion = new Map((sesiones ?? []).map((sesion) => [sesion.id, sesion.fecha]));
  const ejercicioPorId = new Map(
    (ejercicios ?? []).map((ejercicio) => {
      const programa = ejercicio.rutina_dia_ejercicios as unknown as { nombre: string; grupo_muscular: string | null } | null;
      return [ejercicio.id, { sesionId: ejercicio.sesion_id, nombre: programa?.nombre ?? "Ejercicio", grupo: programa?.grupo_muscular ?? null }];
    })
  );
  const marcas: MarcaReciente[] = [];
  const vistos = new Set<string>();
  for (const serie of series ?? []) {
    const ejercicio = ejercicioPorId.get(serie.sesion_ejercicio_id);
    if (!ejercicio) continue;
    const fecha = fechaPorSesion.get(ejercicio.sesionId);
    if (!fecha) continue;
    const clave = `${ejercicio.nombre}:${fecha}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    marcas.push({
      ejercicio: ejercicio.nombre,
      grupo: ejercicio.grupo,
      fecha,
      pesoKg: serie.peso_kg,
      pesoCorporal: serie.es_peso_corporal,
      repeticiones: serie.reps_realizadas,
    });
  }
  marcas.sort((a, b) => b.fecha.localeCompare(a.fecha));

  const comidas = (registroHoy?.comidas_registradas as unknown as { id: string; omitida: boolean }[] | null) ?? [];
  const recordatorios: string[] = [];
  if (!comidas.some((comida) => !comida.omitida)) recordatorios.push("Registra tu primera comida de hoy.");
  if (!sesiones?.some((sesion) => sesion.fecha === hoy)) recordatorios.push("Revisa si hoy corresponde continuar tu rutina.");
  const ultimoPeso = pesos?.[0] ?? null;
  if (!ultimoPeso || ultimoPeso.fecha < ultimosNDiasISO(7)[6]) recordatorios.push("Tu registro semanal de peso está pendiente.");
  const ultimaFoto = fotos?.[0]?.fecha_foto ?? null;
  if (!ultimaFoto || ultimaFoto < ultimosNDiasISO(7)[6]) recordatorios.push("Puedes actualizar tu foto semanal de progreso.");

  return {
    recordatorios,
    sesionesRecientes: (sesiones ?? []).map((sesion) => ({
      fecha: sesion.fecha,
      dia: (sesion.rutina_dias as unknown as { nombre: string } | null)?.nombre ?? "Entrenamiento",
      estado: sesion.estado,
    })),
    marcasRecientes: marcas.slice(0, 16),
    progreso: {
      pesoActual: ultimoPeso?.peso_kg ?? null,
      fechaPeso: ultimoPeso?.fecha ?? null,
      ultimaFoto,
    },
  };
}

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
}

/** Respuestas de historial que Portal VIP puede resolver sin IA ni costo. */
export function responderConHistorialLocal(
  pregunta: string,
  contexto: ContextoAlumnoVip
): string | null {
  const texto = normalizar(pregunta);
  if (/recordatorio|pendiente|que.*hacer/.test(texto)) {
    return contexto.recordatorios.length
      ? `Tienes ${contexto.recordatorios.length} recordatorio${contexto.recordatorios.length === 1 ? "" : "s"}: ${contexto.recordatorios.join(" ")}`
      : "No tienes recordatorios pendientes detectados hoy.";
  }

  if (/que.*entren|entrene|sesion.*reciente|historial.*entren/.test(texto)) {
    if (contexto.sesionesRecientes.length === 0) return "Todavía no tienes entrenamientos finalizados en los últimos 14 días.";
    const resumen = contexto.sesionesRecientes.slice(0, 5).map((sesion) => `${sesion.fecha}: ${sesion.dia}`).join("; ");
    return `Tus entrenamientos más recientes fueron: ${resumen}.`;
  }

  if (/mi progreso|peso actual|cuanto peso/.test(texto)) {
    return contexto.progreso.pesoActual === null
      ? "Todavía no tienes un peso corporal reciente registrado."
      : `Tu último peso registrado fue ${contexto.progreso.pesoActual} kg el ${contexto.progreso.fechaPeso}.`;
  }

  if (/levante|levant|peso.*ejercicio|repeticion|reps|marca/.test(texto)) {
    const grupos = ["pecho", "espalda", "piernas", "hombros", "brazos", "core", "cardio"];
    const grupo = grupos.find((opcion) => texto.includes(opcion));
    const marca = contexto.marcasRecientes.find((item) => {
      const ejercicio = normalizar(item.ejercicio);
      return grupo ? item.grupo === grupo : texto.split(/\s+/).some((palabra) => palabra.length > 4 && ejercicio.includes(palabra));
    }) ?? (grupo ? undefined : contexto.marcasRecientes[0]);
    if (!marca) return grupo ? `No encontré una marca reciente clasificada como ${grupo}.` : "No encontré una marca reciente para esa pregunta.";
    const peso = marca.pesoCorporal
      ? "con peso corporal"
      : marca.pesoKg === null
        ? "sin peso anotado"
        : `con ${marca.pesoKg} kg`;
    const reps = marca.repeticiones === null ? "sin repeticiones anotadas" : `${marca.repeticiones} repeticiones`;
    return `La marca más reciente encontrada es ${marca.ejercicio}, el ${marca.fecha}: ${peso} y ${reps}.`;
  }

  return null;
}
