import { Sparkles, Zap } from "lucide-react";

export function ImpulsoVip({ mensaje, indicador }: { mensaje: string; indicador: string }) {
  return (
    <section className="impulso-inicio relative overflow-hidden rounded-[20px] border border-acento/30 p-3">
      <div className="relative flex items-start gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-acento text-white shadow-[0_8px_24px_color-mix(in_srgb,var(--color-acento)_35%,transparent)]">
          <Zap size={18} fill="currentColor" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-[11px] font-bold text-text">
              IMPULSO VIP <Sparkles size={12} className="text-acento-fuerte" />
            </p>
            <span className="shrink-0 text-[9px] font-semibold text-acento-fuerte">{indicador}</span>
          </div>
          <p className="mt-1 text-[10px] leading-snug text-text-secondary">{mensaje}</p>
        </div>
      </div>
    </section>
  );
}
