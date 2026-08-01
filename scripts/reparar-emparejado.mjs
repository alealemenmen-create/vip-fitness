/**
 * Cruza contra la biblioteca los ejercicios de rutinas que quedaron sin
 * emparejar (`rutina_dia_ejercicios.ejercicio_id = null`).
 *
 * Las rutinas publicadas ANTES de que existiera la biblioteca (migración 0026)
 * nunca pasaron por el emparejado, así que sus ejercicios no tienen ilustración
 * ni tempo aunque el movimiento sí esté en la biblioteca. Esto lo arregla hacia
 * atrás, sin tocar las rutinas nuevas (que ya se emparejan solas al publicar).
 *
 * Uso (desde la raíz del proyecto):
 *   node --experimental-strip-types --import ./scripts/alias-loader.mjs scripts/reparar-emparejado.mjs
 *   ... --probar   # muestra qué emparejaría, sin guardar nada
 *
 * Usa el MISMO emparejador que la app al publicar una rutina, así que no puede
 * dar un resultado distinto: si acá empareja mal, es que hay que corregir
 * src/lib/ejercicios/emparejar.ts, no este script.
 */

import { readFileSync } from "node:fs";
import { emparejarEjercicio } from "../src/lib/ejercicios/emparejar.ts";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);

const S = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const cabeceras = { apikey: KEY, Authorization: `Bearer ${KEY}` };

const soloProbar = process.argv.includes("--probar");

async function pedir(ruta) {
  const r = await fetch(`${S}/rest/v1/${ruta}`, { headers: cabeceras });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
  return r.json();
}

const biblioteca = (
  await pedir(
    "ejercicios?select=id,slug,nombre,aliases,grupo_muscular,grupos_secundarios,categoria,equipo,nivel&activo=is.true&limit=1000"
  )
).map((e) => ({
  id: e.id,
  slug: e.slug,
  nombre: e.nombre,
  aliases: e.aliases ?? [],
  grupoMuscular: e.grupo_muscular,
  gruposSecundarios: e.grupos_secundarios ?? [],
  categoria: e.categoria,
  equipo: e.equipo,
  nivel: e.nivel,
  descripcionCorta: null,
  tecnica: null,
  erroresComunes: [],
  consejos: [],
  ilustracionSlug: null,
  videoUrl: null,
}));

const sueltos = await pedir(
  "rutina_dia_ejercicios?select=id,nombre&ejercicio_id=is.null&limit=1000"
);

console.log(`Biblioteca: ${biblioteca.length} ejercicios. Sin emparejar: ${sueltos.length}.`);

let emparejados = 0;
const sinSuerte = [];

for (const fila of sueltos) {
  const resultado = emparejarEjercicio(fila.nombre, biblioteca);
  if (!resultado) {
    sinSuerte.push(fila.nombre);
    continue;
  }
  console.log(`  ${fila.nombre}  ->  ${resultado.ejercicio.nombre}`);
  if (!soloProbar) {
    const r = await fetch(`${S}/rest/v1/rutina_dia_ejercicios?id=eq.${fila.id}`, {
      method: "PATCH",
      headers: { ...cabeceras, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ ejercicio_id: resultado.ejercicio.id }),
    });
    if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
  }
  emparejados++;
}

console.log(
  `\n${emparejados} emparejados${soloProbar ? " (prueba, no se guardó nada)" : ""}. ` +
    `${sinSuerte.length} sin coincidencia en la biblioteca.`
);
if (sinSuerte.length > 0) {
  console.log("Sin coincidencia:");
  for (const nombre of [...new Set(sinSuerte)]) console.log(`  - ${nombre}`);
}
