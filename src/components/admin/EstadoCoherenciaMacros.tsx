"use client";

import { AlertTriangle, CheckCircle2, Calculator } from "lucide-react";
import { caloriasDeMacros, reconciliarObjetivos } from "@/lib/alimentacion/objetivos";

export function EstadoCoherenciaMacros({
  kcal,
  proteina,
  carbohidratos,
  grasa,
}: {
  kcal: number | null;
  proteina: number | null;
  carbohidratos: number | null;
  grasa: number | null;
}) {
  if (
    kcal === null || proteina === null || grasa === null ||
    !Number.isFinite(kcal) || !Number.isFinite(proteina) || !Number.isFinite(grasa) ||
    (carbohidratos !== null && !Number.isFinite(carbohidratos))
  ) {
    return (
      <div className="radius-control flex gap-2 border border-border bg-surface-2 p-3 text-caption text-text-secondary">
        <Calculator size={16} className="mt-0.5 shrink-0 text-text-tertiary" />
        Define calorías, proteína y grasa. El sistema comprobará y calculará el cierre de carbohidratos antes de publicar.
      </div>
    );
  }

  const resultado = reconciliarObjetivos({
    kcalObjetivo: kcal,
    protObjetivo: proteina,
    carbObjetivo: carbohidratos,
    grasaObjetivo: grasa,
  });
  const kcalOriginales = caloriasDeMacros(proteina, carbohidratos, grasa);

  if (resultado.error) {
    return (
      <div className="radius-control flex gap-2 border border-error/50 bg-error/5 p-3 text-caption text-error">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
        <span><strong>No se puede publicar:</strong> {resultado.error}</span>
      </div>
    );
  }

  if (resultado.ajustado) {
    return (
      <div className="radius-control flex gap-2 border border-vip/50 bg-vip/5 p-3 text-caption text-text-secondary">
        <Calculator size={16} className="mt-0.5 shrink-0 text-vip" />
        <span>
          {kcalOriginales === null
            ? "Faltaban carbohidratos. "
            : `Los macros escritos suman ${Math.round(kcalOriginales)} kcal, no ${Math.round(kcal)}. `}
          Al publicar se usarán <strong className="text-text">{resultado.objetivos.carbObjetivo} g de carbohidratos</strong> para cerrar exactamente la meta.
        </span>
      </div>
    );
  }

  return (
    <div className="radius-control flex gap-2 border border-success/40 bg-success/5 p-3 text-caption text-text-secondary">
      <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success" />
      <span><strong className="text-success">Objetivos coherentes.</strong> Los macros equivalen a {Math.round(resultado.kcalCalculadas ?? kcal)} kcal.</span>
    </div>
  );
}
