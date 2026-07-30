// Tipos y constantes de Torneos que también usan componentes cliente
// ("use client", ej. TorneoAdminCard) — separados de data.ts porque ese
// archivo es server-only (usa la service_role key) y no se puede importar
// desde el bundle del navegador.
import type { TorneoMetrica, TorneoParticipanteEstado } from "@/lib/supabase/types";
import type { ResultadoTorneo } from "./puntos";

export type { TorneoMetrica, TorneoParticipanteEstado };

export const NOMBRE_METRICA: Record<TorneoMetrica, string> = {
  peso_baja: "Mayor bajada de peso",
  peso_sube: "Mayor subida de peso",
  asistencia: "Más asistencia al gimnasio",
  manual: "A criterio del entrenador",
};

export type TorneoAdmin = {
  id: string;
  nombre: string;
  descripcion: string | null;
  metrica: TorneoMetrica;
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
};

export type ParticipanteConEstado = { alumnoId: string; nombre: string; estado: TorneoParticipanteEstado };

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
  fechaInicio: string;
  horaInicio: string | null;
  fechaFin: string;
  horaFin: string | null;
  puntosEnJuego: number;
  participantes: ParticipanteConEstado[];
  miEstado: TorneoParticipanteEstado | null;
};

export type ResultadoHistorico = {
  torneoId: string;
  nombre: string;
  metrica: TorneoMetrica;
  fechaFin: string;
  cerradoEn: string;
  resultados: ResultadoTorneo[];
};
