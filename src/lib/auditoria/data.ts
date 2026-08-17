import "server-only";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { hoyISO, sumarDiasISO } from "@/lib/date";
import { esDuracionImposible } from "./deteccion";
import { detectarDeficienciasRutina } from "@/lib/rutinas/validacion";

export type TipoHallazgo =
  | "sesion_duracion_imposible"
  | "puntos_entrenamiento_huerfanos"
  | "rutina_activa_deficiente"
  | "series_sin_registro";

export type HallazgoAuditoria = {
  tipo: TipoHallazgo;
  referenciaId: string;
  alumnoId: string;
  alumnoNombre: string;
  fecha: string;
  severidad: "alta" | "media";
  titulo: string;
  detalle: string;
};

const DIAS_VENTANA = 90;
const PREFIJO_CLAVE_ENTRENAMIENTO = "entrenamiento:";

/**
 * Corre los chequeos de la Auditoría de Puntos VIP contra los últimos
 * `DIAS_VENTANA` días y devuelve solo lo que todavía no se revisó (ver
 * `auditoria_revisiones`, migración 0046).
 *
 * Deliberadamente NO decide nada por su cuenta: cada hallazgo es una
 * sospecha con evidencia para que el entrenador decida (descartar o
 * penalizar vía las acciones en `app/admin/auditoria/actions.ts`).
 *
 * Se probó contra datos reales de producción antes de dejarlo así: una
 * primera versión también intentaba detectar "series cargadas de golpe"
 * usando `sesion_ejercicios.completado_en` como proxy (no hay timestamp por
 * serie individual en el esquema), pero esa columna se actualiza cada vez
 * que se re-guarda el ejercicio, no solo la primera vez que se completa —
 * daba falso positivo en el 89% de las sesiones reales. Se sacó por
 * completo en vez de dejar una señal que no se puede confiar.
 */
async function calcularHallazgosPendientes(): Promise<HallazgoAuditoria[]> {
  const admin = createAdminClient();
  const desde = sumarDiasISO(hoyISO(), -DIAS_VENTANA);

  const [{ data: perfiles }, { data: sesiones }, { data: revisiones }, { data: rutinasActivas }] = await Promise.all([
    admin.from("perfiles").select("id, nombre"),
    admin
      .from("sesiones_entrenamiento")
      .select("id, alumno_id, fecha, estado, numero_calendario, hora_inicio, hora_fin")
      .eq("estado", "completada")
      .gte("fecha", desde),
    admin.from("auditoria_revisiones").select("tipo, referencia_id"),
    admin
      .from("rutinas")
      .select("id, alumno_id, nombre, created_at, rutina_dias(nombre, tipo, rutina_dia_ejercicios(nombre, series_programadas, grupo_muscular))")
      .eq("activa", true),
  ]);

  const nombrePorAlumno = new Map((perfiles ?? []).map((p) => [p.id, p.nombre as string]));
  const revisado = new Set((revisiones ?? []).map((r) => `${r.tipo}:${r.referencia_id}`));
  const yaRevisado = (tipo: TipoHallazgo, referenciaId: string) => revisado.has(`${tipo}:${referenciaId}`);

  const hallazgos: HallazgoAuditoria[] = [];

  type RutinaActiva = {
    id: string;
    alumno_id: string;
    nombre: string;
    created_at: string;
    rutina_dias: {
      nombre: string;
      tipo: string | null;
      rutina_dia_ejercicios: {
        nombre: string;
        series_programadas: number;
        grupo_muscular: string | null;
      }[];
    }[];
  };
  for (const rutina of (rutinasActivas ?? []) as unknown as RutinaActiva[]) {
    if (yaRevisado("rutina_activa_deficiente", rutina.id)) continue;
    const deficiencias = detectarDeficienciasRutina((rutina.rutina_dias ?? []).map((dia) => ({
      nombre: dia.nombre,
      tipo: dia.tipo,
      ejercicios: (dia.rutina_dia_ejercicios ?? []).map((ejercicio) => ({
        nombre: ejercicio.nombre,
        series: ejercicio.series_programadas,
        grupoMuscular: ejercicio.grupo_muscular,
      })),
    })));
    if (deficiencias.length === 0) continue;
    hallazgos.push({
      tipo: "rutina_activa_deficiente",
      referenciaId: rutina.id,
      alumnoId: rutina.alumno_id,
      alumnoNombre: nombrePorAlumno.get(rutina.alumno_id) ?? "Alumno",
      fecha: rutina.created_at.slice(0, 10),
      severidad: "alta",
      titulo: `Rutina activa: ${rutina.nombre}`,
      detalle: deficiencias.join(" "),
    });
  }
  const sesionesValidas = sesiones ?? [];
  const sesionIds = sesionesValidas.map((s) => s.id);

  if (sesionIds.length > 0) {
    const totalSeriesPorSesion = new Map<string, number>();
    // Filtro por la sesión ENCADENADA (sesion_ejercicios.sesion_id), no una
    // lista de sesion_ejercicio_id: con cientos de ejercicios en la ventana
    // de 90 días, un `.in()` con esos ids de a uno superaba el límite de la
    // URL y la consulta volvía "Bad Request" sin avisar. Y el proyecto tiene
    // un tope duro de 1000 filas por respuesta (db-max-rows de PostgREST,
    // `.range()` no lo puede pisar) — con ~2000 series en 90 días hace falta
    // paginar, si no la mitad de las series queda sin contar en silencio.
    // Ambos problemas se detectaron recién probando contra datos reales.
    /** Series dadas por hechas sin un solo dato cargado, por sesión. */
    const seriesSinRegistroPorSesion = new Map<string, number>();
    const TAM_PAGINA = 1000;
    let desdeOffset = 0;
    while (true) {
      const { data: pagina } = await admin
        .from("series_realizadas")
        .select("sesion_ejercicio_id, realizada, peso_kg, reps_realizadas, sesion_ejercicios!inner(sesion_id)")
        .in("sesion_ejercicios.sesion_id", sesionIds)
        .range(desdeOffset, desdeOffset + TAM_PAGINA - 1);

      for (const s of pagina ?? []) {
        const sesionId = (s.sesion_ejercicios as unknown as { sesion_id: string } | null)?.sesion_id;
        if (!sesionId) continue;
        totalSeriesPorSesion.set(sesionId, (totalSeriesPorSesion.get(sesionId) ?? 0) + 1);
        // Marcada como hecha y COMPLETAMENTE vacía. Se exigen las dos cosas
        // vacías a propósito: un ejercicio de peso corporal no lleva kilos
        // pero sí repeticiones, y uno de tiempo tampoco lleva kilos — pedir
        // solo "sin kilos" los marcaría a todos por igual. Sin kilos Y sin
        // repeticiones no es un caso legítimo de ningún tipo de ejercicio:
        // es una serie que se cerró sin hacerse.
        if (s.realizada && s.peso_kg === null && s.reps_realizadas === null) {
          seriesSinRegistroPorSesion.set(sesionId, (seriesSinRegistroPorSesion.get(sesionId) ?? 0) + 1);
        }
      }

      if (!pagina || pagina.length < TAM_PAGINA) break;
      desdeOffset += TAM_PAGINA;
    }

    // Umbral de 3: una serie suelta sin cargar es despiste, y marcarlo por
    // eso llenaría el panel de ruido hasta volverlo inútil. Tres o más ya es
    // un patrón — normalmente un ejercicio entero cerrado de golpe.
    const MINIMO_SERIES_SIN_REGISTRO = 3;
    for (const sesion of sesionesValidas) {
      const vacias = seriesSinRegistroPorSesion.get(sesion.id) ?? 0;
      if (vacias < MINIMO_SERIES_SIN_REGISTRO) continue;
      if (yaRevisado("series_sin_registro", sesion.id)) continue;

      const totalSeries = totalSeriesPorSesion.get(sesion.id) ?? 0;
      hallazgos.push({
        tipo: "series_sin_registro",
        referenciaId: sesion.id,
        alumnoId: sesion.alumno_id,
        alumnoNombre: nombrePorAlumno.get(sesion.alumno_id) ?? "Alumno",
        fecha: sesion.fecha,
        severidad: "media",
        titulo: `#${sesion.numero_calendario ?? "?"} · ${vacias} series sin registro`,
        detalle:
          `${vacias} de ${totalSeries} series quedaron marcadas como hechas pero sin kilos ni repeticiones. ` +
          `Pasa al cerrar un ejercicio con "Completar y guardar" teniendo series pendientes: la sesión puntúa igual. ` +
          `Hasta el 11/08/2026 la app no avisaba nada al hacerlo, así que lo anterior a esa fecha es casi seguro ` +
          `que no se entendía el botón. Mira sobre todo si sigue pasando después.`,
      });
    }

    for (const sesion of sesionesValidas) {
      if (!sesion.hora_inicio || !sesion.hora_fin) continue;
      const totalSeries = totalSeriesPorSesion.get(sesion.id) ?? 0;
      const duracionSegundos = (new Date(sesion.hora_fin).getTime() - new Date(sesion.hora_inicio).getTime()) / 1000;
      if (!esDuracionImposible(duracionSegundos, totalSeries)) continue;
      if (yaRevisado("sesion_duracion_imposible", sesion.id)) continue;

      const minutos = Math.round(duracionSegundos / 60);
      hallazgos.push({
        tipo: "sesion_duracion_imposible",
        referenciaId: sesion.id,
        alumnoId: sesion.alumno_id,
        alumnoNombre: nombrePorAlumno.get(sesion.alumno_id) ?? "Alumno",
        fecha: sesion.fecha,
        // Bajado de "alta" a "media" por lo que se ve en los datos reales: la
        // app es nueva y la mayoría de estos casos es gente que entrenó SIN
        // el teléfono y despues abrió la sesión para dejarla registrada. Eso
        // no es hacer trampa, y tratarlo como "sospecha alta" acusaba de algo
        // que no pasó — además de enterrar lo que sí hay que mirar.
        severidad: "media",
        titulo: `#${sesion.numero_calendario ?? "?"} · ${totalSeries} series en ${minutos} min`,
        detalle:
          `La sesión quedó registrada en ${minutos} minuto${minutos === 1 ? "" : "s"} para ${totalSeries} series. ` +
          `Lo más probable es que haya entrenado sin la app y cargado todo al final. ` +
          `Solo vale la pena mirarlo si se repite seguido en la misma persona.`,
      });
    }
  }

  const { data: movimientos } = await admin
    .from("puntos_vip_movimientos")
    .select("alumno_id, clave, puntos, fecha")
    .eq("categoria", "entrenamiento")
    .gt("puntos", 0)
    .gte("fecha", desde)
    .like("clave", `${PREFIJO_CLAVE_ENTRENAMIENTO}%`);

  const referenciados = (movimientos ?? [])
    .map((m) => ({ ...m, sesionId: m.clave.slice(PREFIJO_CLAVE_ENTRENAMIENTO.length) }))
    .filter((m) => m.sesionId);

  if (referenciados.length > 0) {
    const idsUnicos = Array.from(new Set(referenciados.map((m) => m.sesionId)));
    const { data: existentes } = await admin.from("sesiones_entrenamiento").select("id").in("id", idsUnicos);
    const existenteSet = new Set((existentes ?? []).map((s) => s.id));

    for (const m of referenciados) {
      if (existenteSet.has(m.sesionId) || yaRevisado("puntos_entrenamiento_huerfanos", m.sesionId)) continue;
      hallazgos.push({
        tipo: "puntos_entrenamiento_huerfanos",
        referenciaId: m.sesionId,
        alumnoId: m.alumno_id,
        alumnoNombre: nombrePorAlumno.get(m.alumno_id) ?? "Alumno",
        fecha: m.fecha,
        severidad: "media",
        titulo: `${m.puntos} puntos sin sesión asociada`,
        detalle: `Hay ${m.puntos} puntos de "Entrenamiento finalizado" cuya sesión ya no existe en el historial. Puede ser un dato huérfano (ej. una rutina que se reinició) y no necesariamente algo intencional — revisar antes de penalizar.`,
      });
    }
  }

  return hallazgos.sort((a, b) => {
    if (a.severidad !== b.severidad) return a.severidad === "alta" ? -1 : 1;
    return b.fecha.localeCompare(a.fecha);
  });
}

/**
 * `calcularHallazgosPendientes` recorre 90 días de sesiones y todas las
 * rutinas activas — es la parte más pesada de `/admin/pendientes` (medido
 * hasta 4.6s). Se cachea 30s: son sospechas para que el entrenador decida,
 * no algo que tenga que reflejar el segundo exacto, y evita repetir ese
 * costo en cada carga de las tres pantallas que la usan (Pendientes,
 * Auditoría, Más).
 */
export const obtenerHallazgosPendientes = unstable_cache(
  calcularHallazgosPendientes,
  ["hallazgos-pendientes"],
  { revalidate: 30, tags: ["hallazgos-pendientes"] }
);
