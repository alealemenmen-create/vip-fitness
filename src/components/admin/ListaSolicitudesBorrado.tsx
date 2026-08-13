"use client";

import { useActionState, useState } from "react";
import { Trash2, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import {
  aprobarBorradoSesion,
  rechazarBorradoSesion,
  type ResolverBorradoState,
} from "@/app/admin/borrados/actions";

export type SolicitudBorrado = {
  id: string;
  alumnoNombre: string;
  diaNombre: string;
  fechaSesion: string | null;
  numeroCalendario: number | null;
  motivo: string;
  estado: "pendiente" | "borrada" | "rechazada";
  creadoEn: string;
  sesionExiste: boolean;
};

const estadoInicial: ResolverBorradoState = { error: null, ok: false };

const ETIQUETA_ESTADO = {
  pendiente: { texto: "Pendiente", tone: "vip" as const },
  borrada: { texto: "Borrada", tone: "neutral" as const },
  rechazada: { texto: "Rechazada", tone: "neutral" as const },
};

/** Aprobar borra de verdad y no se puede deshacer, así que va con
 * confirmación en dos pasos dentro de la misma tarjeta — un modal más, encima
 * de una lista, se vuelve un toque automático. */
function AccionesSolicitud({ id }: { id: string }) {
  const [confirmando, setConfirmando] = useState(false);
  const [estadoAprobar, aprobar, aprobando] = useActionState(aprobarBorradoSesion, estadoInicial);
  const [estadoRechazar, rechazar, rechazando] = useActionState(rechazarBorradoSesion, estadoInicial);
  const error = estadoAprobar.error ?? estadoRechazar.error;

  return (
    <div className="space-y-1.5">
      {confirmando ? (
        <form action={aprobar} className="space-y-1.5">
          <input type="hidden" name="id" value={id} />
          <p className="text-micro text-error">
            Se borran los kilos, las repeticiones y los Puntos VIP de esa sesión. No se puede
            deshacer.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              className="radius-control h-9 border border-border text-caption font-semibold text-text"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={aprobando}
              className="radius-control h-9 border border-error text-caption font-bold text-error disabled:opacity-50"
            >
              {aprobando ? "Borrando…" : "Sí, borrar"}
            </button>
          </div>
        </form>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <form action={rechazar}>
            <input type="hidden" name="id" value={id} />
            <button
              type="submit"
              disabled={rechazando}
              className="radius-control flex h-9 w-full items-center justify-center gap-1.5 border border-border text-caption font-semibold text-text-secondary disabled:opacity-50"
            >
              <X size={14} /> {rechazando ? "…" : "Rechazar"}
            </button>
          </form>
          <button
            type="button"
            onClick={() => setConfirmando(true)}
            className="radius-control flex h-9 w-full items-center justify-center gap-1.5 border border-error text-caption font-semibold text-error"
          >
            <Trash2 size={14} /> Borrar
          </button>
        </div>
      )}
      {error && <p className="text-micro text-error">{error}</p>}
    </div>
  );
}

export function ListaSolicitudesBorrado({
  solicitudes,
  pendientes,
}: {
  solicitudes: SolicitudBorrado[];
  pendientes: number;
}) {
  // Por defecto solo lo que falta atender: con el tiempo las resueltas son la
  // mayoría y enterrarían lo que importa (mismo criterio que el panel de
  // errores reportados).
  const [verResueltas, setVerResueltas] = useState(false);
  const visibles = verResueltas ? solicitudes : solicitudes.filter((s) => s.estado === "pendiente");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-caption text-text-secondary">
          {pendientes === 0
            ? "Sin pedidos pendientes."
            : `${pendientes} ${pendientes === 1 ? "pedido pendiente" : "pedidos pendientes"}`}
        </p>
        <button
          type="button"
          onClick={() => setVerResueltas((v) => !v)}
          className="text-caption font-semibold text-vip"
        >
          {verResueltas ? "Ver solo pendientes" : `Ver todos (${solicitudes.length})`}
        </button>
      </div>

      {visibles.length === 0 ? (
        <Card padding="p-4">
          <p className="text-caption text-text-secondary">
            Nada pendiente. Toca “Ver todos” para revisar el historial.
          </p>
        </Card>
      ) : (
        visibles.map((s) => {
          const etiqueta = ETIQUETA_ESTADO[s.estado];
          return (
            <Card key={s.id} padding="p-3" className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-body font-semibold text-text">{s.alumnoNombre}</p>
                  <p className="text-caption text-text-secondary">
                    {s.numeroCalendario ? `Sesión ${s.numeroCalendario} · ` : ""}
                    {s.diaNombre}
                    {s.fechaSesion ? ` · ${s.fechaSesion}` : ""}
                  </p>
                </div>
                <Pill tone={etiqueta.tone}>{etiqueta.texto}</Pill>
              </div>

              <p className="text-caption text-text">“{s.motivo}”</p>

              {s.estado === "pendiente" &&
                (s.sesionExiste ? (
                  <AccionesSolicitud id={s.id} />
                ) : (
                  <p className="text-micro text-text-tertiary">
                    El registro ya no existe. Puedes rechazar el pedido para sacarlo de la lista.
                  </p>
                ))}
            </Card>
          );
        })
      )}
    </div>
  );
}
