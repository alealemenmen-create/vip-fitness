"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Dumbbell,
  LayoutList,
  Search,
  Star,
  Users,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { TarjetaReporteAlumno } from "./TarjetaReporteAlumno";
import type { ReporteAlumno } from "@/app/admin/alumnos/data";

export type FiltroAlumnos = "todos" | "sin_rutina" | "seguimiento" | "al_dia" | "destacados";

const SIN_RUTINA = "Sin rutina activa asignada";

function pertenece(reporte: ReporteAlumno, filtro: FiltroAlumnos): boolean {
  if (filtro === "todos") return true;
  if (filtro === "sin_rutina") return reporte.motivo === SIN_RUTINA;
  if (filtro === "seguimiento") return reporte.estado === "atencion" && reporte.motivo !== SIN_RUTINA;
  if (filtro === "al_dia") return reporte.estado === "normal";
  return reporte.estado === "destacado";
}

function estadoVisual(reporte: ReporteAlumno) {
  if (reporte.motivo === SIN_RUTINA) {
    return { etiqueta: "Sin rutina", clase: "border-error/25 bg-error/10 text-error", Icon: Dumbbell };
  }
  if (reporte.estado === "atencion") {
    return { etiqueta: "Revisar", clase: "border-vip/25 bg-vip/10 text-vip", Icon: AlertTriangle };
  }
  if (reporte.estado === "destacado") {
    return { etiqueta: "Destacado", clase: "border-vip/25 bg-vip/10 text-vip", Icon: Star };
  }
  return { etiqueta: "Al día", clase: "border-success/25 bg-success/10 text-success", Icon: CircleCheck };
}

export function ListaAlumnos({
  reportes,
  sesionUserId,
  filtroInicial = "todos",
}: {
  reportes: ReporteAlumno[];
  sesionUserId: string;
  filtroInicial?: FiltroAlumnos;
}) {
  const [vista, setVista] = useState<"compacta" | "detallada">("compacta");
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<FiltroAlumnos>(filtroInicial);
  const [pagina, setPagina] = useState(1);

  const conteos = useMemo(
    () => ({
      todos: reportes.length,
      sin_rutina: reportes.filter((r) => pertenece(r, "sin_rutina")).length,
      seguimiento: reportes.filter((r) => pertenece(r, "seguimiento")).length,
      al_dia: reportes.filter((r) => pertenece(r, "al_dia")).length,
      destacados: reportes.filter((r) => pertenece(r, "destacados")).length,
    }),
    [reportes]
  );

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLocaleLowerCase("es");
    return reportes.filter(
      (reporte) =>
        pertenece(reporte, filtro) &&
        (!q ||
          reporte.nombre.toLocaleLowerCase("es").includes(q) ||
          reporte.objetivo?.toLocaleLowerCase("es").includes(q))
    );
  }, [reportes, busqueda, filtro]);

  const porPagina = vista === "compacta" ? 16 : 8;
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / porPagina));
  const paginaActual = Math.min(pagina, totalPaginas);
  const visibles = filtrados.slice((paginaActual - 1) * porPagina, paginaActual * porPagina);

  const cambiarFiltro = (nuevo: FiltroAlumnos) => {
    setFiltro(nuevo);
    setPagina(1);
  };

  if (reportes.length === 0) {
    return (
      <Card>
        <p className="text-body text-text-secondary">Todavía no hay alumnos registrados.</p>
      </Card>
    );
  }

  const filtros: { id: FiltroAlumnos; etiqueta: string; Icon: typeof Users; activo: string; icono: string }[] = [
    { id: "todos", etiqueta: "Todos", Icon: Users, activo: "border-[#3b82f6] bg-[#3b82f6] text-white", icono: "text-[#3b82f6]" },
    { id: "sin_rutina", etiqueta: "Sin rutina", Icon: Dumbbell, activo: "border-[#ef4444] bg-[#ef4444] text-white", icono: "text-[#ef4444]" },
    { id: "seguimiento", etiqueta: "Por revisar", Icon: AlertTriangle, activo: "border-[#f59e0b] bg-[#f59e0b] text-black", icono: "text-[#f59e0b]" },
    { id: "al_dia", etiqueta: "Al día", Icon: CircleCheck, activo: "border-[#22c55e] bg-[#22c55e] text-black", icono: "text-[#22c55e]" },
    { id: "destacados", etiqueta: "Destacados", Icon: Star, activo: "border-[#a78bfa] bg-[#a78bfa] text-black", icono: "text-[#a78bfa]" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {filtros.map(({ id, etiqueta, Icon, activo: claseActiva, icono }) => {
          const activo = filtro === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => cambiarFiltro(id)}
              className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${
                activo
                  ? claseActiva
                  : "border-border bg-surface-2 text-text-secondary hover:border-vip/40"
              }`}
            >
              <Icon size={13} className={activo ? "" : icono} />
              {etiqueta}
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${activo ? "bg-black/15" : "bg-surface"}`}>
                {conteos[id]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_220px]">
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-tertiary"
          />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setPagina(1);
            }}
            placeholder="Buscar por nombre u objetivo..."
            className="radius-control h-11 w-full border border-border bg-surface-2 pl-10 pr-3 text-sm text-text outline-none transition-colors focus:border-vip/60"
          />
        </div>

        <div className="radius-control flex h-11 gap-1 border border-border bg-surface-2 p-1">
          <button
            type="button"
            onClick={() => {
              setVista("compacta");
              setPagina(1);
            }}
            aria-label="Vista compacta"
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl text-xs font-medium transition-colors ${
              vista === "compacta" ? "bg-vip text-black" : "text-text-secondary"
            }`}
          >
            <Users size={13} /> Lista
          </button>
          <button
            type="button"
            onClick={() => {
              setVista("detallada");
              setPagina(1);
            }}
            aria-label="Vista detallada"
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl text-xs font-medium transition-colors ${
              vista === "detallada" ? "bg-vip text-black" : "text-text-secondary"
            }`}
          >
            <LayoutList size={13} /> Detalle
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-text-tertiary">
          Mostrando <span className="font-semibold text-text">{visibles.length}</span> de {filtrados.length}
        </p>
        {filtro !== "todos" && (
          <button type="button" onClick={() => cambiarFiltro("todos")} className="text-xs font-medium text-vip">
            Limpiar filtro
          </button>
        )}
      </div>

      {visibles.length === 0 ? (
        <Card padding="p-5" className="border border-border text-center">
          <p className="text-sm font-medium text-text">No hay alumnos en esta categoría</p>
          <p className="mt-1 text-xs text-text-tertiary">Prueba otro filtro o cambia la búsqueda.</p>
        </Card>
      ) : vista === "compacta" ? (
        <Card padding="p-0" className="overflow-hidden border border-border">
          <div className="hidden grid-cols-[minmax(180px,1fr)_minmax(220px,1.35fr)_150px_24px] gap-4 border-b border-border bg-surface-2/60 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-text-tertiary md:grid">
            <span>Alumno</span>
            <span>Situación</span>
            <span>Actividad</span>
            <span />
          </div>
          <div className="divide-y divide-border">
            {visibles.map((reporte) => {
              const visual = estadoVisual(reporte);
              return (
                <Link
                  key={reporte.alumnoId}
                  href={`/admin/alumnos/${reporte.alumnoId}`}
                  className="group grid gap-2 px-4 py-3.5 transition-colors hover:bg-surface-2 md:grid-cols-[minmax(180px,1fr)_minmax(220px,1.35fr)_150px_24px] md:items-center md:gap-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-vip/10 text-xs font-bold text-vip">
                      {reporte.nombre.trim().charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-text">
                        {reporte.nombre}
                        {reporte.alumnoId === sesionUserId && <span className="font-normal text-text-tertiary"> (Tú)</span>}
                      </span>
                      <span className="block truncate text-[11px] text-text-tertiary">
                        {reporte.objetivo || "Objetivo todavía no definido"}
                      </span>
                    </span>
                  </div>

                  <div className="min-w-0 md:flex md:items-center md:gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold ${visual.clase}`}>
                      <visual.Icon size={11} /> {visual.etiqueta}
                    </span>
                    <p className="mt-1 truncate text-xs text-text-secondary md:mt-0">{reporte.motivo}</p>
                  </div>

                  <div className="flex items-center justify-between gap-3 text-xs md:block">
                    <span className="text-text-secondary">
                      {reporte.diasSinEntrenar === null
                        ? "Sin entrenamientos"
                        : reporte.diasSinEntrenar === 0
                          ? "Entrenó hoy"
                          : `Último: hace ${reporte.diasSinEntrenar} d`}
                    </span>
                    <span className="text-text-tertiary md:block">{reporte.pctSesiones}% del mes</span>
                  </div>
                  <ChevronRight size={16} className="hidden text-text-tertiary transition-transform group-hover:translate-x-0.5 md:block" />
                </Link>
              );
            })}
          </div>
        </Card>
      ) : (
        <div className="grid items-start gap-4 xl:grid-cols-2">
          {visibles.map((reporte) => (
            <TarjetaReporteAlumno
              key={reporte.alumnoId}
              reporte={reporte}
              esTuPerfil={reporte.alumnoId === sesionUserId}
            />
          ))}
        </div>
      )}

      {totalPaginas > 1 && (
        <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
          <button
            type="button"
            disabled={paginaActual === 1}
            onClick={() => setPagina((actual) => Math.max(1, actual - 1))}
            className="flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-text-secondary disabled:opacity-35"
          >
            <ChevronLeft size={14} /> Anterior
          </button>
          <span className="text-xs text-text-tertiary">
            Página <strong className="text-text">{paginaActual}</strong> de {totalPaginas}
          </span>
          <button
            type="button"
            disabled={paginaActual === totalPaginas}
            onClick={() => setPagina((actual) => Math.min(totalPaginas, actual + 1))}
            className="flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-text-secondary disabled:opacity-35"
          >
            Siguiente <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
