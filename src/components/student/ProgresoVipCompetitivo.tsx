"use client";

import { useState } from "react";
import { Dumbbell, Flame, Swords, Target, Trophy, UtensilsCrossed, Zap } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { BadgeRango } from "@/components/student/BadgeRango";
import { EscalaRangos } from "@/components/student/EscalaRangos";
import type { FilaRanking, MovimientoPuntos, PeriodoRanking } from "@/lib/ranking/data";
import { progresoAlSiguiente } from "@/lib/ranking/puntos";
import { nombreAlumnoPublicado } from "@/lib/nombre";

const PERIODOS: { id: PeriodoRanking; nombre: string; ayuda: string }[] = [
  { id: "semana", nombre: "Semana", ayuda: "Se renueva cada lunes" },
  { id: "mes", nombre: "Mes", ayuda: "Constancia del mes" },
  { id: "anio", nombre: "Año", ayuda: "Temporada completa" },
];

function colorPuesto(posicion: number) {
  if (posicion === 1) return "#ffc247";
  if (posicion === 2) return "#c0c4cc";
  if (posicion === 3) return "#c88a4a";
  return "var(--color-text-secondary)";
}

export function ProgresoVipCompetitivo({
  rankings,
  alumnoId,
  movimientos,
}: {
  rankings: Record<PeriodoRanking, FilaRanking[]>;
  alumnoId: string;
  movimientos: MovimientoPuntos[];
}) {
  const [periodo, setPeriodo] = useState<PeriodoRanking>("semana");
  const filas = rankings[periodo];
  const propia = filas.find((fila) => fila.alumnoId === alumnoId);
  const progreso = propia ? progresoAlSiguiente(propia.puntosAcumulados) : null;

  const rival = propia && propia.posicion > 1 ? filas[propia.posicion - 2] ?? null : null;

  if (!propia) {
    return <Card><p className="text-body text-text-secondary">Aún no estás participando en Progreso VIP.</p></Card>;
  }

  const periodoInfo = PERIODOS.find((p) => p.id === periodo)!;
  const faltanParaSuperar = rival ? Math.max(1, rival.puntos - propia.puntos + 1) : 0;

  return (
    <div className="space-y-5">
      <Card className="efecto-3d overflow-hidden">
        <div className="flex items-center gap-4">
          <BadgeRango rango={propia.rango} size={104} destacado eager />
          <div className="min-w-0 flex-1">
            <p className="text-micro uppercase tracking-[0.18em] text-text-tertiary">Tu rango actual</p>
            <p className="text-h2" style={{ color: propia.rango.color }}>{propia.rango.nombre}</p>
            <p className="text-secondary text-text-secondary">
              {propia.puntosAcumulados.toLocaleString("es-CL")} Puntos VIP totales
            </p>
          </div>
        </div>

        {progreso ? (
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <p className="text-caption text-text-secondary">
                Próximo rango: <span className="font-semibold" style={{ color: progreso.siguiente.color }}>{progreso.siguiente.nombre}</span>
              </p>
              <p className="text-caption font-bold text-vip">faltan {progreso.faltan.toLocaleString("es-CL")}</p>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-surface-2">
              <div
                className="barra-progreso-relleno h-full rounded-full transition-[width] duration-700 ease-out"
                style={{
                  width: `${progreso.pct}%`,
                  background: `linear-gradient(90deg, ${propia.rango.color}, ${progreso.siguiente.color})`,
                }}
              >
                {[0, 1, 2, 3].map((indice) => (
                  <span key={indice} className="ola-progreso" style={{ animationDelay: `${indice * 0.52}s` }} />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-caption mt-3 font-semibold text-vip">Alcanzaste el rango máximo.</p>
        )}
      </Card>

      <Card>
        <div className="mb-3 flex items-center gap-2">
          <Trophy size={17} className="text-vip" />
          <div className="min-w-0 flex-1">
            <p className="text-body font-semibold text-text">Competencia VIP</p>
            <p className="text-micro text-text-tertiary">{periodoInfo.ayuda}</p>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1">
          {PERIODOS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPeriodo(item.id)}
              className={`radius-control min-h-9 px-2 text-caption font-semibold transition-colors ${
                periodo === item.id ? "bg-vip text-black" : "text-text-secondary"
              }`}
            >
              {item.nombre}
            </button>
          ))}
        </div>

        <div className="radius-control mb-3 border border-vip/30 bg-vip/5 px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-micro uppercase tracking-wide text-text-tertiary">Tu posición</p>
              <p className="text-h2 text-vip">#{propia.posicion}</p>
            </div>
            <div className="text-right">
              <p className="text-h3 text-text">{propia.puntos.toLocaleString("es-CL")} pts</p>
              <p className="text-micro text-text-tertiary">en este periodo</p>
            </div>
          </div>
          <p className="text-caption mt-2 text-text-secondary">
            {rival
              ? `Te faltan ${faltanParaSuperar} puntos para superar a ${nombreAlumnoPublicado(rival.nombre)}.`
              : "Vas liderando. Mantén la constancia para defender el primer lugar."}
          </p>
        </div>

        <div className="space-y-1.5">
          {filas.slice(0, 10).map((fila) => {
            const esPropia = fila.alumnoId === alumnoId;
            return (
              <div
                key={fila.alumnoId}
                className={`radius-control grid grid-cols-[28px_34px_minmax(0,1fr)_auto] items-center gap-2 px-2 py-2 ${
                  esPropia ? "border border-vip/50 bg-vip/10" : "bg-surface-2/55"
                }`}
              >
                <span className="text-center text-caption font-bold" style={{ color: colorPuesto(fila.posicion) }}>
                  {fila.posicion}
                </span>
                <BadgeRango rango={fila.rango} size={32} destacado={fila.posicion === 1} />
                <p className="truncate text-caption font-semibold text-text">
                  {nombreAlumnoPublicado(fila.nombre)}{esPropia ? " · Tú" : ""}
                </p>
                <p className="text-caption font-bold tabular-nums text-text">{fila.puntos.toLocaleString("es-CL")}</p>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <p className="text-caption mb-3 flex items-center gap-1.5 text-text-tertiary">
          <Zap size={14} className="text-vip" /> ASÍ SUMAS ESTA SEMANA
        </p>
        <div className="space-y-2">
          <Regla icono={<Dumbbell size={15} />} titulo="Entrenamiento según % completado" puntos="hasta +300" />
          <Regla icono={<UtensilsCrossed size={15} />} titulo="Precisión del objetivo de calorías" puntos="−150 a +250" />
          <Regla icono={<Flame size={15} />} titulo="Primera entrada del día" puntos="+30/día" />
          <Regla icono={<Target size={15} />} titulo="Peso y foto semanal" puntos="hasta +175" />
          <Regla icono={<Swords size={15} />} titulo="Premios oficiales de Arena VIP" puntos="según evento" />
        </div>
        <p className="radius-control mt-2 bg-surface-2 px-3 py-2 text-[9px] leading-relaxed text-text-tertiary">
          Nutrición al cerrar: 100% = +250 · 75% o 125% = +125 · 50% o 150% = 0 · sin registros = −150.
        </p>
        <p className="text-micro mt-3 text-text-tertiary">La alimentación se confirma al cerrar el día. Las penalizaciones son visibles y el saldo nunca baja de cero.</p>
      </Card>

      <Card>
        <p className="text-caption mb-3 text-text-tertiary">ÚLTIMOS PUNTOS</p>
        {movimientos.length === 0 ? (
          <p className="text-caption text-text-secondary">Completa tu primera acción para comenzar.</p>
        ) : (
          <div className="space-y-2">
            {movimientos.map((movimiento) => (
              <div key={movimiento.id} className="flex items-center gap-3 border-b border-border/60 pb-2 last:border-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="text-caption font-medium text-text">{movimiento.titulo}</p>
                  <p className="text-micro truncate text-text-tertiary">{movimiento.detalle ?? movimiento.fecha}</p>
                </div>
                <p className={`text-caption font-bold ${movimiento.puntos < 0 ? "text-error" : "text-vip"}`}>
                  {movimiento.puntos > 0 ? "+" : ""}{movimiento.puntos}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="!p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-caption text-text-tertiary">RANGOS VIP</p>
          <p className="text-micro text-text-secondary">El total no se reinicia</p>
        </div>
        <EscalaRangos rangoActual={propia.rango.nombre} />
      </Card>
    </div>
  );
}

function Regla({ icono, titulo, puntos }: { icono: React.ReactNode; titulo: string; puntos: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-surface-2 px-3 py-2">
      <span className="text-vip">{icono}</span>
      <p className="text-caption min-w-0 flex-1 text-text-secondary">{titulo}</p>
      <p className="text-caption shrink-0 font-bold text-vip">{puntos}</p>
    </div>
  );
}
