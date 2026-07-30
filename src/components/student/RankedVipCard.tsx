"use client";

import { useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import Image from "next/image";
import { Trophy, Star, ChevronDown } from "lucide-react";
import type { FilaRanking } from "@/lib/ranking/data";
import { RANGOS } from "@/lib/ranking/puntos";
import { nombreAlumnoPublicado } from "@/lib/nombre";

const TOP = 15;
// Antes 5 — pedido explícito de achicar la tarjeta ~20%, mostrando 4.
const VISIBLES = 4;
const ALTO_FILA = 44;
const ALTO_LISTA = VISIBLES * ALTO_FILA + (VISIBLES - 1) * 4;

/** Color del puesto: dorado/plateado/bronce para el podio, blanco desde el 4°
 * — el emblema (rango real) nunca cambia por esto, solo el número y los pts. */
function colorPuesto(posicion: number): string {
  if (posicion === 1) return "#ffc247";
  if (posicion === 2) return "#c0c4cc";
  if (posicion === 3) return "#c88a4a";
  return "var(--color-text)";
}

function hexARgba(hex: string, alpha: number): string {
  const limpio = hex.replace("#", "");
  const bigint = parseInt(limpio, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Emblema del rango REAL de la cuenta (Bronze/Silver/Gold/…), con el mismo
 * resplandor "que respira" del mensaje del día — más intenso cuanto más alto
 * el rango. Se probó reemplazarlo por una insignia corona/estrella por
 * puesto semanal, pero el usuario pidió mantener las insignias propias de la
 * app: cada alumno lleva la que ganó de verdad, no un ícono genérico. */
function EmblemaRango({ rango }: { rango: FilaRanking["rango"] }) {
  const indice = RANGOS.findIndex((r) => r.nombre === rango.nombre);
  const intensidad = (indice + 1) / RANGOS.length;

  return (
    <span className="relative flex h-6 w-6 shrink-0 items-center justify-center">
      <Image
        src={rango.imagen}
        alt={rango.nombre}
        width={24}
        height={24}
        className="emblema-rango-movimiento object-contain"
        style={
          {
            "--brillo-suave": hexARgba(rango.color, 0.55 + intensidad * 0.2),
            "--brillo-fuerte": hexARgba(rango.color, 0.85 + intensidad * 0.35),
          } as CSSProperties
        }
      />
    </span>
  );
}

export function RankedVipCard({ filas, alumnoId }: { filas: FilaRanking[]; alumnoId: string }) {
  const top15 = filas.slice(0, TOP);
  const listaRef = useRef<HTMLDivElement>(null);
  const [alFinal, setAlFinal] = useState(false);

  function onScroll() {
    const el = listaRef.current;
    if (!el) return;
    setAlFinal(el.scrollTop + el.clientHeight >= el.scrollHeight - 4);
  }

  return (
    // Sin marco propio: vive dentro de la tarjeta compartida con el perfil, a
    // la derecha de la línea divisoria.
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-start justify-between gap-1.5">
        <div className="min-w-0">
          <p className="flex items-center gap-1 text-[11px] font-semibold leading-none text-text">
            <Trophy size={12} className="shrink-0 text-vip" /> RANKING VIP
          </p>
          <p className="mt-0.5 text-[8px] leading-none text-text-tertiary">Clasificación semanal</p>
        </div>
        <span className="radius-control flex shrink-0 items-center gap-0.5 border border-vip/40 px-1.5 py-0.5 text-[8px] leading-none text-text-tertiary">
          <Star size={8} className="text-vip" fill="var(--color-vip)" /> Top {TOP}
        </span>
      </div>

      {top15.length === 0 ? (
        <p className="text-body py-6 text-center text-text-secondary">
          Todavía no hay participantes en el ranking.
        </p>
      ) : (
        <div className="relative">
          {/* Se ven 5 puestos (pedido explícito, antes eran 3); el resto del
              Top 15 se alcanza deslizando. */}
          <div
            ref={listaRef}
            onScroll={onScroll}
            className="scrollbar-fina space-y-1 overflow-y-auto overscroll-contain scroll-smooth pr-0.5"
            style={{ height: ALTO_LISTA }}
          >
            {top15.map((fila) => {
              const esPropia = fila.alumnoId === alumnoId;
              return (
                <div
                  key={fila.alumnoId}
                  className={`grid grid-cols-[13px_24px_minmax(0,1fr)] items-center gap-1.5 rounded-xl bg-surface-2 px-1.5 py-2 transition-colors duration-200 ${
                    esPropia ? "border border-vip/60 bg-surface-2/80" : ""
                  }`}
                >
                  <span
                    className="text-center text-[10px] font-bold leading-none tabular-nums"
                    style={{ color: colorPuesto(fila.posicion) }}
                  >
                    {String(fila.posicion).padStart(2, "0")}
                  </span>
                  <EmblemaRango rango={fila.rango} />
                  {/* Nombre y puntos apilados: a media tarjeta no entran los dos
                      en la misma línea sin cortar casi todos los nombres. */}
                  <div className="min-w-0">
                    <p className="truncate text-[10px] font-medium leading-tight text-text">
                      {nombreAlumnoPublicado(fila.nombre)}
                      {esPropia && <span className="ml-1 text-[8px] text-vip">TÚ</span>}
                    </p>
                    <p
                      className="mt-0.5 text-[10px] font-bold leading-none tabular-nums"
                      style={{ color: colorPuesto(fila.posicion) }}
                    >
                      {fila.puntos.toLocaleString("es-CL")}
                      <span className="ml-0.5 text-[7px] font-normal text-text-tertiary">pts</span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {top15.length > VISIBLES && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center justify-end gap-0.5 rounded-b-2xl bg-gradient-to-t from-surface to-transparent pb-0.5 transition-opacity duration-300"
              style={{ height: 24, opacity: alFinal ? 0 : 1 }}
            >
              <span className="flex items-center gap-0.5 text-[7px] leading-none text-text-tertiary">
                <ChevronDown size={8} className="shrink-0" /> Desliza para ver{" "}
                {Math.min(TOP, filas.length)}
                <ChevronDown size={8} className="shrink-0" />
              </span>
            </div>
          )}
        </div>
      )}

      <Link
        href="/alumno/ranked"
        className="mt-auto flex items-center justify-center pt-2 text-[9px] font-medium leading-none text-vip"
      >
        Ver ranking completo →
      </Link>
    </div>
  );
}
