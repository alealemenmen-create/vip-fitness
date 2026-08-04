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
