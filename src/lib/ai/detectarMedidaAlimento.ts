import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const MedidaSchema = z.object({
  /** Cantidad de referencia, coherente con la unidad (100 si es "g" o "ml",
   * 1 si es "unidad" o "porción", etc.). */
  porcionBase: z.number(),
  /** Unidad en la que se pesa o mide este alimento tal como se compra o
   * prepara — no siempre gramos: "g", "ml", "unidad", "rebanada", "taza",
   * "cucharada", "paquete"… */
  unidad: z.string(),
});

const PROMPT_BASE = `Sos un nutricionista clasificando alimentos para el catálogo de un gimnasio en Chile. Te doy el nombre de un alimento y tenés que decidir en qué unidad se mide o se pesa NORMALMENTE, pensando en cómo lo registraría una persona común:

- Líquidos que se sirven en volumen (leche, jugo, aceite, bebidas): "ml" o "litro", con porcionBase 100 o 1 según corresponda.
- Sólidos que se pesan (harina, arroz crudo, carne, queso): "g", porcionBase 100.
- Cosas que se cuentan una por una (huevo, plátano, pan, yogurt individual): "unidad", porcionBase 1.
- Alimentos envasados que se compran por paquete (galletas, snacks): "paquete" o "porción", porcionBase 1.
- Si el alimento tiene una medida casera típica más natural que el gramo (cucharada de aceite, taza de arroz cocido, vaso de leche), preferí esa.

Respondé SOLO con la unidad más natural y la porción de referencia coherente con ella. No expliques nada más.`;

export type MedidaDetectada = { porcionBase: number; unidad: string };
export type ResultadoDeteccion = { ok: true; datos: MedidaDetectada } | { ok: false; error: string };

/**
 * Sugiere unidad de medida + porción de referencia para un alimento nuevo,
 * a partir de su nombre — el entrenador ya no tiene que adivinar si algo se
 * mide en gramos, mililitros o unidades. Una sola llamada corta por
 * alimento, disparada solo cuando el entrenador aprieta "Detectar con IA"
 * (nunca automática), mismo criterio de costo que extraerPlanAlimentacion.
 */
export async function detectarMedidaAlimento(
  nombre: string,
  categoria?: string | null
): Promise<ResultadoDeteccion> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, error: "Falta configurar la clave de IA en el servidor." };
  if (!nombre.trim()) return { ok: false, error: "Escribe el nombre del alimento primero." };

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.parse({
      model: "claude-sonnet-5",
      max_tokens: 256,
      thinking: { type: "disabled" },
      output_config: { format: zodOutputFormat(MedidaSchema) },
      messages: [
        {
          role: "user",
          content: `${PROMPT_BASE}\n\nAlimento: "${nombre}"${categoria ? ` (categoría: ${categoria})` : ""}`,
        },
      ],
    });

    if (!response.parsed_output) {
      return { ok: false, error: "No fue posible sugerir la unidad. Cárgala a mano." };
    }

    return { ok: true, datos: response.parsed_output };
  } catch (err) {
    console.error("detectarMedidaAlimento error:", err);
    return { ok: false, error: "No fue posible conectar con la IA. Intenta nuevamente." };
  }
}
