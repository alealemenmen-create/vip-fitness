"use client";

import { useEffect, useRef, useState } from "react";
import { formatFechaCorta } from "@/lib/date";
import type { PuntoProgreso } from "@/app/alumno/inicio/data";

const ALTO = 84;
const BASE = 62; // línea de reposo del "electro"
const AMPLITUD_MAX = 48; // altura del pico al 100%
const PASO = 40; // px por sesión
const MARGEN = 20;

/** Un hueco mayor a esto entre dos sesiones cuenta como días saltados y
 * pinta el tramo en rojo aunque el % de ese día haya sido bueno. */
const DIAS_HUECO_ACEPTABLE = 2;

const VERDE = "var(--color-success)";
const ROJO = "var(--color-error)";

/** Sube (verde) si mantuvo o mejoró el cumplimiento y no dejó pasar días de
 * más; baja (rojo) si bajó el % o si saltó días. El primer punto no tiene
 * con qué compararse: se juzga solo por su propio %. */
function subeElPunto(punto: PuntoProgreso, anterior: PuntoProgreso | undefined): boolean {
  if (punto.diasDesdeAnterior != null && punto.diasDesdeAnterior > DIAS_HUECO_ACEPTABLE) return false;
  if (!anterior) return punto.pct >= 70;
  return punto.pct >= anterior.pct;
}

/** Trazo de un latido centrado en `x`: reposo, pequeño valle, pico
 * proporcional al %, rebote y vuelta al reposo. */
function latido(x: number, pct: number): string {
  const alturaPico = (Math.max(0, Math.min(100, pct)) / 100) * AMPLITUD_MAX;
  const y = BASE - Math.max(alturaPico, 4);
  return [
    `M ${x - 16} ${BASE}`,
    `L ${x - 10} ${BASE}`,
    `L ${x - 7} ${BASE + 5}`,
    `L ${x - 2.5} ${y}`,
    `L ${x + 3} ${BASE + 4}`,
    `L ${x + 8} ${BASE}`,
    `L ${x + 16} ${BASE}`,
  ].join(" ");
}

export function GraficaProgresoECG({ puntos }: { puntos: PuntoProgreso[] }) {
  const [seleccionado, setSeleccionado] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Arranca mostrando lo más reciente (extremo derecho).
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [puntos.length]);

  if (puntos.length === 0) {
    return (
      <p className="text-secondary text-text-tertiary">
        Todavía no hay entrenamientos finalizados. Cuando termines el primero, aquí vas a ver tu
        constancia.
      </p>
    );
  }

  const ancho = puntos.length * PASO + MARGEN * 2;
  const x = (i: number) => MARGEN + i * PASO + PASO / 2;
  const detalle = seleccionado != null ? puntos[seleccionado] : puntos[puntos.length - 1];
  const detalleIndice = seleccionado ?? puntos.length - 1;

  return (
    <div>
      <div
        ref={scrollRef}
        className="radius-card overflow-x-auto border border-border bg-black"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <svg width={ancho} height={ALTO} viewBox={`0 0 ${ancho} ${ALTO}`} className="block">
          {/* Retícula tenue estilo monitor */}
          {[0.25, 0.5, 0.75].map((f) => (
            <line
              key={f}
              x1={0}
              x2={ancho}
              y1={BASE - AMPLITUD_MAX * f}
              y2={BASE - AMPLITUD_MAX * f}
              stroke="#1e2127"
              strokeWidth={1}
            />
          ))}
          <line x1={0} x2={ancho} y1={BASE} y2={BASE} stroke="#2a2f38" strokeWidth={1} />

          {puntos.map((p, i) => {
            const sube = subeElPunto(p, puntos[i - 1]);
            const color = sube ? VERDE : ROJO;
            const px = x(i);
            const esDetalle = i === detalleIndice;

            return (
              <g key={p.numero}>
                {/* Tramo de reposo hasta el latido anterior */}
                {i > 0 && (
                  <line
                    x1={x(i - 1) + 16}
                    x2={px - 16}
                    y1={BASE}
                    y2={BASE}
                    stroke={color}
                    strokeWidth={2}
                    opacity={0.55}
                  />
                )}
                <path
                  d={latido(px, p.pct)}
                  fill="none"
                  stroke={color}
                  strokeWidth={esDetalle ? 3 : 2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={esDetalle ? 1 : 0.85}
                />
                {esDetalle && (
                  <circle
                    cx={px - 2.5}
                    cy={BASE - Math.max((p.pct / 100) * AMPLITUD_MAX, 4)}
                    r={3.5}
                    fill={color}
                  />
                )}
                <text
                  x={px}
                  y={ALTO - 6}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight={esDetalle ? 700 : 500}
                  fill={esDetalle ? "var(--color-vip)" : "#6f7682"}
                >
                  {p.numero}
                </text>
                {/* Zona clicable de todo el tramo */}
                <rect
                  x={px - PASO / 2}
                  y={0}
                  width={PASO}
                  height={ALTO}
                  fill="transparent"
                  onClick={() => setSeleccionado(i)}
                  style={{ cursor: "pointer" }}
                />
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-3">
        <div>
          <p className="text-secondary font-semibold text-text">
            Día {detalle.numero} · {detalle.nombreDia}
          </p>
          <p className="text-caption text-text-tertiary">
            {formatFechaCorta(detalle.fecha)}
            {detalle.esDescanso
              ? " · descanso"
              : ` · ${detalle.completados}/${detalle.total} ejercicios`}
            {detalle.diasDesdeAnterior != null && detalle.diasDesdeAnterior > DIAS_HUECO_ACEPTABLE
              ? ` · ${detalle.diasDesdeAnterior} días sin entrenar`
              : ""}
          </p>
        </div>
        <p
          className="text-h3"
          style={{ color: subeElPunto(detalle, puntos[detalleIndice - 1]) ? VERDE : ROJO }}
        >
          {detalle.pct}%
        </p>
      </div>
    </div>
  );
}
