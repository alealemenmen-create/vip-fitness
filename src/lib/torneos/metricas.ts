import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { TorneoMetrica } from "@/lib/supabase/types";

type AdminClient = ReturnType<typeof createAdminClient>;
export type ValorCompetencia = { valor: number; valido: boolean };

/** Calcula el marcador desde datos verificables de Portal VIP. */
export async function calcularValoresCompetencia(
  admin: AdminClient,
  metrica: TorneoMetrica,
  fechaInicio: string,
  fechaFin: string,
  participantes: { alumnoId: string; resultadoManual: number | null }[]
): Promise<Map<string, ValorCompetencia>> {
  const ids = participantes.map((participante) => participante.alumnoId);
  const valores = new Map<string, ValorCompetencia>();
  if (ids.length === 0) return valores;

  if (metrica === "manual") {
    for (const participante of participantes) {
      valores.set(participante.alumnoId, {
        valor: participante.resultadoManual ?? 0,
        valido: participante.resultadoManual !== null,
      });
    }
    return valores;
  }

  if (metrica === "asistencia") {
    for (const id of ids) valores.set(id, { valor: 0, valido: false });
    const { data: sesiones } = await admin
      .from("sesiones_entrenamiento")
      .select("alumno_id, rutina_dias(tipo)")
      .in("alumno_id", ids)
      .in("estado", ["completada", "finalizada_incompleta"])
      .gte("fecha", fechaInicio)
      .lte("fecha", fechaFin);
    for (const sesion of sesiones ?? []) {
      const dia = sesion.rutina_dias as unknown as { tipo: string } | null;
      if (dia?.tipo !== "entrenamiento") continue;
      const previo = valores.get(sesion.alumno_id)?.valor ?? 0;
      valores.set(sesion.alumno_id, { valor: previo + 1, valido: true });
    }
    return valores;
  }

  if (metrica === "progreso_vip") {
    for (const id of ids) valores.set(id, { valor: 0, valido: false });
    const { data: movimientos } = await admin
      .from("puntos_vip_movimientos")
      .select("alumno_id, puntos")
      .in("alumno_id", ids)
      .neq("categoria", "competencia")
      .gte("fecha", fechaInicio)
      .lte("fecha", fechaFin);
    for (const movimiento of movimientos ?? []) {
      const previo = valores.get(movimiento.alumno_id)?.valor ?? 0;
      valores.set(movimiento.alumno_id, { valor: previo + movimiento.puntos, valido: true });
    }
    for (const [id, resultado] of valores) {
      valores.set(id, { ...resultado, valor: Math.max(0, resultado.valor) });
    }
    return valores;
  }

  const { data: pesos } = await admin
    .from("pesos_corporales")
    .select("alumno_id, peso_kg, fecha")
    .in("alumno_id", ids)
    .gte("fecha", fechaInicio)
    .lte("fecha", fechaFin)
    .order("fecha", { ascending: true });
  const porAlumno = new Map<string, { primero: number; ultimo: number; cantidad: number }>();
  for (const peso of pesos ?? []) {
    const actual = porAlumno.get(peso.alumno_id);
    if (!actual) {
      porAlumno.set(peso.alumno_id, { primero: peso.peso_kg, ultimo: peso.peso_kg, cantidad: 1 });
    } else {
      actual.ultimo = peso.peso_kg;
      actual.cantidad += 1;
    }
  }
  for (const id of ids) {
    const registro = porAlumno.get(id);
    const diferencia = registro ? registro.ultimo - registro.primero : 0;
    valores.set(id, {
      valor: metrica === "peso_baja" ? -diferencia : diferencia,
      valido: (registro?.cantidad ?? 0) >= 2,
    });
  }
  return valores;
}
