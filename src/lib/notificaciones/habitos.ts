import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { ultimosNDiasISO } from "@/lib/date";
import { crearNotificacionEntrenador } from "./crear";

// "Importante de verdad" no es un umbral fijo igual para todos (pedido de
// Alejandro, 2026-08-16): un alumno que nunca registra comida no genera
// aviso por no registrar hoy, pero uno que SIEMPRE lo hace y de repente
// paró, sí. Se compara contra el patrón propio de cada alumno en las
// últimas 4 semanas: 21 días de "línea base" + los últimos 7 días.
const DIAS_TOTAL = 28;
const DIAS_RECIENTE = 7;
// Con estos umbrales el hábito tiene que ser real (no dos registros
// sueltos) y el corte tiene que ser total (no "bajó un poco") — evita
// avisar por ruido normal de una semana floja.
const MINIMO_DIAS_COMIDA_BASE = 13; // ~62% de los 21 días de línea base
const MINIMO_DIAS_ENTRENO_BASE = 6; // ~2 veces por semana en la línea base
// No repetir el mismo aviso todos los días mientras el hábito sigue roto.
const HORAS_DEDUP = 24 * 6;

/**
 * Corre desde el cron diario (`/api/cron/notificaciones`). Compara, para
 * cada alumno, cuántos días con comida/entrenamiento tuvo en la línea base
 * (días 8 a 28 hacia atrás) contra los últimos 7 días. Si tenía un hábito
 * real y lo cortó de un día para otro, avisa al entrenador — con push,
 * porque es justo el tipo de aviso que amerita interrumpir.
 */
export async function detectarHabitosRotos(): Promise<{ ok: boolean; avisos: number }> {
  const admin = createAdminClient();
  const dias = ultimosNDiasISO(DIAS_TOTAL); // [hoy, ayer, ..., hace 27 días]
  const desde = dias[dias.length - 1];
  const diasRecientes = new Set(dias.slice(0, DIAS_RECIENTE));
  const diasBase = new Set(dias.slice(DIAS_RECIENTE));

  const { data: alumnos, error: errorAlumnos } = await admin.from("perfiles").select("id, nombre").eq("rol", "alumno");
  if (errorAlumnos || !alumnos || alumnos.length === 0) return { ok: !errorAlumnos, avisos: 0 };
  const idsAlumnos = alumnos.map((a) => a.id);
  const nombrePorId = new Map(alumnos.map((a) => [a.id, a.nombre]));

  const [{ data: registros }, { data: sesiones }] = await Promise.all([
    admin
      .from("registros_diarios")
      .select("alumno_id, fecha, comidas_registradas(id, omitida)")
      .in("alumno_id", idsAlumnos)
      .gte("fecha", desde),
    admin
      .from("sesiones_entrenamiento")
      .select("alumno_id, fecha")
      .in("alumno_id", idsAlumnos)
      .in("estado", ["completada", "finalizada_incompleta"])
      .gte("fecha", desde),
  ]);

  const diasComidaPorAlumno = new Map<string, Set<string>>();
  for (const r of registros ?? []) {
    const comidas = (r.comidas_registradas as unknown as { id: string; omitida: boolean }[]) ?? [];
    if (!comidas.some((c) => !c.omitida)) continue;
    const set = diasComidaPorAlumno.get(r.alumno_id) ?? new Set<string>();
    set.add(r.fecha);
    diasComidaPorAlumno.set(r.alumno_id, set);
  }
  const diasEntrenoPorAlumno = new Map<string, Set<string>>();
  for (const s of sesiones ?? []) {
    const set = diasEntrenoPorAlumno.get(s.alumno_id) ?? new Set<string>();
    set.add(s.fecha);
    diasEntrenoPorAlumno.set(s.alumno_id, set);
  }

  const contarEnVentana = (fechas: Set<string>, ventana: Set<string>) => {
    let n = 0;
    for (const f of fechas) if (ventana.has(f)) n++;
    return n;
  };

  let avisos = 0;
  for (const alumnoId of idsAlumnos) {
    const nombre = nombrePorId.get(alumnoId) ?? "Este alumno";

    const diasComida = diasComidaPorAlumno.get(alumnoId) ?? new Set<string>();
    const comidaBase = contarEnVentana(diasComida, diasBase);
    const comidaReciente = contarEnVentana(diasComida, diasRecientes);
    if (comidaBase >= MINIMO_DIAS_COMIDA_BASE && comidaReciente === 0) {
      await crearNotificacionEntrenador({
        tipo: "habito_comida",
        alumnoId,
        titulo: "Dejó de registrar comida",
        cuerpo: `${nombre} registraba comida casi todos los días (${comidaBase}/21) y no lo hizo en toda la última semana.`,
        prioridad: "alta",
        ruta: `/admin/alumnos/${alumnoId}`,
        claveDedup: `habito_comida:${alumnoId}`,
        horasDedup: HORAS_DEDUP,
      });
      avisos++;
    }

    const diasEntreno = diasEntrenoPorAlumno.get(alumnoId) ?? new Set<string>();
    const entrenoBase = contarEnVentana(diasEntreno, diasBase);
    const entrenoReciente = contarEnVentana(diasEntreno, diasRecientes);
    if (entrenoBase >= MINIMO_DIAS_ENTRENO_BASE && entrenoReciente === 0) {
      await crearNotificacionEntrenador({
        tipo: "habito_entrenamiento",
        alumnoId,
        titulo: "Dejó de entrenar",
        cuerpo: `${nombre} entrenaba seguido (${entrenoBase} sesiones en 3 semanas) y no registró ninguna en la última semana.`,
        prioridad: "alta",
        ruta: `/admin/alumnos/${alumnoId}`,
        claveDedup: `habito_entrenamiento:${alumnoId}`,
        horasDedup: HORAS_DEDUP,
      });
      avisos++;
    }
  }

  return { ok: true, avisos };
}
