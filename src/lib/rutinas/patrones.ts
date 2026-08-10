/**
 * Vocabulario biomecánico mínimo del Método VIP.
 *
 * La biblioteca todavía no tiene `patron_movimiento` cargado. Hasta que ese
 * dato exista, clasificamos por nombre para que el motor pueda distinguir un
 * press de una apertura, un remo de un jalón y una base de pierna de un
 * aislamiento. Esta capa es deliberadamente determinista: la IA no decide la
 * estructura fundamental de la rutina.
 */
export type PatronMovimiento =
  | "pecho_press_horizontal"
  | "pecho_press_inclinado"
  | "pecho_aislamiento"
  | "espalda_traccion_vertical"
  | "espalda_remo_horizontal"
  | "espalda_pullover"
  | "espalda_bisagra"
  | "espalda_trapecio"
  | "hombro_press_vertical"
  | "hombro_lateral"
  | "hombro_posterior"
  | "hombro_anterior"
  | "biceps_supinado"
  | "biceps_neutro"
  | "biceps_hombro_flexionado"
  | "triceps_polea_abajo"
  | "triceps_sobre_cabeza"
  | "triceps_compuesto"
  | "pierna_dominante_rodilla"
  | "pierna_bisagra_cadera"
  | "pierna_empuje_cadera"
  | "pierna_flexion_rodilla"
  | "pierna_extension_rodilla"
  | "pierna_abduccion"
  | "pierna_aduccion"
  | "pierna_pantorrilla"
  | "core"
  | "cardio"
  | "otro";

/** Mismos valores que `PatronMovimiento`, en tiempo de ejecución — para
 * validar en el servidor lo que llega desde el select del admin antes de
 * guardarlo (ver `actualizarPatronMovimiento` en admin/ejercicios/actions.ts). */
export const PATRONES_MOVIMIENTO_VALIDOS: PatronMovimiento[] = [
  "pecho_press_horizontal",
  "pecho_press_inclinado",
  "pecho_aislamiento",
  "espalda_traccion_vertical",
  "espalda_remo_horizontal",
  "espalda_pullover",
  "espalda_bisagra",
  "espalda_trapecio",
  "hombro_press_vertical",
  "hombro_lateral",
  "hombro_posterior",
  "hombro_anterior",
  "biceps_supinado",
  "biceps_neutro",
  "biceps_hombro_flexionado",
  "triceps_polea_abajo",
  "triceps_sobre_cabeza",
  "triceps_compuesto",
  "pierna_dominante_rodilla",
  "pierna_bisagra_cadera",
  "pierna_empuje_cadera",
  "pierna_flexion_rodilla",
  "pierna_extension_rodilla",
  "pierna_abduccion",
  "pierna_aduccion",
  "pierna_pantorrilla",
  "core",
  "cardio",
  "otro",
];

export function normalizarMovimiento(texto: string | null | undefined): string {
  return (texto ?? "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

export function patronMovimiento(nombre: string, grupoMuscular: string | null | undefined): PatronMovimiento {
  const n = normalizarMovimiento(nombre);
  const grupo = normalizarMovimiento(grupoMuscular);

  if (grupo === "pecho") {
    if (/apertura|cruce|crossover|fly|pec.?deck|cristo/.test(n)) return "pecho_aislamiento";
    if (/inclinado|incline|clavicular/.test(n) && /press|fondos|flexion/.test(n)) return "pecho_press_inclinado";
    if (/press|bench|fondos|dip|flexion|push.?up/.test(n)) return "pecho_press_horizontal";
  }

  if (grupo === "espalda") {
    if (/remo/.test(n) && !/ergometro/.test(n)) return "espalda_remo_horizontal";
    if (/jalon|dominada|pull.?up|pulldown|pull down/.test(n)) return "espalda_traccion_vertical";
    if (/pullover|brazo recto|brazos rectos/.test(n)) return "espalda_pullover";
    if (/peso muerto|buenos dias|hiperextension|banco romano|extension lumbar/.test(n)) return "espalda_bisagra";
    if (/encogimiento|shrug|trapecio/.test(n)) return "espalda_trapecio";
  }

  if (grupo === "hombros" || grupo === "hombro") {
    if (/press|militar|shoulder/.test(n)) return "hombro_press_vertical";
    if (/lateral/.test(n)) return "hombro_lateral";
    if (/pajaro|posterior|reverse|face pull/.test(n)) return "hombro_posterior";
    if (/frontal/.test(n)) return "hombro_anterior";
  }

  if (grupo === "brazos" || grupo === "brazo" || /biceps|triceps|curl/.test(n)) {
    if (/triceps|extension|press frances|press cerrado|fondos|patada|pushdown/.test(n)) {
      if (/sobre.*cabeza|por encima|tras nuca|overhead|copa|frances/.test(n)) return "triceps_sobre_cabeza";
      if (/fondos|press cerrado/.test(n)) return "triceps_compuesto";
      return "triceps_polea_abajo";
    }
    if (/martillo|hammer/.test(n)) return "biceps_neutro";
    if (/polea alta|predicador|scott|inclinado/.test(n)) return "biceps_hombro_flexionado";
    if (/curl|biceps/.test(n)) return "biceps_supinado";
  }

  if (grupo === "piernas" || grupo === "pierna") {
    if (/gemelo|pantorrilla|talones/.test(n)) return "pierna_pantorrilla";
    if (/abdu/.test(n)) return "pierna_abduccion";
    if (/adu/.test(n)) return "pierna_aduccion";
    if (/curl.*femoral|femoral.*curl|femoral tumbado|femoral sentado/.test(n)) return "pierna_flexion_rodilla";
    if (/extension.*cuadriceps|cuadriceps.*extension/.test(n)) return "pierna_extension_rodilla";
    if (/hip thrust|puente|patada.*glute|frog pump|extension.*cadera|multi.?hip/.test(n)) return "pierna_empuje_cadera";
    if (/peso muerto|rumano|buenos dias|kettlebell swing|hiperextension|banco romano|pull.?through/.test(n)) return "pierna_bisagra_cadera";
    if (/sentadilla|squat|prensa|zancada|estocada|bulgara|hack|step.?up|subida.*cajon|belt/.test(n)) return "pierna_dominante_rodilla";
  }

  if (grupo === "core") return "core";
  if (grupo === "cardio") return "cardio";
  return "otro";
}

export function esPressPecho(patron: PatronMovimiento): boolean {
  return patron === "pecho_press_horizontal" || patron === "pecho_press_inclinado";
}

export function esBaseEstructural(patron: PatronMovimiento): boolean {
  return [
    "pecho_press_horizontal",
    "pecho_press_inclinado",
    "espalda_traccion_vertical",
    "espalda_remo_horizontal",
    "hombro_press_vertical",
    "triceps_compuesto",
    "pierna_dominante_rodilla",
    "pierna_bisagra_cadera",
    "pierna_empuje_cadera",
  ].includes(patron);
}

/** Orden de trabajo: base mecánica, complemento y finalmente aislamiento. */
export function prioridadEstructural(patron: PatronMovimiento): number {
  if (esBaseEstructural(patron)) return 0;
  if (["espalda_pullover", "hombro_lateral", "hombro_posterior", "biceps_supinado", "biceps_neutro", "biceps_hombro_flexionado", "triceps_polea_abajo", "triceps_sobre_cabeza", "pierna_flexion_rodilla"].includes(patron)) return 1;
  if (["pecho_aislamiento", "hombro_anterior", "pierna_extension_rodilla", "pierna_abduccion", "pierna_aduccion", "pierna_pantorrilla", "espalda_trapecio"].includes(patron)) return 2;
  if (patron === "espalda_bisagra") return 3;
  return 2;
}
