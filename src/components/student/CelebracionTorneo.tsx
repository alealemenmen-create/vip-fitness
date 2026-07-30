"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PartyPopper, Trophy, X } from "lucide-react";
import type { CelebracionTorneo } from "@/lib/torneos/data";

const CONFETI = [
  ["7%", "0s", "3.8s", "#ffffff"],
  ["15%", ".6s", "4.2s", "#ffa100"],
  ["24%", "1.1s", "3.6s", "#a1a7b3"],
  ["34%", ".2s", "4.5s", "#ffffff"],
  ["45%", "1.4s", "3.9s", "#ffa100"],
  ["55%", ".8s", "4.3s", "#ffffff"],
  ["65%", ".1s", "3.7s", "#a1a7b3"],
  ["75%", "1.3s", "4.4s", "#ffa100"],
  ["84%", ".5s", "3.8s", "#ffffff"],
  ["93%", "1s", "4.1s", "#ffa100"],
] as const;

export function CelebracionTorneo({ celebracion }: { celebracion: CelebracionTorneo }) {
  const [visible, setVisible] = useState(false);
  const clave = `vip-celebracion-torneo-${celebracion.torneoId}`;

  useEffect(() => {
    if (localStorage.getItem(clave)) return;
    const id = window.setTimeout(() => setVisible(true), 0);
    return () => window.clearTimeout(id);
  }, [clave]);

  const cerrar = () => {
    localStorage.setItem(clave, "vista");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-hidden bg-black/75 px-5 backdrop-blur-sm">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {CONFETI.map(([left, delay, duration, color], indice) => (
          <span
            key={indice}
            className="confeti-torneo"
            style={{
              left,
              animationDelay: delay,
              animationDuration: duration,
              background: color,
            }}
          />
        ))}
        <span className="globo-torneo left-[8%]">🎈</span>
        <span className="globo-torneo left-[24%] [animation-delay:.7s]">🎈</span>
        <span className="globo-torneo right-[24%] [animation-delay:1.2s]">🎈</span>
        <span className="globo-torneo right-[8%] [animation-delay:.3s]">🎈</span>
      </div>

      <div className="panel-vip-espejo radius-card relative z-10 w-full max-w-sm p-6 text-center shadow-2xl">
        <button
          type="button"
          onClick={cerrar}
          aria-label="Cerrar felicitación"
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-text-secondary"
        >
          <X size={18} />
        </button>

        <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-vip/40 bg-vip/10 text-vip">
          <Trophy size={42} />
        </span>
        <p className="text-caption mt-4 flex items-center justify-center gap-1.5 font-semibold text-vip">
          <PartyPopper size={15} /> GANADOR DEL TORNEO
        </p>
        <h2 className="text-h2 mt-1 text-text">¡Felicitaciones!</h2>
        <p className="text-body mt-2 text-text-secondary">
          Ganaste <span className="font-semibold text-text">{celebracion.nombre}</span>.
        </p>
        {celebracion.puntosGanados > 0 && (
          <p className="text-h3 mt-3 text-vip">
            +{celebracion.puntosGanados.toLocaleString("es-CL")} pts Ranked
          </p>
        )}

        <Link
          href="/alumno/ranked"
          onClick={cerrar}
          className="radius-control mt-5 flex h-12 w-full items-center justify-center bg-vip text-body font-semibold text-black"
        >
          Ver resultados
        </Link>
      </div>
    </div>
  );
}
