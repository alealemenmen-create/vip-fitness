import type { PerfilEntrenamiento } from "./tipos";

const NIVEL = { principiante: 0, intermedio: 1, avanzado: 2 } as const;
const CARDIO = { bajo: 0, medio: 1, alto: 2 } as const;

function menorNivel<T extends string>(valores: Array<T | null>, orden: Record<T, number>): T | null {
  const presentes = valores.filter((v): v is T => v !== null);
  return presentes.length ? presentes.sort((a, b) => orden[a] - orden[b])[0] : null;
}

function valorComun<T>(valores: Array<T | null>, fallback: T | null = null): T | null {
  const presentes = valores.filter((v): v is T => v !== null);
  return presentes.length > 0 && presentes.every((v) => v === presentes[0]) ? presentes[0] : fallback;
}

function juntarTexto(perfiles: PerfilEntrenamiento[], campo: keyof PerfilEntrenamiento): string | null {
  const textos = perfiles.map((p) => p[campo]).filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  return textos.length ? [...new Set(textos)].join(" | ") : null;
}

/** Construye el perfil conservador de una rutina compartida. No promedia la
 * seguridad: usa el nivel menos experimentado, la mayor edad y la unión de
 * antecedentes/restricciones. Así una sola rutina sigue siendo práctica para
 * el entrenador sin ignorar a los demás integrantes del grupo. */
export function combinarPerfilesGrupo(perfiles: PerfilEntrenamiento[]): PerfilEntrenamiento {
  if (perfiles.length === 0) throw new Error("No hay perfiles para generar la rutina grupal.");
  if (perfiles.length === 1) return perfiles[0];
  const primero = perfiles[0];
  const edades = perfiles.map((p) => p.edad).filter((e): e is number => e !== null);

  return {
    ...primero,
    alumnoId: perfiles.map((p) => p.alumnoId).join(","),
    sexo: valorComun(perfiles.map((p) => p.sexo)),
    edad: edades.length ? Math.max(...edades) : null,
    ejerciciosRecientes: [...new Set(perfiles.flatMap((p) => p.ejerciciosRecientes))],
    objetivoPrincipal: valorComun(perfiles.map((p) => p.objetivoPrincipal)),
    objetivoSecundario: juntarTexto(perfiles, "objetivoSecundario"),
    diasDisponibles: Math.min(...perfiles.map((p) => p.diasDisponibles ?? 7)),
    minutosSesion: Math.min(...perfiles.map((p) => p.minutosSesion ?? 999)),
    experiencia: menorNivel(perfiles.map((p) => p.experiencia), NIVEL),
    cardioNivel: menorNivel(perfiles.map((p) => p.cardioNivel), CARDIO),
    preferenciaEquipo: valorComun(perfiles.map((p) => p.preferenciaEquipo), "indistinto"),
    // Una categoría distinta por integrante no se resuelve tomando la del
    // primero. La UI obliga al entrenador a definir el enfoque compartido.
    categoriaCompetencia: valorComun(perfiles.map((p) => p.categoriaCompetencia), "ninguna"),
    molestias: juntarTexto(perfiles, "molestias"),
    lesionesDiagnosticadas: juntarTexto(perfiles, "lesionesDiagnosticadas"),
    condicionesMedicas: juntarTexto(perfiles, "condicionesMedicas"),
    medicamentosRelevantes: juntarTexto(perfiles, "medicamentosRelevantes"),
    operacionesPrevias: juntarTexto(perfiles, "operacionesPrevias"),
    actividadesAdicionales: juntarTexto(perfiles, "actividadesAdicionales"),
    ejerciciosPreferidos: juntarTexto(perfiles, "ejerciciosPreferidos"),
    ejerciciosNoDeseados: juntarTexto(perfiles, "ejerciciosNoDeseados"),
    requiereRevision: perfiles.some((p) => p.requiereRevision),
  };
}
