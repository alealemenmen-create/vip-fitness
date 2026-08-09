"use client";

import { useState, type CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Crown, Sparkles, Trophy } from "lucide-react";
import { obtenerDesglosePuntosAlumno, type DesglosePuntos } from "@/app/alumno/inicio/actions";
import type { FilaRanking } from "@/lib/ranking/data";
import { nombreAlumnoPublicado } from "@/lib/nombre";
import { RANGOS } from "@/lib/ranking/puntos";

const TOP = 15;

function colorPuesto(posicion: number): string {
  if (posicion === 1) return "#ffc247";
  if (posicion === 2) return "#cbd0d8";
  if (posicion === 3) return "#d08a4d";
  return "var(--color-vip)";
}

function fondoPuesto(posicion: number): string {
  if (posicion === 1) {
    return "linear-gradient(155deg, color-mix(in srgb, #ffc247 22%, var(--color-surface)) 0%, var(--color-surface) 72%)";
  }
  if (posicion === 2) {
    return "linear-gradient(155deg, color-mix(in srgb, #cbd0d8 16%, var(--color-surface)) 0%, var(--color-surface) 72%)";
  }
  if (posicion === 3) {
    return "linear-gradient(155deg, color-mix(in srgb, #d08a4d 18%, var(--color-surface)) 0%, var(--color-surface) 72%)";
  }
  return "var(--color-surface)";
}

function hexARgba(hex: string, alpha: number): string {
  const limpio = hex.replace("#", "");
  const bigint = parseInt(limpio, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function EmblemaRango({ rango, destacado }: { rango: FilaRanking["rango"]; destacado: boolean }) {
  const indice = RANGOS.findIndex((item) => item.nombre === rango.nombre);
  const intensidad = (indice + 1) / RANGOS.length;
  const tamano = destacado ? 58 : 50;

  return (
    <span
      className="relative flex shrink-0 items-center justify-center rounded-2xl border"
      style={{
        width: tamano + 18,
        height: tamano + 18,
        borderColor: hexARgba(rango.color, 0.38),
        background: `radial-gradient(circle, ${hexARgba(rango.color, 0.2)} 0%, transparent 72%)`,
      }}
    >
      <Image
        src={rango.imagen}
        alt={`Rango ${rango.nombre}`}
        width={tamano}
        height={tamano}
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
  const filaPropia = filas.find((fila) => fila.alumnoId === alumnoId);
  const participantes =
    filaPropia && !top15.some((fila) => fila.alumnoId === alumnoId) ? [...top15, filaPropia] : top15;

  const [expandido, setExpandido] = useState<string | null>(null);
  const [cargando, setCargando] = useState<string | null>(null);
  const [datos, setDatos] = useState<Record<string, DesglosePuntos>>({});
  const [conError, setConError] = useState<string | null>(null);

  async function alternar(idAlumno: string) {
    if (expandido === idAlumno) {
      setExpandido(null);
      return;
    }

    setExpandido(idAlumno);
    if (datos[idAlumno]) return;

    setCargando(idAlumno);
    setConError(null);
    try {
      const resultado = await obtenerDesglosePuntosAlumno(idAlumno);
      setDatos((actuales) => ({ ...actuales, [idAlumno]: resultado }));
    } catch {
      setConError(idAlumno);
    } finally {
      setCargando(null);
    }
  }

  return (
    <section className="arena-vip relative overflow-hidden rounded-[26px] border border-vip/35 bg-surface py-4">
      <div className="arena-vip-corona pointer-events-none absolute -right-4 -top-8 text-vip" aria-hidden>
        <Crown size={118} strokeWidth={1} />
      </div>

      <div className="relative flex items-center justify-between gap-3 px-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-vip text-black shadow-[0_8px_24px_color-mix(in_srgb,var(--color-vip)_30%,transparent)]">
            <Trophy size={22} />
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[14px] font-bold tracking-[0.08em] text-text">
              ARENA VIP <Sparkles size={13} className="text-vip" />
            </p>
            <p className="text-[10px] text-text-tertiary">Clasificación semanal · desliza para competir</p>
          </div>
        </div>
        <Link href="/alumno/ranked" className="shrink-0 text-[10px] font-semibold text-vip">
          Top {TOP} →
        </Link>
      </div>

      {participantes.length === 0 ? (
        <p className="px-4 py-8 text-center text-body text-text-secondary">
          Todavía no hay participantes en la Arena VIP.
        </p>
      ) : (
        <div
          className="scrollbar-oculta mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-4 pb-2"
          aria-label="Ranking semanal deslizable"
        >
          {participantes.map((fila) => {
            const esPropia = fila.alumnoId === alumnoId;
            const esPodio = fila.posicion <= 3;
            const abierto = expandido === fila.alumnoId;
            const desglose = datos[fila.alumnoId];

            return (
              <article
                key={fila.alumnoId}
                className={`relative min-w-[168px] snap-center overflow-hidden rounded-[22px] border p-3 ${
                  esPropia ? "border-vip shadow-[0_0_24px_color-mix(in_srgb,var(--color-vip)_20%,transparent)]" : "border-border"
                }`}
                style={{ background: fondoPuesto(fila.posicion) }}
              >
                {esPodio && (
                  <span
                    className="pointer-events-none absolute -right-3 -top-4 opacity-10"
                    style={{ color: colorPuesto(fila.posicion) }}
                    aria-hidden
                  >
                    <Trophy size={72} />
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => alternar(fila.alumnoId)}
                  aria-expanded={abierto}
                  className="relative flex w-full flex-col items-center text-center"
                >
                  <span
                    className="mb-2 flex h-7 min-w-7 items-center justify-center rounded-full border px-2 text-[10px] font-bold tabular-nums"
                    style={{ color: colorPuesto(fila.posicion), borderColor: colorPuesto(fila.posicion) }}
                  >
                    {String(fila.posicion).padStart(2, "0")}
                  </span>
                  <EmblemaRango rango={fila.rango} destacado={fila.posicion === 1} />
                  <p className="mt-2 w-full truncate text-[11px] font-semibold text-text">
                    {nombreAlumnoPublicado(fila.nombre)}
                  </p>
                  <p className="mt-1 text-[16px] font-bold tabular-nums" style={{ color: colorPuesto(fila.posicion) }}>
                    {fila.puntos.toLocaleString("es-CL")}
                    <span className="ml-1 text-[8px] font-normal text-text-tertiary">pts</span>
                  </p>
                  <p className="mt-1 text-[9px] text-text-tertiary">
                    {fila.rango.nombre}{esPropia ? " · TÚ" : ""}
                  </p>
                </button>

                {abierto && (
                  <div className="mt-3 border-t border-border pt-2 text-left">
                    {cargando === fila.alumnoId ? (
                      <p className="text-[9px] text-text-tertiary">Cargando…</p>
                    ) : conError === fila.alumnoId ? (
                      <p className="text-[9px] text-text-tertiary">No se pudo cargar el detalle.</p>
                    ) : desglose && desglose.movimientos.length > 0 ? (
                      <div className="space-y-1.5">
                        {desglose.movimientos.slice(0, 3).map((movimiento) => (
                          <div key={movimiento.id} className="flex items-center justify-between gap-2">
                            <p className="min-w-0 truncate text-[8px] text-text-secondary">{movimiento.titulo}</p>
                            <p className={`shrink-0 text-[8px] font-bold ${movimiento.puntos < 0 ? "text-error" : "text-vip"}`}>
                              {movimiento.puntos > 0 ? "+" : ""}{movimiento.puntos}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[9px] text-text-tertiary">Todavía sin puntos esta semana.</p>
                    )}
                  </div>
                )}
              </article>
            );
          })}

          <Link
            href="/alumno/ranked"
            className="flex min-w-[132px] snap-center flex-col items-center justify-center rounded-[22px] border border-dashed border-vip/45 bg-vip/5 px-4 text-center text-vip"
          >
            <ChevronRight size={28} />
            <span className="mt-2 text-[11px] font-semibold">Ver ranking completo</span>
          </Link>
        </div>
      )}
    </section>
  );
}
