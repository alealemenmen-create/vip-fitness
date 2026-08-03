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
 * recalcula el elapsed contra la hora real del dispositivo. */
export function CronometroSesion({ horaInicio }: { horaInicio: string }) {
  const inicioMs = new Date(horaInicio).getTime();
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setAhora(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const segundos = Math.max(0, Math.floor((ahora - inicioMs) / 1000));

  return (
    <span className="radius-control flex items-center gap-1.5 bg-surface-2 px-2.5 py-1 text-micro font-semibold tabular-nums text-vip">
      <Timer size={13} className="shrink-0" />
      {formatoTranscurrido(segundos)}
    </span>
  );
}
