"use client";

import type { EtiquetaDia } from "@/lib/generador-rutinas/tipos";

const GRUPOS: { value: EtiquetaDia; label: string }[] = [
  { value: "pecho", label: "Pecho" },
  { value: "espalda", label: "Espalda" },
  { value: "hombros", label: "Hombros" },
  { value: "brazos", label: "Brazos" },
  { value: "piernas", label: "Piernas" },
  { value: "core", label: "Core" },
];

/** Sub-partes de "piernas" — el entrenador dijo que a veces las junta
 * (glúteo+cuádriceps en un solo día) y a veces las separa, según el enfoque
 * y los días disponibles. Van aparte de `GRUPOS` para que se note en la UI
 * que son una alternativa a "Piernas" combinado, no un grupo más. */
const SUBGRUPOS_PIERNA: { value: EtiquetaDia; label: string }[] = [
  { value: "gluteo", label: "Glúteo" },
  { value: "cuadriceps", label: "Cuádriceps" },
  { value: "femoral", label: "Femoral" },
  { value: "pantorrilla", label: "Pantorrilla" },
];

/** Distribución "personalizada": el entrenador elige a mano qué grupo (o
 * varios) entrena cada día, sin tope — en la práctica real hay días de un
 * solo grupo (Piernas) y días de cuatro combinados (Espalda + Hombros +
 * Brazos + Abdomen), así que limitarlo a 2 no alcanzaba. */
export function SelectorGruposDia({
  dias,
  valor,
  onChange,
}: {
  dias: number;
  valor: EtiquetaDia[][];
  onChange: (v: EtiquetaDia[][]) => void;
}) {
  const alternar = (diaIdx: number, grupo: EtiquetaDia) => {
    const copia = valor.map((d) => [...d]);
    while (copia.length < dias) copia.push([]);
    const actual = copia[diaIdx] ?? [];
    copia[diaIdx] = actual.includes(grupo) ? actual.filter((g) => g !== grupo) : [...actual, grupo];
    onChange(copia.slice(0, dias));
  };

  return (
    <div className="space-y-2">
      <p className="text-micro text-text-tertiary">Elige los grupos de cada día (los que quieras combinar)</p>
      {Array.from({ length: dias }, (_, diaIdx) => {
        const seleccion = valor[diaIdx] ?? [];
        return (
          <div key={diaIdx} className="flex items-start gap-1.5">
            <span className="text-caption w-12 shrink-0 pt-1 text-text-tertiary">Día {diaIdx + 1}</span>
            <div className="flex flex-1 flex-col gap-1">
              <div className="flex flex-wrap gap-1">
                {GRUPOS.map((g) => {
                  const activo = seleccion.includes(g.value);
                  return (
                    <button
                      key={g.value}
                      type="button"
                      onClick={() => alternar(diaIdx, g.value)}
                      className={`radius-control px-2 py-1 text-micro ${activo ? "bg-vip text-black" : "bg-surface-2 text-text-secondary"}`}
                    >
                      {g.label}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-1">
                {SUBGRUPOS_PIERNA.map((g) => {
                  const activo = seleccion.includes(g.value);
                  return (
                    <button
                      key={g.value}
                      type="button"
                      onClick={() => alternar(diaIdx, g.value)}
                      title="Sub-parte de piernas — alternativa a marcar Piernas combinado"
                      className={`radius-control border px-2 py-1 text-micro ${activo ? "border-vip bg-vip/15 text-vip" : "border-border text-text-tertiary"}`}
                    >
                      {g.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
