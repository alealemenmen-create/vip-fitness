/** Tipos compartidos del motor de progresión de Impulso VIP.
 *
 * Solo 4 objetivos existen hoy en `alumno_perfil.objetivo` (ver
 * `objetivoAImpulso` en motor.ts), pero el tipo interno ya incluye 'fuerza',
 * 'resistencia' y 'rendimiento' para no tener que tocar el motor cuando se
 * amplíen las opciones del `<Select>` del entrenador.
 */
export type ObjetivoProgresion =
  | "masa"
  | "fuerza"
  | "perdida_grasa"
  | "resistencia"
  | "rendimiento"
  | "salud_general";

export type Dificultad = "muy_facil" | "facil" | "justo" | "dificil" | "fallo";

export type TipoProgresion = "doble" | "solo_peso" | "solo_reps" | "manual";

export type ReglaImpulso = "A_subir_reps" | "B_subir_peso" | "C_mantener" | "D_reducir" | "E_consultar";

export type Cumplimiento = "cumplida" | "superada" | "parcial" | "no_cumplida";

/** Tipo de alerta que puede disparar la Regla E — código estructurado, no se
 * deriva parseando `justificacion` en ningún lado. */
export type AlertaTipo = "dolor" | "estancamiento_3_sesiones" | "caida_rendimiento";

/** Motivos que puede reportar el motor para auditar una decisión (persistidos
 * en `decision_data.motivos`). Unión literal a propósito: si se agrega un
 * motivo nuevo en motor.ts, hay que declararlo acá primero. */
export type MotivoDecision =
  | "sin_historial"
  | "tipo_manual"
  | "dolor_reportado"
  | "estancamiento_3_sesiones"
  | "caida_rendimiento"
  | "fallos_consecutivos_minimo"
  | "completo_maximo"
  | "sin_esfuerzo_alto"
  | "esfuerzo_alto"
  | "max_sin_lever_de_peso"
  | "dentro_del_rango"
  | "sin_fallo"
  | "fallo_minimo_aislado"
  | "primera_sesion_sin_dificultad"
  | "objetivo_perdida_grasa_sostener";

export interface RangoReps {
  min: number;
  max: number;
}

export interface ConfigProgresion {
  aptoProgresion: boolean;
  tipoProgresion: TipoProgresion;
  incrementoKg: number;
  requiereAutorizacion: boolean;
  rirObjetivo: number | null;
}

export interface SerieHistorial {
  numeroSerie: number;
  pesoKg: number | null;
  esPesoCorporal: boolean;
  repsRealizadas: number | null;
  realizada: boolean;
}

export interface SesionHistorial {
  /** Id de `sesion_ejercicios`, no de `sesiones_entrenamiento` — es lo que
   * `impulso_vip_recomendaciones.basado_en_sesion_ejercicio_id` referencia. */
  sesionEjercicioId: string;
  fecha: string;
  series: SerieHistorial[];
  /** Se pregunta una vez por ejercicio al terminarlo, no por serie. */
  dificultadPercibida: Dificultad | null;
  dolorReportado: boolean;
}

export interface Recomendacion {
  regla: ReglaImpulso;
  pesoSugeridoKg: number | null;
  repsObjetivoMin: number | null;
  repsObjetivoMax: number | null;
  esPesoCorporal: boolean;
  justificacion: string;
  /** Snapshot de por qué se llegó a esta regla — persistido en
   * `decision_data` para poder auditar la decisión después. */
  motivos: MotivoDecision[];
  /** Meta total de repeticiones (todas las series sumadas) usada para
   * resolver el cumplimiento después. Null cuando la regla no define una
   * meta numérica de reps (ej. Regla B, que se juzga por peso usado). */
  metaTotalReps: number | null;
  /** Solo presente (no null) cuando `regla === 'E_consultar'` — qué tipo de
   * alerta hay que asegurar en `impulso_vip_alertas`. Código estructurado,
   * nunca se infiere parseando texto. */
  alertaTipo: AlertaTipo | null;
}

export interface CalcularRecomendacionInput {
  objetivo: ObjetivoProgresion;
  rango: RangoReps;
  seriesProgramadas: number;
  config: ConfigProgresion | null;
  /** Más reciente primero. */
  historialUltimasSesiones: SesionHistorial[];
}

export const MOTOR_VERSION = "v1";
