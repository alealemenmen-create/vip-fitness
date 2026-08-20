export const ESCALAS_VISUALES_V2 = ["compacta", "normal", "grande", "maxima"] as const;

export type EscalaVisualV2 = (typeof ESCALAS_VISUALES_V2)[number];

export const CLAVE_ESCALA_VISUAL_V2 = "vip-v2-escala-visual";

export const ETIQUETAS_ESCALA_VISUAL_V2: Record<EscalaVisualV2, string> = {
  compacta: "90%",
  normal: "100%",
  grande: "110%",
  maxima: "120%",
};

export function escalaVisualV2Valida(valor: string | null): valor is EscalaVisualV2 {
  return ESCALAS_VISUALES_V2.some((escala) => escala === valor);
}
