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

/** "30 de julio, 2026" — subtítulo del encabezado de Alimentación. El día de
 * la semana no se repite ahí porque ya lo muestra la tira de fechas. */
export function formatFechaMedia(fechaISO: string): string {
  return formatInTimeZone(`${fechaISO}T12:00:00`, ZONA_HORARIA_VIP, "d 'de' MMMM, yyyy", {
    locale: es,
  });
}

/** "Domingo 2 de agosto" — para listas de historial donde el día de la
 * semana ayuda a ubicarse más que el año. */
export function formatFechaDiaSemana(fechaISO: string): string {
  const texto = formatInTimeZone(`${fechaISO}T12:00:00`, ZONA_HORARIA_VIP, "EEEE d 'de' MMMM", {
    locale: es,
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** "5 ago, 14:32" — para timestamps completos (no solo fecha), como el
 * registro de novedades de la app. */
export function formatFechaHoraCorta(timestamptz: string): string {
  return formatInTimeZone(timestamptz, ZONA_HORARIA_VIP, "d MMM, HH:mm", { locale: es }).replace(".", "");
}

/** Hora del día (0-23) en Chile. Se calcula en el servidor y se pasa como
 * prop: si el cliente usara su propio reloj, un alumno fuera de Chile
 * renderizaría otra hora que el servidor y React marcaría desajuste de
 * hidratación. */
export function horaActualISO(): number {
  return Number(formatInTimeZone(new Date(), ZONA_HORARIA_VIP, "H"));
}

/** Suma (o resta) días a una fecha YYYY-MM-DD, en horario de Chile. */
export function sumarDiasISO(fechaISO: string, delta: number): string {
  const base = toZonedTime(`${fechaISO}T12:00:00`, ZONA_HORARIA_VIP);
  base.setDate(base.getDate() + delta);
  return formatInTimeZone(base, ZONA_HORARIA_VIP, "yyyy-MM-dd");
}

/**
 * Ventana de fechas permitida para registrar peso/foto/comida NUEVOS: hoy o
 * ayer, nunca más atrás ni en el futuro.
 *
 * Sin este límite, cualquiera podía mandar una fecha arbitraria del pasado
 * (el campo de fecha del formulario solo lo bloqueaba visualmente, nunca en
 * el servidor) y cobrar los puntos de esa semana/día como si los hubiera
 * cumplido, sin que pasara un solo día real — y como el ranking histórico
 * suma todo sin filtro de fecha, eso inflaba el puntaje acumulado para
 * siempre de una sola vez. "Ayer" se permite a propósito: es el caso real
 * de un alumno que se olvidó de cargar el día anterior y lo carga a primera
 * hora del siguiente.
 */
export function fechaEnVentanaValida(fechaISO: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaISO)) return false;
  const hoy = hoyISO();
  return fechaISO === hoy || fechaISO === sumarDiasISO(hoy, -1);
}

/** Años hacia atrás que se aceptan al fechar una foto vieja. */
const ANOS_MAXIMOS_ATRAS = 10;

/**
 * Ventana más ancha, para el dato que describe CUÁNDO pasó algo y no cobra
 * puntos por sí solo: la fecha real de una foto "de antes" que el alumno sube
 * desde la galería de su teléfono. Acepta hoy y cualquier día anterior
 * razonable; nunca el futuro.
 *
 * El límite de puntos NO vive acá: quien fecha una foto vieja la guarda con su
 * fecha real pero no recibe recompensa (ver `subirFotoProgreso`), así que esta
 * ventana no reabre el agujero que cerró `fechaEnVentanaValida`.
 */
export function fechaPasadaValida(fechaISO: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaISO)) return false;
  const hoy = hoyISO();
  if (fechaISO > hoy) return false;
  return fechaISO >= sumarDiasISO(hoy, -365 * ANOS_MAXIMOS_ATRAS);
}

export type DiaTira = { fecha: string; letra: string; dia: number; esHoy: boolean };

/** Ventana de días alrededor de `centroISO`, para una tira que se arrastra de
 * verdad en vez de un bloque fijo de 7 con flechas. Se piden varias semanas a
 * cada lado para que el arrastre nunca choque con un borde vacío. */
export function diasVentanaISO(centroISO: string, antes = 21, despues = 21): DiaTira[] {
  const centro = toZonedTime(`${centroISO}T12:00:00`, ZONA_HORARIA_VIP);
  const hoyStr = hoyISO();
  const letras = ["D", "L", "M", "X", "J", "V", "S"]; // getDay(): 0 = domingo

  return Array.from({ length: antes + despues + 1 }, (_, i) => {
    const fecha = new Date(centro);
    fecha.setDate(fecha.getDate() - antes + i);
    const iso = formatInTimeZone(fecha, ZONA_HORARIA_VIP, "yyyy-MM-dd");
    return {
      fecha: iso,
      letra: letras[fecha.getDay()],
      dia: Number(iso.slice(-2)),
      esHoy: iso === hoyStr,
    };
  });
}

/** Lunes de la semana que contiene una fecha dada (Chile), YYYY-MM-DD. */
function lunesDe(fecha: Date): string {
  const desplazamientoALunes = (fecha.getDay() + 6) % 7;
  const lunes = new Date(fecha);
  lunes.setDate(lunes.getDate() - desplazamientoALunes);
  return formatInTimeZone(lunes, ZONA_HORARIA_VIP, "yyyy-MM-dd");
}

/**
 * Lunes de la semana que contiene una fecha YYYY-MM-DD dada, en horario de
 * Chile. Única fuente de verdad de "qué semana es esta fecha": la usa el
 * bono semanal de PESO en Puntos VIP (`registrarPeso`/`recalcularPesoSemana`
 * en `lib/ranking/movimientos.ts`) — antes había dos funciones con el mismo
 * nombre y lógicas apenas distintas (una en Chile, otra en UTC), que en el
 * borde de la medianoche podían no coincidir en qué lunes le tocaba a una
 * fecha.
 *
 * La FOTO de progreso ya no usa esto: pasó a ser quincenal (ver
 * `quincenaDeISO`, 2026-08-16) — "semanal es muy pronto para ver
 * resultados", pedido de Alejandro. El peso se queda semanal a propósito:
 * el peso sí puede tener sentido revisarlo semana a semana.
 */
export function lunesDeISO(fechaISO: string): string {
  return lunesDe(toZonedTime(`${fechaISO}T12:00:00`, ZONA_HORARIA_VIP));
}

/**
 * Primer día de la quincena (Chile) que contiene una fecha YYYY-MM-DD: "01"
 * si el día del mes cae entre 1 y 15, "16" si cae entre 16 y el último día
 * del mes. Es la unidad de la foto de progreso desde el 2026-08-16 —
 * "semanal es muy pronto para ver resultados", pedido de Alejandro: el
 * físico cambia más despacio que el peso, así que su ritmo de registro es
 * más largo. Calendario, no una ventana móvil desde que el alumno empezó:
 * mismo criterio que `lunesDeISO`, todos los alumnos comparten el mismo
 * corte (día 1 y día 16 de cada mes) en vez de que cada uno tenga el suyo
 * según cuándo se sumó a la app.
 */
export function quincenaDeISO(fechaISO: string): string {
  const [anio, mes, dia] = fechaISO.split("-").map(Number);
  const diaInicio = dia <= 15 ? 1 : 16;
  return `${anio}-${String(mes).padStart(2, "0")}-${String(diaInicio).padStart(2, "0")}`;
}

/** Último día de la quincena que arranca en `inicioISO` (el "01" o "16" que
 * devuelve `quincenaDeISO`) — 15, o el último día real del mes si empezó
 * el 16 (28, 29, 30 o 31 según el mes). */
export function finQuincenaISO(inicioISO: string): string {
  const [anio, mes, dia] = inicioISO.split("-").map(Number);
  if (dia === 1) return `${anio}-${String(mes).padStart(2, "0")}-15`;
  // Día 0 del mes siguiente = último día de este mes. Mismo truco que ya
  // usa `mesActualISO` más arriba en este archivo — no depende de huso
  // horario porque no hay conversión UTC de por medio, solo aritmética de
  // calendario con componentes locales.
  const ultimoDiaMes = new Date(anio, mes, 0).getDate();
  return `${anio}-${String(mes).padStart(2, "0")}-${String(ultimoDiaMes).padStart(2, "0")}`;
}

/** La quincena siguiente a la que arranca en `inicioISO`. */
export function siguienteQuincenaISO(inicioISO: string): string {
  const [anio, mes, dia] = inicioISO.split("-").map(Number);
  if (dia === 1) return `${anio}-${String(mes).padStart(2, "0")}-16`;
  const siguienteMes = mes === 12 ? 1 : mes + 1;
  const siguienteAnio = mes === 12 ? anio + 1 : anio;
  return `${siguienteAnio}-${String(siguienteMes).padStart(2, "0")}-01`;
}

/** Ventana para la foto de progreso: solo la quincena en curso, nunca el
 * futuro ni una quincena ya cerrada. */
export function fechaEnQuincenaActualValida(fechaISO: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaISO)) return false;
  const hoy = hoyISO();
  if (fechaISO > hoy) return false;
  return quincenaDeISO(fechaISO) === quincenaDeISO(hoy);
}

/** Lunes de la semana calendario anterior a la actual (Chile), YYYY-MM-DD. */
export function semanaAnteriorLunesISO(): string {
  const hoy = toZonedTime(new Date(), ZONA_HORARIA_VIP);
  const haceSieteDias = new Date(hoy);
  haceSieteDias.setDate(haceSieteDias.getDate() - 7);
  return lunesDe(haceSieteDias);
}

/** "45 min" o "1h 20min" a partir de hora_inicio/hora_fin de una sesión.
 * Sesiones sin cerrar (`fin` null) o con datos inconsistentes no muestran nada. */
export function formatoDuracion(inicio: string | null, fin: string | null): string | null {
  if (!inicio || !fin) return null;
  const minutos = Math.round((new Date(fin).getTime() - new Date(inicio).getTime()) / 60000);
  if (minutos <= 0) return null;
  if (minutos < 60) return `${minutos} min`;
  return `${Math.floor(minutos / 60)}h ${minutos % 60}min`;
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
