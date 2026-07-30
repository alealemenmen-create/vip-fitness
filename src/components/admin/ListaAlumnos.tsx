"use client";

import { useState } from "react";
import Link from "next/link";
import { Users, LayoutList, ChevronRight, AlertTriangle, Star, Diamond } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { TarjetaReporteAlumno } from "./TarjetaReporteAlumno";
import type { ReporteAlumno } from "@/app/admin/alumnos/data";

const CONFIG = {
  atencion: { Icon: AlertTriangle, color: "var(--color-error)" },
  normal: { Icon: Diamond, color: "var(--color-text-secondary)" },
  destacado: { Icon: Star, color: "var(--color-vip)" },
} as const;

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase();
}

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

  if (reportes.length === 0) {
    return (
      <Card>
        <p className="text-body text-text-secondary">Todavía no hay alumnos registrados.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="radius-control flex gap-1 bg-surface-2 p-1">
        <button
          type="button"
          onClick={() => setVista("compacta")}
          aria-label="Vista compacta"
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-secondary font-medium transition-colors duration-200 ${
            vista === "compacta" ? "bg-vip text-black" : "text-text-secondary"
          }`}
        >
          <Users size={16} /> Compacta
        </button>
        <button
          type="button"
          onClick={() => setVista("detallada")}
          aria-label="Vista detallada"
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-secondary font-medium transition-colors duration-200 ${
            vista === "detallada" ? "bg-vip text-black" : "text-text-secondary"
          }`}
        >
          <LayoutList size={16} /> Detallada
        </button>
      </div>

      {vista === "compacta" ? (
        <Card className="space-y-1 p-2">
          {reportes.map((r) => {
            const { Icon, color } = CONFIG[r.estado];
            return (
              <Link
                key={r.alumnoId}
                href={`/admin/alumnos/${r.alumnoId}`}
                className="flex items-center gap-3 rounded-xl px-2 py-2.5"
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-caption font-bold text-text"
                >
                  {iniciales(r.nombre)}
                </span>
                <p className="min-w-0 flex-1 truncate text-secondary font-medium text-text">
                  {r.nombre}
                  {r.alumnoId === sesionUserId && (
                    <span className="font-normal text-text-tertiary"> (Tú)</span>
                  )}
                </p>
                <span style={{ color }} className="shrink-0">
                  <Icon size={16} strokeWidth={2.25} />
                </span>
                <ChevronRight size={16} className="shrink-0 text-text-tertiary" />
              </Link>
            );
          })}
        </Card>
      ) : (
        <div className="space-y-4">
          {reportes.map((reporte) => (
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
