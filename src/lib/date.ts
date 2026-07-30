import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { es } from "date-fns/locale";
import { differenceInCalendarDays } from "date-fns";

export const ZONA_HORARIA_VIP = "America/Santiago";

/** Fecha de hoy en zona horaria de Chile, formato YYYY-MM-DD (para consultas por fecha). */
export function hoyISO(): string {
  return formatInTimeZone(new Date(), ZONA_HORARIA_VIP, "yyyy-MM-dd");
}

/** "Sábado, 25 de julio de 2026" en horario de Chile. */
export function formatFechaLarga(fecha: Date = new Date()): string {
  const texto = formatInTimeZone(fecha, ZONA_HORARIA_VIP, "EEEE, d 'de' MMMM 'de' yyyy", {
    locale: es,
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** "Mié, 29 jul 2026" — fecha compacta para encabezados móviles. */
export function formatFechaCompacta(fecha: Date = new Date()): string {
  const texto = formatInTimeZone(fecha, ZONA_HORARIA_VIP, "EEE, d LLL yyyy", {
    locale: es,
  }).replace(/\./g, "");
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** "07 AGO" — para tarjetas compactas como Próximo control. */
export function formatFechaCorta(fechaISO: string): string {
  return formatInTimeZone(`${fechaISO}T00:00:00`, ZONA_HORARIA_VIP, "dd LLL", { locale: es })
    .toUpperCase()
    .replace(".", "");
}

/** Días de calendario (Chile) entre hoy y una fecha objetivo YYYY-MM-DD. Puede ser negativo si ya pasó. */
export function diasRestantes(fechaObjetivoISO: string): number {
  const hoy = toZonedTime(new Date(), ZONA_HORARIA_VIP);
  const objetivo = toZonedTime(`${fechaObjetivoISO}T00:00:00`, ZONA_HORARIA_VIP);
  return differenceInCalendarDays(objetivo, hoy);
}

/** Edad en años a partir de una fecha de nacimiento YYYY-MM-DD. */
export function calcularEdad(fechaNacimientoISO: string): number {
  const hoy = toZonedTime(new Date(), ZONA_HORARIA_VIP);
  const [anio, mes, dia] = fechaNacimientoISO.split("-").map(Number);
  let edad = hoy.getFullYear() - anio;
  const aunNoCumple = hoy.getMonth() + 1 < mes || (hoy.getMonth() + 1 === mes && hoy.getDate() < dia);
  if (aunNoCumple) edad -= 1;
  return edad;
}

/** Primer y último día del mes calendario actual (Chile), YYYY-MM-DD. */
export function mesActualISO(): { desde: string; hasta: string } {
  const hoy = toZonedTime(new Date(), ZONA_HORARIA_VIP);
  const desde = formatInTimeZone(new Date(hoy.getFullYear(), hoy.getMonth(), 1), ZONA_HORARIA_VIP, "yyyy-MM-dd");
  const hasta = formatInTimeZone(
    new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0),
    ZONA_HORARIA_VIP,
    "yyyy-MM-dd"
  );
  return { desde, hasta };
}

/** Nombre del día de la semana en Chile: "Martes". */
export function nombreDiaSemana(fecha: Date = new Date()): string {
  const texto = formatInTimeZone(fecha, ZONA_HORARIA_VIP, "EEEE", { locale: es });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Los 7 días de la semana en curso (lunes a domingo) en horario de Chile,
 * con la inicial que se muestra en los puntitos de Inicio. */
export function semanaActualISO(): { fecha: string; letra: string; esHoy: boolean }[] {
  const hoy = toZonedTime(new Date(), ZONA_HORARIA_VIP);
  // getDay(): 0 = domingo. Se corre a lunes como primer día.
  const desplazamientoALunes = (hoy.getDay() + 6) % 7;
  const hoyStr = hoyISO();

  return Array.from({ length: 7 }, (_, i) => {
    const fecha = new Date(hoy);
    fecha.setDate(fecha.getDate() - desplazamientoALunes + i);
    const iso = formatInTimeZone(fecha, ZONA_HORARIA_VIP, "yyyy-MM-dd");
    return { fecha: iso, letra: ["L", "M", "X", "J", "V", "S", "D"][i], esHoy: iso === hoyStr };
  });
}

/** Lunes de la semana que contiene una fecha dada (Chile), YYYY-MM-DD. */
function lunesDe(fecha: Date): string {
  const desplazamientoALunes = (fecha.getDay() + 6) % 7;
  const lunes = new Date(fecha);
  lunes.setDate(lunes.getDate() - desplazamientoALunes);
  return formatInTimeZone(lunes, ZONA_HORARIA_VIP, "yyyy-MM-dd");
}

/** Lunes de la semana calendario anterior a la actual (Chile), YYYY-MM-DD. */
export function semanaAnteriorLunesISO(): string {
  const hoy = toZonedTime(new Date(), ZONA_HORARIA_VIP);
  const haceSieteDias = new Date(hoy);
  haceSieteDias.setDate(haceSieteDias.getDate() - 7);
  return lunesDe(haceSieteDias);
}

/** Últimos n días (incluye hoy) en horario de Chile, YYYY-MM-DD, del más reciente al más antiguo. */
export function ultimosNDiasISO(n: number): string[] {
  const hoy = toZonedTime(new Date(), ZONA_HORARIA_VIP);
  return Array.from({ length: n }, (_, i) => {
    const fecha = new Date(hoy);
    fecha.setDate(fecha.getDate() - i);
    return formatInTimeZone(fecha, ZONA_HORARIA_VIP, "yyyy-MM-dd");
  });
}
