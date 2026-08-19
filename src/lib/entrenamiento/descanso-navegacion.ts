export function claveDescansoSesion(ejercicioId: string, serieIndice: number) {
  return `${ejercicioId}-${serieIndice}`;
}

export function destinoAlAvanzarSerieCompletada(input: {
  temporizadorAutomatico: boolean;
  requiereDescanso: boolean;
  descansoYaResuelto: boolean;
}): "descanso" | "siguiente" {
  if (!input.temporizadorAutomatico || !input.requiereDescanso || input.descansoYaResuelto) {
    return "siguiente";
  }
  return "descanso";
}

/**
 * Calcula el descanso contra una hora de término real, no contra la cantidad
 * de ticks que alcanzó a ejecutar la pestaña. En iOS/Android el navegador
 * puede suspender los intervalos al bloquear la pantalla; al volver, este
 * cálculo recupera inmediatamente el tiempo correcto.
 */
export function segundosRestantesDescanso(finEn: number, ahora: number = Date.now()) {
  if (!Number.isFinite(finEn) || !Number.isFinite(ahora)) return 0;
  return Math.max(0, Math.ceil((finEn - ahora) / 1_000));
}

export function ajustarFinDescanso(input: {
  finEn: number;
  cambioSegundos: number;
  ahora?: number;
  maximoSegundos?: number;
}) {
  const ahora = input.ahora ?? Date.now();
  const maximo = Math.max(0, input.maximoSegundos ?? 15 * 60);
  const segundos = Math.min(
    maximo,
    Math.max(0, segundosRestantesDescanso(input.finEn, ahora) + input.cambioSegundos),
  );
  return { segundos, finEn: ahora + segundos * 1_000 };
}
