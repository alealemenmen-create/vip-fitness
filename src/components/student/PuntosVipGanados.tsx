"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

export function PuntosVipGanados({ puntos, detalle }: { puntos: number; detalle: string }) {
  const [visible, setVisible] = useState(puntos > 0);

  useEffect(() => {
    if (puntos <= 0) return;
    const timer = window.setTimeout(() => setVisible(false), 4200);
    return () => window.clearTimeout(timer);
  }, [puntos]);

  if (!visible || puntos <= 0) return null;

  return (
    <div
      role="status"
      className="puntos-vip-entrada radius-card flex items-center gap-3 border border-vip/50 bg-vip/10 px-4 py-3 shadow-[0_12px_36px_-18px_var(--color-vip)]"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-vip text-black">
        <Sparkles size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-h3 text-vip">+{puntos} Puntos VIP</p>
        <p className="text-caption text-text-secondary">{detalle}</p>
      </div>
      <button
        type="button"
        onClick={() => setVisible(false)}
        className="text-micro text-text-tertiary"
        aria-label="Cerrar recompensa"
      >
        Cerrar
      </button>
    </div>
  );
}
