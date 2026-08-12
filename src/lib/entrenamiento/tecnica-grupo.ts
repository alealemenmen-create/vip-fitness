/**
 * Técnicas que encadenan varios ejercicios seguidos, casi sin descanso entre
 * uno y otro (superserie, biserie, triserie, circuito, giant set...): el
 * entrenador ya las escribe en `tecnica_tipo` como texto libre ("Superserie
 * (1/2)", "Biserie (2/2)", "Circuito metabólico (1/3)"), y los dos o más
 * ejercicios que forman el grupo comparten el mismo nombre de familia.
 *
 * Se usa en dos lugares: SesionEjercicioCard (color por familia, para que el
 * alumno VEA qué ejercicios van encadenados) y SesionEjercicios (para
 * alternar de verdad entre ellos serie por serie — ver `calcularActivo`).
 */
export type GrupoTecnica = { color: string; etiqueta: string };

export function resolverGrupoTecnica(tecnicaTipo: string | null | undefined): GrupoTecnica | null {
  if (!tecnicaTipo) return null;
  const t = tecnicaTipo.toLowerCase();
  if (t.includes("superserie")) return { color: "var(--color-tecnica-superserie)", etiqueta: "Superserie" };
  if (t.includes("biserie") || t.includes("biset"))
    return { color: "var(--color-tecnica-biserie)", etiqueta: "Biserie" };
  if (t.includes("triserie")) return { color: "var(--color-tecnica-triserie)", etiqueta: "Triserie" };
  if (t.includes("giant set")) return { color: "var(--color-tecnica-giant)", etiqueta: "Giant Set" };
  if (t.includes("circuito") || t.includes("tabata"))
    return { color: "var(--color-tecnica-circuito)", etiqueta: "Circuito" };
  return null;
}

/** Lee la numeración "(n/total)" que el entrenador escribe en `tecnica_tipo`
 * (ej. "Biserie (1/2)", "Biserie (2/2)") para saber cuántos ejercicios
 * forman ESTE grupo puntual. Sin esto, dos biseries seguidas (4 ejercicios
 * consecutivos, todos con etiqueta "Biserie") se confundían con un solo
 * grupo de 4 en vez de dos grupos de 2 — ver `calcularActivo` en
 * `SesionEjercicios.tsx`. */
export function posicionTecnica(tecnicaTipo: string | null | undefined): { actual: number; total: number } | null {
  if (!tecnicaTipo) return null;
  const m = tecnicaTipo.match(/\((\d+)\s*\/\s*(\d+)\)/);
  if (!m) return null;
  return { actual: Number(m[1]), total: Number(m[2]) };
}

/**
 * Cuántos ejercicios forma cada familia cuando NO viene el "(n/total)" —
 * el campo `tecnica_tipo` es texto libre en varios caminos (el cuadro de
 * texto suelto del editor, lo que extrae la IA de un PDF, una rutina vieja
 * escrita a mano) y ninguno de esos garantiza el sufijo con número. Sin este
 * respaldo, dos biseries seguidas sin numerar se fundían en un solo grupo de
 * 4 en vez de dos de 2 — "en muchas biserias no sale la cantidad correcta de
 * ejercicio", reportado por Alejandro.
 *
 * Solo cubre las familias con un tamaño que el propio nombre ya fija (bi=2,
 * tri=3, super=2). "Giant Set" y "Circuito" quedan sin tope a propósito: su
 * cantidad de ejercicios varía de verdad de una rutina a otra, así que
 * inventar un default ahí sería tan arbitrario como el bug que se arregla acá.
 */
const TAMANO_POR_DEFECTO: Partial<Record<GrupoTecnica["etiqueta"], number>> = {
  Superserie: 2,
  Biserie: 2,
  Triserie: 3,
};

/** Cuántos ejercicios debería tener el grupo de este `tecnicaTipo`: el número
 * explícito si vino, si no el default de su familia (ver arriba), si no
 * `null` (sin tope, como hoy). */
export function tamanoGrupoTecnica(tecnicaTipo: string | null | undefined): number | null {
  const explicito = posicionTecnica(tecnicaTipo)?.total;
  if (explicito) return explicito;
  const familia = resolverGrupoTecnica(tecnicaTipo)?.etiqueta;
  return familia ? (TAMANO_POR_DEFECTO[familia] ?? null) : null;
}
