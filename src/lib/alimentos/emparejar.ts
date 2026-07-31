import type { AlimentoCatalogo } from "@/app/alumno/comer/tipos";
import type { AlimentoPdf, PlanAlimentacionExtraido } from "@/lib/ai/extraerPlanAlimentacion";

/** Minúsculas, sin tildes, sin puntuación y sin plurales simples — para poder
 * comparar "Pechuga de Pollo" con "pollo pechugas". */
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const PALABRAS_VACIAS = new Set([
  "de", "del", "la", "el", "los", "las", "con", "sin", "a", "al", "en", "y", "o",
  "cocido", "cocida", "crudo", "cruda", "fresco", "fresca", "natural",
]);

function tokens(texto: string): string[] {
  return normalizar(texto)
    .split(" ")
    .map((t) => (t.length > 3 && t.endsWith("s") ? t.slice(0, -1) : t))
    .filter((t) => t.length > 1 && !PALABRAS_VACIAS.has(t));
}

export type Confianza = "exacta" | "alta" | "media";

export type Emparejamiento = {
  alimento: AlimentoCatalogo;
  confianza: Confianza;
} | null;

/**
 * Busca en el catálogo del gimnasio el alimento que menciona el PDF. No usa IA:
 * compara el nombre normalizado, primero exacto, después por inclusión, y por
 * último por palabras en común. Lo que no llega al umbral se devuelve como null
 * para que el entrenador lo elija a mano — es preferible eso a emparejar mal y
 * darle al alumno una meta calculada con el alimento equivocado.
 */
export function emparejarAlimento(
  nombrePdf: string,
  catalogo: AlimentoCatalogo[]
): Emparejamiento {
  const objetivo = normalizar(nombrePdf);
  if (!objetivo) return null;

  const exacto = catalogo.find((a) => normalizar(a.nombre) === objetivo);
  if (exacto) return { alimento: exacto, confianza: "exacta" };

  const contenido = catalogo.find((a) => {
    const n = normalizar(a.nombre);
    return n.includes(objetivo) || objetivo.includes(n);
  });
  if (contenido) return { alimento: contenido, confianza: "alta" };

  const tokensObjetivo = tokens(nombrePdf);
  if (tokensObjetivo.length === 0) return null;

  let mejor: { alimento: AlimentoCatalogo; puntaje: number } | null = null;
  for (const a of catalogo) {
    const tokensAlimento = tokens(a.nombre);
    if (tokensAlimento.length === 0) continue;
    const comunes = tokensObjetivo.filter((t) => tokensAlimento.includes(t)).length;
    if (comunes === 0) continue;
    // Proporción de palabras compartidas sobre el nombre más corto de los dos.
    const puntaje = comunes / Math.min(tokensObjetivo.length, tokensAlimento.length);
    if (!mejor || puntaje > mejor.puntaje) mejor = { alimento: a, puntaje };
  }

  if (mejor && mejor.puntaje >= 0.5) return { alimento: mejor.alimento, confianza: "media" };
  return null;
}

export type AporteNutricional = { kcal: number; prot: number; carb: number; grasa: number };

const CERO: AporteNutricional = { kcal: 0, prot: 0, carb: 0, grasa: 0 };

/** Regla de tres sobre la porción base del alimento — la misma cuenta que hace
 * el registro diario del alumno (`obtenerResumenAlimentacionHoy`). */
export function calcularAporte(
  alimento: AlimentoCatalogo,
  cantidad: number | null
): AporteNutricional {
  if (cantidad === null || !Number.isFinite(cantidad) || alimento.porcionBase <= 0) return CERO;
  const factor = cantidad / alimento.porcionBase;
  return {
    kcal: alimento.kcal * factor,
    prot: alimento.prot * factor,
    carb: alimento.carb * factor,
    grasa: alimento.grasa * factor,
  };
}

export type AlimentoResuelto = {
  nombrePdf: string;
  cantidad: number | null;
  unidadPdf: string | null;
  alimentoId: string | null;
  nombreCatalogo: string | null;
  unidadCatalogo: string | null;
  confianza: Confianza | null;
  /** La unidad del PDF no coincide con la del catálogo (ej. "taza" vs "g"). */
  unidadDudosa: boolean;
  aporte: AporteNutricional;
};

export type ComidaResuelta = {
  orden: number;
  nombre: string;
  hora: string | null;
  descripcion: string | null;
  kcalDeclarada: number | null;
  alimentos: AlimentoResuelto[];
  aporte: AporteNutricional;
};

export type PlanResuelto = {
  comidas: ComidaResuelta[];
  total: AporteNutricional;
  /** Alimentos del PDF que no están en la tabla del gimnasio. */
  sinEmparejar: number;
  /** Alimentos emparejados pero sin cantidad en el PDF. */
  sinCantidad: number;
};

function mismaUnidad(unidadPdf: string | null, unidadCatalogo: string): boolean {
  if (!unidadPdf) return true; // sin dato, no se puede afirmar que esté mal
  const a = normalizar(unidadPdf);
  const b = normalizar(unidadCatalogo);
  if (a === b) return true;
  const gramos = new Set(["g", "gr", "gramo", "gramos"]);
  const mililitros = new Set(["ml", "mililitro", "mililitros", "cc"]);
  const unidades = new Set(["unidad", "unidades", "u", "un", "pieza", "piezas"]);
  return (
    (gramos.has(a) && gramos.has(b)) ||
    (mililitros.has(a) && mililitros.has(b)) ||
    (unidades.has(a) && unidades.has(b))
  );
}

export function resolverAlimento(
  item: AlimentoPdf,
  catalogo: AlimentoCatalogo[],
  alimentoIdForzado?: string | null
): AlimentoResuelto {
  const alimento = alimentoIdForzado
    ? (catalogo.find((a) => a.id === alimentoIdForzado) ?? null)
    : null;
  const match = alimento
    ? { alimento, confianza: "exacta" as Confianza }
    : emparejarAlimento(item.nombre, catalogo);

  if (!match) {
    return {
      nombrePdf: item.nombre,
      cantidad: item.cantidad,
      unidadPdf: item.unidad,
      alimentoId: null,
      nombreCatalogo: null,
      unidadCatalogo: null,
      confianza: null,
      unidadDudosa: false,
      aporte: CERO,
    };
  }

  return {
    nombrePdf: item.nombre,
    cantidad: item.cantidad,
    unidadPdf: item.unidad,
    alimentoId: match.alimento.id,
    nombreCatalogo: match.alimento.nombre,
    unidadCatalogo: match.alimento.unidad,
    confianza: match.confianza,
    unidadDudosa: !mismaUnidad(item.unidad, match.alimento.unidad),
    aporte: calcularAporte(match.alimento, item.cantidad),
  };
}

function sumar(aportes: AporteNutricional[]): AporteNutricional {
  return aportes.reduce(
    (acc, a) => ({
      kcal: acc.kcal + a.kcal,
      prot: acc.prot + a.prot,
      carb: acc.carb + a.carb,
      grasa: acc.grasa + a.grasa,
    }),
    { ...CERO }
  );
}

/** Cruza lo que la IA leyó del PDF con la tabla de alimentos del gimnasio y
 * arma la meta calculada. `correcciones` mapea "índice de comida:índice de
 * alimento" → id de alimento elegido a mano por el entrenador. */
export function resolverPlan(
  datos: PlanAlimentacionExtraido,
  catalogo: AlimentoCatalogo[],
  correcciones: Record<string, string> = {}
): PlanResuelto {
  const comidas: ComidaResuelta[] = datos.comidas.map((c, i) => {
    const alimentos = c.alimentos.map((a, j) =>
      resolverAlimento(a, catalogo, correcciones[`${i}:${j}`] ?? null)
    );
    return {
      orden: c.orden || i + 1,
      nombre: c.nombre,
      hora: c.hora,
      descripcion: c.descripcion,
      kcalDeclarada: c.kcalDeclarada,
      alimentos,
      aporte: sumar(alimentos.map((a) => a.aporte)),
    };
  });

  const todos = comidas.flatMap((c) => c.alimentos);

  return {
    comidas,
    total: sumar(comidas.map((c) => c.aporte)),
    sinEmparejar: todos.filter((a) => a.alimentoId === null).length,
    sinCantidad: todos.filter((a) => a.alimentoId !== null && a.cantidad === null).length,
  };
}
