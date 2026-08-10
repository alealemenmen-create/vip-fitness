/** La maquinaria real de VIP Fitness, tal como la enumeró el entrenador.
 *
 * Existe por una razón concreta: la biblioteca de ejercicios dice QUÉ se puede
 * hacer, pero no CON QUÉ cuenta la sala. Sin esto, el filtro de IA veía una
 * lista de nombres y podía razonar sobre equipo imaginario ("faltaría una
 * máquina de gemelos") sin saber si existe o no. Con el inventario delante,
 * sus observaciones se apoyan en lo que hay.
 *
 * Cuando el gimnasio compre o dé de baja una máquina, se actualiza acá y se
 * ajusta la biblioteca — son las dos caras de lo mismo. */

export const INVENTARIO_GIMNASIO = {
  multiestacion: [
    "Crossover",
    "Dos poleas ajustables",
    "Pull down (polea alta para jalones)",
    "Polea alta para extensiones de tríceps",
    "Remo con polea baja",
  ],
  maquinas: [
    "Jaula de sentadilla libre (también para press de pecho plano e inclinado y hombros)",
    "Smith",
    "Belt squat",
    "Super squat (se usa para hack squat)",
    "Femoral tumbado",
    "Prensa de piernas 45°",
    "Máquina abductora y aductora (dual)",
    "Extensiones de cuádriceps",
    "Multihip",
    "Press de pecho sentado, doble agarre (prono y hammer)",
    "Press de hombro sentado, doble agarre (prono y hammer)",
    "Remo con pecho apoyado",
    "Hip thrust",
    "Banco romano para hiperextensiones",
    "Banco de abdominales",
    "Barras de dominadas de múltiples agarres",
    "Paralelas para fondos",
    "Bicicleta de spinning",
  ],
  pesoLibre: [
    "Barras rectas y Z/curvas de 10, 15, 20, 25 y 35 kg",
    "Mancuernas de 2,5 · 5 · 6 · 7 · 8 · 9 · 10 · 11 · 12 · 16 · 18 · 20 · 22 · 25 kg, y una de 50 kg",
    "Mancuernas rusas (kettlebells)",
    "Bancos planos",
    "Dos bancos inclinados",
  ],
  accesorios: ["Cable de TRX (el ejercicio se llama TRX profundo)", "Colchonetas", "Cajones para step ups"],
} as const;

/** Lo que NO hay, dicho explícitamente. Un modelo que solo ve una lista de lo
 * que existe tiende a asumir que lo común está disponible; nombrar las
 * ausencias frecuentes corta eso de raíz. */
export const NO_HAY_EN_EL_GIMNASIO = [
  "caminadora / trotadora / cinta de correr",
  "elíptica",
  "escaladora",
  "remo ergómetro",
  "pec deck (ni normal ni invertido)",
  "máquina de press inclinado",
  "máquina de remo en T",
  "máquinas de gemelos (de pie o sentado)",
  "femoral sentado o de pie (solo hay femoral tumbado)",
  "máquina de crunch abdominal",
];

/** El inventario en texto, para meterlo en el prompt de la revisión de IA. */
export function describirInventario(): string {
  const bloque = (titulo: string, items: readonly string[]) => `${titulo}:\n${items.map((i) => `  - ${i}`).join("\n")}`;
  return [
    bloque("Multiestación (una sola máquina con varias estaciones)", INVENTARIO_GIMNASIO.multiestacion),
    bloque("Máquinas", INVENTARIO_GIMNASIO.maquinas),
    bloque("Peso libre", INVENTARIO_GIMNASIO.pesoLibre),
    bloque("Accesorios", INVENTARIO_GIMNASIO.accesorios),
    `NO existe en la sala: ${NO_HAY_EN_EL_GIMNASIO.join(", ")}.`,
  ].join("\n\n");
}
