"use client";

import { useEffect, useState, useTransition } from "react";
import { ChevronDown, ShieldAlert, Sparkles, X } from "lucide-react";
import {
  consultarPropuestasImpulso,
  decidirPropuestaImpulso,
} from "@/app/admin/alumnos/impulso-actions";
import type { PropuestaImpulso } from "@/lib/impulso-vip/propuestas-data";
import { AvisosImpulsoPush } from "./AvisosImpulsoPush";

const NOMBRE_TECNICA: Record<string, string> = {
  cierre_controlado: "Cierre controlado",
  repeticion_objetivo: "Repetición objetivo",
  tempo_controlado: "Tempo controlado",
  pausa_isometrica: "Pausa isométrica",
  serie_descarga: "Serie de descarga",
  drop_set: "Drop set",
  rest_pause: "Rest-pause",
  fallo_controlado: "Fallo técnico",
};

export function PropuestasImpulsoVIP({
  iniciales,
  destacadaId,
}: {
  iniciales: PropuestaImpulso[];
  destacadaId?: string;
}) {
  const [propuestas, setPropuestas] = useState(iniciales);
  const [, actualizar] = useTransition();
  useEffect(() => {
    let activo = true;
    const consultar = () => actualizar(async () => {
      const nuevas = await consultarPropuestasImpulso().catch(() => null);
      if (activo && nuevas) setPropuestas(nuevas);
    });
    const id = window.setInterval(consultar, 15_000);
    return () => { activo = false; window.clearInterval(id); };
  }, []);

  const excepciones = propuestas.filter((propuesta) => propuesta.requiereRevision && !propuesta.aprobadaPorAle);
  const automaticas = propuestas.filter((propuesta) => !propuesta.requiereRevision);
  const destacada = destacadaId ? propuestas.find((propuesta) => propuesta.id === destacadaId) : null;

  return (
    <section id="propuestas-impulso" className="admin-panel-card scroll-mt-24 rounded-3xl p-4" aria-label="Propuestas automáticas de Impulso VIP">
      <div className="flex items-start gap-2">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-vip/15 text-vip"><Sparkles size={16} /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-text">Propuestas de Impulso</h2>
          <p className="mt-0.5 text-[11px] leading-snug text-text-tertiary">
            {propuestas.length} preparadas · todas continúan solas si no las cancelas
          </p>
        </div>
        {excepciones.length > 0 && <span className="rounded-full bg-error/12 px-2 py-1 text-[9px] font-black text-error">{excepciones.length}</span>}
      </div>

      <AvisosImpulsoPush />

      {destacada && (
        <article className="mt-3 rounded-2xl border border-vip/35 bg-vip/[0.09] p-3 shadow-[0_0_22px_color-mix(in_srgb,var(--color-vip)_10%,transparent)]">
          <p className="text-[9px] font-black uppercase tracking-[0.14em] text-vip">Aviso abierto desde tu teléfono</p>
          <p className="mt-1 text-[11px] font-bold text-text">{destacada.alumno}</p>
          <p className="text-[10px] text-text-secondary">{destacada.ejercicio} · Serie {destacada.serie} · {NOMBRE_TECNICA[destacada.tipo]}</p>
          <p className="mt-1 text-[10px] leading-snug text-text-tertiary">{destacada.instruccion}</p>
          <p className="mt-2 rounded-xl border border-success/20 bg-success/[0.07] px-2.5 py-2 text-[10px] font-semibold text-success">
            Se activará automáticamente. No necesitas aprobarla.
          </p>
          <form action={decidirPropuestaImpulso} className="mt-2">
            <input type="hidden" name="intervencion_id" value={destacada.id} />
            <button name="decision" value="descartar" className="flex min-h-10 w-full items-center justify-center gap-1 rounded-xl border border-error/30 bg-error/[0.06] text-[10px] font-bold text-error"><X size={12} /> Cancelar intervención</button>
          </form>
        </article>
      )}

      {excepciones.length === 0 ? (
        <p className="mt-3 rounded-xl border border-success/20 bg-success/[0.07] px-3 py-2 text-[10px] font-semibold text-success">
          Todo está cubierto. No necesitas aprobar alumno por alumno.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {excepciones.slice(0, 6).map((propuesta) => (
            <article key={propuesta.id} className="rounded-2xl border border-warning/25 bg-warning/[0.06] p-3">
              <div className="flex items-start gap-2">
                <ShieldAlert size={14} className="mt-0.5 shrink-0 text-warning" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-bold text-text">{propuesta.alumno}</p>
                  <p className="truncate text-[10px] text-text-secondary">{propuesta.ejercicio} · Serie {propuesta.serie} · {NOMBRE_TECNICA[propuesta.tipo]}</p>
                  <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-text-tertiary">{propuesta.instruccion}</p>
                  <p className="mt-1 text-[9px] font-semibold text-warning">Se aplicará automáticamente solo si pasa las reglas de seguridad.</p>
                </div>
              </div>
              <form action={decidirPropuestaImpulso} className="mt-2">
                <input type="hidden" name="intervencion_id" value={propuesta.id} />
                <button name="decision" value="descartar" className="flex min-h-9 w-full items-center justify-center gap-1 rounded-xl border border-error/30 text-[10px] font-bold text-error"><X size={12} /> Cancelar intervención</button>
              </form>
            </article>
          ))}
        </div>
      )}

      {automaticas.length > 0 && (
        <details className="mt-2 group">
          <summary className="flex cursor-pointer list-none items-center justify-center gap-1 py-1 text-[10px] font-semibold text-text-tertiary">
            Ver propuestas automáticas <ChevronDown size={12} className="transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-1 space-y-1.5">
            {automaticas.slice(0, 8).map((propuesta) => (
              <div key={propuesta.id} className="rounded-xl border border-border px-2.5 py-2">
                <p className="truncate text-[10px] font-semibold text-text">{propuesta.alumno} · {propuesta.ejercicio}</p>
                <p className="mt-0.5 text-[9px] text-text-tertiary">Serie {propuesta.serie} · Activación automática</p>
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
