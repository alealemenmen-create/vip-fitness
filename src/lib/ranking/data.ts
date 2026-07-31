import "server-only";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { semanaActualISO, semanaAnteriorLunesISO, hoyISO } from "@/lib/date";
import { calcularPuntosSemana, rangoDePuntos, type DesgloseSemana } from "./puntos";
import { obtenerDeltasTorneosCerrados } from "@/lib/torneos/data";

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Etiqueta de caché del ranking. Cualquier acción que cambie los puntos de un
 * alumno (finalizar una sesión, registrar una comida, un check-in, un peso,
 * cerrar un torneo) debe llamar a `revalidateTag(TAG_RANKING)` para que el
 * cambio se vea al instante en vez de esperar a que venza la caché.
 */
export const TAG_RANKING = "ranking";

/** Cuánto vive el ranking calculado antes de recalcularse solo. Es un dato
 * comparativo entre alumnos, no un contador en vivo: 5 minutos es suficiente,
 * y las acciones que suman puntos lo invalidan de inmediato por etiqueta. */
const SEGUNDOS_CACHE_RANKING = 300;

/** Si el alumno todavía no tiene plan de alimentación cargado, se asume el
 * mínimo razonable (desayuno, almuerzo y cena) para no castigarlo por comidas
 * que nadie le asignó. */
const COMIDAS_SIN_PLAN = 3;

/** Lunes de la semana en que se lanzó el sistema de ranking (2026-07-28, un
 * martes). No se cierran ni acumulan semanas anteriores a esta. */
const LANZAMIENTO_RANKING_ISO = "2026-07-27";

export type FilaRanking = {
  alumnoId: string;
  nombre: string;
  /** Puesto en el ranking de ESTA semana (define el orden del top semanal). */
  posicion: number;
  /** Puntos de esta semana. */
  puntos: number;
  desglose: DesgloseSemana;
  /** Suma histórica de semanas ya cerradas + lo que va de la semana en curso.
   * Es lo que define el rango (Bronze→Olympian VIP): sube y baja de verdad,
   * no se reinicia cada lunes. */
  puntosAcumulados: number;
  rango: ReturnType<typeof rangoDePuntos>;
};

type Alumno = { id: string; nombre: string };

/**
 * El ranking necesita leer entrenamientos, comidas y check-ins de TODOS los
 * alumnos, no solo los de quien pregunta — pero las políticas RLS de esas
 * tablas restringen la lectura a "lo propio" (un alumno normal no puede ver
 * las sesiones de otro). Por eso este módulo entero usa la service_role key
 * (ignora RLS) en vez del cliente de sesión: es server-only, se invoca desde
 * páginas ya protegidas con requireAlumno()/requireRol(), y solo devuelve al
 * cliente los campos agregados (nombre, puntos) que la función ya mostraba.
 */

/** Calcula el desglose de puntos de un grupo de alumnos para un rango de
 * fechas arbitrario. Se reusa tanto para "la semana en curso" (parcial) como
 * para cerrar semanas ya terminadas (diasTranscurridos = 7). */
async function calcularDesglosePorAlumno(
  admin: AdminClient,
  alumnos: Alumno[],
  desde: string,
  hasta: string,
  diasTranscurridos: number
): Promise<Map<string, DesgloseSemana>> {
  const ids = alumnos.map((a) => a.id);
  if (ids.length === 0) return new Map();

  const [{ data: rutinas }, { data: sesiones }, { data: registros }, { data: seguimientos }, { data: pesos }] =
    await Promise.all([
      admin.from("rutinas").select("id, alumno_id").in("alumno_id", ids).eq("activa", true),
      admin
        .from("sesiones_entrenamiento")
        .select("alumno_id, fecha, rutina_dias(tipo)")
        .in("alumno_id", ids)
        .in("estado", ["completada", "finalizada_incompleta"])
        .gte("fecha", desde)
        .lte("fecha", hasta),
      admin
        .from("registros_diarios")
        .select("id, alumno_id, fecha")
        .in("alumno_id", ids)
        .gte("fecha", desde)
        .lte("fecha", hasta),
      admin
        .from("seguimientos_diarios")
        .select("alumno_id, fecha")
        .in("alumno_id", ids)
        .gte("fecha", desde)
        .lte("fecha", hasta),
      admin
        .from("pesos_corporales")
        .select("alumno_id")
        .in("alumno_id", ids)
        .gte("fecha", desde)
        .lte("fecha", hasta),
    ]);

  // Días de entrenamiento por alumno → sesiones que le tocan por semana.
  const rutinaPorAlumno = new Map((rutinas ?? []).map((r) => [r.id, r.alumno_id]));
  const programadasPorAlumno = new Map<string, number>();
  if (rutinaPorAlumno.size > 0) {
    const { data: dias } = await admin
      .from("rutina_dias")
      .select("rutina_id, tipo")
      .in("rutina_id", [...rutinaPorAlumno.keys()]);
    for (const d of dias ?? []) {
      if (d.tipo !== "entrenamiento") continue;
      const alumnoId = rutinaPorAlumno.get(d.rutina_id);
      if (!alumnoId) continue;
      programadasPorAlumno.set(alumnoId, (programadasPorAlumno.get(alumnoId) ?? 0) + 1);
    }
  }

  const sesionesPorAlumno = new Map<string, number>();
  for (const s of sesiones ?? []) {
    const dia = s.rutina_dias as unknown as { tipo: string } | null;
    if (dia?.tipo !== "entrenamiento") continue;
    sesionesPorAlumno.set(s.alumno_id, (sesionesPorAlumno.get(s.alumno_id) ?? 0) + 1);
  }

  // Comidas realmente registradas (con al menos un alimento y no omitidas).
  const comidasPorAlumnoFecha = new Map<string, Map<string, number>>();
  const registroIds = (registros ?? []).map((r) => r.id);

  if (registroIds.length > 0) {
    const { data: comidas } = await admin
      .from("comidas_registradas")
      .select("id, registro_diario_id, omitida")
      .in("registro_diario_id", registroIds);

    const validas = (comidas ?? []).filter((c) => !c.omitida);

    if (validas.length > 0) {
      const { data: consumidos } = await admin
        .from("alimentos_consumidos")
        .select("comida_id")
        .in(
          "comida_id",
          validas.map((c) => c.id)
        );

      const comidasConAlimento = new Set((consumidos ?? []).map((c) => c.comida_id));
      const registroPorId = new Map((registros ?? []).map((r) => [r.id, r]));

      for (const comida of validas) {
        if (!comidasConAlimento.has(comida.id)) continue;
        const registro = registroPorId.get(comida.registro_diario_id);
        if (!registro) continue;
        const porFecha = comidasPorAlumnoFecha.get(registro.alumno_id) ?? new Map<string, number>();
        porFecha.set(registro.fecha, (porFecha.get(registro.fecha) ?? 0) + 1);
        comidasPorAlumnoFecha.set(registro.alumno_id, porFecha);
      }
    }
  }

  // Cuántas comidas tiene el plan de cada alumno: el día de alimentación vale
  // lo mismo para todos y se reparte entre SUS comidas.
  const comidasDelPlan = new Map<string, number>();
  const { data: planes } = await admin
    .from("planes_alimentacion")
    .select("id, alumno_id")
    .in("alumno_id", ids)
    .eq("activo", true);

  if (planes && planes.length > 0) {
    const { data: comidasPlan } = await admin
      .from("plan_comidas")
      .select("plan_id")
      .in(
        "plan_id",
        planes.map((p) => p.id)
      );

    const conteoPorPlan = new Map<string, number>();
    for (const c of comidasPlan ?? []) {
      conteoPorPlan.set(c.plan_id, (conteoPorPlan.get(c.plan_id) ?? 0) + 1);
    }
    for (const plan of planes) {
      const n = conteoPorPlan.get(plan.id) ?? 0;
      if (n > 0) comidasDelPlan.set(plan.alumno_id, n);
    }
  }

  const checkinsPorAlumno = new Map<string, number>();
  for (const s of seguimientos ?? []) {
    checkinsPorAlumno.set(s.alumno_id, (checkinsPorAlumno.get(s.alumno_id) ?? 0) + 1);
  }

  const conPeso = new Set((pesos ?? []).map((p) => p.alumno_id));

  const resultado = new Map<string, DesgloseSemana>();
  for (const alumno of alumnos) {
    const comidasPorDia = comidasDelPlan.get(alumno.id) ?? COMIDAS_SIN_PLAN;
    const porFecha = comidasPorAlumnoFecha.get(alumno.id) ?? new Map<string, number>();
    // Tope por día: desde que Comer registra por hora, el alumno puede anotar
    // hasta 24 comidas diarias. Cada comida vale puntosPorDia/comidasPorDia,
    // así que sin este tope registrar de más pagaría más que un día perfecto.
    // El tope va acá y no en calcularPuntosSemana para no tocar la fórmula.
    const comidasRegistradas = [...porFecha.values()].reduce(
      (a, b) => a + Math.min(b, comidasPorDia),
      0
    );
    const diasCompletos = [...porFecha.values()].filter((n) => n >= comidasPorDia).length;
    const diasConAlgo = porFecha.size;

    resultado.set(
      alumno.id,
      calcularPuntosSemana({
        sesionesProgramadas: programadasPorAlumno.get(alumno.id) ?? 0,
        sesionesHechas: sesionesPorAlumno.get(alumno.id) ?? 0,
        comidasPorDia,
        diasTranscurridos,
        comidasRegistradas,
        diasCompletos,
        diasSinComidas: Math.max(0, diasTranscurridos - diasConAlgo),
        diasConCheckin: checkinsPorAlumno.get(alumno.id) ?? 0,
        registroPesoSemanal: conPeso.has(alumno.id),
      })
    );
  }
  return resultado;
}

/** Lunes de cada semana calendario completa desde el lanzamiento del ranking
 * hasta la semana pasada (inclusive) — son las que ya se pueden cerrar. */
function semanasCerrablesDesdeLanzamiento(): string[] {
  const limite = semanaAnteriorLunesISO();
  if (limite < LANZAMIENTO_RANKING_ISO) return [];

  const lunes: string[] = [];
  const cursor = new Date(`${LANZAMIENTO_RANKING_ISO}T00:00:00Z`);
  const fin = new Date(`${limite}T00:00:00Z`);
  while (cursor <= fin) {
    lunes.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
  return lunes;
}

/** Cierra (guarda) las semanas ya terminadas que todavía no tienen fila en
 * ranking_semanas, para el grupo de alumnos dado. Se llama en cada visita a
 * Inicio/Ranked: es idempotente (unique alumno_id+semana_inicio) y no hace
 * nada si ya está todo cerrado, así que el costo normal es una sola consulta
 * de chequeo. */
async function cerrarSemanasPendientes(admin: AdminClient, alumnos: Alumno[]): Promise<void> {
  const lunes = semanasCerrablesDesdeLanzamiento();
  if (lunes.length === 0 || alumnos.length === 0) return;

  const ids = alumnos.map((a) => a.id);
  const { data: existentes } = await admin
    .from("ranking_semanas")
    .select("alumno_id, semana_inicio")
    .in("alumno_id", ids)
    .in("semana_inicio", lunes);

  const yaCerradas = new Set((existentes ?? []).map((r) => `${r.alumno_id}:${r.semana_inicio}`));

  for (const semanaInicio of lunes) {
    const faltantes = alumnos.filter((a) => !yaCerradas.has(`${a.id}:${semanaInicio}`));
    if (faltantes.length === 0) continue;

    const semanaFin = new Date(`${semanaInicio}T00:00:00Z`);
    semanaFin.setUTCDate(semanaFin.getUTCDate() + 6);
    const hasta = semanaFin.toISOString().slice(0, 10);

    const desglosePorAlumno = await calcularDesglosePorAlumno(admin, faltantes, semanaInicio, hasta, 7);

    const filas = faltantes.map((a) => {
      const d = desglosePorAlumno.get(a.id)!;
      return {
        alumno_id: a.id,
        semana_inicio: semanaInicio,
        puntos: d.total,
        desglose: d,
      };
    });

    // onConflict ignora si otra visita concurrente ya cerró la misma semana.
    await admin
      .from("ranking_semanas")
      .upsert(filas, { onConflict: "alumno_id,semana_inicio", ignoreDuplicates: true });
  }
}

/** Suma de puntos de las semanas ya cerradas, por alumno. */
async function obtenerAcumuladosCerrados(
  admin: AdminClient,
  ids: string[]
): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map();
  const { data } = await admin.from("ranking_semanas").select("alumno_id, puntos").in("alumno_id", ids);

  const mapa = new Map<string, number>();
  for (const fila of data ?? []) {
    mapa.set(fila.alumno_id, (mapa.get(fila.alumno_id) ?? 0) + fila.puntos);
  }
  return mapa;
}

/**
 * La parte cara del ranking, cacheada: leer entrenamientos, comidas,
 * check-ins y pesos de TODOS los alumnos son ~14 consultas encadenadas en
 * varias etapas. Antes se recalculaba entero en cada visita a Inicio y a
 * Ranked, de cada alumno.
 *
 * La clave de caché incluye la semana y los días transcurridos, así que al
 * cambiar el día (o al empezar una semana nueva) se recalcula solo, sin
 * depender de que venza el tiempo. La lista de alumnos también entra en la
 * clave: si se suma o se borra un alumno, el ranking se rehace de inmediato.
 */
const calcularRankingCacheado = unstable_cache(
  async (
    alumnos: Alumno[],
    desde: string,
    hasta: string,
    diasTranscurridos: number
  ): Promise<FilaRanking[]> => {
    const admin = createAdminClient();
    const ids = alumnos.map((a) => a.id);

    const [desgloseSemana, acumulados, deltasTorneos] = await Promise.all([
      calcularDesglosePorAlumno(admin, alumnos, desde, hasta, diasTranscurridos),
      obtenerAcumuladosCerrados(admin, ids),
      obtenerDeltasTorneosCerrados(admin, ids),
    ]);

    const filas: FilaRanking[] = alumnos.map((alumno) => {
      const desglose = desgloseSemana.get(alumno.id)!;
      const puntosAcumulados =
        (acumulados.get(alumno.id) ?? 0) + desglose.total + (deltasTorneos.get(alumno.id) ?? 0);
      return {
        alumnoId: alumno.id,
        nombre: alumno.nombre,
        puntos: desglose.total,
        desglose,
        puntosAcumulados,
        rango: rangoDePuntos(puntosAcumulados),
        posicion: 0,
      };
    });

    // El orden del top semanal sigue siendo por lo hecho ESTA semana, no por el
    // acumulado histórico (si no, el que ya llegó a Diamond nunca perdería el
    // primer puesto aunque esta semana no haya hecho nada).
    filas.sort((a, b) => b.puntos - a.puntos);
    filas.forEach((f, i) => (f.posicion = i + 1));

    return filas;
  },
  ["ranking-semanal"],
  { revalidate: SEGUNDOS_CACHE_RANKING, tags: [TAG_RANKING] }
);

/**
 * Ranking completo: puntos de la semana en curso (calculados al vuelo, para
 * el orden del top semanal) y puntos acumulados históricos (para el rango
 * persistente). No hay tabla de puntos "en vivo" que mantener — solo se
 * persiste el cierre de semanas ya terminadas.
 */
export async function obtenerRankingSemanal(): Promise<FilaRanking[]> {
  const admin = createAdminClient();

  // Compite cualquiera que tenga un perfil de alumno activo, sin importar el
  // rol — un entrenador que activó su "Mi entrenamiento" (alumno_perfil
  // propio) participa igual que cualquier alumno. Mismo criterio que ya usa
  // /admin/alumnos para listar a "sus" alumnos.
  const { data: alumnoPerfiles } = await admin
    .from("alumno_perfil")
    .select("user_id, perfiles!alumno_perfil_user_id_fkey(nombre)");

  const alumnos = (alumnoPerfiles ?? []).map((a) => ({
    id: a.user_id,
    nombre: (a.perfiles as unknown as { nombre: string } | null)?.nombre ?? "Alumno",
  }));
  if (alumnos.length === 0) return [];

  // El cierre de semanas queda FUERA de la caché a propósito: escribe en la
  // base y tiene que correr aunque el cálculo se sirva cacheado. Normalmente
  // no cuesta nada (no hay semanas nuevas que cerrar) y es idempotente.
  await cerrarSemanasPendientes(admin, alumnos);

  const semana = semanaActualISO();
  const hoy = hoyISO();
  const diasTranscurridos = Math.max(1, semana.filter((d) => d.fecha <= hoy).length);

  // El orden de la lista tiene que ser estable o la clave de caché cambia sin
  // motivo y nunca se acierta (Postgres no garantiza orden sin ORDER BY).
  alumnos.sort((a, b) => a.id.localeCompare(b.id));

  return calcularRankingCacheado(alumnos, semana[0].fecha, semana[6].fecha, diasTranscurridos);
}
