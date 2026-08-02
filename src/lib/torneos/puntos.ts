/** Reparto oficial de la bolsa de premios aportada por VIP Fitness. */

export type ParticipanteTorneo = {
  alumnoId: string;
  nombre: string;
  /** Valor medido: sesiones, Puntos VIP, kg, repeticiones o tiempo. */
  valor: number;
  /** Evita premiar a quien acepto pero no produjo un resultado verificable. */
  valido: boolean;
};

export type ResultadoTorneo = Omit<ParticipanteTorneo, "valido"> & {
  valido?: boolean;
  puesto: number;
  /** Se conserva este nombre por compatibilidad; Arena VIP nunca genera valores negativos. */
  puntosDelta: number;
};

function porcentajesPremio(cantidad: number): number[] {
  if (cantidad <= 0) return [];
  if (cantidad === 1) return [1];
  if (cantidad === 2) return [0.8, 0.2];
  return Array.from({ length: cantidad }, (_, indice) => [0.5, 0.3, 0.2][indice] ?? 0);
}

export function descripcionRepartoPremio(cantidad: number): string {
  if (cantidad === 2) return "VIP Fitness aporta la bolsa: 80% al ganador y 20% al rival si registra un resultado valido.";
  return "VIP Fitness aporta la bolsa: 50% al 1.er lugar, 30% al 2.do y 20% al 3.ro. Sin resultado valido no hay premio.";
}

/**
 * Ordena resultados y distribuye una bolsa fija. Los empates comparten la suma
 * de los premios de los puestos empatados. Nadie pierde puntos ya ganados.
 */
export function calcularResultadoTorneo(
  participantes: ParticipanteTorneo[],
  puntosEnJuego: number,
  menorEsMejor: boolean
): ResultadoTorneo[] {
  const porcentajes = porcentajesPremio(participantes.length);
  const validos = participantes
    .filter((participante) => participante.valido)
    .sort((a, b) => {
      const diferencia = menorEsMejor ? a.valor - b.valor : b.valor - a.valor;
      return diferencia || a.nombre.localeCompare(b.nombre, "es");
    });
  const resultados: ResultadoTorneo[] = [];

  let indice = 0;
  while (indice < validos.length) {
    let finGrupo = indice + 1;
    while (finGrupo < validos.length && validos[finGrupo].valor === validos[indice].valor) {
      finGrupo += 1;
    }
    const porcentajeGrupo = porcentajes
      .slice(indice, finGrupo)
      .reduce((total, porcentaje) => total + porcentaje, 0);
    const premioIndividual = Math.round((puntosEnJuego * porcentajeGrupo) / (finGrupo - indice));
    for (let posicion = indice; posicion < finGrupo; posicion += 1) {
      resultados.push({
        ...validos[posicion],
        puesto: indice + 1,
        puntosDelta: premioIndividual,
      });
    }
    indice = finGrupo;
  }

  const invalidos = participantes
    .filter((participante) => !participante.valido)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  for (const participante of invalidos) {
    resultados.push({
      ...participante,
      puesto: validos.length + 1,
      puntosDelta: 0,
    });
  }
  return resultados;
}
