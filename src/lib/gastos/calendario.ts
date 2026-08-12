export type CicloGasto = "mensual" | "anual" | "variable" | "unico";
export type EstadoGasto = "sin_fecha" | "al_dia" | "proximo" | "hoy" | "vencido";

function fechaUtc(fechaISO: string): Date {
  const [anio, mes, dia] = fechaISO.split("-").map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia));
}
function isoUtc(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

export function diasEntreISO(desdeISO: string, hastaISO: string): number {
  return Math.round((fechaUtc(hastaISO).getTime() - fechaUtc(desdeISO).getTime()) / 86_400_000);
}

export function estadoVencimiento(
  proximaFecha: string | null,
  avisarDiasAntes: number,
  hoyISO: string,
): { estado: EstadoGasto; dias: number | null } {
  if (!proximaFecha) return { estado: "sin_fecha", dias: null };
  const dias = diasEntreISO(hoyISO, proximaFecha);
  if (dias < 0) return { estado: "vencido", dias };
  if (dias === 0) return { estado: "hoy", dias };
  if (dias <= avisarDiasAntes) return { estado: "proximo", dias };
  return { estado: "al_dia", dias };
}

function sumarMesesConDia(fechaISO: string, meses: number): string {
  const base = fechaUtc(fechaISO);
  const dia = base.getUTCDate();
  const objetivo = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + meses, 1));
  const ultimoDia = new Date(Date.UTC(objetivo.getUTCFullYear(), objetivo.getUTCMonth() + 1, 0)).getUTCDate();
  objetivo.setUTCDate(Math.min(dia, ultimoDia));
  return isoUtc(objetivo);
}

/** Próximo cobro después de registrar el pago. Si había varios vencimientos
 * atrasados, avanza hasta dejar una fecha futura en vez de seguir alertando. */
export function siguienteFechaPago(
  fechaVencimiento: string | null,
  ciclo: CicloGasto,
  fechaPago: string,
): string | null {
  if (!fechaVencimiento || ciclo === "variable" || ciclo === "unico") return null;
  const salto = ciclo === "mensual" ? 1 : 12;
  let siguiente = sumarMesesConDia(fechaVencimiento, salto);
  while (siguiente <= fechaPago) siguiente = sumarMesesConDia(siguiente, salto);
  return siguiente;
}
