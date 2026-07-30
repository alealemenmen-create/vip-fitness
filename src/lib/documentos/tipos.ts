import type { TipoDocumento } from "@/lib/supabase/types";

/**
 * Tipos y etiquetas compartidos entre servidor y navegador.
 *
 * Viven aparte de `data.ts` a propósito: ese archivo lleva `server-only`, así
 * que un componente cliente que importara de ahí rompe el build. Acá no hay
 * nada que consulte la base, solo formas de datos.
 */

export const ETIQUETA_TIPO: Record<TipoDocumento, string> = {
  rutina: "Rutina",
  alimentacion: "Alimentación",
  otro: "Otro",
};

export type AsignacionDocumento = {
  alumnoId: string;
  nombre: string;
  fechaAsignacion: string;
};

export type DocumentoBiblioteca = {
  id: string;
  tipo: TipoDocumento;
  nombreArchivo: string;
  storagePath: string;
  fechaCarga: string;
  asignaciones: AsignacionDocumento[];
};

export type AlumnoParaAsignar = { id: string; nombre: string };
