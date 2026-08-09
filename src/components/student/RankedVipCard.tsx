"use client";

import { useState, type CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { Crown, Sparkles, Trophy } from "lucide-react";
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

function EmblemaRango({ rango, tamano }: { rango: FilaRanking["rango"]; tamano: number }) {
  const indice = RANGOS.findIndex((item) => item.nombre === rango.nombre);
  const intensidad = (indice + 1) / RANGOS.length;

  return (
    <span
      className="relative flex shrink-0 items-center justify-center rounded-2xl border"
      style={{
        width: tamano + 12,
        height: tamano + 12,
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

function DetallePuntos({
  fila,
  desglose,
  cargando,
  conError,
}: {
  fila: FilaRanking;
  desglose?: DesglosePuntos;
  cargando: boolean;
  conError: boolean;
}) {
  return (
    <div
      id={`detalle-ranking-${fila.alumnoId}`}
      className="mt-2 rounded-xl border border-border bg-bg/45 px-3 py-2 text-left"
    >
      <p className="mb-1.5 truncate text-[9px] font-semibold text-text">
        Movimientos de {nombreAlumnoPublicado(fila.nombre)}
      </p>
      {cargando ? (
        <p className="text-[9px] text-text-tertiary">Cargando…</p>
      ) : conError ? (
        <p className="text-[9px] text-text-tertiary">No se pudo cargar el detalle.</p>
      ) : desglose && desglose.movimientos.length > 0 ? (
        <div className="grid gap-1 sm:grid-cols-2">
          {desglose.movimientos.slice(0, 4).map((movimiento) => (
            <div key={movimiento.id} className="flex items-center justify-between gap-2">
              <p className="min-w-0 truncate text-[8px] text-text-secondary">{movimiento.titulo}</p>
              <p
                className={`shrink-0 text-[8px] font-bold ${
                  movimiento.puntos < 0 ? "text-error" : "text-vip"
                }`}
              >
                {movimiento.puntos > 0 ? "+" : ""}
                {movimiento.puntos}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[9px] text-text-tertiary">Todavía sin puntos esta semana.</p>
      )}
    </div>
  );
}

export function RankedVipCard({ filas, alumnoId }: { filas: FilaRanking[]; alumnoId: string }) {
  const top15 = filas.slice(0, TOP);
  const podio = top15.slice(0, 3);
  const perseguidores = top15.slice(3);
  const filaPropia = filas.find((fila) => fila.alumnoId === alumnoId);
  const propiaFueraDelTop =
    filaPropia && !top15.some((fila) => fila.alumnoId === alumnoId) ? filaPropia : null;

  const [expandido, setExpandido] = useState<string | null>(null);
  const [cargando, setCargando] = useState<string | null>(null);
  const [datos, setDatos] = useState<Record<string, DesglosePuntos>>({});
  const [conError, setConError] = useState<string | null>(null);
  const filaSeleccionada =
    top15.find((fila) => fila.alumnoId === expandido) ??
    (propiaFueraDelTop?.alumnoId === expandido ? propiaFueraDelTop : null);

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
    <section className="arena-vip relative overflow-hidden rounded-[24px] border border-vip/35 bg-surface p-3">
      <div className="arena-vip-corona pointer-events-none absolute -right-5 -top-9 text-vip" aria-hidden>
        <Crown size={104} strokeWidth={1} />
      </div>

      <div className="relative flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-vip text-black shadow-[0_8px_24px_color-mix(in_srgb,var(--color-vip)_30%,transparent)]">
            <Trophy size={19} />
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[13px] font-bold tracking-[0.08em] text-text">
              ARENA VIP <Sparkles size={12} className="text-vip" />
            </p>
            <p className="text-[9px] text-text-tertiary">Podio semanal · Top 15 completo</p>
          </div>
        </div>
        <Link href="/alumno/ranked" className="shrink-0 text-[10px] font-semibold text-vip">
          Ver todo →
        </Link>
      </div>

      {top15.length === 0 ? (
        <p className="py-8 text-center text-body text-text-secondary">
          Todavía no hay participantes en la Arena VIP.
        </p>
      ) : (
        <div className="relative mt-3">
          <div className="grid grid-cols-3 items-stretch gap-2" aria-label="Podio semanal">
            {podio.map((fila) => {
              const esPropia = fila.alumnoId === alumnoId;
              const abierto = expandido === fila.alumnoId;

              return (
                <article
                  key={fila.alumnoId}
                  className={`relative overflow-hidden rounded-[18px] border px-2 py-2.5 ${
                    esPropia
                      ? "border-vip shadow-[0_0_22px_color-mix(in_srgb,var(--color-vip)_22%,transparent)]"
                      : "border-border"
                  }`}
                  style={{ background: fondoPuesto(fila.posicion) }}
                >
                  <Trophy
                    size={56}
                    className="pointer-events-none absolute -right-3 -top-3 opacity-10"
                    style={{ color: colorPuesto(fila.posicion) }}
                    aria-hidden
                  />
                  <button
                    type="button"
                    onClick={() => alternar(fila.alumnoId)}
                    aria-expanded={abierto}
                    aria-controls={`detalle-ranking-${fila.alumnoId}`}
                    className="relative flex min-h-[126px] w-full flex-col items-center justify-between text-center"
                  >
                    <span
                      className="flex h-6 min-w-6 items-center justify-center rounded-full border px-1.5 text-[9px] font-bold tabular-nums"
                      style={{ color: colorPuesto(fila.posicion), borderColor: colorPuesto(fila.posicion) }}
                    >
                      {fila.posicion}
                    </span>
                    <EmblemaRango rango={fila.rango} tamano={fila.posicion === 1 ? 46 : 40} />
                    <span className="w-full">
                      <span className="block truncate text-[9px] font-semibold text-text">
                        {nombreAlumnoPublicado(fila.nombre)}
                      </span>
                      <span
                        className="mt-0.5 block text-[13px] font-bold tabular-nums"
                        style={{ color: colorPuesto(fila.posicion) }}
                      >
                        {fila.puntos.toLocaleString("es-CL")}
                        <span className="ml-0.5 text-[7px] font-normal text-text-tertiary">pts</span>
                      </span>
                    </span>
                  </button>
                </article>
              );
            })}
          </div>

          {perseguidores.length > 0 && (
            <div className="mt-2 grid grid-cols-3 gap-1.5" aria-label="Posiciones 4 a 15">
              {perseguidores.map((fila) => {
                const esPropia = fila.alumnoId === alumnoId;
                const abierto = expandido === fila.alumnoId;

                return (
                  <button
                    key={fila.alumnoId}
                    type="button"
                    onClick={() => alternar(fila.alumnoId)}
                    aria-expanded={abierto}
                    aria-controls={`detalle-ranking-${fila.alumnoId}`}
                    className={`flex min-h-10 min-w-0 items-center gap-1.5 rounded-xl border px-1.5 py-1 text-left ${
                      esPropia ? "border-vip bg-vip/10" : "border-border bg-surface/70"
                    }`}
                  >
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[9px] font-bold tabular-nums"
                      style={{
                        color: colorPuesto(fila.posicion),
                        background: `color-mix(in srgb, ${colorPuesto(fila.posicion)} 12%, transparent)`,
                      }}
                    >
                      {fila.posicion}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[7px] font-semibold leading-tight text-text">
                        {nombreAlumnoPublicado(fila.nombre)}
                      </span>
                      <span className="mt-0.5 block text-[8px] font-bold leading-none tabular-nums text-text-secondary">
                        {fila.puntos.toLocaleString("es-CL")} pts
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {propiaFueraDelTop && (
            <button
              type="button"
              onClick={() => alternar(propiaFueraDelTop.alumnoId)}
              aria-expanded={expandido === propiaFueraDelTop.alumnoId}
              aria-controls={`detalle-ranking-${propiaFueraDelTop.alumnoId}`}
              className="mt-2 flex min-h-9 w-full items-center justify-between gap-2 rounded-xl border border-vip/45 bg-vip/10 px-3 py-1.5 text-left"
            >
              <span className="truncate text-[9px] font-semibold text-text">
                TU POSICIÓN · #{propiaFueraDelTop.posicion} · {propiaFueraDelTop.rango.nombre}
              </span>
              <span className="shrink-0 text-[10px] font-bold tabular-nums text-vip">
                {propiaFueraDelTop.puntos.toLocaleString("es-CL")} pts
              </span>
            </button>
          )}

          {filaSeleccionada && (
            <DetallePuntos
              fila={filaSeleccionada}
              desglose={datos[filaSeleccionada.alumnoId]}
              cargando={cargando === filaSeleccionada.alumnoId}
              conError={conError === filaSeleccionada.alumnoId}
            />
          )}
        </div>
      )}
    </section>
  );
}
