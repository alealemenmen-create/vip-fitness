"use client";

import { useRef, useState } from "react";
import { Trophy, ChevronLeft, ChevronRight } from "lucide-react";
import type { FilaRanking } from "@/lib/ranking/data";
import { BadgeRango, tamanoPorPosicion } from "./BadgeRango";
import { nombreAlumnoPublicado } from "@/lib/nombre";

const POR_PAGINA = 3;

function colorPuesto(posicion: number): string {
  if (posicion === 1) return "var(--color-vip)";
  if (posicion === 2) return "#c0c4cc";
  if (posicion === 3) return "#c88a4a";
  return "var(--color-text-tertiary)";
}

/**
 * Top 10 de la semana en páginas de a 3 (3+3+3+1), como pidió el usuario: se
 * desliza de derecha a izquierda. El alumno logueado se marca aunque no esté
 * en el top.
 */
export function RankingSemanal({
  filas,
  alumnoId,
}: {
  filas: FilaRanking[];
  alumnoId: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pagina, setPagina] = useState(0);

  const top = filas.slice(0, 10);
  const paginas = Math.max(1, Math.ceil(top.length / POR_PAGINA));
  const propia = filas.find((f) => f.alumnoId === alumnoId);

  const irA = (n: number) => {
    const destino = Math.max(0, Math.min(paginas - 1, n));
    setPagina(destino);
    const el = scrollRef.current;
    if (el) el.scrollTo({ left: destino * el.clientWidth, behavior: "smooth" });
  };

  if (top.length === 0) {
    return (
      <p className="text-caption text-text-tertiary">
        Todavía no hay puntaje esta semana.
      </p>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center justify-between gap-1">
        <p className="text-caption flex items-center gap-1 font-semibold text-vip">
          <Trophy size={13} /> TOP SEMANAL
        </p>
        {paginas > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => irA(pagina - 1)}
              disabled={pagina === 0}
              aria-label="Anteriores"
              className="text-text-tertiary disabled:opacity-30"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => irA(pagina + 1)}
              disabled={pagina >= paginas - 1}
              aria-label="Siguientes"
              className="text-text-tertiary disabled:opacity-30"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          if (el.clientWidth > 0) setPagina(Math.round(el.scrollLeft / el.clientWidth));
        }}
        className="flex flex-1 snap-x snap-mandatory overflow-x-auto"
        style={{ scrollbarWidth: "none" }}
      >
        {Array.from({ length: paginas }, (_, p) => (
          <div key={p} className="w-full shrink-0 snap-start space-y-1.5 pr-0.5">
            {top.slice(p * POR_PAGINA, p * POR_PAGINA + POR_PAGINA).map((fila) => (
              <FilaTop key={fila.alumnoId} fila={fila} esPropia={fila.alumnoId === alumnoId} />
            ))}
          </div>
        ))}
      </div>

      {propia && propia.posicion > 10 && (
        <div className="mt-2 border-t border-border pt-2">
          <FilaTop fila={propia} esPropia />
        </div>
      )}

      {paginas > 1 && (
        <div className="mt-2 flex justify-center gap-1">
          {Array.from({ length: paginas }, (_, p) => (
            <span
              key={p}
              className="h-1 rounded-full transition-all duration-200"
              style={{
                width: p === pagina ? 12 : 4,
                background: p === pagina ? "var(--color-vip)" : "var(--color-border)",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilaTop({ fila, esPropia }: { fila: FilaRanking; esPropia: boolean }) {
  const esPrimero = fila.posicion === 1;
  // El podio se ve de un vistazo: el badge encoge según el puesto.
  const size = tamanoPorPosicion(fila.posicion, 44, 26);

  return (
    <div
      className="flex items-center gap-2 rounded-xl px-1.5 py-1"
      style={{
        background: esPrimero
          ? `linear-gradient(90deg, ${fila.rango.color}2e, transparent)`
          : esPropia
            ? "color-mix(in srgb, var(--color-vip) 12%, transparent)"
            : "transparent",
      }}
    >
      <BadgeRango rango={fila.rango} size={size} destacado={esPrimero} />

      <div className="min-w-0 flex-1">
        {/* Nombre completo siempre, aunque sea largo: sin recorte, puede
            partir en dos líneas para que se sepa exactamente quién es. */}
        <p
          className={`break-words leading-tight font-semibold text-text ${esPrimero ? "text-secondary" : "text-caption"}`}
        >
          {nombreAlumnoPublicado(fila.nombre)}
          {esPrimero && " 👑"}
        </p>
        <p
          className="text-caption font-bold leading-tight"
          style={{ color: colorPuesto(fila.posicion) }}
        >
          {fila.puntos.toLocaleString("es-CL")}
        </p>
      </div>
    </div>
  );
}
