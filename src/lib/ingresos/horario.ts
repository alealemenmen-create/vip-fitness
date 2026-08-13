import { formatInTimeZone } from "date-fns-tz";
import { ZONA_HORARIA_VIP } from "@/lib/date";

export type ConfianzaHorario = "alta" | "media" | "baja";

/** Mediana robusta: una visita excepcional no desplaza la hora habitual. */
export function calcularHorarioHabitual(inicios: string[]): {
  hora: string | null;
  confianza: ConfianzaHorario | null;
  muestras: number;
} {
  const minutos = inicios
    .map((inicio) => {
      const hora = formatInTimeZone(inicio, ZONA_HORARIA_VIP, "HH:mm");
      const [h, m] = hora.split(":").map(Number);
      return h * 60 + m;
    })
    .sort((a, b) => a - b);
  if (minutos.length < 3) return { hora: null, confianza: null, muestras: minutos.length };
  const mediana = minutos[Math.floor(minutos.length / 2)];
  const desviaciones = minutos.map((m) => Math.abs(m - mediana)).sort((a, b) => a - b);
  const dispersion = desviaciones[Math.floor(desviaciones.length / 2)];
  const confianza: ConfianzaHorario = minutos.length >= 6 && dispersion <= 60
    ? "alta"
    : dispersion <= 120
      ? "media"
      : "baja";
  const hh = String(Math.floor(mediana / 60)).padStart(2, "0");
  const mm = String(mediana % 60).padStart(2, "0");
  return { hora: `${hh}:${mm}`, confianza, muestras: minutos.length };
}
