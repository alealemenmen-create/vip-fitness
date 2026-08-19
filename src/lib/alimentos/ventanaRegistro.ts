type VentanaRegistroComida = {
  fecha: string;
  fechaHoy: string;
  fechasConRegistro?: Iterable<string>;
};

/** Resta un día de calendario sin depender del huso horario del dispositivo. */
export function diaAnteriorISO(fechaISO: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaISO)) return null;
  const [anio, mes, dia] = fechaISO.split("-").map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia, 12));
  if (
    fecha.getUTCFullYear() !== anio ||
    fecha.getUTCMonth() !== mes - 1 ||
    fecha.getUTCDate() !== dia
  ) return null;
  fecha.setUTCDate(fecha.getUTCDate() - 1);
  return fecha.toISOString().slice(0, 10);
}

/**
 * Refleja en la interfaz la misma regla que aplica el servidor:
 * se puede crear un diario hoy o ayer, y se puede continuar un diario real
 * que ya existe. Así el alumno no completa una carga para descubrir el error
 * recién al confirmar.
 */
export function puedeRegistrarComidaEnFecha({
  fecha,
  fechaHoy,
  fechasConRegistro = [],
}: VentanaRegistroComida): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  if (fecha === fechaHoy || fecha === diaAnteriorISO(fechaHoy)) return true;
  return new Set(fechasConRegistro).has(fecha);
}
