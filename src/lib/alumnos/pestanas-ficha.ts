/**
 * Los ids de pestaña de la ficha del alumno, compartidos entre
 * `FichaAlumnoTabs.tsx` (cliente) y las páginas que validan `?tab=` en el
 * servidor (Control VIP V2, Fase 2). Van en un módulo aparte, sin
 * "use client": un Server Component que importa un valor exportado por un
 * archivo cliente recibe una referencia opaca, no el array real — `.includes`
 * revienta con "is not a function". Separado acá, ambos lados importan el
 * mismo dato de verdad.
 */
export type IdPestanaFicha =
  | "resumen"
  | "plan"
  | "actividad"
  | "nutricion"
  | "comunicacion"
  | "documentos"
  | "cuenta";

export const IDS_PESTANA_FICHA: IdPestanaFicha[] = [
  "resumen",
  "plan",
  "actividad",
  "nutricion",
  "comunicacion",
  "documentos",
  "cuenta",
];
