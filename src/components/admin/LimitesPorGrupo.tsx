"use client";

import type { EtiquetaDia } from "@/lib/generador-rutinas/tipos";

/** Mismas etiquetas que `SelectorGruposDia` — el entrenador tope los mismos
 * grupos que puede elegir por día, sin tener que traducir nada mentalmente. */
const GRUPOS: { value: EtiquetaDia; label: string }[] = [
  { value: "pecho", label: "Pecho" },
  { value: "espalda", label: "Espalda" },
  { value: "hombros", label: "Hombros" },
  { value: "brazos", label: "Brazos" },
  { value: "piernas", label: "Piernas" },
  { value: "core", label: "Core" },
];

const SUBGRUPOS: { value: EtiquetaDia; label: string; padre: string }[] = [
  { value: "biceps", label: "Bíceps", padre: "Brazos" },
  { value: "triceps", label: "Tríceps", padre: "Brazos" },
  { value: "gluteo", label: "Glúteo", padre: "Piernas" },
  { value: "cuadriceps", label: "Cuádriceps", padre: "Piernas" },
  { value: "femoral", label: "Femoral", padre: "Piernas" },
  { value: "pantorrilla", label: "Pantorrilla", padre: "Piernas" },
];

const OPCIONES = [1, 2, 3, 4, 5, 6];

/** Tope de ejercicios POR DÍA para cada grupo — "máximo 3 de pecho, máximo 2
 * de bíceps". Lo que queda en "sin tope" se reparte como siempre; los
 * espacios que libera un tope se los llevan los otros grupos del mismo día.
 * No es el tope de SERIES semanales (ese lo aplica el motor solo, contra el
 * mismo límite que bloquea la publicación). */
export function LimitesPorGrupo({
  valor,
  onChange,
}: {
  valor: Partial<Record<EtiquetaDia, number>>;
  onChange: (v: Partial<Record<EtiquetaDia, number>>) => void;
}) {
  const cambiar = (clave: EtiquetaDia, texto: string) => {
    const copia = { ...valor };
    if (!texto) delete copia[clave];
    else copia[clave] = Number(texto);
    onChange(copia);
  };

  const control = (clave: EtiquetaDia, label: string, titulo?: string) => (
    <label key={clave} title={titulo} className="flex items-center justify-between gap-1.5">
      <span className="text-micro truncate text-text-secondary">{label}</span>
      <select
        aria-label={`Tope de ejercicios de ${label} por día`}
        value={valor[clave] ?? ""}
        onChange={(e) => cambiar(clave, e.target.value)}
        className={`radius-control shrink-0 border px-1.5 py-0.5 text-micro ${
          valor[clave] ? "border-vip bg-vip/15 text-vip" : "border-border bg-surface-2 text-text-tertiary"
        }`}
      >
        <option value="">Sin tope</option>
        {OPCIONES.map((n) => (
          <option key={n} value={n}>
            máx. {n}
          </option>
        ))}
      </select>
    </label>
  );

  const conTope = Object.keys(valor).length;

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-micro text-text-tertiary">
          Cuántos ejercicios como máximo de cada grupo <strong className="text-text-secondary">en un mismo día</strong>. Lo que sobra se lo llevan los otros grupos de ese día.
        </p>
        {conTope > 0 && (
          <button type="button" onClick={() => onChange({})} className="shrink-0 text-micro font-medium text-vip underline">
            Quitar topes
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">{GRUPOS.map((g) => control(g.value, g.label))}</div>
      <p className="text-micro pt-1 text-text-tertiary">SUB-GRUPOS (se suman al tope de su grupo padre; manda el más chico)</p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        {SUBGRUPOS.map((g) => control(g.value, g.label, `Sub-parte de ${g.padre}`))}
      </div>
    </div>
  );
}
