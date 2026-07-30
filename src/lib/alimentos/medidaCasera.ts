/**
 * Deduce la medida práctica de un alimento a partir de su nombre. Los datos
 * nutricionales vienen todos por 100 g, pero nadie pesa el aceite: lo mide en
 * cucharadas, la leche en vasos y los huevos en unidades. Cada regla lleva la
 * equivalencia real en gramos, así el cálculo sigue siendo exacto.
 */

export type MedidaCasera = { nombre: string; gramos: number };

type Regla = { claves: string[]; medida: MedidaCasera };

// Se evalúan en orden: la primera que coincide gana, así que las reglas más
// específicas van antes que las genéricas.
const REGLAS: Regla[] = [
  // Grasas y líquidos que se sirven a cucharadas
  { claves: ["aceite"], medida: { nombre: "cucharada", gramos: 14 } },
  { claves: ["vinagre"], medida: { nombre: "cucharada", gramos: 15 } },
  { claves: ["mantequilla", "margarina", "manteca"], medida: { nombre: "cucharada", gramos: 14 } },
  // "salsa" va antes que las frutas/verduras: si no, "salsa de tomate"
  // terminaba midiéndose en unidades de tomate.
  { claves: ["mayonesa", "ketchup", "mostaza", "salsa", "aderezo"], medida: { nombre: "cucharada", gramos: 15 } },
  { claves: ["miel", "mermelada", "jarabe", "sirope"], medida: { nombre: "cucharada", gramos: 21 } },
  { claves: ["azucar", "azúcar"], medida: { nombre: "cucharadita", gramos: 4 } },
  { claves: ["crema de mani", "crema de maní", "mantequilla de mani"], medida: { nombre: "cucharada", gramos: 16 } },

  // Bebidas. Las específicas van antes que "agua": media receta del dataset
  // dice "preparado con agua" y se llevaba puestos los cafés y las infusiones.
  { claves: ["cafe", "café", "te", "té", "infusion", "infusión"], medida: { nombre: "taza (240 ml)", gramos: 240 } },
  { claves: ["leche", "bebida vegetal", "bebida de almendra", "bebida de soja"], medida: { nombre: "vaso (200 ml)", gramos: 200 } },
  { claves: ["jugo", "zumo", "néctar", "nectar"], medida: { nombre: "vaso (200 ml)", gramos: 200 } },
  { claves: ["cerveza", "vino", "bebida gaseosa", "refresco", "gaseosa"], medida: { nombre: "vaso (200 ml)", gramos: 200 } },
  { claves: ["agua mineral", "agua embotellada"], medida: { nombre: "vaso (200 ml)", gramos: 200 } },
  { claves: ["caldo", "consome", "consomé", "sopa"], medida: { nombre: "plato (250 ml)", gramos: 250 } },
  { claves: ["yogur bebible", "yoghurt bebible"], medida: { nombre: "vaso (200 ml)", gramos: 200 } },
  { claves: ["yogur", "yoghurt"], medida: { nombre: "pote (125 g)", gramos: 125 } },

  // Unidades enteras
  { claves: ["huevo"], medida: { nombre: "unidad", gramos: 50 } },
  { claves: ["platano", "plátano", "banana"], medida: { nombre: "unidad", gramos: 118 } },
  { claves: ["manzana"], medida: { nombre: "unidad", gramos: 182 } },
  { claves: ["naranja"], medida: { nombre: "unidad", gramos: 154 } },
  { claves: ["pera"], medida: { nombre: "unidad", gramos: 178 } },
  { claves: ["kiwi"], medida: { nombre: "unidad", gramos: 76 } },
  { claves: ["palta", "aguacate"], medida: { nombre: "unidad", gramos: 150 } },
  { claves: ["tomate"], medida: { nombre: "unidad", gramos: 123 } },
  { claves: ["zanahoria"], medida: { nombre: "unidad", gramos: 61 } },
  { claves: ["papa", "patata"], medida: { nombre: "unidad", gramos: 173 } },
  { claves: ["cebolla"], medida: { nombre: "unidad", gramos: 110 } },
  { claves: ["limon", "limón", "lima"], medida: { nombre: "unidad", gramos: 58 } },
  { claves: ["durazno", "melocoton", "melocotón"], medida: { nombre: "unidad", gramos: 150 } },
  { claves: ["marraqueta", "hallulla", "bollo"], medida: { nombre: "unidad", gramos: 100 } },
  { claves: ["pan de molde", "pan molde", "rebanada"], medida: { nombre: "rebanada", gramos: 28 } },
  { claves: ["tortilla", "wrap"], medida: { nombre: "unidad", gramos: 45 } },
  { claves: ["galleta"], medida: { nombre: "unidad", gramos: 10 } },
  { claves: ["barra de cereal", "barrita"], medida: { nombre: "unidad", gramos: 40 } },

  // Porciones de plato
  { claves: ["arroz", "fideo", "pasta", "espagueti", "tallarin", "tallarín", "quinoa", "couscous"], medida: { nombre: "taza cocida", gramos: 158 } },
  { claves: ["lenteja", "poroto", "garbanzo", "frijol", "judia", "judía"], medida: { nombre: "taza cocida", gramos: 180 } },
  { claves: ["avena"], medida: { nombre: "taza cocida", gramos: 234 } },
  { claves: ["cereal"], medida: { nombre: "taza", gramos: 30 } },
  { claves: ["almendra", "nuez", "nueces", "mani", "maní", "pistacho", "castana", "castaña", "semilla"], medida: { nombre: "puñado", gramos: 30 } },
  { claves: ["queso"], medida: { nombre: "lámina", gramos: 20 } },
  { claves: ["jamon", "jamón", "pavo en lonja", "lonja"], medida: { nombre: "lámina", gramos: 20 } },

  // Proteínas: se sirven en presas/filetes, no en gramos exactos
  { claves: ["pollo", "pavo", "vacuno", "carne", "cerdo", "pescado", "salmon", "salmón", "merluza", "atun", "atún", "reineta"], medida: { nombre: "porción (150 g)", gramos: 150 } },
];

function normalizar(texto: string): string {
  return texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * La clave debe aparecer como palabra completa, no como fragmento: buscar
 * "te" con `includes` matcheaba dentro de "tomate", "chocolate" y "aceite".
 * Se admite la "s" del plural ("papa" encuentra "papas").
 */
const cache = new Map<string, RegExp>();
function coincide(nombreNormalizado: string, clave: string): boolean {
  const claveNorm = normalizar(clave).trim();
  let re = cache.get(claveNorm);
  if (!re) {
    re = new RegExp(`(^|[^a-z0-9])${escapar(claveNorm)}s?([^a-z0-9]|$)`);
    cache.set(claveNorm, re);
  }
  return re.test(nombreNormalizado);
}

/**
 * Respaldo por categoría del catálogo. Cuando el nombre no dispara ninguna
 * regla (que es lo habitual con nombres largos y traducidos a medias), la
 * categoría alcanza para saber cómo se sirve: una grasa va en cucharadas y un
 * corte de vacuno en porciones, se llame como se llame.
 */
const POR_CATEGORIA: Record<string, MedidaCasera> = {
  "grasas y aceites": { nombre: "cucharada", gramos: 14 },
  bebidas: { nombre: "vaso (200 ml)", gramos: 200 },
  "especias y hierbas": { nombre: "pizca", gramos: 1 },
  vacuno: { nombre: "porción (150 g)", gramos: 150 },
  aves: { nombre: "porción (150 g)", gramos: 150 },
  cerdo: { nombre: "porción (150 g)", gramos: 150 },
  "cordero, ternera y caza": { nombre: "porción (150 g)", gramos: 150 },
  "pescados y mariscos": { nombre: "porción (150 g)", gramos: 150 },
  "frutos secos y semillas": { nombre: "puñado", gramos: 30 },
  "sopas y salsas": { nombre: "plato (250 ml)", gramos: 250 },
  "embutidos y fiambres": { nombre: "lámina", gramos: 20 },
  "cereales de desayuno": { nombre: "taza", gramos: 30 },
  "cereales, arroz y pastas": { nombre: "taza cocida", gramos: 158 },
  legumbres: { nombre: "taza cocida", gramos: 180 },
  "colaciones y snacks": { nombre: "puñado", gramos: 30 },
};

/**
 * Devuelve la medida casera del alimento, o null si se mide en gramos y ya.
 *
 * Del nombre solo se mira el primer tramo (lo que va antes de la primera coma),
 * porque el dataset nombra "alimento, preparación, detalle": en "Fideos, huevo,
 * cocido" el alimento es el fideo, no el huevo. Buscar en el nombre completo
 * hacía que un helado "sin azúcar añadida" se midiera en cucharaditas.
 *
 * Si el nombre no alcanza, decide la categoría.
 */
export function deducirMedidaCasera(
  nombre: string,
  categoria?: string | null
): MedidaCasera | null {
  const principal = normalizar(nombre.split(",")[0]);
  for (const regla of REGLAS) {
    if (regla.claves.some((c) => coincide(principal, c))) return regla.medida;
  }

  if (categoria) {
    const porCategoria = POR_CATEGORIA[normalizar(categoria).trim()];
    if (porCategoria) return porCategoria;
  }

  return null;
}
