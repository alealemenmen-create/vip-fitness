import "server-only";
import { createClient } from "@/lib/supabase/server";
import { hoyISO, ultimosNDiasISO, semanaActualISO } from "@/lib/date";
import {
  obtenerDiasRutina,
  obtenerRutinaActiva,
  type GrupoMuscular,
} from "@/app/alumno/entrenar/data";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type NotaActiva = {
  id: string;
  texto: string;
  fecha_inicio: string;
  esNueva: boolean;
  generadoConIA: boolean;
} | null;

export type EstadoEntrenamientoHoy =
  | { tipo: "sin_rutina" }
  | { tipo: "sin_dia_elegido" }
  | { tipo: "en_progreso"; completados: number; total: number; pct: number; sesionId: string }
  | { tipo: "completado"; completados: number; total: number; sesionId: string };

export type ResumenAlimentacionHoy = {
  comidasRegistradas: number;
  comidasDisponibles: number;
  kcal: number;
  prot: number;
  carb: number;
  grasa: number;
};

export type ProximoControl = { fecha: string; dias: number } | null;

export type SeguimientoHoy = {
  entreno_hoy: boolean | null;
  cumplio_alimentacion: boolean | null;
  agua_litros: number | null;
  horas_sueno: number | null;
  energia: number | null;
  molestias: string | null;
  comentario: string | null;
} | null;

const COMIDAS_DISPONIBLES_POR_DIA = 6;

export async function obtenerPerfilYObjetivo(supabase: SupabaseServerClient, userId: string) {
  const [{ data: perfil }, { data: alumnoPerfil }] = await Promise.all([
    supabase.from("perfiles").select("nombre").eq("id", userId).single(),
    supabase
      .from("alumno_perfil")
      .select("objetivo, proximo_control_fecha")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  return {
    nombre: perfil?.nombre ?? "",
    objetivo: alumnoPerfil?.objetivo ?? null,
    proximoControlFecha: alumnoPerfil?.proximo_control_fecha ?? null,
  };
}

/**
 * Devuelve la nota activa para hoy y, si corresponde marcarla como vista,
 * la marca "leída" en el mismo request (la UI ya mostró "NUEVO" con el valor
 * original antes de esta escritura, tal como pide la especificación:
 * deja de aparecer como nueva la próxima vez que el alumno entre).
 */
export async function obtenerNotaActivaYMarcarLeida(
  supabase: SupabaseServerClient,
  alumnoId: string,
  marcarLeida = true
): Promise<NotaActiva> {
  const hoy = hoyISO();
  const { data } = await supabase
    .from("notas_entrenador")
    .select("id, texto, fecha_inicio, fecha_fin, marcar_nueva, leida_en, generado_con_ia")
    .eq("alumno_id", alumnoId)
    .lte("fecha_inicio", hoy)
    .or(`fecha_fin.is.null,fecha_fin.gte.${hoy}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const esNueva = data.marcar_nueva && !data.leida_en;

  if (esNueva && marcarLeida) {
    await supabase
      .from("notas_entrenador")
      .update({ leida_en: new Date().toISOString() })
      .eq("id", data.id);
  }

  return {
    id: data.id,
    texto: data.texto,
    fecha_inicio: data.fecha_inicio,
    esNueva,
    generadoConIA: data.generado_con_ia,
  };
}

export async function obtenerEstadoEntrenamientoHoy(
  supabase: SupabaseServerClient,
  alumnoId: string
): Promise<EstadoEntrenamientoHoy> {
  const rutina = await obtenerRutinaActiva(alumnoId);

  if (!rutina) return { tipo: "sin_rutina" };

  // El entrenamiento ya no depende de la fecha del calendario (ver
  // entrenar/data.ts, "número de calendario falso"): se toma la sesión más
  // reciente de la rutina activa, y solo cuenta como "de hoy" si sigue en
  // progreso o si efectivamente se hizo hoy.
  const hoy = hoyISO();
  const { data: sesion } = await supabase
    .from("sesiones_entrenamiento")
    .select("id, fecha, estado")
    .eq("alumno_id", alumnoId)
    .eq("rutina_id", rutina.id)
    .order("numero_calendario", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sesion || (sesion.estado !== "en_progreso" && sesion.fecha !== hoy)) {
    return { tipo: "sin_dia_elegido" };
  }

  const { data: ejercicios } = await supabase
    .from("sesion_ejercicios")
    .select("completado")
    .eq("sesion_id", sesion.id);

  const total = ejercicios?.length ?? 0;
  const completados = ejercicios?.filter((e) => e.completado).length ?? 0;

  if (sesion.estado !== "en_progreso") {
    return { tipo: "completado", completados, total, sesionId: sesion.id };
  }

  const pct = total > 0 ? (completados / total) * 100 : 0;
  return { tipo: "en_progreso", completados, total, pct, sesionId: sesion.id };
}

export type EstadoDiaResumen = {
  nombre: string;
  tipo: "entrenamiento" | "descanso";
  /** Grupo muscular principal del día, para el ícono anatómico. */
  grupo: GrupoMuscular | null;
  esHoy: boolean;
  /** `false` cuando el alumno nunca pasó por esta posición de la rotación:
   * el círculo se dibuja gris en vez de rojo (0% "por falta de datos" no es
   * lo mismo que 0% cumplido). */
  conDatos: boolean;
  completados: number;
  total: number;
  pct: number;
};

export type ResumenEntrenamientoDias = {
  dias: EstadoDiaResumen[];
  pctGeneral: number;
  /** Número del calendario falso al que corresponde el día actual. */
  numeroActual: number;
} | null;

/** Un círculo de % por cada día de la rutina (según su posición en la
 * rotación, no la fecha real — mismo "calendario falso" que usa Entrenar),
 * más el promedio general. Para cada posición se toma la sesión más reciente
 * que le tocó (puede ser de hace varias vueltas de la rutina si el alumno no
 * volvió a pasar por ahí); para el día actual, la sesión de este número si ya
 * existe, o el conteo programado del día si todavía no la empezó. */
export async function obtenerResumenEntrenamientoDias(
  supabase: SupabaseServerClient,
  alumnoId: string
): Promise<ResumenEntrenamientoDias> {
  const rutina = await obtenerRutinaActiva(alumnoId);

  if (!rutina) return null;

  // Los días de la rutina y las sesiones no dependen entre sí: van juntos.
  const [diasRutina, { data: sesiones }] = await Promise.all([
    obtenerDiasRutina(rutina.id),
    supabase
      .from("sesiones_entrenamiento")
      .select("id, numero_calendario, estado")
      .eq("alumno_id", alumnoId)
      .eq("rutina_id", rutina.id)
      .not("numero_calendario", "is", null)
      .order("numero_calendario", { ascending: false }),
  ]);

  if (diasRutina.length === 0) return null;

  const n = diasRutina.length;

  // El día actual es la sesión en curso si la hay; si la última ya se
  // finalizó, el actual es el número siguiente (todavía sin sesión).
  const ultimaSesion = sesiones?.[0];
  const numeroActual =
    ultimaSesion && ultimaSesion.estado === "en_progreso"
      ? ultimaSesion.numero_calendario!
      : (ultimaSesion?.numero_calendario ?? 0) + 1;
  const posicionHoy = (numeroActual - 1) % n;

  // Solo interesa la sesión más reciente por posición — como vienen
  // ordenadas de mayor a menor número, la primera que se ve por posición ya
  // es la más reciente.
  const ultimaPorPosicion = new Map<number, { id: string; estado: string }>();
  for (const s of sesiones ?? []) {
    const pos = (s.numero_calendario! - 1) % n;
    if (!ultimaPorPosicion.has(pos)) {
      ultimaPorPosicion.set(pos, { id: s.id, estado: s.estado });
    }
  }

  const sesionIds = [...ultimaPorPosicion.values()].map((v) => v.id);
  const { data: ejerciciosSesiones } = sesionIds.length
    ? await supabase.from("sesion_ejercicios").select("sesion_id, completado").in("sesion_id", sesionIds)
    : { data: [] };

  const conteoPorSesion = new Map<string, { completados: number; total: number }>();
  for (const e of ejerciciosSesiones ?? []) {
    const actual = conteoPorSesion.get(e.sesion_id) ?? { completados: 0, total: 0 };
    actual.total += 1;
    if (e.completado) actual.completados += 1;
    conteoPorSesion.set(e.sesion_id, actual);
  }

  const dias: EstadoDiaResumen[] = diasRutina.map((dia, pos) => {
    const esHoy = pos === posicionHoy;
    const programados = dia.resumen?.cantidadEjercicios ?? 0;
    const ultima = ultimaPorPosicion.get(pos);
    const conteo = ultima ? conteoPorSesion.get(ultima.id) : undefined;

    // El día actual solo muestra datos si la sesión de ESTE número ya existe
    // (o sea, está en progreso); si la última de esta posición es de la vuelta
    // anterior, arranca en blanco.
    const usaSesion = ultima != null && (!esHoy || ultima.estado === "en_progreso");

    let completados = 0;
    let total = programados;
    let pct = 0;

    if (usaSesion && conteo && conteo.total > 0) {
      completados = conteo.completados;
      total = conteo.total;
      pct = (completados / total) * 100;
    } else if (usaSesion && ultima!.estado !== "en_progreso") {
      // Día de descanso finalizado (o sesión sin filas de ejercicios).
      pct = 100;
    }

    return {
      nombre: dia.tipo === "descanso" ? "Descanso" : dia.nombre,
      tipo: dia.tipo,
      grupo: dia.resumen?.gruposMusculares[0] ?? null,
      esHoy,
      conDatos: usaSesion,
      completados,
      total,
      pct: Math.round(pct),
    };
  });

  const pctGeneral = Math.round(dias.reduce((acc, d) => acc + d.pct, 0) / dias.length);

  return { dias, pctGeneral, numeroActual };
}

export type DiaSemanaReal = {
  letra: string;
  fecha: string;
  esHoy: boolean;
  entreno: boolean;
};

export type ConstanciaSemana = {
  dias: DiaSemanaReal[];
  entrenados: number;
  objetivo: number;
  pct: number;
};

/** Los puntitos L M X J V S D de Inicio: acá sí se usan fechas reales (no el
 * calendario falso de Entrenar), porque lo que se mide es la constancia de la
 * semana en curso. Un día cuenta como entrenado si tiene una sesión de un día
 * de entrenamiento finalizada con esa fecha. El objetivo semanal son los días
 * tipo 'entrenamiento' de la rutina activa. */
export async function obtenerConstanciaSemana(
  supabase: SupabaseServerClient,
  alumnoId: string
): Promise<ConstanciaSemana> {
  const semana = semanaActualISO();
  const desde = semana[0].fecha;
  const hasta = semana[6].fecha;

  // Las sesiones de la semana no dependen de la rutina, así que la consulta
  // arranca en paralelo en vez de esperar a que se resuelva la rutina.
  const sesionesPromesa = supabase
    .from("sesiones_entrenamiento")
    .select("fecha, rutina_dias(tipo)")
    .eq("alumno_id", alumnoId)
    .in("estado", ["completada", "finalizada_incompleta"])
    .gte("fecha", desde)
    .lte("fecha", hasta);

  const rutina = await obtenerRutinaActiva(alumnoId);
  const [diasRutina, { data: sesiones }] = await Promise.all([
    rutina ? obtenerDiasRutina(rutina.id) : [],
    sesionesPromesa,
  ]);
  const objetivo = diasRutina.filter((d) => d.tipo === "entrenamiento").length;

  const fechasEntrenadas = new Set(
    (sesiones ?? [])
      .filter((s) => (s.rutina_dias as unknown as { tipo: string } | null)?.tipo === "entrenamiento")
      .map((s) => s.fecha)
  );

  const dias = semana.map((d) => ({ ...d, entreno: fechasEntrenadas.has(d.fecha) }));
  const entrenados = fechasEntrenadas.size;

  return {
    dias,
    entrenados,
    objetivo,
    pct: objetivo > 0 ? Math.min(100, Math.round((entrenados / objetivo) * 100)) : 0,
  };
}

export type PuntoProgreso = {
  numero: number;
  nombreDia: string;
  fecha: string;
  esDescanso: boolean;
  completados: number;
  total: number;
  pct: number;
  /** Días reales transcurridos desde la sesión anterior — sirve para pintar
   * en rojo los tramos con días saltados aunque el % haya sido bueno. */
  diasDesdeAnterior: number | null;
};

/** Historial de sesiones finalizadas de la rutina activa, en orden
 * cronológico del calendario falso, para la gráfica tipo ECG de Inicio. */
export async function obtenerHistorialProgreso(
  supabase: SupabaseServerClient,
  alumnoId: string,
  limite = 40
): Promise<PuntoProgreso[]> {
  const rutina = await obtenerRutinaActiva(alumnoId);

  if (!rutina) return [];

  const { data: sesiones } = await supabase
    .from("sesiones_entrenamiento")
    .select("id, fecha, numero_calendario, estado, rutina_dias(nombre, tipo)")
    .eq("alumno_id", alumnoId)
    .eq("rutina_id", rutina.id)
    .neq("estado", "en_progreso")
    .not("numero_calendario", "is", null)
    .order("numero_calendario", { ascending: false })
    .limit(limite);

  if (!sesiones || sesiones.length === 0) return [];

  const { data: ejercicios } = await supabase
    .from("sesion_ejercicios")
    .select("sesion_id, completado")
    .in(
      "sesion_id",
      sesiones.map((s) => s.id)
    );

  const conteos = new Map<string, { completados: number; total: number }>();
  for (const e of ejercicios ?? []) {
    const actual = conteos.get(e.sesion_id) ?? { completados: 0, total: 0 };
    actual.total += 1;
    if (e.completado) actual.completados += 1;
    conteos.set(e.sesion_id, actual);
  }

  const cronologico = [...sesiones].reverse();

  return cronologico.map((s, i) => {
    const dia = s.rutina_dias as unknown as { nombre: string; tipo: string } | null;
    const esDescanso = dia?.tipo === "descanso";
    const c = conteos.get(s.id) ?? { completados: 0, total: 0 };
    const pct = c.total > 0 ? Math.round((c.completados / c.total) * 100) : esDescanso ? 100 : 0;

    const anterior = cronologico[i - 1];
    const diasDesdeAnterior = anterior
      ? Math.round(
          (new Date(`${s.fecha}T00:00:00`).getTime() -
            new Date(`${anterior.fecha}T00:00:00`).getTime()) /
            86_400_000
        )
      : null;

    return {
      numero: s.numero_calendario!,
      nombreDia: esDescanso ? "Descanso" : (dia?.nombre ?? ""),
      fecha: s.fecha,
      esDescanso,
      completados: c.completados,
      total: c.total,
      pct,
      diasDesdeAnterior,
    };
  });
}

export async function obtenerResumenAlimentacionHoy(
  supabase: SupabaseServerClient,
  alumnoId: string
): Promise<ResumenAlimentacionHoy> {
  const vacio: ResumenAlimentacionHoy = {
    comidasRegistradas: 0,
    comidasDisponibles: COMIDAS_DISPONIBLES_POR_DIA,
    kcal: 0,
    prot: 0,
    carb: 0,
    grasa: 0,
  };

  // Antes eran tres consultas encadenadas (registro del día → sus comidas →
  // los alimentos de esas comidas), cada una esperando a la anterior. Con el
  // embebido de PostgREST sale todo en un solo viaje: se filtra por el
  // registro del día con `!inner` y se traen anidados los alimentos.
  const { data: comidas } = await supabase
    .from("comidas_registradas")
    .select(
      "id, omitida, registros_diarios!inner(alumno_id, fecha), alimentos_consumidos(cantidad, alimentos(kcal, prot, carb, grasa, porcion_base))"
    )
    .eq("registros_diarios.alumno_id", alumnoId)
    .eq("registros_diarios.fecha", hoyISO());

  if (!comidas || comidas.length === 0) return vacio;

  const registradas = comidas.filter((c) => !c.omitida);
  if (registradas.length === 0) {
    return { ...vacio, comidasRegistradas: 0 };
  }

  const consumidos = registradas.flatMap(
    (c) =>
      (c.alimentos_consumidos as unknown as {
        cantidad: number;
        alimentos: {
          kcal: number;
          prot: number;
          carb: number;
          grasa: number;
          porcion_base: number;
        } | null;
      }[]) ?? []
  );

  const totales = consumidos.reduce(
    (acc, item) => {
      const alimento = item.alimentos;
      if (!alimento) return acc;
      const factor = item.cantidad / alimento.porcion_base;
      acc.kcal += alimento.kcal * factor;
      acc.prot += alimento.prot * factor;
      acc.carb += alimento.carb * factor;
      acc.grasa += alimento.grasa * factor;
      return acc;
    },
    { kcal: 0, prot: 0, carb: 0, grasa: 0 }
  );

  return {
    comidasRegistradas: registradas.length,
    comidasDisponibles: COMIDAS_DISPONIBLES_POR_DIA,
    kcal: Math.round(totales.kcal),
    prot: Math.round(totales.prot),
    carb: Math.round(totales.carb),
    grasa: Math.round(totales.grasa),
  };
}

export function calcularProximoControl(fechaISO: string | null): ProximoControl {
  if (!fechaISO) return null;
  const hoy = hoyISO();
  const dias = Math.round(
    (new Date(`${fechaISO}T00:00:00`).getTime() - new Date(`${hoy}T00:00:00`).getTime()) /
      86_400_000
  );
  return { fecha: fechaISO, dias };
}

export async function obtenerSeguimientoHoy(
  supabase: SupabaseServerClient,
  alumnoId: string
): Promise<SeguimientoHoy> {
  const { data } = await supabase
    .from("seguimientos_diarios")
    .select("entreno_hoy, cumplio_alimentacion, agua_litros, horas_sueno, energia, molestias, comentario")
    .eq("alumno_id", alumnoId)
    .eq("fecha", hoyISO())
    .maybeSingle();

  return data ?? null;
}

export type SeguimientoDia = {
  fecha: string;
  entrenoHoy: boolean | null;
  cumplioAlimentacion: boolean | null;
  aguaLitros: number | null;
  horasSueno: number | null;
  energia: number | null;
  molestias: string | null;
  comentario: string | null;
};

/** Últimos `dias` con seguimiento registrado (no incluye los vacíos, a
 * diferencia del resumen de comidas), para que el entrenador vea el
 * autorreporte diario del alumno, incluido su comentario libre. */
export async function obtenerHistorialSeguimientos(
  supabase: SupabaseServerClient,
  alumnoId: string,
  dias = 14
): Promise<SeguimientoDia[]> {
  const fechas = ultimosNDiasISO(dias);
  const desde = fechas[fechas.length - 1];
  const hasta = fechas[0];

  const { data } = await supabase
    .from("seguimientos_diarios")
    .select(
      "fecha, entreno_hoy, cumplio_alimentacion, agua_litros, horas_sueno, energia, molestias, comentario"
    )
    .eq("alumno_id", alumnoId)
    .gte("fecha", desde)
    .lte("fecha", hasta)
    .order("fecha", { ascending: false });

  return (data ?? []).map((s) => ({
    fecha: s.fecha,
    entrenoHoy: s.entreno_hoy,
    cumplioAlimentacion: s.cumplio_alimentacion,
    aguaLitros: s.agua_litros,
    horasSueno: s.horas_sueno,
    energia: s.energia,
    molestias: s.molestias,
    comentario: s.comentario,
  }));
}
