"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Users, LayoutList, AlertTriangle, Star, Diamond, Search } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { TarjetaReporteAlumno } from "./TarjetaReporteAlumno";
import type { ReporteAlumno } from "@/app/admin/alumnos/data";

const CONFIG = {
  atencion: { Icon: AlertTriangle, color: "var(--color-error)" },
  normal: { Icon: Diamond, color: "var(--color-text-tertiary)" },
  destacado: { Icon: Star, color: "var(--color-vip)" },
} as const;

/**
 * Lista de alumnos con dos vistas: la "detallada" (tarjetas grandes con todo
 * el reporte) y una "compacta" (una fila chica por alumno, sin scrollear
 * tanto para verlos a todos de un vistazo) — el usuario pidió esta segunda
 * porque con muchos alumnos la vista detallada obliga a desplazar mucho.
 */
export function ListaAlumnos({
  reportes,
  sesionUserId,
}: {
  reportes: ReporteAlumno[];
  sesionUserId: string;
}) {
  const [vista, setVista] = useState<"compacta" | "detallada">("compacta");
  const [busqueda, setBusqueda] = useState("");

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return reportes;
    return reportes.filter((r) => r.nombre.toLowerCase().includes(q));
  }, [reportes, busqueda]);

  if (reportes.length === 0) {
    return (
      <Card>
        <p className="text-body text-text-secondary">Todavía no hay alumnos registrados.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search
          size={12}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary"
        />
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar alumno..."
          className="radius-control text-caption w-full border border-border bg-surface py-1.5 pl-7 pr-3 text-text"
        />
      </div>

      <div className="radius-control flex gap-1 bg-surface-2 p-0.5">
        <button
          type="button"
          onClick={() => setVista("compacta")}
          aria-label="Vista compacta"
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-caption font-medium transition-colors duration-200 ${
            vista === "compacta" ? "bg-vip text-black" : "text-text-secondary"
          }`}
        >
          <Users size={12} /> Compacta
        </button>
        <button
          type="button"
          onClick={() => setVista("detallada")}
          aria-label="Vista detallada"
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-caption font-medium transition-colors duration-200 ${
            vista === "detallada" ? "bg-vip text-black" : "text-text-secondary"
          }`}
        >
          <LayoutList size={12} /> Detallada
        </button>
      </div>

      {filtrados.length === 0 ? (
        <Card>
          <p className="text-body text-text-secondary">Ningún alumno coincide con la búsqueda.</p>
        </Card>
      ) : vista === "compacta" ? (
        <Card padding="p-0" className="divide-y divide-border overflow-hidden">
          <div className="grid grid-cols-[1fr_28px] items-stretch bg-surface-2">
            <span className="px-2.5 py-1 text-[10px] font-semibold tracking-wide text-text-tertiary">
              ALUMNO
            </span>
            <span className="border-l border-border" />
          </div>
          {filtrados.map((r) => {
            const { Icon, color } = CONFIG[r.estado];
            return (
              <Link
                key={r.alumnoId}
                href={`/admin/alumnos/${r.alumnoId}`}
                className="grid grid-cols-[1fr_28px] items-stretch active:bg-surface-2"
              >
                <span className="truncate px-2.5 py-1.5 text-caption text-text">
                  {r.nombre}
                  {r.alumnoId === sesionUserId && (
                    <span className="text-text-tertiary"> (Tú)</span>
                  )}
                </span>
                <span
                  style={{ color }}
                  className="flex items-center justify-center border-l border-border"
                >
                  <Icon size={12} strokeWidth={2.5} />
                </span>
              </Link>
            );
          })}
        </Card>
      ) : (
        <div className="space-y-4">
          {filtrados.map((reporte) => (
            <TarjetaReporteAlumno
              key={reporte.alumnoId}
              reporte={reporte}
              esTuPerfil={reporte.alumnoId === sesionUserId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
