import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { hoyISO } from "@/lib/date";
import { repartirApuestas, type Apuesta } from "./apuestas";

type AdminClient = ReturnType<typeof createAdminClient>;

/** Cuánto puede arriesgar un alumno: TODO lo que acumuló, con piso en cero.
 *
 * Se lee directo de los movimientos y no del ranking (`obtenerRanking`) a
 * propósito: ese está cacheado 120 s con `unstable_cache`, y 120 s es una
 * eternidad cuando el número decide si una apuesta entra o se rechaza. Un
 * alumno que acaba de cerrar su sesión tiene que poder apostar con los puntos
 * que ganó recién, y —más importante— nadie tiene que poder apostar dos veces
 * un saldo que el caché todavía muestra intacto.
 */
export async function obtenerSaldoVip(alumnoId: string): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("puntos_vip_movimientos")
    .select("puntos")
    .eq("alumno_id", alumnoId);
  if (error) return 0;
  return Math.max(0, (data ?? []).reduce((total, fila) => total + fila.puntos, 0));
}

/** Lo que ya se apostó en un torneo, por participante. */
export type ResumenApuestasTorneo = {
  torneoId: string;
  /** Bolsa apostada por el público (no la bolsa de premios de VIP Fitness). */
  total: number;
  cantidad: number;
  porParticipante: { alumnoId: string; total: number; cantidad: number }[];
  /** La apuesta del alumno que está mirando, si puso alguna. */
  miApuesta: { porAlumnoId: string; puntos: number } | null;
};

const RESUMEN_VACIO = (torneoId: string): ResumenApuestasTorneo => ({
  torneoId,
  total: 0,
  cantidad: 0,
  porParticipante: [],
  miApuesta: null,
});

/**
 * Resumen de apuestas de varios torneos de una sola consulta — la lista de
 * Arena VIP muestra todos los torneos abiertos a la vez y una consulta por
 * torneo se nota en el gimnasio, donde el wifi es el que es.
 */
export async function obtenerResumenApuestas(
  torneoIds: string[],
  alumnoId: string
): Promise<Map<string, ResumenApuestasTorneo>> {
  const resumen = new Map(torneoIds.map((id) => [id, RESUMEN_VACIO(id)]));
  if (torneoIds.length === 0) return resumen;

  const admin = createAdminClient();
  const { data } = await admin
    .from("torneo_apuestas")
    .select("torneo_id, alumno_id, por_alumno_id, puntos")
    .in("torneo_id", torneoIds);

  for (const apuesta of data ?? []) {
    const actual = resumen.get(apuesta.torneo_id);
    if (!actual) continue;
    actual.total += apuesta.puntos;
    actual.cantidad += 1;
    const porParticipante = actual.porParticipante.find((p) => p.alumnoId === apuesta.por_alumno_id);
    if (porParticipante) {
      porParticipante.total += apuesta.puntos;
      porParticipante.cantidad += 1;
    } else {
      actual.porParticipante.push({
        alumnoId: apuesta.por_alumno_id,
        total: apuesta.puntos,
        cantidad: 1,
      });
    }
    if (apuesta.alumno_id === alumnoId) {
      actual.miApuesta = { porAlumnoId: apuesta.por_alumno_id, puntos: apuesta.puntos };
    }
  }

  return resumen;
}

/**
 * ¿Siguen abiertas las apuestas de este torneo?
 *
 * Cierran cuando la competencia EMPIEZA, igual que las invitaciones. No es una
 * decisión de comodidad: el marcador de Arena VIP es público y se actualiza
 * solo, así que apostar el último día sería apostar con el resultado casi a la
 * vista, a costa de los que se la jugaron antes. En una carrera de caballos las
 * ventanillas cierran cuando se abre la partida, por exactamente lo mismo.
 */
export function apuestasAbiertas(torneo: { cerrado: boolean; fecha_inicio: string }): boolean {
  return !torneo.cerrado && hoyISO() < torneo.fecha_inicio;
}

export type ResolucionApuestas = {
  /** Cuántas apuestas se pagaron. 0 si no había ninguna. */
  cantidad: number;
  bolsaTotal: number;
  motivoDevolucion: ReturnType<typeof repartirApuestas>["motivoDevolucion"];
};

/**
 * Cierra las apuestas de un torneo: reparte la bolsa y acredita lo que
 * corresponde. La aritmética entera vive en `repartirApuestas` (probada
 * aparte); acá solo se escribe el resultado.
 *
 * Es idempotente por dos candados: `devuelto is null` filtra las apuestas ya
 * resueltas, y el movimiento de puntos se hace con `upsert` sobre
 * `(alumno_id, clave)`. Que se llame dos veces —un reintento del entrenador,
 * un cierre que falló a mitad— no puede pagar dos veces.
 *
 * No lanza: si algo falla, el torneo igual se cierra y las apuestas quedan sin
 * resolver para reintentar. Preferible a dejar un torneo a medio cerrar con la
 * bolsa de premios ya repartida.
 */
export async function resolverApuestasTorneo(
  admin: AdminClient,
  torneo: { id: string; nombre: string },
  ganadorId: string | null
): Promise<ResolucionApuestas> {
  const { data: filas } = await admin
    .from("torneo_apuestas")
    .select("id, alumno_id, por_alumno_id, puntos")
    .eq("torneo_id", torneo.id)
    .is("devuelto", null);

  if (!filas || filas.length === 0) {
    return { cantidad: 0, bolsaTotal: 0, motivoDevolucion: null };
  }

  const apuestas: Apuesta[] = filas.map((f) => ({
    alumnoId: f.alumno_id,
    porAlumnoId: f.por_alumno_id,
    puntos: f.puntos,
  }));
  const { pagos, bolsaTotal, motivoDevolucion } = repartirApuestas(apuestas, ganadorId);

  const ahora = new Date().toISOString();
  const fecha = hoyISO();

  // Solo se escriben movimientos por lo que efectivamente vuelve. Al que falló
  // no se le anota un 0: ya se le descontó al apostar, y una fila en 0 sería
  // ruido en su historial.
  const movimientos = pagos
    .filter((pago) => pago.devuelto > 0)
    .map((pago) => ({
      alumno_id: pago.alumnoId,
      clave: `apuesta-pago:${torneo.id}`,
      categoria: "competencia" as const,
      puntos: pago.devuelto,
      titulo: `Arena VIP · apuesta en ${torneo.nombre}`,
      detalle: motivoDevolucion
        ? `Se devolvió tu apuesta de ${pago.apostado} pts`
        : `Acertaste: recuperas ${pago.apostado} y ganas ${pago.neto} pts`,
      fecha,
      metadata: {
        torneoId: torneo.id,
        apostado: pago.apostado,
        neto: pago.neto,
        motivoDevolucion,
      },
      updated_at: ahora,
    }));

  if (movimientos.length > 0) {
    const { error } = await admin
      .from("puntos_vip_movimientos")
      .upsert(movimientos, { onConflict: "alumno_id,clave" });
    // Sin pago acreditado no se marcan como resueltas: así el reintento las
    // vuelve a tomar en vez de darlas por pagadas sin haberlo hecho.
    if (error) return { cantidad: 0, bolsaTotal, motivoDevolucion };
  }

  await Promise.all(
    pagos.map((pago) => {
      const fila = filas.find((f) => f.alumno_id === pago.alumnoId);
      if (!fila) return Promise.resolve();
      return admin
        .from("torneo_apuestas")
        .update({ devuelto: pago.devuelto, resuelta_en: ahora })
        .eq("id", fila.id)
        .then(() => undefined);
    })
  );

  return { cantidad: pagos.length, bolsaTotal, motivoDevolucion };
}
