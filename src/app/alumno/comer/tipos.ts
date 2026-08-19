/**
 * Tipos y helpers puros de Alimentación.
 *
 * Vive aparte de `data.ts` porque ese lleva `server-only`: los componentes
 * cliente (la pantalla, la tira de días, el panel de agregar) necesitan estos
 * tipos y funciones, e importarlos desde `data.ts` rompe el build con un error
 * poco claro ("Ecmascript file had an error"). Mismo patrón que
 * `src/lib/documentos/tipos.ts` y `src/lib/ejercicios/tipos.ts`.
 *
 * Acá NO va nada que toque Supabase.
 */

export const COMIDAS_SLOTS = [
  "Comida 1",
  "Comida 2",
  "Comida 3",
  "Comida 4",
  "Comida 5",
  "Comida 6",
  "Comida adicional",
] as const;

/**
 * Desde el rediseño de Comer, una comida se identifica por la HORA a la que se
 * comió: `comidas_registradas.tipo_comida` guarda "HH:00". Esa columna ya era
 * texto libre, así que no hizo falta migrar el esquema ni tocar las políticas
 * RLS.
 *
 * Lo registrado ANTES del rediseño sigue guardado con nombres de slot
 * ("Comida 1"), y esas filas se siguen leyendo: se les asigna una hora de
 * referencia para poder ubicarlas en la línea de tiempo. No se reescribe ni se
 * pierde nada.
 */
const HORA_LEGADO: Record<string, number> = {
  "Comida 1": 8,
  "Comida 2": 11,
  "Comida 3": 13,
  "Comida 4": 16,
  "Comida 5": 19,
  "Comida 6": 21,
  "Comida adicional": 22,
};

/** "08:00" → 8. null si el texto no es una hora. */
function horaDeEtiqueta(tipoComida: string): number | null {
  const m = /^(\d{1,2}):\d{2}$/.exec(tipoComida.trim());
  if (!m) return null;
  const h = Number(m[1]);
  return h >= 0 && h <= 23 ? h : null;
}

/** En qué fila de la línea de tiempo cae una comida ya guardada. */
export function horaDeComida(tipoComida: string): number {
  return horaDeEtiqueta(tipoComida) ?? HORA_LEGADO[tipoComida] ?? 12;
}

/** La etiqueta que se guarda al crear una comida nueva en una hora. */
export function etiquetaDeHora(hora: number): string {
  return `${String(hora).padStart(2, "0")}:00`;
}

export type EstadoDia = "vacio" | "parcial" | "completo";

export type ComidaPlan = {
  nombre: string;
  hora: string | null;
  kcal: number | null;
  descripcion: string | null;
};

export type PlanAlimentacion = {
  kcalObjetivo: number | null;
  protObjetivo: number | null;
  carbObjetivo: number | null;
  grasaObjetivo: number | null;
  comidas: ComidaPlan[];
} | null;

export type DocumentoDieta = { nombreArchivo: string; url: string } | null;

export type AlimentoCatalogo = {
  id: string;
  nombre: string;
  /** Marca comercial cuando corresponde (Soprole, Colun, etc.). */
  marca: string | null;
  categoria: string | null;
  porcionBase: number;
  unidad: string;
  kcal: number;
  prot: number;
  carb: number;
  grasa: number;
  /** Medida práctica del alimento ("cucharada", "unidad", "vaso (200 ml)"),
   * null si se mide directamente en su unidad base. */
  medidaNombre: string | null;
  /** Cuántas unidades base equivale 1 medida casera (1 cucharada = 14 g). */
  medidaGramos: number | null;
  /** Solo lo traen los alimentos importados de Open Food Facts: el catálogo
   * curado y los personalizados no lo piden. */
  fibra: number | null;
  azucares: number | null;
  sodio: number | null;
};

/** Pocos resultados a la vista: en el celular entran sin scroll interno y se
 * eligen de un toque. */
export const LIMITE_BUSQUEDA_ALIMENTOS = 7;

export type AlimentoEnComida = {
  id: string;
  alimentoId: string;
  nombre: string;
  cantidad: number;
  unidad: string;
  kcal: number;
  prot: number;
  carb: number;
  grasa: number;
};

export type Totales = { kcal: number; prot: number; carb: number; grasa: number };

export type ComidaDia = {
  tipoComida: string;
  comidaId: string | null;
  omitida: boolean;
  observacion: string | null;
  alimentos: AlimentoEnComida[];
  totales: Totales;
};

/** Una franja de la línea de tiempo. Puede tener varias comidas: el alumno
 * puede registrar dos veces en la misma hora. */
export type HoraDia = {
  hora: number;
  comidas: ComidaDia[];
  totales: Totales;
};

export type RegistroDia = {
  /** Siempre 24, de 0 a 23, aunque estén vacías. */
  horas: HoraDia[];
  totalesDia: Totales;
};

export type ResumenDiaComidas = {
  fecha: string;
  estado: EstadoDia;
  kcal: number;
};

/** 24 franjas vacías, de 0 a 23. */
export function horasVacias(): HoraDia[] {
  return Array.from({ length: 24 }, (_, hora) => ({
    hora,
    comidas: [],
    totales: { kcal: 0, prot: 0, carb: 0, grasa: 0 },
  }));
}

export function sumarTotales(items: { totales: Totales }[]): Totales {
  return items.reduce(
    (acc, i) => ({
      kcal: acc.kcal + i.totales.kcal,
      prot: acc.prot + i.totales.prot,
      carb: acc.carb + i.totales.carb,
      grasa: acc.grasa + i.totales.grasa,
    }),
    { kcal: 0, prot: 0, carb: 0, grasa: 0 }
  );
}

export function sumarAlimentos(alimentos: AlimentoEnComida[]): Totales {
  return alimentos.reduce(
    (acc, a) => ({
      kcal: acc.kcal + a.kcal,
      prot: acc.prot + a.prot,
      carb: acc.carb + a.carb,
      grasa: acc.grasa + a.grasa,
    }),
    { kcal: 0, prot: 0, carb: 0, grasa: 0 }
  );
}

/** El puntito del día en la tira. Se calcula sobre los datos ya cargados, sin
 * volver a consultar. */
export function estadoDelDia(horas: HoraDia[] | undefined): EstadoDia {
  if (!horas) return "vacio";
  const comidas = horas.reduce(
    (n, h) => n + h.comidas.filter((c) => c.omitida || c.alimentos.length > 0).length,
    0
  );
  return comidas === 0 ? "vacio" : comidas < 3 ? "parcial" : "completo";
}
