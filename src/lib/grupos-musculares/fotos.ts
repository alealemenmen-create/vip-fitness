import type { GrupoMuscular } from "@/app/alumno/entrenar/data";

/**
 * Fotos reales de referencia por grupo muscular, para reemplazar el dibujo
 * anatómico en Entrenar. Piernas tiene dos (cuádriceps de frente + glúteo/
 * femoral/pantorrilla de espalda) — el resto tiene una sola. Cardio no tiene
 * foto todavía: sigue mostrando el dibujo de siempre.
 */
export const FOTOS_GRUPO_MUSCULAR: Partial<Record<GrupoMuscular, string[]>> = {
  pecho: ["/grupos-musculares/pecho.webp"],
  espalda: ["/grupos-musculares/espalda.webp"],
  piernas: ["/grupos-musculares/piernas-frente.webp", "/grupos-musculares/piernas-espalda.webp"],
  hombros: ["/grupos-musculares/hombros.webp"],
  brazos: ["/grupos-musculares/brazos.webp"],
  core: ["/grupos-musculares/core.webp"],
};
