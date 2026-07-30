/**
 * Reparto de puntos de un torneo: zero-sum, el primero gana los puntos en
 * juego y el último los pierde. Con 2 participantes es exactamente "el que
 * gana le quita los puntos al que pierde"; con más, se reparte linealmente
 * entre medio (la suma de todos los deltas siempre da 0).
 */

export type ParticipanteTorneo = {
  alumnoId: string;
  nombre: string;
  /** Lo que midió el torneo: kg de diferencia, sesiones, o el número que
   * cargó el entrenador para métrica manual. */
  valor: number;
};

export type ResultadoTorneo = ParticipanteTorneo & {
  puesto: number;
  puntosDelta: number;
};

export function calcularResultadoTorneo(
  participantes: ParticipanteTorneo[],
  puntosEnJuego: number,
  menorEsMejor: boolean
): ResultadoTorneo[] {
  const n = participantes.length;
  const ordenados = [...participantes].sort((a, b) =>
    menorEsMejor ? a.valor - b.valor : b.valor - a.valor
  );

  return ordenados.map((p, i) => {
    const puesto = i + 1;
    const puntosDelta = n <= 1 ? 0 : Math.round((puntosEnJuego * (n + 1 - 2 * puesto)) / (n - 1));
    return { ...p, puesto, puntosDelta };
  });
}
