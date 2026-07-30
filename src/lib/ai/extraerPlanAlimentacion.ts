import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const AlimentoPdfSchema = z.object({
  nombre: z.string(),
  /** Cantidad numérica tal como aparece en el PDF (150, 1, 0.5…). */
  cantidad: z.number().nullable(),
  /** Unidad tal como aparece: "g", "ml", "unidad", "taza", "cucharada"… */
  unidad: z.string().nullable(),
});

const ComidaExtraidaSchema = z.object({
  orden: z.number(),
  nombre: z.string(),
  /** "HH:MM" en 24 horas, o null si el PDF no indica horario. */
  hora: z.string().nullable(),
  descripcion: z.string().nullable(),
  alimentos: z.array(AlimentoPdfSchema),
  /** Calorías escritas en el PDF para esta comida, si las trae. */
  kcalDeclarada: z.number().nullable(),
});

const PlanAlimentacionSchema = z.object({
  /** Totales escritos en el PDF, si los trae. Sirven para contrastar contra
   * lo que calcula la app con la tabla de alimentos del gimnasio. */
  kcalDeclarada: z.number().nullable(),
  protDeclarada: z.number().nullable(),
  carbDeclarada: z.number().nullable(),
  grasaDeclarada: z.number().nullable(),
  comidas: z.array(ComidaExtraidaSchema),
  notaLectura: z.string().nullable(),
});

export type PlanAlimentacionExtraido = z.infer<typeof PlanAlimentacionSchema>;
export type AlimentoPdf = z.infer<typeof AlimentoPdfSchema>;

const PROMPT = `Este PDF es una pauta de alimentación escrita por un nutricionista o entrenador personal.

Tu trabajo es LEER el documento, no calcular nada. Las calorías las calcula después el sistema del gimnasio con su propia tabla de alimentos, así que lo que importa es que identifiques bien cada alimento y su cantidad.

Extrae:
- comidas: una entrada por cada comida del día (desayuno, colación, almuerzo, once, cena, etc.), en el orden en que se comen.
- hora: formato "HH:MM" en 24 horas (ej. "08:00", "13:30"). Si el PDF da un rango, usa la hora de inicio. Si no indica horario, null.
- alimentos: dentro de cada comida, un elemento por cada alimento, con su cantidad y unidad.
  - nombre: el nombre del alimento SOLO, sin la cantidad y sin la preparación. "150 g de pechuga de pollo a la plancha" → nombre "Pechuga de pollo", cantidad 150, unidad "g".
  - Usa el nombre genérico y en singular, tal como figuraría en una tabla nutricional ("Arroz blanco cocido", "Palta", "Huevo").
  - Si el PDF ofrece alternativas ("pollo o pescado"), toma solo la primera.
  - Si no se indica cantidad, deja cantidad y unidad en null — no la inventes.
- kcalDeclarada (por comida y total) y protDeclarada / carbDeclarada / grasaDeclarada: SOLO si esos números están escritos en el PDF. Si no aparecen, null. Nunca los calcules tú.
- descripcion: resumen muy corto de la comida (máximo 12 palabras).
- notaLectura: una frase corta si hay algo que el entrenador deba saber al revisar (ej. "Varios alimentos no indican cantidad", "El PDF está escaneado y algunas cantidades son dudosas"). Si todo estaba claro, null.

Nunca inventes comidas, alimentos, horarios ni cantidades que no estén en el documento.`;

export type ExtraccionPlanResultado =
  | { ok: true; datos: PlanAlimentacionExtraido }
  | { ok: false; error: string };

/**
 * Una sola llamada a la IA por PDF, y solo cuando el entrenador la pide
 * expresamente (no al subir el archivo). La IA solo transcribe alimentos y
 * cantidades; los valores nutricionales salen de la tabla `alimentos` del
 * gimnasio (ver `src/lib/alimentos/emparejar.ts`), que es la misma con la que
 * el alumno registra lo que come — si no, la meta y el consumo se medirían con
 * varas distintas.
 */
export async function extraerPlanAlimentacionDesdePdf(
  pdfBase64: string
): Promise<ExtraccionPlanResultado> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "Falta configurar la clave de IA en el servidor." };
  }

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.parse({
      model: "claude-sonnet-5",
      max_tokens: 4096,
      thinking: { type: "disabled" },
      output_config: { format: zodOutputFormat(PlanAlimentacionSchema) },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: pdfBase64 },
            },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return { ok: false, error: "No fue posible analizar este PDF." };
    }

    if (!response.parsed_output) {
      return {
        ok: false,
        error:
          "No se pudo leer el PDF automáticamente. Prueba con un PDF con texto seleccionable (no una foto escaneada), o carga la meta a mano.",
      };
    }

    const datos = response.parsed_output;

    if (datos.comidas.length === 0 && datos.kcalDeclarada === null) {
      return { ok: false, error: "El PDF no arrojó comidas ni calorías reconocibles." };
    }

    return { ok: true, datos };
  } catch (err) {
    console.error("extraerPlanAlimentacionDesdePdf error:", err);
    return {
      ok: false,
      error: "No fue posible analizar el PDF en este momento. Intenta nuevamente en unos minutos.",
    };
  }
}
