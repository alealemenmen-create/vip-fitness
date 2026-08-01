/**
 * Rellena de una vez el tempo de TODA la biblioteca de ejercicios.
 *
 * El flujo normal (src/lib/ejercicios/rellenarTempos.ts) calcula el tempo de
 * los ejercicios nuevos al publicar una rutina. Este script es para la carga
 * inicial: los ~100 ejercicios que ya estaban en la biblioteca antes de que
 * existiera la columna, que si no habría que esperar a que aparezcan en una
 * rutina nueva para que se les calcule.
 *
 * Uso (desde la raíz del proyecto):
 *   node scripts/rellenar-tempos.mjs           # solo los que no tienen tempo
 *   node scripts/rellenar-tempos.mjs --probar  # una tanda y muestra, sin guardar
 *
 * Es idempotente: nunca pisa un tempo que ya exista, ni el de la IA ni el que
 * haya corregido el entrenador a mano.
 */

import { readFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";

const RAIZ = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

const env = Object.fromEntries(
  readFileSync(`${RAIZ}/.env.local`, "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || env.ANTHROPIC_API_KEY;

// El mismo criterio que usa la app en caliente. Si se cambia acá, cambiarlo
// también en src/lib/ai/tempoEjercicio.ts — media biblioteca con un criterio y
// media con otro se nota al tiro.
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

const ESQUEMA = {
  type: "object",
  properties: {
    tempos: {
      type: "array",
      items: {
        type: "object",
        properties: {
          slug: { type: "string" },
          tempo: { type: "string" },
          nota: { type: "string" },
        },
        required: ["slug", "tempo", "nota"],
        additionalProperties: false,
      },
    },
  },
  required: ["tempos"],
  additionalProperties: false,
};

const TAMANO_TANDA = 12;
const RE_TEMPO_VALIDO = /^\d-\d-\d-\d$/;

const cabeceras = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };

async function leerSinTempo() {
  const campos = "id,slug,nombre,grupo_muscular,categoria,equipo,nivel,descripcion_corta";
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/ejercicios?select=${campos}&tempo=is.null&order=grupo_muscular,nombre`,
    { headers: cabeceras }
  );
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
  return r.json();
}

async function guardar(id, tempo, nota) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/ejercicios?id=eq.${id}&tempo=is.null`, {
    method: "PATCH",
    headers: { ...cabeceras, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ tempo, tempo_nota: nota, tempo_origen: "ia" }),
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
}

async function main() {
  const soloProbar = process.argv.includes("--probar");

  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env.local");
    process.exit(1);
  }
  if (!ANTHROPIC_KEY) {
    console.error("Falta ANTHROPIC_API_KEY.");
    process.exit(1);
  }

  const pendientes = await leerSinTempo();
  if (pendientes.length === 0) {
    console.log("Todos los ejercicios ya tienen tempo. Nada que hacer.");
    return;
  }

  const lista = soloProbar ? pendientes.slice(0, TAMANO_TANDA) : pendientes;
  console.log(
    `${pendientes.length} ejercicios sin tempo. Procesando ${lista.length} en tandas de ${TAMANO_TANDA}.` +
      (soloProbar ? " (prueba: no se guarda nada)" : "")
  );

  const client = new Anthropic({ apiKey: ANTHROPIC_KEY });
  let guardados = 0;

  for (let i = 0; i < lista.length; i += TAMANO_TANDA) {
    const tanda = lista.slice(i, i + TAMANO_TANDA);
    const detalle = tanda
      .map(
        (e) =>
          `- slug: ${e.slug} | ${e.nombre} | músculo: ${e.grupo_muscular} | patrón: ${e.categoria} | equipo: ${e.equipo} | nivel: ${e.nivel}${
            e.descripcion_corta ? ` | ${e.descripcion_corta}` : ""
          }`
      )
      .join("\n");

    process.stdout.write(`  tanda ${Math.floor(i / TAMANO_TANDA) + 1} (${tanda.length}) ... `);

    // La primera vez que se usa un esquema, la API lo compila; con la cuenta
    // fría eso a veces se pasa del tiempo permitido y devuelve 400 "Grammar
    // compilation timed out". Es transitorio: al reintentar ya está compilado
    // y responde al toque.
    let respuesta;
    for (let intento = 1; ; intento++) {
      try {
        respuesta = await client.messages.create({
          model: "claude-opus-5",
          max_tokens: 4000,
          output_config: {
            effort: "medium",
            format: { type: "json_schema", schema: ESQUEMA },
          },
          messages: [{ role: "user", content: `${PROMPT_BASE}\n\nEjercicios:\n${detalle}` }],
        });
        break;
      } catch (error) {
        if (intento >= 4) throw error;
        process.stdout.write(`reintento ${intento} ... `);
        await new Promise((r) => setTimeout(r, 3000 * intento));
      }
    }

    if (respuesta.stop_reason === "refusal") {
      console.log("la IA rechazó la tanda, se salta");
      continue;
    }

    const bloque = respuesta.content.find((b) => b.type === "text");
    const { tempos } = JSON.parse(bloque.text);
    const porSlug = new Map(tanda.map((e) => [e.slug, e]));

    for (const t of tempos) {
      const ejercicio = porSlug.get(t.slug);
      if (!ejercicio || !RE_TEMPO_VALIDO.test(t.tempo)) continue;
      if (soloProbar) {
        console.log(`\n    ${ejercicio.nombre}: ${t.tempo} — ${t.nota}`);
        continue;
      }
      await guardar(ejercicio.id, t.tempo, t.nota);
      guardados++;
    }
    if (!soloProbar) console.log("listo");
  }

  console.log(soloProbar ? "\nPrueba terminada, no se guardó nada." : `\nGuardados ${guardados} tempos.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
