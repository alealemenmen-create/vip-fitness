import type {
  EstadoIntervencionImpulso,
  VerificacionIntervencionImpulso,
} from "@/lib/supabase/types";

type IntervencionPersistida = {
  estado: EstadoIntervencionImpulso;
  verificacion: VerificacionIntervencionImpulso | null;
};

export type ResultadoDisponibilidadIntervencion = {
  error: string | null;
  ok: boolean;
  verificada: boolean;
};

export type DisponibilidadIntervencion<T extends IntervencionPersistida = IntervencionPersistida> =
  | { puedeResolver: true; intervencion: T }
  | { puedeResolver: false; resultado: ResultadoDisponibilidadIntervencion };

/**
 * Conserva inmutable el primer resultado, pero hace idempotentes los
 * reintentos: una intervención ya resuelta no es un error para el alumno.
 */
export function evaluarDisponibilidadIntervencion<T extends IntervencionPersistida>(
  intervencion: T | null,
): DisponibilidadIntervencion<T> {
  if (!intervencion || intervencion.estado === "cancelada") {
    return {
      puedeResolver: false,
      resultado: {
        error: "Esta intervencion ya no esta disponible.",
        ok: false,
        verificada: false,
      },
    };
  }

  if (intervencion.estado === "resuelta") {
    return {
      puedeResolver: false,
      resultado: {
        error: null,
        ok: true,
        verificada: intervencion.verificacion === "datos",
      },
    };
  }

  return { puedeResolver: true, intervencion };
}
