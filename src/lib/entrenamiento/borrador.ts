/**
 * Respaldo local de lo que el alumno va cargando en un ejercicio.
 *
 * El guardado real va a Supabase, pero en el gimnasio la conexión se cae, el
 * alumno cambia de app o el teléfono descarta la pestaña por memoria. Si eso
 * pasa entre que toca "Listo" y que la petición llega al servidor, el dato se
 * perdía. Acá queda una copia en el propio teléfono.
 *
 * Regla de precedencia: el borrador existe SOLO mientras hay algo sin
 * confirmar. Cuando el servidor responde que guardó, se borra. Así, al abrir la
 * sesión, si hay borrador es porque quedó trabajo sin sincronizar y hay que
 * restaurarlo; si no hay, la base ya es la verdad y no se toca nada. Sin esta
 * regla, un borrador viejo podría pisar datos más nuevos.
 */

export type SerieBorrador = {
  numero: number;
  peso: string;
  reps: string;
  rir?: string;
  realizada: boolean;
  esPesoCorporal: boolean;
};

export type BorradorEjercicio = {
  series: SerieBorrador[];
  nota: string;
  /** Marca de tiempo, para poder descartar borradores muy viejos. */
  guardadoEn: number;
};

/** Un borrador de hace más de un día casi seguro es basura de una sesión que
 * el alumno abandonó: restaurarlo confundiría más de lo que ayuda. */
const VENCIMIENTO_MS = 24 * 60 * 60 * 1000;

function clave(sesionId: string, sesionEjercicioId: string): string {
  return `vip:borrador:${sesionId}:${sesionEjercicioId}`;
}

export function guardarBorrador(
  sesionId: string,
  sesionEjercicioId: string,
  borrador: Omit<BorradorEjercicio, "guardadoEn">
): void {
  try {
    localStorage.setItem(
      clave(sesionId, sesionEjercicioId),
      JSON.stringify({ ...borrador, guardadoEn: Date.now() })
    );
  } catch {
    // Modo privado o almacenamiento lleno: el guardado al servidor sigue su
    // curso igual, esto es solo la red de seguridad.
  }
}

export function leerBorrador(
  sesionId: string,
  sesionEjercicioId: string
): BorradorEjercicio | null {
  try {
    const crudo = localStorage.getItem(clave(sesionId, sesionEjercicioId));
    if (!crudo) return null;

    const dato = JSON.parse(crudo) as BorradorEjercicio;
    if (!dato || !Array.isArray(dato.series)) return null;

    if (Date.now() - (dato.guardadoEn ?? 0) > VENCIMIENTO_MS) {
      limpiarBorrador(sesionId, sesionEjercicioId);
      return null;
    }
    return dato;
  } catch {
    return null;
  }
}

export function limpiarBorrador(sesionId: string, sesionEjercicioId: string): void {
  try {
    localStorage.removeItem(clave(sesionId, sesionEjercicioId));
  } catch {
    // Ver guardarBorrador.
  }
}
