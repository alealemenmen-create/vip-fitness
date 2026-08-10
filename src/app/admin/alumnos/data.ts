import "server-only";
import { formatInTimeZone } from "date-fns-tz";
import { createClient } from "@/lib/supabase/server";
import { mesActualISO, ultimosNDiasISO, hoyISO, ZONA_HORARIA_VIP } from "@/lib/date";
import { obtenerConfiguracionSupervision } from "@/lib/configuracion/supervision";
import { resolverPlanEntrenamiento, type CodigoPlanEntrenamiento } from "@/lib/planes-entrenamiento";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type EstadoAlumno = "atencion" | "normal" | "destacado";

export type IndicadorAlumno = {
  estado: EstadoAlumno;
  /** Cumplimiento de entrenamiento del mes calendario, 0-100+. */
  pctSesiones: number;
  sesionesHechas: number;
  sesionesAsignadas: number;
  /** Días con al menos una comida registrada en los últimos 7. */
  diasConComida: number;
  /** Días desde el último entrenamiento finalizado; null si nunca entrenó. */
  diasSinEntrenar: number | null;
  /** Frase corta que explica por qué está en ese estado. */
  motivo: string;
  /** Plan de entrenamiento CONTRATADO (cobrado), asignado por el entrenador
   * en la ficha del alumno — no confundir con lo que el alumno declaró en su
   * propio cuestionario (`perfiles_entrenamiento.dias_disponibles`), que es
   * autoreporte y puede no coincidir. Null si todavía no se le asignó plan. */
  planCodigo: CodigoPlanEntrenamiento | null;
  planDiasSemana: number | null;
  planSesionesMensuales: number | null;
};

const DIAS_VENTANA_COMIDAS = 7;

/**
 * Semáforo de supervisión para la lista del entrenador. Se calcula para todos
 * los alumnos con un número fijo de consultas (no una por alumno), combinando
 * dos señales: cuánto de su cupo mensual de entrenamientos cumplió, y con qué
 * regularidad registra sus comidas.
 */
export async function obtenerIndicadores(
  supabase: SupabaseServerClient,
  alumnoIds: string[]
): Promise<Map<string, IndicadorAlumno>> {
  const indicadores = new Map<string, IndicadorAlumno>();
  if (alumnoIds.length === 0) return indicadores;
  const config = await obtenerConfiguracionSupervision();

  const { desde, hasta } = mesActualISO();
  const ultimos7 = ultimosNDiasISO(DIAS_VENTANA_COMIDAS);
  const desde7 = ultimos7[ultimos7.length - 1];
  const ultimos30 = ultimosNDiasISO(30);
  const desde30 = ultimos30[ultimos30.length - 1];

  const [{ data: rutinas }, { data: sesionesMes }, { data: sesionesRecientes }, { data: registros }, { data: perfilesPlan }] =
    await Promise.all([
      supabase
        .from("rutinas")
        .select("id, alumno_id, created_at")
        .in("alumno_id", alumnoIds)
        .eq("activa", true),
      supabase
        .from("sesiones_entrenamiento")
        .select("alumno_id, fecha, rutina_dias(tipo)")
        .in("alumno_id", alumnoIds)
        .in("estado", ["completada", "finalizada_incompleta"])
        .gte("fecha", desde)
        .lte("fecha", hasta),
      supabase
        .from("sesiones_entrenamiento")
        .select("alumno_id, fecha")
        .in("alumno_id", alumnoIds)
        .in("estado", ["completada", "finalizada_incompleta"])
        .gte("fecha", desde30)
        .order("fecha", { ascending: false }),
      supabase
        .from("registros_diarios")
        .select("alumno_id, fecha, comidas_registradas(id, omitida)")
        .in("alumno_id", alumnoIds)
        .gte("fecha", desde7),
      supabase
        .from("alumno_perfil")
        .select("user_id, plan_entrenamiento, sesiones_mensuales, dias_entrenamiento_semana")
        .in("user_id", alumnoIds),
    ]);

  const planPorAlumno = new Map(
    (perfilesPlan ?? []).map((perfil) => [
      perfil.user_id,
      resolverPlanEntrenamiento(
        perfil.plan_entrenamiento,
        perfil.sesiones_mensuales,
        perfil.dias_entrenamiento_semana
      ),
    ])
  );

  // Días de entrenamiento por alumno → cupo mensual (días/semana × 4).
  const rutinaPorAlumno = new Map((rutinas ?? []).map((r) => [r.id, r.alumno_id]));
  // Rutina activa más antigua de cada alumno: si empezó a mitad de mes, el
  // cupo se prorratea desde ahí en vez de exigirle el mes completo.
  const inicioRutinaPorAlumno = new Map<string, string>();
  for (const r of rutinas ?? []) {
    const actual = inicioRutinaPorAlumno.get(r.alumno_id);
    if (!actual || r.created_at < actual) inicioRutinaPorAlumno.set(r.alumno_id, r.created_at);
  }
  const diasEntrenamiento = new Map<string, number>();
  if (rutinaPorAlumno.size > 0) {
    const { data: dias } = await supabase
      .from("rutina_dias")
      .select("rutina_id, tipo")
      .in("rutina_id", [...rutinaPorAlumno.keys()]);

    for (const d of dias ?? []) {
      if (d.tipo !== "entrenamiento") continue;
      const alumnoId = rutinaPorAlumno.get(d.rutina_id);
      if (!alumnoId) continue;
      diasEntrenamiento.set(alumnoId, (diasEntrenamiento.get(alumnoId) ?? 0) + 1);
    }
  }

  const hechasPorAlumno = new Map<string, number>();
  for (const s of sesionesMes ?? []) {
    const dia = s.rutina_dias as unknown as { tipo: string } | null;
    if (dia?.tipo !== "entrenamiento") continue;
    hechasPorAlumno.set(s.alumno_id, (hechasPorAlumno.get(s.alumno_id) ?? 0) + 1);
  }

  // Vienen ordenadas de más reciente a más antigua: la primera por alumno gana.
  const ultimaFecha = new Map<string, string>();
  for (const s of sesionesRecientes ?? []) {
    if (!ultimaFecha.has(s.alumno_id)) ultimaFecha.set(s.alumno_id, s.fecha);
  }

  const diasComidaPorAlumno = new Map<string, Set<string>>();
  for (const r of registros ?? []) {
    const comidas = (r.comidas_registradas as unknown as { id: string; omitida: boolean }[]) ?? [];
    if (!comidas.some((c) => !c.omitida)) continue;
    const set = diasComidaPorAlumno.get(r.alumno_id) ?? new Set<string>();
    set.add(r.fecha);
    diasComidaPorAlumno.set(r.alumno_id, set);
  }

  const hoy = hoyISO();
  const hoyMs = new Date(`${hoy}T00:00:00`).getTime();
  const inicioMesMs = new Date(`${desde}T00:00:00`).getTime();

  for (const alumnoId of alumnoIds) {
    const plan = planPorAlumno.get(alumnoId);
    const diasSemana = plan?.diasSemana ?? diasEntrenamiento.get(alumnoId) ?? 0;

    // Cupo prorrateado: si el mes recién empezó, o la rutina activa es más
    // nueva que el mes (alumno recién arrancó), no se le exige la cuota de
    // 4 semanas completas — solo la parte que ya pudo haber cumplido.
    const inicioRutinaISO = inicioRutinaPorAlumno.get(alumnoId);
    const inicioRutinaMs = inicioRutinaISO
      ? new Date(`${formatInTimeZone(new Date(inicioRutinaISO), ZONA_HORARIA_VIP, "yyyy-MM-dd")}T00:00:00`).getTime()
      : inicioMesMs;
    const inicioVentanaMs = Math.max(inicioMesMs, inicioRutinaMs);
    const diasTranscurridos = Math.max(1, Math.round((hoyMs - inicioVentanaMs) / 86_400_000) + 1);
    const sesionesAsignadas = Math.round(diasSemana * (diasTranscurridos / 7));
    const sesionesHechas = hechasPorAlumno.get(alumnoId) ?? 0;
    const pctSesiones =
      sesionesAsignadas > 0 ? Math.round((sesionesHechas / sesionesAsignadas) * 100) : 0;
    const diasConComida = diasComidaPorAlumno.get(alumnoId)?.size ?? 0;

    const fechaUltima = ultimaFecha.get(alumnoId);
    const diasSinEntrenar = fechaUltima
      ? Math.round(
          (new Date(`${hoy}T00:00:00`).getTime() - new Date(`${fechaUltima}T00:00:00`).getTime()) /
            86_400_000
        )
      : null;

    let estado: EstadoAlumno = "normal";
    let motivo = "Ritmo normal";

    if (diasSemana === 0) {
      estado = "atencion";
      motivo = "Sin rutina activa asignada";
    } else if (diasSinEntrenar === null) {
      estado = "atencion";
      motivo = "Todavía no registró ningún entrenamiento";
    } else if (diasSinEntrenar >= config.diasSinEntrenarAlerta) {
      estado = "atencion";
      motivo = `Hace ${diasSinEntrenar} días que no entrena`;
    } else if (sesionesAsignadas === 0) {
      // Rutina recién activada dentro de la ventana actual: todavía no
      // acumuló cupo prorrateado como para juzgar su cumplimiento.
      motivo = "Recién empezando, todavía sin cupo suficiente para evaluar";
    } else if (pctSesiones < config.pctEntrenamientoAtencion) {
      estado = "atencion";
      motivo = `Solo ${pctSesiones}% de sus sesiones del mes`;
    } else if (diasConComida <= config.diasComidaAtencion) {
      estado = "atencion";
      motivo = `Registró comidas solo ${diasConComida} de los últimos ${DIAS_VENTANA_COMIDAS} días`;
    } else if (
      pctSesiones >= config.pctEntrenamientoDestacado &&
      diasConComida >= config.diasComidaDestacado
    ) {
      estado = "destacado";
      motivo = `${pctSesiones}% de sus sesiones y ${diasConComida}/${DIAS_VENTANA_COMIDAS} días de comidas`;
    } else {
      motivo = `${pctSesiones}% de sus sesiones del mes`;
    }

    indicadores.set(alumnoId, {
      estado,
      pctSesiones,
      sesionesHechas,
      sesionesAsignadas,
      diasConComida,
      diasSinEntrenar,
      motivo,
      planCodigo: plan?.codigo ?? null,
      planDiasSemana: plan?.diasSemana ?? null,
      planSesionesMensuales: plan?.sesionesMensuales ?? null,
    });
  }

  return indicadores;
}

export type ReporteAlumno = IndicadorAlumno & {
  alumnoId: string;
  nombre: string;
  objetivo: string | null;
  /** Último peso registrado y cuánto cambió en los últimos 30 días. */
  pesoActual: number | null;
  pesoVariacion: number | null;
  /** Promedio de kcal de los días que sí registró, en la última semana. */
  kcalPromedio: number | null;
  kcalObjetivo: number | null;
  energiaPromedio: number | null;
  /** Molestias que el alumno reportó en su seguimiento diario esta semana. */
  molestias: string[];
  ultimaSesion: string | null;
  /** Días de la última semana con seguimiento diario completado. */
  diasConSeguimiento: number;
};

/**
 * Reporte completo de cada alumno para que el entrenador lo lea de un vistazo
 * en la lista, sin entrar a cada ficha. Todo con consultas agrupadas: la
 * cantidad de consultas no crece con la cantidad de alumnos.
 */
export async function obtenerReportes(
  supabase: SupabaseServerClient,
  alumnos: { id: string; nombre: string; objetivo: string | null }[]
): Promise<ReporteAlumno[]> {
  if (alumnos.length === 0) return [];

  const ids = alumnos.map((a) => a.id);
  const indicadores = await obtenerIndicadores(supabase, ids);

  const ultimos7 = ultimosNDiasISO(DIAS_VENTANA_COMIDAS);
  const desde7 = ultimos7[ultimos7.length - 1];
  const desde30 = ultimosNDiasISO(30)[29];

  const [{ data: pesos }, { data: seguimientos }, { data: registros }, { data: sesiones }] =
    await Promise.all([
      supabase
        .from("pesos_corporales")
        .select("alumno_id, fecha, peso_kg")
        .in("alumno_id", ids)
        .gte("fecha", desde30)
        .order("fecha", { ascending: true }),
      supabase
        .from("seguimientos_diarios")
        .select("alumno_id, fecha, energia, molestias")
        .in("alumno_id", ids)
        .gte("fecha", desde7),
      supabase
        .from("registros_diarios")
        .select("id, alumno_id, fecha")
        .in("alumno_id", ids)
        .gte("fecha", desde7),
      supabase
        .from("sesiones_entrenamiento")
        .select("alumno_id, fecha")
        .in("alumno_id", ids)
        .in("estado", ["completada", "finalizada_incompleta"])
        .order("fecha", { ascending: false }),
    ]);

  // Calorías consumidas por alumno en la semana: se recorren las comidas de
  // los registros encontrados y se valorizan con la tabla de alimentos.
  const registroIds = (registros ?? []).map((r) => r.id);
  const kcalPorAlumno = new Map<string, { total: number; dias: Set<string> }>();

  if (registroIds.length > 0) {
    const { data: comidas } = await supabase
      .from("comidas_registradas")
      .select("id, registro_diario_id, omitida")
      .in("registro_diario_id", registroIds);

    const comidasValidas = (comidas ?? []).filter((c) => !c.omitida);
    const registroPorComida = new Map(comidasValidas.map((c) => [c.id, c.registro_diario_id]));

    if (comidasValidas.length > 0) {
      const { data: consumidos } = await supabase
        .from("alimentos_consumidos")
        .select("comida_id, cantidad, alimentos(kcal, porcion_base)")
        .in(
          "comida_id",
          comidasValidas.map((c) => c.id)
        );

      const alumnoPorRegistro = new Map((registros ?? []).map((r) => [r.id, r.alumno_id]));
      const fechaPorRegistro = new Map((registros ?? []).map((r) => [r.id, r.fecha]));

      for (const item of consumidos ?? []) {
        const registroId = registroPorComida.get(item.comida_id);
        if (!registroId) continue;
        const alumnoId = alumnoPorRegistro.get(registroId);
        if (!alumnoId) continue;

        const alimento = item.alimentos as unknown as { kcal: number; porcion_base: number } | null;
        if (!alimento || alimento.porcion_base <= 0) continue;

        const acumulado = kcalPorAlumno.get(alumnoId) ?? { total: 0, dias: new Set<string>() };
        acumulado.total += alimento.kcal * (item.cantidad / alimento.porcion_base);
        const fecha = fechaPorRegistro.get(registroId);
        if (fecha) acumulado.dias.add(fecha);
        kcalPorAlumno.set(alumnoId, acumulado);
      }
    }
  }

  const pesosPorAlumno = new Map<string, { fecha: string; peso_kg: number }[]>();
  for (const p of pesos ?? []) {
    const lista = pesosPorAlumno.get(p.alumno_id) ?? [];
    lista.push(p);
    pesosPorAlumno.set(p.alumno_id, lista);
  }

  const seguimientosPorAlumno = new Map<
    string,
    { energia: number | null; molestias: string | null }[]
  >();
  for (const s of seguimientos ?? []) {
    const lista = seguimientosPorAlumno.get(s.alumno_id) ?? [];
    lista.push(s);
    seguimientosPorAlumno.set(s.alumno_id, lista);
  }

  const ultimaSesionPorAlumno = new Map<string, string>();
  for (const s of sesiones ?? []) {
    if (!ultimaSesionPorAlumno.has(s.alumno_id)) ultimaSesionPorAlumno.set(s.alumno_id, s.fecha);
  }

  // Meta calórica de todos los alumnos en UNA consulta.
  //
  // Antes se llamaba `obtenerPlanAlimentacion` una vez por alumno: con 10
  // alumnos eran 10 consultas (más otras 10 por las comidas del plan, que acá
  // no se usan). Medido con VIP_DEBUG_SQL, las 10 en paralelo se estorbaban
  // entre sí y cada una pasaba de ~108ms a ~273ms — el tramo más lento de
  // toda la pantalla. Esta versión pide solo la columna que se muestra
  // (`kcal_objetivo`) para todos de una vez.
  const { data: filasPlanes } = await supabase
    .from("planes_alimentacion")
    .select("alumno_id, kcal_objetivo, created_at")
    .in("alumno_id", ids)
    .eq("activo", true)
    .order("created_at", { ascending: false });

  // Viene del más nuevo al más viejo: el primero de cada alumno es el vigente,
  // igual criterio que `obtenerPlanAlimentacion`.
  const kcalObjetivoPorAlumno = new Map<string, number | null>();
  for (const fila of filasPlanes ?? []) {
    if (!kcalObjetivoPorAlumno.has(fila.alumno_id)) {
      kcalObjetivoPorAlumno.set(fila.alumno_id, fila.kcal_objetivo);
    }
  }

  return alumnos.map((alumno) => {
    const indicador = indicadores.get(alumno.id)!;

    const listaPesos = pesosPorAlumno.get(alumno.id) ?? [];
    const pesoActual = listaPesos.length ? listaPesos[listaPesos.length - 1].peso_kg : null;
    const pesoVariacion =
      listaPesos.length >= 2
        ? Math.round((listaPesos[listaPesos.length - 1].peso_kg - listaPesos[0].peso_kg) * 10) / 10
        : null;

    const kcal = kcalPorAlumno.get(alumno.id);
    const kcalPromedio =
      kcal && kcal.dias.size > 0 ? Math.round(kcal.total / kcal.dias.size) : null;

    const seguimientosAlumno = seguimientosPorAlumno.get(alumno.id) ?? [];
    const energias = seguimientosAlumno
      .map((s) => s.energia)
      .filter((e): e is number => e !== null);
    const energiaPromedio = energias.length
      ? Math.round((energias.reduce((a, b) => a + b, 0) / energias.length) * 10) / 10
      : null;

    const molestias = seguimientosAlumno
      .map((s) => s.molestias?.trim())
      .filter((m): m is string => Boolean(m));

    return {
      ...indicador,
      alumnoId: alumno.id,
      nombre: alumno.nombre,
      objetivo: alumno.objetivo,
      pesoActual,
      pesoVariacion,
      kcalPromedio,
      kcalObjetivo: kcalObjetivoPorAlumno.get(alumno.id) ?? null,
      energiaPromedio,
      molestias,
      ultimaSesion: ultimaSesionPorAlumno.get(alumno.id) ?? null,
      diasConSeguimiento: seguimientosAlumno.length,
    };
  });
}

export type AvisoNotaIA = { alumnoId: string; nombre: string; texto: string };

/** Notas generadas por IA (motivación por peso, refuerzo semanal) que el
 * entrenador todavía no vio — se avisa acá porque no hay otra forma de
 * enterarse salvo entrando a cada ficha una por una. */
export async function obtenerAvisosNotasIA(supabase: SupabaseServerClient): Promise<AvisoNotaIA[]> {
  const { data } = await supabase
    .from("notas_entrenador")
    .select("alumno_id, texto, created_at, perfiles!notas_entrenador_alumno_id_fkey(nombre)")
    .eq("generado_con_ia", true)
    .is("leida_en", null)
    .order("created_at", { ascending: false });

  return (data ?? []).map((fila) => ({
    alumnoId: fila.alumno_id,
    nombre: (fila.perfiles as unknown as { nombre: string } | null)?.nombre ?? "Alumno",
    texto: fila.texto,
  }));
}

