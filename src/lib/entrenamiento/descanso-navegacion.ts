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
