"use client";

import { useEffect, useState, useTransition } from "react";
import { Radio, UserRoundCheck } from "lucide-react";
import type { SolicitudAsistenciaEnVivo } from "@/lib/impulso-vip/asistencia-data";
import { consultarAsistenciasImpulso, responderAsistenciaImpulso } from "@/app/admin/alumnos/impulso-actions";

export function AsistenciaImpulsoEnVivo({ solicitudes }: { solicitudes: SolicitudAsistenciaEnVivo[] }) {
  const [actuales, setActuales] = useState(solicitudes);
  const [, iniciarConsulta] = useTransition();

  useEffect(() => {
    let activa = true;
    const consultar = () => {
      iniciarConsulta(async () => {
        const siguientes = await consultarAsistenciasImpulso().catch(() => null);
        if (activa && siguientes) setActuales(siguientes);
      });
    };
    const id = window.setInterval(consultar, 8_000);
    const alVolver = () => {
      if (!document.hidden) consultar();
    };
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      activa = false;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, []);

  if (actuales.length === 0) return null;

  return (
    <section className="admin-panel-card rounded-3xl border border-vip/25 p-4" aria-label="Alumnos entrenando ahora">
      <div className="mb-3 flex items-center gap-2">
        <span className="relative grid size-9 place-items-center rounded-xl bg-vip/15 text-vip">
          <Radio size={17} />
          <span className="absolute right-0 top-0 size-2 rounded-full bg-error ring-2 ring-surface" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-text">Te necesitan ahora</h2>
          <p className="text-[11px] text-text-tertiary">Solicitudes nacidas desde Impulso VIP</p>
        </div>
      </div>
      <div className="space-y-2">
        {actuales.map((solicitud) => (
          <article key={solicitud.id} className="rounded-2xl border border-border bg-surface-2 p-3">
            <p className="text-caption font-bold text-text">{solicitud.alumnoNombre}</p>
            <p className="mt-0.5 text-micro text-text-secondary">
              {solicitud.ejercicioNombre} · serie {solicitud.serieObjetivo}
            </p>
            {solicitud.estado === "voy" ? (
              <form action={responderAsistenciaImpulso} className="mt-2">
                <input type="hidden" name="solicitud_id" value={solicitud.id} />
                <button name="respuesta" value="atendida" className="flex min-h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-success/15 text-micro font-bold text-success">
                  <UserRoundCheck size={14} /> Ya lo atendí
                </button>
              </form>
            ) : (
              <form action={responderAsistenciaImpulso} className="mt-2 grid grid-cols-2 gap-2">
                <input type="hidden" name="solicitud_id" value={solicitud.id} />
                <button name="respuesta" value="voy" className="min-h-9 rounded-xl bg-vip text-micro font-black text-black">Voy para allá</button>
                <button name="respuesta" value="no_disponible" className="min-h-9 rounded-xl border border-border text-micro font-semibold text-text-secondary">No disponible</button>
              </form>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
