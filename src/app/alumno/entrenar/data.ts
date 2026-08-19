import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { mesActualISO } from "@/lib/date";
import { resolverTempo, type Tempo } from "@/lib/ejercicios/tempo";
import { emparejarEjercicio } from "@/lib/ejercicios/emparejar";
import { obtenerBiblioteca } from "@/lib/ejercicios/data";
import { normalizarTecnicaSeries } from "@/lib/entrenamiento/tecnica-series";
import { obtenerEstadoPlanMensual } from "@/lib/planes-entrenamiento-servidor";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** Si el alumno tiene una sesión en progreso DE VERDAD (la empezó y se fue a
 * otra pestaña sin finalizarla), devuelve su id — se usa para reengancharlo
 * ahí en vez de mostrarle el calendario desde cero cada vez que vuelve a
 * Entrenar.
 *
 * "En progreso de verdad" es a propósito más estricto que la columna
 * `estado`: tocar "Ver entrenamiento" en un día de entrenamiento crea la fila
 * con `estado = 'en_progreso'` (falta enganchar los ejercicios) pero la
 * rutina sigue bloqueada hasta tocar "Iniciar rutina" — ver
 * `bloqueadaPorIniciar` en sesion/[id]/page.tsx. Antes de este filtro, con
 * solo mirar un día ya aparecía la píldora "Entrenamiento en curso" y la
 * pestaña Entrenar de la barra inferior te mandaba de vuelta ahí, aunque
 * nunca se hubiera arrancado nada. Un día de descanso no tiene ese segundo
 * paso — se registra directo — así que para esos sí cuenta con solo crearse. */
export async function obtenerSesionEnProgreso(
  supabase: SupabaseServerClient,
  alumnoId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("sesiones_entrenamiento")
    .select("id, rutina_iniciada_en, rutina_dias(tipo)")
    .eq("alumno_id", alumnoId)
    .eq("estado", "en_progreso")
    .order("hora_inicio", { ascending: false })
    .limit(20);

  const enCurso = (data ?? []).find((s) => {
    const dia = s.rutina_dias as unknown as { tipo: string } | null;
    return dia?.tipo === "descanso" || s.rutina_iniciada_en !== null;
  });
  return enCurso?.id ?? null;
}

export type ConflictoSesionActiva = { id: string; numeroCalendario: number | null; diaNombre: string };

/**
 * Igual que `obtenerSesionEnProgreso`, pero para el único camino que hoy NO
 * pregunta antes de abandonar una sesión activa: el botón fijo "Iniciar
 * rutina" de una sesión ya creada como vista previa (`BotonIniciarRutinaFijo`,
 * ver `bloqueadaPorIniciar` en sesion/[id]/page.tsx). Ese camino redirigía en
 * silencio a la sesión activa sin avisar — reportado por Alejandro (alumnos
 * arrancando la rutina equivocada). Devuelve número y nombre del día para
 * poder avisar CUÁL sesión sigue en curso antes de dejar elegir.
 */
export async function obtenerConflictoSesionActiva(
  supabase: SupabaseServerClient,
  alumnoId: string,
  excluirSesionId: string
): Promise<ConflictoSesionActiva | null> {
  const { data } = await supabase
    .from("sesiones_entrenamiento")
    .select("id, numero_calendario, rutina_iniciada_en, rutina_dias(nombre, tipo)")
    .eq("alumno_id", alumnoId)
    .eq("estado", "en_progreso")
    .neq("id", excluirSesionId)
    .order("hora_inicio", { ascending: false })
    .limit(20);

  const enCurso = (data ?? []).find((s) => {
    const dia = s.rutina_dias as unknown as { tipo: string } | null;
    return dia?.tipo === "descanso" || s.rutina_iniciada_en !== null;
  });
  if (!enCurso) return null;
  const dia = enCurso.rutina_dias as unknown as { nombre: string } | null;
  return { id: enCurso.id, numeroCalendario: enCurso.numero_calendario, diaNombre: dia?.nombre ?? "" };
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

export type EjercicioVistaPrevia = {
  id: string;
  orden: number;
  nombre: string;
  seriesProgramadas: number;
  repsProgramadas: string;
  descansoSegundos: number | null;
  tecnicaTipo: string | null;
  observacion: string | null;
  grupoMuscular: GrupoMuscular | null;
  ejercicioId: string | null;
  ilustracionSlug: string | null;
  fotoMiniaturaUrl: string | null;
  fotoCompletaUrl: string | null;
  videoUrl: string | null;
  videoCloudflareUid: string | null;
  videoCloudflareEstado: "subiendo" | "procesando" | "listo" | "error" | null;
  videoCloudflareMiniaturaUrl: string | null;
};

export type DiaVistaPrevia = {
  id: string;
  nombre: string;
  tipo: "entrenamiento" | "descanso";
  descripcion: string | null;
  rutinaNombre: string;
  ejercicios: EjercicioVistaPrevia[];
} | null;

/**
 * Los ejercicios de un día **sin crear ninguna sesión**.
 *
 * Existe porque hasta ahora la única forma de ver qué tocaba un día era tocar
 * "Ver entrenamiento", que crea la sesión de una. Con otro entrenamiento
 * activo eso está bloqueado y el alumno terminaba rebotando a la sesión en
 * curso: el botón decía "ver" y no dejaba ver nada. Alejandro: "me posiciono
 * en la sesión seis y le doy ver entrenamiento y no lo veo, solo me lleva a la
 * sesión que está abierta; debería dejarme ver".
 *
 * Mirar no compromete nada, así que esta lectura no toca
 * `sesiones_entrenamiento` ni el cupo del mes. Lo que NO puede mostrar son las
 * metas de Impulso VIP: se congelan al crear la sesión (ver
 * `generarYGuardarRecomendacion`) y acá todavía no hay sesión.
 *
 * Valida por rutina activa del alumno, no solo por id de día: sin eso,
 * cualquiera podría mirar la rutina de otro pegando un uuid en la barra.
 */
export async function obtenerDiaVistaPrevia(
  supabase: SupabaseServerClient,
  alumnoId: string,
  diaId: string
): Promise<DiaVistaPrevia> {
  // El filtro sobre la relación (`rutinas.alumno_id`) deja al parser de tipos
  // de PostgREST sin forma que inferir y colapsa la fila a `never` — mismo
  // caso que `obtenerSesionCompleta` y `FilaBiblioteca`, se declara a mano.
  type FilaDia = {
    id: string;
    nombre: string;
    tipo: "entrenamiento" | "descanso";
    descripcion: string | null;
    rutinas: unknown;
  };

  const { data } = await supabase
    .from("rutina_dias")
    .select("id, nombre, tipo, descripcion, rutinas!inner(nombre, alumno_id, activa)")
    .eq("id", diaId)
    .eq("rutinas.alumno_id", alumnoId)
    .eq("rutinas.activa", true)
    .maybeSingle();

  const dia = data as unknown as FilaDia | null;
  if (!dia) return null;

  const { data: ejercicios } = await supabase
    .from("rutina_dia_ejercicios")
    .select(
      "id, orden, nombre, series_programadas, reps_programadas, descanso_segundos, tecnica_tipo, observacion, grupo_muscular, ejercicio_id, ejercicios(ilustracion_slug, foto_miniatura_url, foto_completa_url, video_url, video_cloudflare_uid, video_cloudflare_estado, video_cloudflare_miniatura_url)"
    )
    .eq("dia_id", diaId)
    .order("orden");

  const rutina = dia.rutinas as unknown as { nombre: string } | null;
  type FilaEjercicioPrevia = {
    id: string;
    orden: number;
    nombre: string;
    series_programadas: number;
    reps_programadas: string;
    descanso_segundos: number | null;
    tecnica_tipo: string | null;
    observacion: string | null;
    grupo_muscular: string | null;
    ejercicio_id: string | null;
    ejercicios: unknown;
  };
  const filasEjercicios = (ejercicios ?? []) as unknown as FilaEjercicioPrevia[];

  return {
    id: dia.id,
    nombre: dia.nombre,
    tipo: dia.tipo,
    descripcion: dia.descripcion,
    rutinaNombre: rutina?.nombre ?? "",
    ejercicios: filasEjercicios.map((e) => {
      const bibliotecaCruda = e.ejercicios as unknown as {
        ilustracion_slug: string | null;
        foto_miniatura_url: string | null;
        foto_completa_url: string | null;
        video_url: string | null;
        video_cloudflare_uid: string | null;
        video_cloudflare_estado: "subiendo" | "procesando" | "listo" | "error" | null;
        video_cloudflare_miniatura_url: string | null;
      } | {
        ilustracion_slug: string | null;
        foto_miniatura_url: string | null;
        foto_completa_url: string | null;
        video_url: string | null;
        video_cloudflare_uid: string | null;
        video_cloudflare_estado: "subiendo" | "procesando" | "listo" | "error" | null;
        video_cloudflare_miniatura_url: string | null;
      }[] | null;
      const biblioteca = Array.isArray(bibliotecaCruda) ? bibliotecaCruda[0] ?? null : bibliotecaCruda;
      return {
        id: e.id,
        orden: e.orden,
        nombre: e.nombre,
        seriesProgramadas: e.series_programadas,
        repsProgramadas: e.reps_programadas,
        descansoSegundos: e.descanso_segundos,
        tecnicaTipo: e.tecnica_tipo,
        observacion: e.observacion,
        grupoMuscular: e.grupo_muscular as GrupoMuscular | null,
        ejercicioId: e.ejercicio_id,
        ilustracionSlug: biblioteca?.ilustracion_slug ?? null,
        fotoMiniaturaUrl: biblioteca?.foto_miniatura_url ?? null,
        fotoCompletaUrl: biblioteca?.foto_completa_url ?? null,
        videoUrl: biblioteca?.video_url ?? null,
        videoCloudflareUid: biblioteca?.video_cloudflare_uid ?? null,
        videoCloudflareEstado: biblioteca?.video_cloudflare_estado ?? null,
        videoCloudflareMiniaturaUrl: biblioteca?.video_cloudflare_miniatura_url ?? null,
      };
    }),
  };
}

export type EstadoNumero = "no_iniciado" | "en_progreso" | "completado";

export type NumeroCalendario = {
  numero: number;
  dia: DiaRutina;
  estado: EstadoNumero;
  sesionId: string | null;
};

/**
 * Calendario "falso": el número no es una fecha, es una posición secuencial
 * que se mapea al día de rutina que le toca por posición (número % cantidad
 * de días). Así, sin importar cuándo entrene en la vida real, el alumno
 * siempre sigue la rotación de días de su rutina en orden.
 *
 * `diasCiclo` son SOLO los días de entrenamiento. Los descansos quedan fuera
 * de la rueda a propósito: un descanso de la vida real pasa solo, pero en la
 * app había que ir a marcarlo, así que el número se quedaba sin consumir y
 * tapaba el paso. Peor todavía, la rueda giraba sobre todos los días (5) y la
 * pantalla paginaba solo sobre los de entrenamiento (4): cinco contra cuatro,
 * y la rutina se corría un lugar por semana. Reportado por Alejandro: "me
 * marca el lunes la sesión que tocaba el viernes de la semana pasada".
 *
 * `todosLosDias` incluye los descansos y se usa solo para mirar hacia atrás:
 * las sesiones de descanso que ya existen (creadas con la regla vieja) se
 * siguen mostrando tal como se registraron.
 */
export async function obtenerNumerosCalendario(
  supabase: SupabaseServerClient,
  alumnoId: string,
  rutinaId: string,
  diasCiclo: DiaRutina[],
  desde: number,
  cantidad: number,
  todosLosDias: DiaRutina[] = diasCiclo
): Promise<NumeroCalendario[]> {
  if (diasCiclo.length === 0) return [];

  const numeros = Array.from({ length: cantidad }, (_, i) => desde + i).filter((n) => n >= 1);
  if (numeros.length === 0) return [];

  const { data: sesiones } = await supabase
    .from("sesiones_entrenamiento")
    .select("id, numero_calendario, estado, rutina_iniciada_en, dia_id")
    .eq("alumno_id", alumnoId)
    .eq("rutina_id", rutinaId)
    .in("numero_calendario", numeros);

  const sesionPorNumero = new Map((sesiones ?? []).map((s) => [s.numero_calendario, s]));
  const diaPorId = new Map(todosLosDias.map((d) => [d.id, d]));

  return numeros.map((n) => {
    const sesion = sesionPorNumero.get(n);
    // Si ya hay una sesión para este número, manda el día que quedó guardado
    // en ella, no el que calcularía la rueda. Sin esto, sacar los descansos
    // de la rueda reescribía el pasado: un número que el alumno usó para un
    // descanso pasaría a mostrarse como el entrenamiento que hoy le toca a
    // esa posición, y encima aparecería como ya completado.
    const dia =
      (sesion?.dia_id ? diaPorId.get(sesion.dia_id) : undefined) ?? diasCiclo[(n - 1) % diasCiclo.length];
    // Un día de entrenamiento con fila creada pero la rutina todavía
    // bloqueada (nunca se tocó "Iniciar rutina") es solo una vista previa —
    // "Ver entrenamiento" no debe pintar el círculo como si ya estuviera en
    // curso. Descanso no tiene ese segundo paso: cuenta con solo crearse.
    const enProgresoDeVerdad =
      dia.tipo === "descanso" || sesion?.rutina_iniciada_en != null;
    const estado: EstadoNumero = !sesion
      ? "no_iniciado"
      : sesion.estado !== "en_progreso"
        ? "completado"
        : enProgresoDeVerdad
          ? "en_progreso"
          : "no_iniciado";
    return { numero: n, dia, estado, sesionId: sesion?.id ?? null };
  });
}

/**
 * Dónde va el alumno en su rutina: cuál es el próximo número sin usar (el más
 * alto usado + 1) y cuál fue la última sesión que terminó de verdad.
 *
 * Las dos salen de la misma consulta a propósito: son la misma lista leída con
 * dos preguntas distintas, y pedirla dos veces sería un round-trip de más en
 * la carga más caliente del alumno.
 */
export async function obtenerAvanceCiclo(
  supabase: SupabaseServerClient,
  alumnoId: string,
  rutinaId: string
): Promise<{ proximoNumero: number; ultimoNumeroHecho: number | null }> {
  const { data } = await supabase
    .from("sesiones_entrenamiento")
    .select("numero_calendario, estado, rutina_iniciada_en, rutina_dias(tipo)")
    .eq("alumno_id", alumnoId)
    .eq("rutina_id", rutinaId)
    .not("numero_calendario", "is", null)
    .order("numero_calendario", { ascending: true })
    .limit(500);

  const sesiones = data ?? [];
  const tipoDe = (sesion: (typeof sesiones)[number]) =>
    (sesion.rutina_dias as unknown as { tipo: string } | null)?.tipo;

  // La última TERMINADA, y solo de entrenamiento: es la que el alumno reconoce
  // como "la que hice". Una en progreso todavía no cuenta, y un descanso
  // registrado con la regla vieja tampoco — nadie se ubica por un descanso.
  const ultimoNumeroHecho =
    sesiones
      .filter((s) => s.estado !== "en_progreso" && tipoDe(s) === "entrenamiento")
      .at(-1)?.numero_calendario ?? null;

  const vistaPreviaPendiente = sesiones.find(
    (sesion) =>
      sesion.estado === "en_progreso" && sesion.rutina_iniciada_en === null && tipoDe(sesion) === "entrenamiento"
  );
  const proximoNumero =
    vistaPreviaPendiente?.numero_calendario ?? (sesiones.at(-1)?.numero_calendario ?? 0) + 1;

  return { proximoNumero, ultimoNumeroHecho };
}

export type BalanceSesionesMes = {
  planNombre: string | null;
  diasSemana: number;
  asignadas: number;
  consumidas: number;
  balance: number;
  pausado: boolean;
  configurado: boolean;
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

  const plan = await obtenerEstadoPlanMensual(supabase as unknown as import("@supabase/supabase-js").SupabaseClient, alumnoId);
  if (plan) {
    return {
      planNombre: plan.nombre,
      diasSemana: plan.diasSemana,
      asignadas: plan.sesionesMensuales,
      consumidas: plan.consumidas,
      balance: plan.restantes,
      pausado: plan.pausado,
      configurado: true,
    };
  }

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

  return {
    planNombre: null,
    diasSemana,
    asignadas,
    consumidas,
    balance: asignadas - consumidas,
    pausado: false,
    configurado: false,
  };
}

export type SerieRealizada = {
  numeroSerie: number;
  pesoKg: number | null;
  esPesoCorporal: boolean;
  repsRealizadas: number | null;
  rirEstimado: number | null;
  /** El alumno marcó esta serie puntual como hecha — distinto de haber
   * cargado peso/reps, que puede pasar sin haberla completado de verdad. */
  realizada: boolean;
};

export type UltimoRegistro = { pesoKg: number | null; esPesoCorporal: boolean; reps: number | null; fecha: string } | null;

export type DificultadPercibida = "muy_facil" | "facil" | "justo" | "dificil" | "fallo";

/** Meta de Impulso VIP para este ejercicio, ya congelada (ver
 * `generarYGuardarRecomendacion` en `src/lib/impulso-vip/data.ts`) — se
 * calculó una sola vez, al crear la sesión, y no cambia aunque el alumno
 * reabra la pantalla. Null cuando el motor no generó recomendación (sin
 * config, técnica excluida, primera vez que se hace el ejercicio, etc). */
export type RecomendacionImpulso = {
  regla: "A_subir_reps" | "B_subir_peso" | "C_mantener" | "D_reducir" | "E_consultar";
  pesoSugeridoKg: number | null;
  repsObjetivoMin: number | null;
  repsObjetivoMax: number | null;
  esPesoCorporal: boolean;
  justificacion: string;
  /** 'propuesta': el entrenador todavía no aprobó subir peso — no se
   * precarga. 'bloqueada' (Regla E): revisión requerida, sin meta. */
  estado: "propuesta" | "aprobada" | "bloqueada" | "modificada";
} | null;

export type IntervencionImpulsoEnVivo = {
  id: string;
  serieObjetivo: number;
  tipo:
    | "cierre_controlado"
    | "repeticion_objetivo"
    | "tempo_controlado"
    | "pausa_isometrica"
    | "serie_descarga"
    | "drop_set"
    | "rest_pause"
    | "fallo_controlado";
  origen: "metodo_ale" | "preparada_por_ale" | "personal_ale";
  firma: string;
  instruccion: string;
  motivo: string;
  estado: "preparada" | "mostrada" | "resuelta" | "cancelada";
  resultado: "lograda" | "parcial" | "no_lograda" | "omitida" | "omitida_molestia" | null;
  calibrada: boolean;
  prescripcion: Record<string, unknown>;
};

export type EjercicioSesion = {
  sesionEjercicioId: string;
  diaEjercicioId: string;
  /** Ejercicio de la biblioteca global cuya foto puede corregir el entrenador.
   * Null cuando la entrada de rutina todavía no está vinculada. */
  ejercicioId: string | null;
  orden: number;
  nombre: string;
  seriesProgramadas: number;
  repsProgramadas: string;
  descansoSegundos: number | null;
  /** Duración elegida por el alumno; null conserva la referencia del entrenador. */
  descansoPersonalizadoSegundos: number | null;
  /** false: este alumno entrena sin cuenta regresiva entre series (interruptor
   * del entrenador, migración 0087). Los segundos de arriba se siguen
   * mostrando como referencia, pero no corre ningún reloj ni se descuentan
   * puntos por descansar de más. */
  temporizadorDescanso: boolean;
  tecnicaTipo: string | null;
  /** Series donde corre la técnica (base 1). `null` = todas, que es lo que
   * tienen las rutinas anteriores a la migración 0073. */
  tecnicaSeries: number[] | null;
  tecnicaInstruccion: string | null;
  observacion: string | null;
  /** Técnica de ejecución de la biblioteca del gimnasio. Se muestra como
   * sugerencia solo cuando la rutina no pidió una técnica propia. */
  tecnicaSugerida: string | null;
  grupoMuscular: GrupoMuscular | null;
  /** Qué dibujo mostrar. Null si el ejercicio no está emparejado con la
   * biblioteca o si todavía no corrió la migración 0026. */
  ilustracionSlug: string | null;
  /** Fotos subidas desde /admin/ejercicios — mandan sobre `ilustracionSlug`
   * cuando existen. Null si el ejercicio no tiene, o si no corrió la
   * migración 0042 todavía. */
  fotoMiniaturaUrl: string | null;
  fotoCompletaUrl: string | null;
  fotoPanoramaX: number;
  fotoPanoramaY: number;
  fotoCuadradaX: number;
  fotoCuadradaY: number;
  /** Link de YouTube o a un archivo de video directo, cargado desde
   * /admin/ejercicios (ver `guardarVideoEjercicio`). Cuando existe, la
   * referencia del ejercicio abre el video en vez de solo ampliar la foto. */
  videoUrl: string | null;
  videoCloudflareUid: string | null;
  videoCloudflareEstado: "subiendo" | "procesando" | "listo" | "error" | null;
  videoCloudflareMiniaturaUrl: string | null;
  /** Cuánto dura cada fase de la repetición. Null cuando ni la rutina lo trae
   * escrito ni la biblioteca lo tiene calculado todavía. */
  tempo: Tempo | null;
  completado: boolean;
  notaEjercicio: string | null;
  series: SerieRealizada[];
  ultimoRegistro: UltimoRegistro;
  /** Se pregunta una vez al terminar el ejercicio, no por serie. Null si
   * migración 0043 no corrió todavía, o si el alumno no la cargó. */
  dificultadPercibida: DificultadPercibida | null;
  recomendacionImpulso: RecomendacionImpulso;
  /** Momento puntual dentro del ejercicio. En la primera version se prepara
   * uno solo, en la ultima serie, y siempre con una instruccion segura. */
  intervencionesImpulso: IntervencionImpulsoEnVivo[];
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
  /** No null mientras el alumno está corrigiendo este registro ya cerrado
   * (migración 0077). La sesión NO vuelve a "en progreso": solo se habilita
   * la edición de los números, sin reloj ni puntos de por medio. */
  corrigiendoDesde: string | null;
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

  // Cadena de respaldo, del select más completo al más pobre: una migración
  // que todavía no corrió no puede dejar al alumno sin pantalla.
  //
  // **Cada escalón suelta UNA sola columna, la de su propia migración.** Es la
  // parte que importa: `corrigiendo_desde` (0077) se había agregado en el
  // mismo escalón que `rutina_iniciada_en` (0040), así que en un entorno sin
  // la 0077 se perdían las dos de una. Y sin `rutina_iniciada_en` la sesión
  // queda para siempre en `bloqueadaPorIniciar`: el alumno toca "Iniciar
  // rutina", la base sí se actualiza, pero al recargar vuelve a leerse null y
  // el botón sigue ahí. Se ve exactamente como un botón que no hace nada.
  // Reportado por Alejandro. Al agregar una columna nueva acá, agregar un
  // escalón nuevo — nunca sumarla a uno existente.
  // El `select` se arma con plantilla, así que PostgREST no puede inferir la
  // forma del resultado: se declara a mano, igual que `FilaBiblioteca` más
  // abajo. Las dos columnas de migraciones recientes van opcionales porque
  // justamente pueden no venir.
  type FilaSesion = {
    id: string;
    fecha: string;
    numero_calendario: number | null;
    estado: "en_progreso" | "completada" | "finalizada_incompleta" | "abandonada";
    hora_inicio: string;
    hora_fin: string | null;
    comentario: string | null;
    dia_id: string;
    rutina_dias: unknown;
    rutinas: unknown;
    rutina_iniciada_en?: string | null;
    corrigiendo_desde?: string | null;
  };

  const consultarSesion = (columnas: string) =>
    supabase
      .from("sesiones_entrenamiento")
      .select(columnas)
      .eq("id", sesionId)
      .eq("alumno_id", alumnoId)
      .maybeSingle();

  const conCorreccion = await consultarSesion(`${COLUMNAS_SESION}, rutina_iniciada_en, corrigiendo_desde`);
  const conInicio = conCorreccion.error
    ? await consultarSesion(`${COLUMNAS_SESION}, rutina_iniciada_en`)
    : conCorreccion;
  const resultadoSesion = conInicio.error ? await consultarSesion(COLUMNAS_SESION) : conInicio;
  const sesion = resultadoSesion.data as unknown as FilaSesion | null;

  if (!sesion) return null;

  // La ilustración del ejercicio viaja anidada en esta misma consulta, así que
  // no cuesta ningún viaje extra a Supabase.
  //
  // Se intenta primero con el join a `ejercicios` (migración 0026) y si falla
  // se repite sin él: el código puede llegar a producción antes que la
  // migración, y sin este respaldo la pantalla de sesión quedaría rota entera
  // hasta correrla. Ya pasó con las migraciones 0009, 0010 y 0013.
  const COLUMNAS_PROGRAMA_BASE =
    "orden, nombre, series_programadas, reps_programadas, descanso_segundos, tecnica_tipo, tecnica_instruccion, observacion, grupo_muscular";
  // `tecnica_series` (0073) va acá y no en BASE por el mismo motivo que
  // `ejercicio_id`: si la migración no corrió, el último intento se degrada
  // solo y el alumno igual ve su pantalla — la técnica vuelve a mostrarse en
  // todas las series, que es el comportamiento de antes.
  const COLUMNAS_PROGRAMA = `${COLUMNAS_PROGRAMA_BASE}, ejercicio_id, tecnica_series`;

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
    // Existe desde la migración base (0026), igual que ilustracion_slug —
    // por eso va en el mismo nivel de resguardo, no en el de fotos (0042).
    video_url: string | null;
    tempo?: string | null;
    tempo_nota?: string | null;
    /** Cómo se ejecuta el ejercicio según la biblioteca del gimnasio. Es la
     * sugerencia que se muestra cuando la rutina no pide una técnica puntual. */
    tecnica?: string | null;
    foto_miniatura_url?: string | null;
    foto_completa_url?: string | null;
    foto_panorama_x?: number | null;
    foto_panorama_y?: number | null;
    foto_cuadrada_x?: number | null;
    foto_cuadrada_y?: number | null;
    video_cloudflare_uid?: string | null;
    video_cloudflare_estado?: "subiendo" | "procesando" | "listo" | "error" | null;
    video_cloudflare_miniatura_url?: string | null;
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
      ejercicio_id?: string | null;
      /** Solo si corrió la 0073. Ausente o null = la técnica va en todas las
       * series, igual que siempre. */
      tecnica_series?: number[] | null;
      // Presente solo si la migración 0026 ya corrió (ver el respaldo arriba);
      // los campos de tempo, solo si además corrió la 0031.
      ejercicios?: FilaBiblioteca | FilaBiblioteca[] | null;
    } | null;
  };

  // Cuatro intentos encadenados, del select más completo al más pobre: con
  // fotos de admin (migración 0042), con tempo (0031), sin tempo pero con
  // biblioteca (0026), y pelado. Cada migración que todavía no haya corrido
  // se degrada sola en vez de dejar al alumno sin pantalla de entrenamiento.
  const intentoConMultimedia = await consultarEjercicios(
    `${COLUMNAS_PROGRAMA}, ejercicios(ilustracion_slug, video_url, tempo, tempo_nota, tecnica, foto_miniatura_url, foto_completa_url, foto_panorama_x, foto_panorama_y, foto_cuadrada_x, foto_cuadrada_y, video_cloudflare_uid, video_cloudflare_estado, video_cloudflare_miniatura_url)`
  );
  const intentoConEncuadre = intentoConMultimedia.error ? await consultarEjercicios(
    `${COLUMNAS_PROGRAMA}, ejercicios(ilustracion_slug, video_url, tempo, tempo_nota, tecnica, foto_miniatura_url, foto_completa_url, foto_panorama_x, foto_panorama_y, foto_cuadrada_x, foto_cuadrada_y)`
  ) : intentoConMultimedia;
  const intentoConFotos = intentoConEncuadre.error ? await consultarEjercicios(
    `${COLUMNAS_PROGRAMA}, ejercicios(ilustracion_slug, video_url, tempo, tempo_nota, tecnica, foto_miniatura_url, foto_completa_url)`
  ) : intentoConEncuadre;
  const intento = intentoConFotos.error
    ? await consultarEjercicios(
        `${COLUMNAS_PROGRAMA}, ejercicios(ilustracion_slug, video_url, tempo, tempo_nota, tecnica)`
      )
    : intentoConFotos;
  const conBiblioteca = intento.error
    ? await consultarEjercicios(`${COLUMNAS_PROGRAMA}, ejercicios(ilustracion_slug, video_url)`)
    : intento;
  const resultado = conBiblioteca.error
    ? await consultarEjercicios(COLUMNAS_PROGRAMA_BASE)
    : conBiblioteca;

  const lista = (resultado.data ?? []) as unknown as FilaSesionEjercicio[];
  const sesionEjercicioIds = lista.map((e) => e.id);

  // ¿Este alumno entrena con cronómetro entre series? Es un interruptor del
  // entrenador (migración 0087): a quien lo tiene apagado, el descanso se le
  // sigue mostrando como referencia pero no corre la cuenta regresiva ni se le
  // descuentan puntos por excederse. En consulta aparte y tolerante: si la
  // migración todavía no corrió en este entorno, se asume encendido, que es el
  // comportamiento de siempre.
  const { data: preferencias } = await supabase
    .from("alumno_perfil")
    .select("temporizador_descanso, segundos_descanso_preferido")
    .eq("user_id", alumnoId)
    .maybeSingle();
  const temporizadorDescanso = preferencias?.temporizador_descanso ?? true;
  // Si el alumno eligió un número fijo, reemplaza el descanso_segundos de
  // CADA ejercicio (incluidas técnicas encadenadas con 0s explícito) — así
  // lo pidió Alejandro después de que se le advirtiera el riesgo con
  // superseries. `null` = sin preferencia, manda lo que programó el entrenador.
  const segundosDescansoPreferido = preferencias?.segundos_descanso_preferido ?? null;

  const { data: todasLasSeries } = sesionEjercicioIds.length
    ? await supabase
        .from("series_realizadas")
        .select("sesion_ejercicio_id, numero_serie, peso_kg, es_peso_corporal, reps_realizadas, rir_estimado, realizada")
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
      rirEstimado: s.rir_estimado,
      realizada: s.realizada,
    });
    seriesPorEjercicio.set(s.sesion_ejercicio_id, arr);
  }

  // Impulso VIP: dificultad percibida y recomendación congelada. Van en
  // consultas separadas (no en `consultarEjercicios` de arriba) para no
  // agregar una quinta variante a esa cadena de fallbacks — si la migración
  // 0043 todavía no corrió en este entorno, estas dos consultas fallan solas
  // y la pantalla de sesión sigue funcionando igual que hoy, sin Impulso VIP.
  const intentoDificultad = sesionEjercicioIds.length
    ? await supabase.from("sesion_ejercicios").select("id, dificultad_percibida").in("id", sesionEjercicioIds)
    : { data: [], error: null };
  const dificultadPorEjercicio = new Map<string, DificultadPercibida | null>(
    (intentoDificultad.error ? [] : (intentoDificultad.data ?? [])).map((d) => [
      d.id,
      d.dificultad_percibida as DificultadPercibida | null,
    ])
  );

  const intentoRecomendaciones = sesionEjercicioIds.length
    ? await supabase
        .from("impulso_vip_recomendaciones")
        .select(
          "sesion_ejercicio_id, regla, peso_sugerido_kg, reps_objetivo_min, reps_objetivo_max, es_peso_corporal, justificacion, estado"
        )
        .in("sesion_ejercicio_id", sesionEjercicioIds)
    : { data: [], error: null };
  const recomendacionPorEjercicio = new Map<string, FilaRecomendacionSesion>(
    (intentoRecomendaciones.error ? [] : ((intentoRecomendaciones.data ?? []) as FilaRecomendacionSesion[])).map(
      (r) => [r.sesion_ejercicio_id, r]
    )
  );

  const intentoIntervenciones = sesionEjercicioIds.length
    ? await supabase
        .from("impulso_vip_intervenciones")
        .select(
          "id, sesion_ejercicio_id, serie_objetivo, tipo, origen, firma, instruccion, motivo, estado, resultado, decision_data, prescripcion"
        )
        .in("sesion_ejercicio_id", sesionEjercicioIds)
        .order("serie_objetivo", { ascending: true })
    : { data: [], error: null };
  const intervencionPorEjercicio = new Map<string, FilaIntervencionSesion[]>();
  for (const intervencion of (intentoIntervenciones.error
    ? []
    : ((intentoIntervenciones.data ?? []) as FilaIntervencionSesion[]))) {
    const actuales = intervencionPorEjercicio.get(intervencion.sesion_ejercicio_id) ?? [];
    actuales.push(intervencion);
    intervencionPorEjercicio.set(intervencion.sesion_ejercicio_id, actuales);
  }

  // Lazy y una sola vez: la mayoría de los ejercicios ya vienen con foto por
  // el join de arriba y no hace falta tocar esto. `obtenerBiblioteca` está
  // cacheada (1h, se invalida sola al editar un ejercicio), así que ni
  // siquiera en el caso con foto faltante es una consulta cara.
  let bibliotecaActual: Awaited<ReturnType<typeof obtenerBiblioteca>> | null = null;

  const ejercicios: EjercicioSesion[] = [];
  for (const se of lista) {
    const prog = se.rutina_dia_ejercicios;
    if (!prog) continue;

    // PostgREST devuelve la relación como objeto o como arreglo según la
    // cardinalidad que infiera; acá siempre es a lo sumo uno.
    const dellaBiblioteca = Array.isArray(prog.ejercicios) ? prog.ejercicios[0] : prog.ejercicios;

    let ilustracionSlug = dellaBiblioteca?.ilustracion_slug ?? null;
    let ejercicioId = prog.ejercicio_id ?? null;
    let fotoMiniaturaUrl = dellaBiblioteca?.foto_miniatura_url ?? null;
    let fotoCompletaUrl = dellaBiblioteca?.foto_completa_url ?? null;
    let fotoPanoramaX = dellaBiblioteca?.foto_panorama_x ?? 50;
    let fotoPanoramaY = dellaBiblioteca?.foto_panorama_y ?? 50;
    let fotoCuadradaX = dellaBiblioteca?.foto_cuadrada_x ?? 50;
    let fotoCuadradaY = dellaBiblioteca?.foto_cuadrada_y ?? 50;
    let videoUrl = dellaBiblioteca?.video_url ?? null;
    let videoCloudflareUid = dellaBiblioteca?.video_cloudflare_uid ?? null;
    let videoCloudflareEstado = dellaBiblioteca?.video_cloudflare_estado ?? null;
    let videoCloudflareMiniaturaUrl = dellaBiblioteca?.video_cloudflare_miniatura_url ?? null;

    // Respaldo: el ejercicio de esta rutina puede haber quedado sin vincular
    // (o vinculado a una entrada sin foto todavía) porque cuando se importó
    // el PDF nadie había cargado el alias con el que el entrenador lo
    // escribió. En vez de resignarse a no mostrar nada, se reintenta el
    // mismo emparejamiento por nombre contra la biblioteca ACTUAL — así,
    // agregar el alias desde /admin/ejercicios (ver `actualizarNombreEjercicio`)
    // hace aparecer la foto en rutinas ya creadas, sin tener que reimportarlas.
    if (!ilustracionSlug && !fotoMiniaturaUrl) {
      bibliotecaActual ??= await obtenerBiblioteca();
      const emparejado = emparejarEjercicio(prog.nombre, bibliotecaActual)?.ejercicio;
      if (emparejado) {
        ejercicioId = emparejado.id;
        ilustracionSlug = emparejado.ilustracionSlug;
        fotoMiniaturaUrl = emparejado.fotoMiniaturaUrl;
        fotoCompletaUrl = emparejado.fotoCompletaUrl;
        fotoPanoramaX = emparejado.fotoPanoramaX;
        fotoPanoramaY = emparejado.fotoPanoramaY;
        fotoCuadradaX = emparejado.fotoCuadradaX;
        fotoCuadradaY = emparejado.fotoCuadradaY;
        videoUrl = emparejado.videoUrl;
        videoCloudflareUid = emparejado.videoCloudflareUid;
        videoCloudflareEstado = emparejado.videoCloudflareEstado;
        videoCloudflareMiniaturaUrl = emparejado.videoCloudflareMiniaturaUrl;
      }
    }

    ejercicios.push({
      sesionEjercicioId: se.id,
      diaEjercicioId: se.dia_ejercicio_id,
      ejercicioId,
      orden: prog.orden,
      nombre: prog.nombre,
      seriesProgramadas: prog.series_programadas,
      repsProgramadas: prog.reps_programadas,
      descansoSegundos: segundosDescansoPreferido ?? prog.descanso_segundos,
      descansoPersonalizadoSegundos: segundosDescansoPreferido,
      temporizadorDescanso,
      tecnicaTipo: prog.tecnica_tipo,
      tecnicaSeries: normalizarTecnicaSeries(prog.tecnica_series, prog.series_programadas),
      tecnicaInstruccion: prog.tecnica_instruccion,
      observacion: prog.observacion,
      tecnicaSugerida: dellaBiblioteca?.tecnica ?? null,
      grupoMuscular: prog.grupo_muscular,
      ilustracionSlug,
      fotoMiniaturaUrl,
      fotoCompletaUrl,
      fotoPanoramaX,
      fotoPanoramaY,
      fotoCuadradaX,
      fotoCuadradaY,
      videoUrl,
      videoCloudflareUid,
      videoCloudflareEstado,
      videoCloudflareMiniaturaUrl,
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
      dificultadPercibida: dificultadPorEjercicio.get(se.id) ?? null,
      recomendacionImpulso: mapearRecomendacionImpulso(recomendacionPorEjercicio.get(se.id)),
      intervencionesImpulso: (intervencionPorEjercicio.get(se.id) ?? []).map(mapearIntervencionImpulso),
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
    corrigiendoDesde: (sesion as { corrigiendo_desde?: string | null }).corrigiendo_desde ?? null,
    comentario: sesion.comentario,
    diaNombre: dia?.nombre ?? "",
    diaTipo: dia?.tipo ?? "entrenamiento",
    diaDescripcion: dia?.descripcion ?? null,
    rutinaNombre: rutinaInfo?.nombre ?? "",
    ejercicios,
  };
}

/**
 * ¿Este registro ya tiene un pedido de borrado esperando al entrenador?
 *
 * Sin esto la pantalla no tenía forma de saberlo, y le seguía ofreciendo al
 * alumno "Pedir que borren este registro" como si nunca hubiera pedido nada.
 * El segundo pedido chocaba contra el índice único de la 0076 y el error se
 * traducía a "Esta opción todavía no está activa" — un mensaje falso, sobre
 * una función que sí estaba activa y sobre un pedido que ya estaba guardado.
 *
 * Devuelve `false` si la tabla no existe (0076 sin correr): sin tabla no hay
 * pedidos pendientes que mostrar, y la pantalla sigue funcionando igual.
 */
export async function tienePedidoDeBorradoPendiente(
  supabase: SupabaseServerClient,
  alumnoId: string,
  sesionId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("solicitudes_borrado_sesion")
    .select("id")
    .eq("sesion_id", sesionId)
    .eq("alumno_id", alumnoId)
    .eq("estado", "pendiente")
    .maybeSingle();

  if (error) return false;
  return !!data;
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
  rutinaId: string | null;
};

export async function obtenerHistorialSesiones(
  supabase: SupabaseServerClient,
  alumnoId: string,
  limite = 30,
  rutinaId?: string
): Promise<SesionHistorial[]> {
  let query = supabase
    .from("sesiones_entrenamiento")
    .select("id, fecha, numero_calendario, estado, comentario, hora_inicio, hora_fin, rutina_id, rutina_dias(nombre)")
    .eq("alumno_id", alumnoId)
    .neq("estado", "en_progreso")
    .order("fecha", { ascending: false })
    .limit(limite);
  if (rutinaId) query = query.eq("rutina_id", rutinaId);
  const { data: sesiones } = await query;

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
      rutinaId: s.rutina_id,
    };
  });
}

export type RutinaHistorial = {
  id: string;
  nombre: string;
  activa: boolean;
  primeraFecha: string;
  ultimaFecha: string;
  cantidadSesiones: number;
  puntos: number;
};

export type ProgramaAlumno = {
  id: string;
  nombre: string;
  activa: boolean;
  archivada: boolean;
  version: number;
  creadoEn: string;
  diasEntrenamiento: number;
  ejercicios: number;
  series: number;
  sesionesCerradas: number;
  ultimaSesion: string | null;
};

/**
 * Todos los programas publicados para el alumno, incluidos los que todavía
 * no tienen sesiones y los archivados. Es deliberadamente de solo lectura:
 * el alumno puede revisar su recorrido, pero no alterar la prescripción del
 * entrenador desde el portal.
 */
export async function obtenerProgramasAlumno(
  supabase: SupabaseServerClient,
  alumnoId: string
): Promise<ProgramaAlumno[]> {
  const { data: rutinas } = await supabase
    .from("rutinas")
    .select("id, nombre, activa, archivada, version, created_at")
    .eq("alumno_id", alumnoId)
    .order("activa", { ascending: false })
    .order("created_at", { ascending: false });

  if (!rutinas?.length) return [];

  const rutinaIds = rutinas.map((rutina) => rutina.id);
  const [{ data: dias }, { data: sesiones }] = await Promise.all([
    supabase
      .from("rutina_dias")
      .select("id, rutina_id, tipo")
      .in("rutina_id", rutinaIds),
    supabase
      .from("sesiones_entrenamiento")
      .select("rutina_id, fecha, estado")
      .eq("alumno_id", alumnoId)
      .in("rutina_id", rutinaIds)
      .neq("estado", "en_progreso"),
  ]);

  const diaIds = (dias ?? []).map((dia) => dia.id);
  const { data: ejercicios } = diaIds.length
    ? await supabase
      .from("rutina_dia_ejercicios")
      .select("dia_id, series_programadas")
      .in("dia_id", diaIds)
    : { data: [] };

  const diaARutina = new Map((dias ?? []).map((dia) => [dia.id, dia.rutina_id]));
  const resumen = new Map<string, Omit<ProgramaAlumno, "id" | "nombre" | "activa" | "archivada" | "version" | "creadoEn">>();
  for (const rutina of rutinas) {
    resumen.set(rutina.id, {
      diasEntrenamiento: 0,
      ejercicios: 0,
      series: 0,
      sesionesCerradas: 0,
      ultimaSesion: null,
    });
  }

  for (const dia of dias ?? []) {
    if (dia.tipo === "entrenamiento") resumen.get(dia.rutina_id)!.diasEntrenamiento += 1;
  }
  for (const ejercicio of ejercicios ?? []) {
    const rutinaId = diaARutina.get(ejercicio.dia_id);
    if (!rutinaId) continue;
    const actual = resumen.get(rutinaId)!;
    actual.ejercicios += 1;
    actual.series += ejercicio.series_programadas;
  }
  for (const sesion of sesiones ?? []) {
    if (!sesion.rutina_id) continue;
    const actual = resumen.get(sesion.rutina_id);
    if (!actual) continue;
    actual.sesionesCerradas += 1;
    if (!actual.ultimaSesion || sesion.fecha > actual.ultimaSesion) actual.ultimaSesion = sesion.fecha;
  }

  return rutinas.map((rutina) => ({
    id: rutina.id,
    nombre: rutina.nombre,
    activa: rutina.activa,
    archivada: rutina.archivada,
    version: rutina.version,
    creadoEn: rutina.created_at,
    ...resumen.get(rutina.id)!,
  }));
}

/** Una fila por rutina que el alumno haya entrenado alguna vez (no solo la
 * activa): cuántas sesiones cerradas tiene, el rango de fechas, y los
 * Puntos VIP que sumó bajo esa rutina — para el resumen de "reporte de
 * rutinas" en el Historial. Las rutinas sin ninguna sesión cerrada
 * (recién asignadas, o solo con vistas previas nunca empezadas) no
 * aparecen: no hay nada que reportar todavía. */
export async function obtenerRutinasHistorial(
  supabase: SupabaseServerClient,
  alumnoId: string
): Promise<RutinaHistorial[]> {
  const [{ data: rutinas }, { data: sesiones }, { data: movimientos }] = await Promise.all([
    supabase
      .from("rutinas")
      .select("id, nombre, activa")
      .eq("alumno_id", alumnoId),
    supabase
      .from("sesiones_entrenamiento")
      .select("id, rutina_id, fecha")
      .eq("alumno_id", alumnoId)
      .neq("estado", "en_progreso"),
    // Los puntos por rutina se calculan de `puntos_vip_movimientos` (clave
    // `entrenamiento:<sesionId>`), que es el registro real de lo que cuenta
    // para el ranking — no una cuenta aparte que se pueda desalinear.
    supabase
      .from("puntos_vip_movimientos")
      .select("clave, puntos")
      .eq("alumno_id", alumnoId)
      .eq("categoria", "entrenamiento"),
  ]);

  if (!rutinas || rutinas.length === 0 || !sesiones || sesiones.length === 0) return [];

  const porRutina = new Map<string, { primera: string; ultima: string; cantidad: number }>();
  const sesionARutina = new Map<string, string>();
  for (const s of sesiones) {
    if (!s.rutina_id) continue;
    sesionARutina.set(s.id, s.rutina_id);
    const actual = porRutina.get(s.rutina_id);
    if (!actual) {
      porRutina.set(s.rutina_id, { primera: s.fecha, ultima: s.fecha, cantidad: 1 });
    } else {
      actual.cantidad += 1;
      if (s.fecha < actual.primera) actual.primera = s.fecha;
      if (s.fecha > actual.ultima) actual.ultima = s.fecha;
    }
  }

  const puntosPorRutina = new Map<string, number>();
  for (const m of movimientos ?? []) {
    const sesionId = m.clave.replace(/^entrenamiento:/, "");
    const rutinaId = sesionARutina.get(sesionId);
    if (!rutinaId) continue;
    puntosPorRutina.set(rutinaId, (puntosPorRutina.get(rutinaId) ?? 0) + m.puntos);
  }

  return rutinas
    .filter((r) => porRutina.has(r.id))
    .map((r) => {
      const resumen = porRutina.get(r.id)!;
      return {
        id: r.id,
        nombre: r.nombre,
        activa: r.activa,
        primeraFecha: resumen.primera,
        ultimaFecha: resumen.ultima,
        cantidadSesiones: resumen.cantidad,
        puntos: puntosPorRutina.get(r.id) ?? 0,
      };
    })
    .sort((a, b) => (a.ultimaFecha < b.ultimaFecha ? 1 : -1));
}

type FilaRecomendacionSesion = {
  sesion_ejercicio_id: string;
  regla: string;
  peso_sugerido_kg: number | null;
  reps_objetivo_min: number | null;
  reps_objetivo_max: number | null;
  es_peso_corporal: boolean;
  justificacion: string;
  estado: string;
};

type FilaIntervencionSesion = {
  id: string;
  sesion_ejercicio_id: string;
  serie_objetivo: number;
  tipo: string;
  origen: string;
  firma: string;
  instruccion: string;
  motivo: string;
  estado: string;
  resultado: string | null;
  decision_data: Record<string, unknown>;
  prescripcion: Record<string, unknown>;
};

function mapearRecomendacionImpulso(fila: FilaRecomendacionSesion | undefined): RecomendacionImpulso {
  if (!fila) return null;
  return {
    regla: fila.regla as NonNullable<RecomendacionImpulso>["regla"],
    pesoSugeridoKg: fila.peso_sugerido_kg,
    repsObjetivoMin: fila.reps_objetivo_min,
    repsObjetivoMax: fila.reps_objetivo_max,
    esPesoCorporal: fila.es_peso_corporal,
    justificacion: fila.justificacion,
    estado: fila.estado as NonNullable<RecomendacionImpulso>["estado"],
  };
}

function mapearIntervencionImpulso(fila: FilaIntervencionSesion): IntervencionImpulsoEnVivo {
  return {
    id: fila.id,
    serieObjetivo: fila.serie_objetivo,
    tipo: fila.tipo as IntervencionImpulsoEnVivo["tipo"],
    origen: fila.origen as IntervencionImpulsoEnVivo["origen"],
    firma: fila.firma,
    instruccion: fila.instruccion,
    motivo: fila.motivo,
    estado: fila.estado as IntervencionImpulsoEnVivo["estado"],
    resultado: fila.resultado as IntervencionImpulsoEnVivo["resultado"],
    calibrada: typeof fila.decision_data?.rirCalibracion === "number",
    prescripcion: fila.prescripcion ?? {},
  };
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
