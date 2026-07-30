"use client";

import { useState } from "react";
import type { FilaRanking } from "@/lib/ranking/data";
import { BadgeRango, tamanoPorPosicion } from "./BadgeRango";
import { nombreAlumnoPublicado } from "@/lib/nombre";

/** Tabla pública con TODOS los alumnos — cualquiera la puede ver, no solo el
 * entrenador. Ordenada por rango/puntos acumulados históricos (quién va
 * primero en la competencia general, no solo esta semana): sin números de
 * puesto, el orden de la lista y la corona en el primero ya dicen quién es
 * quién. El propio siempre resaltado para encontrarse sin buscar, y el
 * nombre completo nunca se recorta por largo que sea. */
export function TablaGeneral({
  filas,
  alumnoId,
}: {
  filas: FilaRanking[];
  alumnoId: string;
}) {
  const [verTodos, setVerTodos] = useState(false);

  if (filas.length === 0) {
    return <p className="text-secondary text-text-tertiary">Todavía no hay alumnos en el ranking.</p>;
  }

  const ordenadas = [...filas].sort((a, b) => b.puntosAcumulados - a.puntosAcumulados);
  const visibles = verTodos ? ordenadas : ordenadas.slice(0, 7);

  return (
    <div>
      <div className="space-y-1">
      {visibles.map((fila, i) => {
        const esPropia = fila.alumnoId === alumnoId;
        const esPrimero = i === 0;
        const size = tamanoPorPosicion(i + 1, 44, 30);

        return (
          <div
            key={fila.alumnoId}
            className="radius-card flex items-center gap-3 px-3 py-2.5"
            style={{
              background: esPrimero
                ? `linear-gradient(90deg, ${fila.rango.color}2e, transparent)`
                : esPropia
                  ? "rgba(255,161,0,0.12)"
                  : "transparent",
              border: esPropia ? "1px solid var(--color-vip)" : "1px solid transparent",
            }}
          >
            <span className="text-caption w-6 shrink-0 text-center font-bold text-text-tertiary">
              #{i + 1}
            </span>
            <BadgeRango rango={fila.rango} size={size} destacado={esPrimero} />

            <div className="min-w-0 flex-1">
              <p className={`break-words font-semibold text-text ${esPrimero ? "text-h3" : "text-body"}`}>
                {nombreAlumnoPublicado(fila.nombre)}
                {esPrimero && " 👑"}
                {esPropia && <span className="font-normal text-text-tertiary"> (tú)</span>}
              </p>
              <p
                className="text-caption font-semibold uppercase tracking-wide"
                style={{ color: fila.rango.color }}
              >
                {fila.rango.nombre}
              </p>
            </div>

            <p
              className={`shrink-0 font-bold ${esPrimero ? "text-h3" : "text-body"}`}
              style={{ color: esPrimero ? fila.rango.color : "var(--color-text)" }}
            >
              {fila.puntosAcumulados.toLocaleString("es-CL")}
            </p>
          </div>
        );
      })}
      </div>
      {ordenadas.length > 7 && (
        <button
          type="button"
          onClick={() => setVerTodos((actual) => !actual)}
          className="radius-control mt-3 flex h-11 w-full items-center justify-center border border-border bg-surface-2 text-secondary font-semibold text-text"
        >
          {verTodos ? "Ver Top 7" : `Ver todos (${ordenadas.length})`}
        </button>
      )}
    </div>
  );
}
