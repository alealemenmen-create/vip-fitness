import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const GRUPOS_MUSCULARES = [
  "pecho",
  "espalda",
  "piernas",
  "hombros",
  "brazos",
  "core",
  "cardio",
] as const;

export type GrupoMuscular = (typeof GRUPOS_MUSCULARES)[number];

const EjercicioExtraidoSchema = z.object({
  orden: z.number(),
  nombre: z.string(),
  series: z.number(),
  reps: z.string(),
  descansoSegundos: z.number().nullable(),
  tecnicaTipo: z.string().nullable(),
  tecnicaInstruccion: z.string().nullable(),
  observacion: z.string().nullable(),
  grupoMuscular: z.enum(GRUPOS_MUSCULARES).nullable(),
});

const DiaExtraidoSchema = z.object({
  numero: z.number(),
  nombre: z.string(),
  tipo: z.enum(["entrenamiento", "descanso"]),
  descripcion: z.string().nullable(),
  ejercicios: z.array(EjercicioExtraidoSchema),
});

const RutinaExtraidaSchema = z.object({
  nombreRutina: z.string(),
  dias: z.array(DiaExtraidoSchema),
});

export type RutinaExtraida = z.infer<typeof RutinaExtraidaSchema>;

const PROMPT = `Este PDF contiene una rutina de entrenamiento de gimnasio escrita por un entrenador personal.

Extrae la rutina completa: cada día, y dentro de cada día cada ejercicio con sus series, repeticiones, descanso, técnica especial (si existe, por ejemplo biserie, triserie, drop set, rest-pause, tempo) y observaciones del entrenador.

Reglas:
- Si un ejercicio no indica series, usa 3.
- Si no indica repeticiones, usa "10-12".
- Si no hay descanso indicado, usa null.
- Si no hay técnica especial, usa null en tecnicaTipo y tecnicaInstruccion.
- No inventes ejercicios que no aparezcan en el documento.
- Respeta el orden y agrupación de días tal como aparece en el PDF.
- Clasifica cada ejercicio en grupoMuscular según el grupo principal que trabaja, usando
  exactamente uno de: "pecho", "espalda", "piernas", "hombros", "brazos", "core", "cardio".
  Si de verdad no se puede determinar, usa null.

Días de descanso o actividad libre (ej. "descanso activo", "salir a caminar/trotar", "movilidad", "día libre"):
- Márcalos con tipo "descanso" y deja ejercicios como un arreglo vacío — NO inventes un
  ejercicio falso con series/repeticiones para representar la actividad.
- Usa descripcion para anotar en texto libre lo que sugiere el entrenador para ese día
  (ej. "Caminata ligera de 30 a 45 minutos o movilidad articular"). Si no hay ninguna
  sugerencia, descripcion puede ser null.
- Los días normales de entrenamiento con ejercicios reales llevan tipo "entrenamiento" y
  descripcion en null.

Biseries, triseries y giant sets (varios ejercicios que se hacen seguidos, sin descanso entre ellos):
- Crea una fila de ejercicio SEPARADA por cada ejercicio del grupo, cada una con su propio
  nombre y sus propias series/repeticiones — nunca combines dos ejercicios en un solo
  nombre (ej. "Press banca + Aperturas" está mal; deben ser dos filas distintas).
- Numera tecnicaTipo para que quede claro el orden y el tamaño del grupo, por ejemplo
  "Biserie (1/2)" y "Biserie (2/2)", o "Triserie (1/3)", "Triserie (2/3)", "Triserie (3/3)".
- En tecnicaInstruccion de cada fila, nombra con qué otro(s) ejercicio(s) va combinado
  (ej. "Sin descanso, seguido de Aperturas con mancuerna").`;

export type ExtraccionResultado =
  | { ok: true; datos: RutinaExtraida }
  | { ok: false; error: string };

export async function extraerRutinaDesdePdf(
  pdfBase64: string,
  /** Un .txt se manda como documento de texto plano; mandarlo como PDF hace
   * que la API lo rechace. */
  mediaType: "application/pdf" | "text/plain" = "application/pdf"
): Promise<ExtraccionResultado> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "Falta configurar la clave de IA en el servidor." };
  }

  const client = new Anthropic({ apiKey });

  try {
    // Un .txt NO puede ir como base64: la API solo acepta ese formato para
    // PDF. El texto plano va con source.type 'text' y el contenido ya decodificado.
    const documento =
      mediaType === 'text/plain'
        ? ({
            type: 'document' as const,
            source: {
              type: 'text' as const,
              media_type: 'text/plain' as const,
              data: Buffer.from(pdfBase64, 'base64').toString('utf8'),
            },
          })
        : ({
            type: 'document' as const,
            source: {
              type: 'base64' as const,
              media_type: 'application/pdf' as const,
              data: pdfBase64,
            },
          });

    const response = await client.messages.parse({
      model: "claude-sonnet-5",
      max_tokens: 8192,
      thinking: { type: "disabled" },
      output_config: { format: zodOutputFormat(RutinaExtraidaSchema) },
      messages: [
        {
          role: "user",
          content: [
            documento,
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
        error: "No se pudo leer el PDF automáticamente. Prueba con un PDF con texto seleccionable (no una foto escaneada), o carga la rutina manualmente.",
      };
    }

    if (response.parsed_output.dias.length === 0) {
      return { ok: false, error: "El PDF no arrojó ejercicios reconocibles." };
    }

    return { ok: true, datos: response.parsed_output };
  } catch (err) {
    console.error("extraerRutinaDesdePdf error:", err);
    return {
      ok: false,
      error: "No fue posible analizar el PDF en este momento. Intenta nuevamente en unos minutos.",
    };
  }
}
