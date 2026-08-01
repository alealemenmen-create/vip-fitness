import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const TempoSchema = z.object({
  tempos: z.array(
    z.object({
      /** El slug del ejercicio, tal como se envió — sirve para volver a
       * emparejar la respuesta con la fila correcta. */
      slug: z.string(),
      /** Cuatro números separados por guiones:
       * excéntrica-pausa abajo-concéntrica-pausa arriba. */
      tempo: z.string(),
      /** Una línea, en español de Chile, explicándole al ALUMNO por qué ese
       * tempo en ese ejercicio. */
      nota: z.string(),
    })
  ),
});

const PROMPT_BASE = `Sos un preparador físico asignando el tempo de ejecución de cada ejercicio para un gimnasio, con el objetivo de MAXIMIZAR HIPERTROFIA.

El tempo se escribe con cuatro números en segundos, en este orden:
excéntrica (bajar o soltar) - pausa abajo - concéntrica (subir o tirar) - pausa arriba.
Ejemplo: "3-1-1-0" = bajar en 3 segundos, aguantar 1 abajo, subir en 1, sin pausa arriba.

Criterios:
- La fase excéntrica es la que más daña fibra y por lo tanto la que más hipertrofia produce: casi siempre va más lenta que la concéntrica (2 a 4 segundos).
- La concéntrica va rápida pero controlada (1 a 2 segundos). Nunca explosiva en un ejercicio de hipertrofia.
- La pausa abajo (1-2s) sirve donde el estiramiento es la parte valiosa del movimiento y donde el rebote es una tentación real: press de banca, sentadilla, remos, curls. En ejercicios donde parar abajo suelta la tensión o carga la articulación, va 0.
- La pausa arriba (1s) sirve donde el pico de contracción es lo que importa: aperturas, elevaciones laterales, extensiones de cuádriceps, curl de femoral, abducciones, glúteo. En el resto va 0.
- Ejercicios multiarticulares pesados (peso muerto, sentadilla, press militar): excéntrica moderada (2-3s), sin pausas largas — el riesgo de perder la técnica con fatiga es mayor que la ganancia.
- Ejercicios de aislamiento y de máquina o polea: se puede alargar más la excéntrica (3-4s) y agregar pausa de contracción, porque la articulación está protegida y el fallo llega antes.
- Ejercicios explosivos u olímpicos, cardio, pliometría y peso corporal a máxima velocidad: NO llevan tempo lento. Devolvé "1-0-1-0".
- Principiante: nada de tempos exóticos. Máximo una fase alargada, para que aprenda a controlar antes de complicarse.

La nota es UNA sola frase corta dirigida al alumno, explicando qué gana con ese tempo. Nada de jerga innecesaria.

IMPORTANTE — el gimnasio es chileno: escribí las notas en español de Chile, tuteando ("baja", "controla", "aguanta", "no rebotes"). NUNCA uses voseo argentino ("bajá", "controlá", "aguantá", "sentí"), que suena extranjero al alumno.

Ejemplo del tono correcto: "Baja lento y aguanta abajo: es donde el pecho más crece, y así no rebotas la barra en el pecho."

Devolvé exactamente un objeto por cada ejercicio que te pasen, con el mismo slug.`;

export type TempoSugerido = { slug: string; tempo: string; nota: string };
export type EjercicioParaTempo = {
  slug: string;
  nombre: string;
  grupoMuscular: string;
  categoria: string;
  equipo: string;
  nivel: string;
  descripcionCorta?: string | null;
};

export type ResultadoTempos =
  | { ok: true; tempos: TempoSugerido[] }
  | { ok: false; error: string };

/** Cuántos ejercicios van por llamada. En tandas más grandes el modelo empieza
 * a repetir el mismo tempo en cadena en vez de mirar cada movimiento. */
const TAMANO_TANDA = 12;

/** Solo se aceptan cuatro dígitos separados por guiones — cualquier otra cosa
 * se descarta antes de tocar la base. */
const RE_TEMPO_VALIDO = /^\d-\d-\d-\d$/;

/**
 * Decide el tempo ideal de cada ejercicio a partir de lo que la biblioteca ya
 * sabe de él: qué músculo trabaja, qué patrón de movimiento es, con qué equipo
 * se hace y para qué nivel está pensado.
 *
 * Se llama una sola vez por ejercicio en toda la vida de la app: el resultado
 * se guarda en la biblioteca (`ejercicios.tempo`) y lo reutilizan todas las
 * rutinas de todos los alumnos. Por eso puede permitirse pensar — no está en
 * el camino de ninguna pantalla que el alumno esté esperando.
 */
export async function sugerirTempos(
  ejercicios: EjercicioParaTempo[]
): Promise<ResultadoTempos> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, error: "Falta configurar la clave de IA en el servidor." };
  if (ejercicios.length === 0) return { ok: true, tempos: [] };

  const client = new Anthropic({ apiKey });
  const acumulado: TempoSugerido[] = [];

  for (let i = 0; i < ejercicios.length; i += TAMANO_TANDA) {
    const tanda = ejercicios.slice(i, i + TAMANO_TANDA);
    const listado = tanda
      .map(
        (e) =>
          `- slug: ${e.slug} | ${e.nombre} | músculo: ${e.grupoMuscular} | patrón: ${e.categoria} | equipo: ${e.equipo} | nivel: ${e.nivel}${
            e.descripcionCorta ? ` | ${e.descripcionCorta}` : ""
          }`
      )
      .join("\n");

    try {
      const respuesta = await client.messages.parse({
        model: "claude-opus-5",
        max_tokens: 4000,
        output_config: { format: zodOutputFormat(TempoSchema), effort: "medium" },
        messages: [{ role: "user", content: `${PROMPT_BASE}\n\nEjercicios:\n${listado}` }],
      });

      if (respuesta.stop_reason === "refusal" || !respuesta.parsed_output) {
        return { ok: false, error: "La IA no pudo decidir los tempos de esta tanda." };
      }

      const validos = respuesta.parsed_output.tempos.filter(
        (t) => RE_TEMPO_VALIDO.test(t.tempo) && tanda.some((e) => e.slug === t.slug)
      );
      acumulado.push(...validos);
    } catch (error) {
      const detalle = error instanceof Error ? error.message : "error desconocido";
      return { ok: false, error: `No se pudo consultar a la IA: ${detalle}` };
    }
  }

  return { ok: true, tempos: acumulado };
}
