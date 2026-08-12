"use client";

import { useActionState, useState } from "react";
import Image from "next/image";
import { createPortal } from "react-dom";
import { Bug, Check, RotateCcw, X, Smartphone } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import {
  cambiarEstadoReporteBug,
  type ResolverReporteState,
} from "@/app/admin/reportes/actions";

export type ReporteBug = {
  id: string;
  alumnoNombre: string;
  ruta: string;
  descripcion: string;
  capturaUrl: string | null;
  dispositivo: string | null;
  estado: "pendiente" | "resuelto";
  creadoEn: string;
};

const estadoInicial: ResolverReporteState = { error: null, ok: false };

export function ListaReportesBugs({
  reportes,
  pendientes,
}: {
  reportes: ReporteBug[];
  pendientes: number;
}) {
  // Por defecto solo lo que falta atender: con el tiempo, los resueltos son
  // la mayoría y enterrarían lo que importa (misma lección que el panel de
  // auditoría, ver AuditoriaHallazgos).
  const [verResueltos, setVerResueltos] = useState(false);
  const visibles = verResueltos ? reportes : reportes.filter((r) => r.estado === "pendiente");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-caption text-text-secondary">
          {pendientes === 0
            ? "Sin reportes pendientes."
            : `${pendientes} ${pendientes === 1 ? "reporte pendiente" : "reportes pendientes"}`}
        </p>
        <button
          type="button"
          onClick={() => setVerResueltos((v) => !v)}
          className="text-caption font-semibold text-vip"
        >
          {verResueltos ? "Ver solo pendientes" : `Ver todos (${reportes.length})`}
        </button>
      </div>

      {visibles.length === 0 ? (
        <Card padding="p-4">
          <p className="text-caption text-text-secondary">
            Nada pendiente. Toca “Ver todos” para revisar el historial.
          </p>
        </Card>
      ) : (
        visibles.map((reporte) => <FilaReporte key={reporte.id} reporte={reporte} />)
      )}
    </div>
  );
}

function FilaReporte({ reporte }: { reporte: ReporteBug }) {
  const [estado, accion, enviando] = useActionState(cambiarEstadoReporteBug, estadoInicial);
  const [ampliada, setAmpliada] = useState(false);
  const resuelto = reporte.estado === "resuelto";

  return (
    <Card padding="p-4" className={resuelto ? "opacity-70" : ""}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <span
            className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
              resuelto ? "bg-success/15 text-success" : "bg-error/15 text-error"
            }`}
          >
            {resuelto ? <Check size={16} /> : <Bug size={16} />}
          </span>
          <div className="min-w-0">
            <p className="text-secondary font-semibold text-text">{reporte.alumnoNombre}</p>
            <p className="text-micro text-text-tertiary">
              {new Date(reporte.creadoEn).toLocaleString("es-CL")}
            </p>
          </div>
        </div>
        <Pill tone={resuelto ? "success" : "error"}>{resuelto ? "Resuelto" : "Pendiente"}</Pill>
      </div>

      <p className="text-secondary mt-2 leading-relaxed text-text">{reporte.descripcion}</p>

      <p className="text-micro mt-2 break-all text-text-tertiary">
        Pantalla: <span className="font-mono">{reporte.ruta}</span>
      </p>
      {reporte.dispositivo && (
        <p className="text-micro mt-1 flex items-start gap-1 break-all text-text-tertiary">
          <Smartphone size={11} className="mt-0.5 shrink-0" />
          {reporte.dispositivo}
        </p>
      )}

      {reporte.capturaUrl && (
        <button
          type="button"
          onClick={() => setAmpliada(true)}
          className="radius-control relative mt-3 block h-40 w-full overflow-hidden border border-border bg-surface-2"
          aria-label="Ver la captura en grande"
        >
          <Image
            src={reporte.capturaUrl}
            alt={`Captura del reporte de ${reporte.alumnoNombre}`}
            fill
            sizes="(max-width: 640px) 100vw, 400px"
            className="object-contain object-top"
            unoptimized
          />
        </button>
      )}

      {estado.error && <p className="text-caption mt-2 text-error">{estado.error}</p>}

      <form action={accion} className="mt-3">
        <input type="hidden" name="id" value={reporte.id} />
        <input type="hidden" name="estado" value={resuelto ? "pendiente" : "resuelto"} />
        <button
          type="submit"
          disabled={enviando}
          className={`radius-control flex h-10 w-full items-center justify-center gap-1.5 text-caption font-bold disabled:opacity-60 ${
            resuelto ? "border border-border text-text-secondary" : "bg-success text-white"
          }`}
        >
          {resuelto ? <RotateCcw size={14} /> : <Check size={15} />}
          {enviando ? "Guardando…" : resuelto ? "Reabrir" : "Marcar resuelto"}
        </button>
      </form>

      {ampliada &&
        reporte.capturaUrl &&
        createPortal(
          <div
            role="dialog"
            aria-label="Captura del reporte"
            onClick={() => setAmpliada(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          >
            <div className="relative h-[85vh] w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
              <Image
                src={reporte.capturaUrl}
                alt={`Captura del reporte de ${reporte.alumnoNombre}`}
                fill
                sizes="90vw"
                className="rounded-xl object-contain"
                unoptimized
              />
            </div>
            <button
              type="button"
              onClick={() => setAmpliada(false)}
              aria-label="Cerrar"
              className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white"
            >
              <X size={18} />
            </button>
          </div>,
          document.body
        )}
    </Card>
  );
}
