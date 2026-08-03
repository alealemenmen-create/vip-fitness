import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { mesActualISO } from "@/lib/date";
import { resolverTempo, type Tempo } from "@/lib/ejercicios/tempo";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** Si el alumno tiene una sesión en progreso (la empezó y se fue a otra
 * pestaña sin finalizarla), devuelve su id — se usa para reengancharlo ahí
 * en vez de mostrarle el calendario desde cero cada vez que vuelve a
 * Entrenar. */
export async function obtenerSesionEnProgreso(
  supabase: SupabaseServerClient,
  alumnoId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("sesiones_entrenamiento")
    .select("id")
    .eq("alumno_id", alumnoId)
    .eq("estado", "en_progreso")
    .order("hora_inicio", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

/**
 * Rutina activa del alumno.
 *
 * Va en `cache()` y crea su propio cliente en vez de recibirlo: solo la
 * pantalla de Inicio la necesitaba cinco veces por carga (entrenamiento de
 * hoy, resumen de días, balance del mes, historial y constancia), y cada una
 * repetía la misma consulta. Recibir el cliente como argumento rompía la
 * deduplicación, porque cada llamador pasaba una instancia distinta y eso
 * cambia la clave de caché.
 */
export const obtenerRutinaActiva = cache(async (alumnoId: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("rutinas")
    .select("id, nombre")
    .eq("alumno_id", alumnoId)
    .eq("activa", true)
    .limit(1)
    .maybeSingle();
  return data;
});

export type GrupoMuscular =
  | "pecho"
  | "espalda"
  | "piernas"
  | "hombros"
  | "brazos"
  | "core"
  | "cardio";

export type ResumenDia = {
  cantidadEjercicios: number;
  cantidadSeries: number;
  minutosEstimados: number;
  gruposMusculares: GrupoMuscular[];
};

export type DiaRutina = {
  id: string;
  nombre: string;
  tipo: "entrenamiento" | "descanso";
  descripcion: string | null;
  resumen: ResumenDia | null;
};

const SEGUNDOS_TRABAJO_POR_SERIE = 40;
const DESCANSO_DEFAULT_SEGUNDOS = 60;

/** Los días de una rutina, en orden — la posición es lo que determina a qué
 * número de calendario "falso" le toca cada uno (ver obtenerNumerosCalendario).
 *
 * También va en `cache()`: tres funciones distintas de Inicio la pedían para
 * la misma rutina en una sola carga (ver obtenerRutinaActiva). */
export const obtenerDiasRutina = cache(async (rutinaId: string): Promise<DiaRutina[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("rutina_dias")
    .select(
      "id, nombre, tipo, descripcion, rutina_dia_ejercicios(series_programadas, descanso_segundos, grupo_muscular)"
    )
    .eq("rutina_id", rutinaId)
    .order("orden");

  return (data ?? []).map((d) => {
    const ejercicios = (d.rutina_dia_ejercicios as unknown as
      | {
          series_programadas: number;
          descanso_segundos: number | null;
          grupo_muscular: GrupoMuscular | null;
        }[]
      | null) ?? [];

    let resumen: ResumenDia | null = null;
    if (d.tipo === "entrenamiento" && ejercicios.length > 0) {
      const cantidadSeries = ejercicios.reduce((acc, e) => acc + e.series_programadas, 0);
      const segundosTotales = ejercicios.reduce(
        (acc, e) =>
          acc +
          e.series_programadas * (SEGUNDOS_TRABAJO_POR_SERIE + (e.descanso_segundos ?? DESCANSO_DEFAULT_SEGUNDOS)),
        0
      );
      const gruposMusculares = [
        ...new Set(ejercicios.map((e) => e.grupo_muscular).filter((g): g is GrupoMuscular => g !== null)),
      ];
      resumen = {
        cantidadEjercicios: ejercicios.length,
        cantidadSeries,
        minutosEstimados: Math.round(segundosTotales / 60),
        gruposMusculares,
      };
    }

    return {
      id: d.id,
      nombre: d.nombre,
      tipo: d.tipo,
      descripcion: d.descripcion,
      resumen,
    };
  });
});

export type EstadoNumero = "no_iniciado" | "en_progreso" | "completado";

export type NumeroCalendario = {
  numero: number;
  dia: DiaRutina;
  estado: EstadoNumero;
  sesionId: string | null;
};

/** Calendario "falso": el número no es una fecha, es una posición secuencial
 * que se mapea al día de rutina que le toca por posición (número % cantidad
 * de días). Así, sin importar cuándo entrene en la vida real, el alumno
 * siempre sigue la rotación de días de su rutina en orden. */
export async function obtenerNumerosCalendario(
  supabase: SupabaseServerClient,
  alumnoId: string,
  rutinaId: string,
  diasRutina: DiaRutina[],
  desde: number,
  cantidad: number
): Promise<NumeroCalendario[]> {
  if (diasRutina.length === 0) return [];

  const numeros = Array.from({ length: cantidad }, (_, i) => desde + i).filter((n) => n >= 1);
  if (numeros.length === 0) return [];

  const { data: sesiones } = await supabase
    .from("sesiones_entrenamiento")
    .select("id, numero_calendario, estado")
    .eq("alumno_id", alumnoId)
    .eq("rutina_id", rutinaId)
    .in("numero_calendario", numeros);

  const sesionPorNumero = new Map((sesiones ?? []).map((s) => [s.numero_calendario, s]));

  return numeros.map((n) => {
    const dia = diasRutina[(n - 1) % diasRutina.length];
    const sesion = sesionPorNumero.get(n);
    const estado: EstadoNumero = !sesion
      ? "no_iniciado"
      : sesion.estado === "en_progreso"
        ? "en_progreso"
        : "completado";
    return { numero: n, dia, estado, sesionId: sesion?.id ?? null };
  });
}

/** El próximo número sin usar de la rutina activa (el más alto usado + 1). */
export async function obtenerProximoNumero(
  supabase: SupabaseServerClient,
  alumnoId: string,
  rutinaId: string
): Promise<number> {
  const { data } = await supabase
    .from("sesiones_entrenamiento")
    .select("numero_calendario")
    .eq("alumno_id", alumnoId)
    .eq("rutina_id", rutinaId)
    .not("numero_calendario", "is", null)
    .order("numero_calendario", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data?.numero_calendario ?? 0) + 1;
}

export type BalanceSesionesMes = {
  diasSemana: number;
  asignadas: number;
  consumidas: number;
  balance: number;
} | null;

/**
 * Sesiones del mes calendario actual: la rutina activa define "días/semana"
 * (cantidad de días tipo 'entrenamiento', sin contar descanso), que se
 * traduce a sesiones asignadas por mes (días/semana × 4). Se descuenta 1 por
 * cada sesión finalizada de un día de entrenamiento (no de descanso) con
 * fecha dentro del mes actual — "finalizada" incluye completa e incompleta,
 * pero no en_progreso (si el alumno reabre una sesión, se le devuelve el
 * cupo hasta que la vuelva a finalizar). Puede quedar en negativo: no se
 * bloquea, el entrenador decide qué hacer.
 */
export async function obtenerBalanceSesionesMes(
  supabase: SupabaseServerClient,
  alumnoId: string
): Promise<BalanceSesionesMes> {
  const rutina = await obtenerRutinaActiva(alumnoId);
  if (!rutina) return null;

  // Los días de la rutina y las sesiones del mes no dependen entre sí: se
  // piden juntas en vez de una después de la otra.
  const { desde, hasta } = mesActualISO();
  const [diasRutina, { data: sesiones }] = await Promise.all([
    obtenerDiasRutina(rutina.id),
    supabase
      .from("sesiones_entrenamiento")
      .select("id, fecha, estado, rutina_dias(tipo)")
      .eq("alumno_id", alumnoId)
      .in("estado", ["completada", "finalizada_incompleta"])
      .gte("fecha", desde)
      .lte("fecha", hasta),
  ]);

  const diasSemana = diasRutina.filter((d) => d.tipo === "entrenamiento").length;
  if (diasSemana === 0) return null;

  const asignadas = diasSemana * 4;

  const consumidas = (sesiones ?? []).filter((s) => {
    const dia = s.rutina_dias as unknown as { tipo: string } | null;
    return dia?.tipo === "entrenamiento";
  }).length;

  return { diasSemana, asignadas, consumidas, balance: asignadas - consumidas };
}

export type SerieRealizada = {
  numeroSerie: number;
  pesoKg: number | null;
  esPesoCorporal: boolean;
  repsRealizadas: number | null;
  /** El alumno marcó esta serie puntual como hecha — distinto de haber
   * cargado peso/reps, que puede pasar sin haberla completado de verdad. */
  realizada: boolean;
};

export type UltimoRegistro = { pesoKg: number | null; esPesoCorporal: boolean; reps: number | null; fecha: string } | null;

export type EjercicioSesion = {
  sesionEjercicioId: string;
  diaEjercicioId: string;
  orden: number;
  nombre: string;
  seriesProgramadas: number;
  repsProgramadas: string;
  descansoSegundos: number | null;
  tecnicaTipo: string | null;
  tecnicaInstruccion: string | null;
  observacion: string | null;
  /** Técnica de ejecución de la biblioteca del gimnasio. Se muestra como
   * sugerencia solo cuando la rutina no pidió una técnica propia. */
  tecnicaSugerida: string | null;
  grupoMuscular: GrupoMuscular | null;
  /** Qué dibujo mostrar. Null si el ejercicio no está emparejado con la
   * biblioteca o si todavía no corrió la migración 0026. */
  ilustracionSlug: string | null;
  /** Cuánto dura cada fase de la repetición. Null cuando ni la rutina lo trae
   * escrito ni la biblioteca lo tiene calculado todavía. */
  tempo: Tempo | null;
  completado: boolean;
  notaEjercicio: string | null;
  series: SerieRealizada[];
  ultimoRegistro: UltimoRegistro;
};

export type SesionCompleta = {
  id: string;
  fecha: string;
  numeroCalendario: number | null;
  estado: "en_progreso" | "completada" | "finalizada_incompleta" | "abandonada";
  horaInicio: string;
  horaFin: string | null;
  /** Cuándo se tocó "Iniciar rutina" en esta pantalla — null mientras la
   * rutina sigue bloqueada. Migración 0040; ver el respaldo en
   * `obtenerSesionCompleta` si todavía no corrió. */
  rutinaIniciadaEn: string | null;
  comentario: string | null;
  diaNombre: string;
  diaTipo: "entrenamiento" | "descanso";
  diaDescripcion: string | null;
  rutinaNombre: string;
  ejercicios: EjercicioSesion[];
} | null;

export async function obtenerSesionCompleta(
  supabase: SupabaseServerClient,
  alumnoId: string,
  sesionId: string
): Promise<SesionCompleta> {
  const COLUMNAS_SESION =
    "id, fecha, numero_calendario, estado, hora_inicio, hora_fin, comentario, dia_id, rutina_dias(nombre, tipo, descripcion), rutinas(nombre)";

  // Igual que con los ejercicios más abajo: si la migración 0040
  // (rutina_iniciada_en) todavía no corrió en este entorno, se degrada sola
  // en vez de romper la pantalla de sesión entera.
  const intentoSesion = await supabase
    .from("sesiones_entrenamiento")
    .select(`${COLUMNAS_SESION}, rutina_iniciada_en`)
    .eq("id", sesionId)
    .eq("alumno_id", alumnoId)
    .maybeSingle();
  const { data: sesion } = intentoSesion.error
    ? await supabase
        .from("sesiones_entrenamiento")
        .select(COLUMNAS_SESION)
        .eq("id", sesionId)
        .eq("alumno_id", alumnoId)
        .maybeSingle()
    : intentoSesion;

  if (!sesion) return null;

  // La ilustración del ejercicio viaja anidada en esta misma consulta, así que
  // no cuesta ningún viaje extra a Supabase.
  //
  // Se intenta primero con el join a `ejercicios` (migración 0026) y si falla
  // se repite sin él: el código puede llegar a producción antes que la
  // migración, y sin este respaldo la pantalla de sesión quedaría rota entera
  // hasta correrla. Ya pasó con las migraciones 0009, 0010 y 0013.
  const COLUMNAS_PROGRAMA =
    "orden, nombre, series_programadas, reps_programadas, descanso_segundos, tecnica_tipo, tecnica_instruccion, observacion, grupo_muscular";

  const consultarEjercicios = (columnasPrograma: string) =>
    supabase
      .from("sesion_ejercicios")
      .select(`id, dia_ejercicio_id, completado, nota, rutina_dia_ejercicios(${columnasPrograma})`)
      .eq("sesion_id", sesionId);

  // El `select` se arma con plantilla, así que el parser de tipos de PostgREST
  // no puede inferir la forma del resultado — se declara a mano, igual que en
  // `obtenerCatalogoAlimentos`.
  type FilaBiblioteca = {
    ilustracion_slug: string | null;
    tempo?: string | null;
    tempo_nota?: string | null;
    /** Cómo se ejecuta el ejercicio según la biblioteca del gimnasio. Es la
     * sugerencia que se muestra cuando la rutina no pide una técnica puntual. */
    tecnica?: string | null;
  };

  type FilaSesionEjercicio = {
    id: string;
    dia_ejercicio_id: string;
    completado: boolean;
    nota: string | null;
    rutina_dia_ejercicios: {
      orden: number;
      nombre: string;
      series_programadas: number;
      reps_programadas: string;
      descanso_segundos: number | null;
      tecnica_tipo: string | null;
      tecnica_instruccion: string | null;
      observacion: string | null;
      grupo_muscular: GrupoMuscular | null;
      // Presente solo si la migración 0026 ya corrió (ver el respaldo arriba);
      // los campos de tempo, solo si además corrió la 0031.
      ejercicios?: FilaBiblioteca | FilaBiblioteca[] | null;
    } | null;
  };

  // Tres intentos encadenados, del select más completo al más pobre: con
  // tempo (migración 0031), sin tempo pero con biblioteca (0026), y pelado.
  // Cada migración que todavía no haya corrido se degrada sola en vez de
  // dejar al alumno sin pantalla de entrenamiento.
  const intento = await consultarEjercicios(
    `${COLUMNAS_PROGRAMA}, ejercicios(ilustracion_slug, tempo, tempo_nota, tecnica)`
  );
  const conBiblioteca = intento.error
    ? await consultarEjercicios(`${COLUMNAS_PROGRAMA}, ejercicios(ilustracion_slug)`)
    : intento;
  const resultado = conBiblioteca.error
    ? await consultarEjercicios(COLUMNAS_PROGRAMA)
    : conBiblioteca;

  const lista = (resultado.data ?? []) as unknown as FilaSesionEjercicio[];
  const sesionEjercicioIds = lista.map((e) => e.id);

  const { data: todasLasSeries } = sesionEjercicioIds.length
    ? await supabase
        .from("series_realizadas")
        .select("sesion_ejercicio_id, numero_serie, peso_kg, es_peso_corporal, reps_realizadas, realizada")
        .in("sesion_ejercicio_id", sesionEjercicioIds)
    : { data: [] };

  const seriesPorEjercicio = new Map<string, SerieRealizada[]>();
  for (const s of todasLasSeries ?? []) {
    const arr = seriesPorEjercicio.get(s.sesion_ejercicio_id) ?? [];
    arr.push({
      numeroSerie: s.numero_serie,
      pesoKg: s.peso_kg,
      esPesoCorporal: s.es_peso_corporal,
      repsRealizadas: s.reps_realizadas,
      realizada: s.realizada,
    });
    seriesPorEjercicio.set(s.sesion_ejercicio_id, arr);
  }

  const ejercicios: EjercicioSesion[] = [];
  for (const se of lista) {
    const prog = se.rutina_dia_ejercicios;
    if (!prog) continue;

    // PostgREST devuelve la relación como objeto o como arreglo según la
    // cardinalidad que infiera; acá siempre es a lo sumo uno.
    const dellaBiblioteca = Array.isArray(prog.ejercicios) ? prog.ejercicios[0] : prog.ejercicios;

    ejercicios.push({
      sesionEjercicioId: se.id,
      diaEjercicioId: se.dia_ejercicio_id,
      orden: prog.orden,
      nombre: prog.nombre,
      seriesProgramadas: prog.series_programadas,
      repsProgramadas: prog.reps_programadas,
      descansoSegundos: prog.descanso_segundos,
      tecnicaTipo: prog.tecnica_tipo,
      tecnicaInstruccion: prog.tecnica_instruccion,
      observacion: prog.observacion,
      tecnicaSugerida: dellaBiblioteca?.tecnica ?? null,
      grupoMuscular: prog.grupo_muscular,
      ilustracionSlug: dellaBiblioteca?.ilustracion_slug ?? null,
      // Lo que el entrenador escribió en la rutina gana sobre lo que dedujo la
      // IA para la biblioteca. Ver src/lib/ejercicios/tempo.ts.
      tempo: resolverTempo(
        [prog.observacion, prog.tecnica_instruccion],
        dellaBiblioteca?.tempo,
        dellaBiblioteca?.tempo_nota
      ),
      completado: se.completado,
      notaEjercicio: se.nota,
      series: (seriesPorEjercicio.get(se.id) ?? []).sort((a, b) => a.numeroSerie - b.numeroSerie),
      ultimoRegistro: await obtenerUltimoRegistro(supabase, alumnoId, se.dia_ejercicio_id, sesionId),
    });
  }

  ejercicios.sort((a, b) => a.orden - b.orden);

  const dia = sesion.rutina_dias as unknown as {
    nombre: string;
    tipo: "entrenamiento" | "descanso";
    descripcion: string | null;
  } | null;
  const rutinaInfo = sesion.rutinas as unknown as { nombre: string } | null;

  return {
    id: sesion.id,
    fecha: sesion.fecha,
    numeroCalendario: sesion.numero_calendario,
    estado: sesion.estado,
    horaInicio: sesion.hora_inicio,
    horaFin: sesion.hora_fin,
    rutinaIniciadaEn: (sesion as { rutina_iniciada_en?: string | null }).rutina_iniciada_en ?? null,
    comentario: sesion.comentario,
    diaNombre: dia?.nombre ?? "",
    diaTipo: dia?.tipo ?? "entrenamiento",
    diaDescripcion: dia?.descripcion ?? null,
    rutinaNombre: rutinaInfo?.nombre ?? "",
    ejercicios,
  };
}

export type SesionHistorial = {
  id: string;
  fecha: string;
  numeroCalendario: number | null;
  estado: "completada" | "finalizada_incompleta" | "abandonada";
  diaNombre: string;
  completados: number;
  total: number;
  comentario: string | null;
  horaInicio: string | null;
  horaFin: string | null;
};

export async function obtenerHistorialSesiones(
  supabase: SupabaseServerClient,
  alumnoId: string,
  limite = 30
): Promise<SesionHistorial[]> {
  const { data: sesiones } = await supabase
    .from("sesiones_entrenamiento")
    .select("id, fecha, numero_calendario, estado, comentario, hora_inicio, hora_fin, rutina_dias(nombre)")
    .eq("alumno_id", alumnoId)
    .neq("estado", "en_progreso")
    .order("fecha", { ascending: false })
    .limit(limite);

  if (!sesiones || sesiones.length === 0) return [];

  const sesionIds = sesiones.map((s) => s.id);
  const { data: ejercicios } = await supabase
    .from("sesion_ejercicios")
    .select("sesion_id, completado")
    .in("sesion_id", sesionIds);

  const conteos = new Map<string, { completados: number; total: number }>();
  for (const e of ejercicios ?? []) {
    const actual = conteos.get(e.sesion_id) ?? { completados: 0, total: 0 };
    actual.total += 1;
    if (e.completado) actual.completados += 1;
    conteos.set(e.sesion_id, actual);
  }

  return sesiones.map((s) => {
    const dia = s.rutina_dias as unknown as { nombre: string } | null;
    const c = conteos.get(s.id) ?? { completados: 0, total: 0 };
    return {
      id: s.id,
      fecha: s.fecha,
      numeroCalendario: s.numero_calendario,
      estado: s.estado as SesionHistorial["estado"],
      diaNombre: dia?.nombre ?? "",
      completados: c.completados,
      total: c.total,
      comentario: s.comentario,
      horaInicio: s.hora_inicio,
      horaFin: s.hora_fin,
    };
  });
}

async function obtenerUltimoRegistro(
  supabase: SupabaseServerClient,
  alumnoId: string,
  diaEjercicioId: string,
  sesionActualId: string
): Promise<UltimoRegistro> {
  const { data: sesionesPrevias } = await supabase
    .from("sesiones_entrenamiento")
    .select("id, fecha, sesion_ejercicios!inner(id, dia_ejercicio_id)")
    .eq("alumno_id", alumnoId)
    .eq("sesion_ejercicios.dia_ejercicio_id", diaEjercicioId)
    .neq("id", sesionActualId)
    .order("fecha", { ascending: false })
    .limit(1);

  const sesionPrevia = sesionesPrevias?.[0];
  if (!sesionPrevia) return null;

  const sesionEjercicioPrevio = (
    sesionPrevia.sesion_ejercicios as unknown as { id: string; dia_ejercicio_id: string }[]
  )[0];
  if (!sesionEjercicioPrevio) return null;

  const { data: ultimaSerie } = await supabase
    .from("series_realizadas")
    .select("peso_kg, es_peso_corporal, reps_realizadas")
    .eq("sesion_ejercicio_id", sesionEjercicioPrevio.id)
    .order("numero_serie", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!ultimaSerie) return null;

  return {
    pesoKg: ultimaSerie.peso_kg,
    esPesoCorporal: ultimaSerie.es_peso_corporal,
    reps: ultimaSerie.reps_realizadas,
    fecha: sesionPrevia.fecha,
  };
}
