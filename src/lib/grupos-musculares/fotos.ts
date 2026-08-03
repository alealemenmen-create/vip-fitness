import type { GrupoMuscular } from "@/app/alumno/entrenar/data";

/**
 * Fotos reales de referencia por grupo muscular, para reemplazar el dibujo
 * anatómico en Entrenar. Piernas tiene dos (cuádriceps de frente + glúteo/
 * femoral/pantorrilla de espalda) — el resto tiene una sola. Cardio no tiene
 * foto todavía: sigue mostrando el dibujo de siempre.
 */
export const FOTOS_GRUPO_MUSCULAR: Partial<Record<GrupoMuscular, string[]>> = {
  pecho: ["/grupos-musculares/pecho-naranja.webp"],
  espalda: ["/grupos-musculares/espalda-naranja.webp"],
  piernas: ["/grupos-musculares/piernas-frente-naranja.webp", "/grupos-musculares/piernas-espalda-naranja.webp"],
  hombros: ["/grupos-musculares/hombros-naranja.webp"],
  brazos: ["/grupos-musculares/brazos-naranja.webp"],
  core: ["/grupos-musculares/core-naranja.webp"],
};
