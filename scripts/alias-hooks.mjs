/**
 * El hook de resolución en sí (ver alias-loader.mjs, que lo registra).
 * Traduce el alias "@/..." de tsconfig a una ruta real y le pone la extensión
 * que TypeScript omite pero Node exige.
 */
const RAIZ = new URL("../src/", import.meta.url).href;

export async function resolve(especificador, contexto, siguiente) {
  if (!especificador.startsWith("@/")) return siguiente(especificador, contexto);

  const base = new URL(especificador.slice(2), RAIZ).href;
  for (const candidato of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, base]) {
    try {
      return await siguiente(candidato, contexto);
    } catch {
      // Se prueba el siguiente candidato.
    }
  }
  return siguiente(especificador, contexto);
}
