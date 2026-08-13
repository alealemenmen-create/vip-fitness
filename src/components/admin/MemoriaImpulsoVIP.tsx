import { Brain, CheckCircle2, ShieldAlert } from "lucide-react";
import type { ResumenMemoriaImpulso } from "@/lib/impulso-vip/memoria-data";

const NOMBRE_TECNICA = {
  drop_set: "Drop set",
  rest_pause: "Rest-pause",
  fallo_controlado: "Fallo técnico",
};

export function MemoriaImpulsoVIP({ memorias }: { memorias: ResumenMemoriaImpulso[] }) {
  if (memorias.length === 0) return null;
  return (
    <section className="admin-panel-card rounded-3xl p-4" aria-label="Memoria adaptativa de Impulso VIP">
      <div className="mb-3 flex items-center gap-2">
        <Brain size={17} className="text-vip" />
        <div>
          <h2 className="text-sm font-semibold text-text">Memoria de Impulso</h2>
          <p className="text-[11px] text-text-tertiary">Lo que aprendió de cada alumno</p>
        </div>
      </div>
      <div className="space-y-2">
        {memorias.map((memoria) => (
          <article key={memoria.id} className="rounded-2xl border border-border bg-surface-2 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-text">{memoria.alumno}</p>
                <p className="truncate text-[11px] text-text-secondary">{memoria.ejercicio} · {NOMBRE_TECNICA[memoria.tecnica]}</p>
              </div>
              <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[9px] font-black uppercase ${
                memoria.confianza === "retroceder"
                  ? "bg-error/10 text-error"
                  : memoria.confianza === "confiable"
                    ? "bg-success/10 text-success"
                    : "bg-warning/10 text-warning"
              }`}>
                {memoria.confianza === "retroceder" ? <ShieldAlert size={10} /> : memoria.confianza === "confiable" ? <CheckCircle2 size={10} /> : null}
                {memoria.confianza === "retroceder" ? "Retroceder" : memoria.confianza === "confiable" ? "Confiable" : "En prueba"}
              </span>
            </div>
            <p className="mt-2 text-[10px] text-text-tertiary">
              {memoria.logradas}/{memoria.intentos} logradas · {memoria.verificadas} verificadas
              {memoria.molestias > 0 ? ` · ${memoria.molestias} con molestia` : ""}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
