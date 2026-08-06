import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { hoyISO, sumarDiasISO } from "@/lib/date";
import { esDuracionImposible } from "./deteccion";

export type TipoHallazgo = "sesion_duracion_imposible" | "puntos_entrenamiento_huerfanos";

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
export async function obtenerHallazgosPendientes(): Promise<HallazgoAuditoria[]> {
  const admin = createAdminClient();
  const desde = sumarDiasISO(hoyISO(), -DIAS_VENTANA);

  const [{ data: perfiles }, { data: sesiones }, { data: revisiones }] = await Promise.all([
    admin.from("perfiles").select("id, nombre"),
    admin
      .from("sesiones_entrenamiento")
      .select("id, alumno_id, fecha, estado, numero_calendario, hora_inicio, hora_fin")
      .eq("estado", "completada")
      .gte("fecha", desde),
    admin.from("auditoria_revisiones").select("tipo, referencia_id"),
  ]);

  const nombrePorAlumno = new Map((perfiles ?? []).map((p) => [p.id, p.nombre as string]));
  const revisado = new Set((revisiones ?? []).map((r) => `${r.tipo}:${r.referencia_id}`));
  const yaRevisado = (tipo: TipoHallazgo, referenciaId: string) => revisado.has(`${tipo}:${referenciaId}`);

  const hallazgos: HallazgoAuditoria[] = [];
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
    const TAM_PAGINA = 1000;
    let desdeOffset = 0;
    while (true) {
      const { data: pagina } = await admin
        .from("series_realizadas")
        .select("sesion_ejercicio_id, sesion_ejercicios!inner(sesion_id)")
        .in("sesion_ejercicios.sesion_id", sesionIds)
        .range(desdeOffset, desdeOffset + TAM_PAGINA - 1);

      for (const s of pagina ?? []) {
        const sesionId = (s.sesion_ejercicios as unknown as { sesion_id: string } | null)?.sesion_id;
        if (!sesionId) continue;
        totalSeriesPorSesion.set(sesionId, (totalSeriesPorSesion.get(sesionId) ?? 0) + 1);
      }

      if (!pagina || pagina.length < TAM_PAGINA) break;
      desdeOffset += TAM_PAGINA;
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
        severidad: "alta",
        titulo: `#${sesion.numero_calendario ?? "?"} · ${totalSeries} series en ${minutos} min`,
        detalle: `La sesión completa duró ${minutos} minuto${minutos === 1 ? "" : "s"} para ${totalSeries} series — insuficiente para ejecutarlas y cargarlas de verdad.`,
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
