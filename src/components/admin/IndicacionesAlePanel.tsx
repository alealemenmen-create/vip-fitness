"use client";

import { useActionState, useMemo, useState } from "react";
import { Check, Radio, Send, Trash2 } from "lucide-react";
import { cancelarIndicacionAle, crearIndicacionAle } from "@/app/admin/alumnos/impulso-actions";
import type { IndicacionAlePendiente, ObjetivoIndicacionAle } from "@/lib/impulso-vip/manual-data";

const INICIAL = { error: null, ok: false, entrega: null } as const;
const TECNICAS = [
  ["cierre_controlado", "Cierre controlado"],
  ["repeticion_objetivo", "Una repetición más"],
  ["tempo_controlado", "Bajada lenta"],
  ["pausa_isometrica", "Pausa isométrica"],
  ["serie_descarga", "Serie de descarga"],
  ["drop_set", "Drop set"],
  ["rest_pause", "Rest-pause"],
  ["fallo_controlado", "Fallo técnico"],
] as const;

export function IndicacionesAlePanel({
  alumnoId,
  objetivos,
  pendientes,
}: {
  alumnoId: string;
  objetivos: ObjetivoIndicacionAle[];
  pendientes: IndicacionAlePendiente[];
}) {
  const [state, action, pending] = useActionState(crearIndicacionAle, INICIAL);
  const [objetivoId, setObjetivoId] = useState(objetivos[0]?.diaEjercicioId ?? "");
  const objetivo = useMemo(() => objetivos.find((fila) => fila.diaEjercicioId === objetivoId) ?? null, [objetivos, objetivoId]);
  const [modo, setModo] = useState<"programada" | "en_vivo">("programada");
  const dias = useMemo(() => {
    const mapa = new Map<string, ObjetivoIndicacionAle[]>();
    for (const fila of objetivos) mapa.set(fila.dia, [...(mapa.get(fila.dia) ?? []), fila]);
    return [...mapa.entries()];
  }, [objetivos]);

  if (objetivos.length === 0) return null;
  return (
    <section className="overflow-hidden rounded-3xl border border-vip/30 bg-gradient-to-br from-vip/10 via-surface to-surface p-4">
      <div className="flex items-start gap-2">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-vip text-black"><Send size={16} /></span>
        <div>
          <h2 className="text-sm font-semibold text-text">Indicación personal de Ale</h2>
          <p className="mt-0.5 text-[11px] leading-snug text-text-tertiary">Déjala lista para la próxima sesión o envíala mientras el alumno entrena.</p>
        </div>
      </div>

      <form action={action} className="mt-4 space-y-3">
        <input type="hidden" name="alumno_id" value={alumnoId} />
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setModo("programada")} className={`min-h-10 rounded-xl border px-2 text-xs font-semibold ${modo === "programada" ? "border-vip/50 bg-vip/15 text-vip" : "border-border text-text-secondary"}`}>Próxima sesión</button>
          <button type="button" onClick={() => setModo("en_vivo")} className={`flex min-h-10 items-center justify-center gap-1.5 rounded-xl border px-2 text-xs font-semibold ${modo === "en_vivo" ? "border-success/50 bg-success/10 text-success" : "border-border text-text-secondary"}`}><Radio size={13} /> En vivo</button>
        </div>
        <input type="hidden" name="modo" value={modo} />
        {modo === "en_vivo" && !objetivo?.sesionEjercicioId && (
          <p className="rounded-xl border border-warning/25 bg-warning/10 px-3 py-2 text-[10px] text-warning">Este ejercicio no está en la sesión activa. Elige uno marcado “EN VIVO” o prepáralo para la próxima sesión.</p>
        )}
        <label className="block text-[11px] font-semibold text-text-secondary">
          Ejercicio
          <select name="dia_ejercicio_id" value={objetivoId} onChange={(e) => setObjetivoId(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-xs text-text">
            {dias.map(([dia, filas]) => <optgroup key={dia} label={dia}>{filas.map((fila) => <option key={fila.diaEjercicioId} value={fila.diaEjercicioId}>{fila.ejercicio}{fila.sesionEjercicioId ? " · EN VIVO" : ""}</option>)}</optgroup>)}
          </select>
        </label>
        <div className="grid grid-cols-[90px_minmax(0,1fr)] gap-2">
          <label className="text-[11px] font-semibold text-text-secondary">Serie
            <select name="serie_objetivo" className="mt-1 w-full rounded-xl border border-border bg-surface-2 px-2 py-2.5 text-xs text-text">
              {Array.from({ length: objetivo?.series ?? 1 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
            </select>
          </label>
          <label className="text-[11px] font-semibold text-text-secondary">Qué debe hacer
            <select name="tipo" className="mt-1 w-full rounded-xl border border-border bg-surface-2 px-2 py-2.5 text-xs text-text">
              {TECNICAS.map(([valor, etiqueta]) => <option key={valor} value={valor}>{etiqueta}</option>)}
            </select>
          </label>
        </div>
        <label className="block text-[11px] font-semibold text-text-secondary">Mensaje exacto de Ale
          <textarea name="instruccion" required minLength={3} maxLength={320} rows={3} placeholder="Ej.: En la última serie quiero una bajada de 3 segundos. Pecho arriba, controla todo el recorrido." className="mt-1 w-full resize-none rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-xs leading-relaxed text-text outline-none focus:border-vip/60" />
        </label>
        {state.error && <p className="text-[11px] font-semibold text-error">{state.error}</p>}
        {state.ok && <p className="flex items-center gap-1 text-[11px] font-semibold text-success"><Check size={13} /> {state.entrega === "en_vivo" ? "Indicación enviada a la sesión activa." : "Indicación preparada para la próxima sesión."}</p>}
        <button type="submit" disabled={pending || (modo === "en_vivo" && !objetivo?.sesionEjercicioId)} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-vip px-3 text-xs font-bold text-black disabled:opacity-45">
          <Send size={14} /> {pending ? "Guardando..." : modo === "en_vivo" ? "Enviar ahora" : "Dejar preparada"}
        </button>
      </form>

      {pendientes.length > 0 && <div className="mt-4 border-t border-border pt-3">
        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.12em] text-text-tertiary">Preparadas</p>
        <div className="space-y-2">{pendientes.map((fila) => <article key={fila.id} className="flex items-start gap-2 rounded-xl border border-border bg-surface-2 p-2.5">
          <div className="min-w-0 flex-1"><p className="truncate text-[11px] font-bold text-text">{fila.objetivo} · Serie {fila.serie}</p><p className="mt-0.5 line-clamp-2 text-[10px] text-text-tertiary">{fila.instruccion}</p></div>
          <form action={cancelarIndicacionAle}><input type="hidden" name="indicacion_id" value={fila.id} /><input type="hidden" name="alumno_id" value={alumnoId} /><button type="submit" aria-label="Cancelar indicación" className="grid size-8 place-items-center rounded-lg text-error"><Trash2 size={14} /></button></form>
        </article>)}</div>
      </div>}
    </section>
  );
}
