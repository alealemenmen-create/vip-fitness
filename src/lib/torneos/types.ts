// Tipos y constantes de Torneos que también usan componentes cliente
// ("use client", ej. TorneoAdminCard) — separados de data.ts porque ese
// archivo es server-only (usa la service_role key) y no se puede importar
// desde el bundle del navegador.
import type { TorneoMetrica, TorneoModalidad, TorneoParticipanteEstado } from "@/lib/supabase/types";
import type { ResultadoTorneo } from "./puntos";

export type { TorneoMetrica, TorneoModalidad, TorneoParticipanteEstado };

export const NOMBRE_METRICA: Record<TorneoMetrica, string> = {
  peso_baja: "Mayor bajada de peso",
  peso_sube: "Mayor subida de peso",
  asistencia: "Más asistencia al gimnasio",
  progreso_vip: "Más Puntos VIP durante el periodo",
  manual: "Resultado validado por el entrenador",
};

export const NOMBRE_MODALIDAD: Record<TorneoModalidad, string> = {
  duelo: "Duelo VIP",
  reto_coach: "Reto del Coach",
  copa_constancia: "Copa de Constancia",
};

export type TorneoAdmin = {
  id: string;
  nombre: string;
  descripcion: string | null;
  metrica: TorneoMetrica;
  modalidad: TorneoModalidad;
  reglaPublica: string | null;
  menorEsMejor: boolean;
  unidadManual: string | null;
  fechaInicio: string;
  fechaFin: string;
  puntosEnJuego: number;
  cerrado: boolean;
  participantes: {
    alumnoId: string;
    nombre: string;
    resultadoManual: number | null;
    estado: TorneoParticipanteEstado;
  }[];
  resultados: ResultadoTorneo[] | null;
  /** Lo que apostó el público. El entrenador tiene que poder ver qué se va a
   * repartir y por qué ANTES de cerrar: son puntos que salieron del saldo de
   * los alumnos, no de la bolsa de VIP Fitness. */
  apuestas: {
    total: number;
    cantidad: number;
    porParticipante: { alumnoId: string; total: number; cantidad: number }[];
    /** Ya se pagaron (el torneo cerró y el reparto se escribió). */
    resueltas: boolean;
  };
};

export type ParticipanteConEstado = {
  alumnoId: string;
  nombre: string;
  estado: TorneoParticipanteEstado;
  valorActual: number | null;
  resultadoValido: boolean;
};

/** Las apuestas del público en un torneo, tal como las ve un alumno.
 *
 * Vive acá y no en `apuestas-data.ts` porque ese archivo es server-only (usa
 * la service_role key) y este tipo cruza al bundle del navegador. */
export type ApuestasEnTorneo = {
  /** Se puede apostar todavía. Cierran cuando la competencia empieza. */
  abiertas: boolean;
  /** Bolsa apostada por el público — distinta de `puntosEnJuego`, que la pone
   * VIP Fitness. */
  total: number;
  cantidad: number;
  porParticipante: { alumnoId: string; total: number; cantidad: number }[];
  /** La apuesta del alumno que está mirando, si puso alguna. */
  miApuesta: { porAlumnoId: string; puntos: number } | null;
};

/** Un torneo abierto tal como lo ve un alumno: TODOS los alumnos ven todos
 * los torneos abiertos como noticia pública ("Fulano vs Mengano compiten
 * esta semana"); `miEstado` es null si no fue invitado (espectador), y si no
 * es null, la app le muestra los botones de aceptar/rechazar cuando está en
 * 'pendiente'. */
export type TorneoPublico = {
  id: string;
  nombre: string;
  descripcion: string | null;
  metrica: TorneoMetrica;
  modalidad: TorneoModalidad;
  reglaPublica: string | null;
  menorEsMejor: boolean;
  unidadManual: string | null;
  fechaInicio: string;
  horaInicio: string | null;
  fechaFin: string;
  horaFin: string | null;
  puntosEnJuego: number;
  participantes: ParticipanteConEstado[];
  miEstado: TorneoParticipanteEstado | null;
  apuestas: ApuestasEnTorneo;
};

export type ResultadoHistorico = {
  torneoId: string;
  nombre: string;
  metrica: TorneoMetrica;
  modalidad: TorneoModalidad;
  fechaFin: string;
  cerradoEn: string;
  resultados: ResultadoTorneo[];
};
