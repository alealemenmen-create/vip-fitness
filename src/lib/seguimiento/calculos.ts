import type { NivelCumplimiento } from "./tipos";

export function limitarPct(valor: number): number {
  return Math.max(0, Math.min(100, Math.round(valor)));
}

export function promedio(valores: Array<number | null | undefined>): number | null {
  const validos = valores.filter((valor): valor is number => valor !== null && valor !== undefined && Number.isFinite(valor));
  if (validos.length === 0) return null;
  return Math.round((validos.reduce((total, valor) => total + valor, 0) / validos.length) * 10) / 10;
}

export function precisionObjetivo(real: number, objetivo: number | null): number | null {
  if (!objetivo || objetivo <= 0) return null;
  return limitarPct(100 * (1 - Math.abs(real / objetivo - 1)));
}

export function cumplimientoMinimo(real: number, objetivo: number | null): number | null {
  if (!objetivo || objetivo <= 0) return null;
  return limitarPct((real / objetivo) * 100);
}

export function nivelDeCumplimiento(pct: number | null): NivelCumplimiento {
  if (pct === null) return "sin_datos";
  if (pct >= 90) return "excelente";
  if (pct >= 80) return "muy_bien";
  if (pct >= 65) return "en_proceso";
  return "atencion";
}

export function adherenciaPonderada(
  areas: Array<{ valor: number | null; peso: number }>
): number | null {
  const disponibles = areas.filter((area) => area.valor !== null && area.peso > 0);
  const pesoTotal = disponibles.reduce((total, area) => total + area.peso, 0);
  if (pesoTotal <= 0) return null;
  return limitarPct(disponibles.reduce((total, area) => total + area.valor! * area.peso, 0) / pesoTotal);
}
