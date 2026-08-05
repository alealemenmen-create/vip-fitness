"use client";

import { useEffect, useState } from "react";
import { Timer } from "lucide-react";

function formatoTranscurrido(segundos: number): string {
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = segundos % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Cronómetro en vivo de la sesión en curso, sin estado propio en el
 * servidor: `horaInicio` ya es la fuente de verdad (columna persistida al
 * crear la sesión), así que un refresh no lo desincroniza — solo se
 * recalcula el elapsed contra la hora real del dispositivo.
 *
 * El primer render arranca en `null` (no en `Date.now()`): el servidor no
 * tiene forma de saber qué hora es en el dispositivo del alumno, así que
 * calcularlo ya en el render inicial hacía que el HTML del servidor y el
 * primer render del cliente casi nunca coincidieran (un segundo de por
 * medio alcanza) — eso disparaba un error de hidratación en cada carga. El
 * cálculo real recién ocurre en el `useEffect`, que solo corre en el
 * cliente después de hidratar. */
export function CronometroSesion({ horaInicio }: { horaInicio: string }) {
  const inicioMs = new Date(horaInicio).getTime();
  const [segundos, setSegundos] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setSegundos(Math.max(0, Math.floor((Date.now() - inicioMs) / 1000)));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [inicioMs]);

  return (
    <span className="radius-control flex items-center gap-1.5 bg-surface-2 px-2.5 py-1 text-micro font-semibold tabular-nums text-vip">
      <Timer size={13} className="shrink-0" />
      {segundos === null ? "00:00" : formatoTranscurrido(segundos)}
    </span>
  );
}
