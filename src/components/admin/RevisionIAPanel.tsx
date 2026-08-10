"use client";

import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, ShieldAlert, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { CambioResuelto, RevisionResuelta } from "@/lib/ai/revisarRutina";

/** Lo que la IA opina de la rutina que armó el motor, antes de publicarla.
 *
 * Es un panel de lectura + botones de aplicar: no edita nada por su cuenta.
 * Cada cambio lo aprueba el entrenador uno por uno (o todos de una), y el
 * borrador de arriba se actualiza en vivo — incluida la vista previa del
 * documento que va a recibir el alumno. */

const VEREDICTOS = {
  aprobada: {
    Icono: CheckCircle2,
    color: "text-success",
    borde: "border-success",
    titulo: "Rutina aprobada",
    bajada: "No se encontraron problemas para este alumno.",
  },
  ajustes_sugeridos: {
    Icono: AlertTriangle,
    color: "text-warning",
    borde: "border-warning",
    titulo: "Con ajustes sugeridos",
    bajada: "Sirve, pero hay cambios que conviene revisar antes de publicar.",
  },
  revisar_con_cuidado: {
    Icono: ShieldAlert,
    color: "text-error",
    borde: "border-error",
    titulo: "Revisar con cuidado",
    bajada: "Hay algo en la ficha del alumno que choca con esta rutina.",
  },
} as const;

const COLOR_GRAVEDAD = { alta: "text-error", media: "text-warning", baja: "text-text-tertiary" } as const;
const LABEL_CATEGORIA = {
  seguridad: "Seguridad",
  objetivo: "Objetivo",
  volumen: "Volumen",
  variedad: "Variedad",
  tecnica: "Técnica",
  otro: "Otro",
} as const;

function descripcionCambio(c: CambioResuelto): string {
  if (c.accion === "quitar") return `Quitar "${c.ejercicioActual}"`;
  if (c.accion === "reemplazar") return `Cambiar "${c.ejercicioActual}" por "${c.reemplazoNombre ?? "—"}"`;
  const ajustes = [
    c.series !== null ? `${c.series} series` : null,
    c.reps !== null ? `${c.reps} reps` : null,
    c.descansoSegundos !== null ? `${c.descansoSegundos}s de descanso` : null,
    c.tecnicaTipo !== null ? `técnica: ${c.tecnicaTipo}` : null,
  ].filter(Boolean);
  return `Ajustar "${c.ejercicioActual}"${ajustes.length ? ` → ${ajustes.join(", ")}` : ""}`;
}

export function RevisionIAPanel({
  revision,
  revisando,
  error,
  aplicados,
  onRevisar,
  onAplicar,
  onAplicarTodos,
}: {
  revision: RevisionResuelta | null;
  revisando: boolean;
  error: string | null;
  /** Índices de `revision.cambios` que el entrenador ya aplicó al borrador. */
  aplicados: Set<number>;
  onRevisar: () => void;
  onAplicar: (indice: number) => void;
  onAplicarTodos: () => void;
}) {
  const [abierto, setAbierto] = useState(true);

  if (!revision) {
    return (
      <Card>
        <div className="flex items-start gap-2">
          <Sparkles size={18} className="mt-0.5 shrink-0 text-vip" />
          <div className="min-w-0 flex-1">
            <p className="text-secondary font-medium text-text">Revisar con IA antes de publicar</p>
            <p className="text-micro mt-0.5 text-text-tertiary">
              Cruza la rutina con la ficha del alumno —lesiones, molestias, operaciones, condiciones médicas, edad y
              objetivo— y propone cambios concretos.
            </p>
          </div>
        </div>
        {error && <p className="text-caption mt-2 text-error">{error}</p>}
        <Button onClick={onRevisar} loading={revisando} variant="secondary" className="mt-3 w-full">
          {revisando ? "Analizando la rutina…" : "Analizar esta rutina"}
        </Button>
      </Card>
    );
  }

  const v = VEREDICTOS[revision.veredicto];
  const pendientes = revision.cambios.filter((c, i) => c.aplicable && !aplicados.has(i));

  return (
    <Card padding="p-0" className={`overflow-hidden border-l-2 ${v.borde}`}>
      <button
        type="button"
        onClick={() => setAbierto((s) => !s)}
        aria-expanded={abierto}
        className="flex w-full items-start gap-2 px-3 py-2.5 text-left"
      >
        <v.Icono size={18} className={`mt-0.5 shrink-0 ${v.color}`} />
        <div className="min-w-0 flex-1">
          <p className="text-secondary font-medium text-text">{v.titulo}</p>
          <p className="text-micro truncate text-text-tertiary">
            {revision.hallazgos.length} hallazgo{revision.hallazgos.length === 1 ? "" : "s"} ·{" "}
            {revision.cambios.length} cambio{revision.cambios.length === 1 ? "" : "s"} propuesto
            {revision.cambios.length === 1 ? "" : "s"}
          </p>
        </div>
        {abierto ? (
          <ChevronUp size={16} className="mt-0.5 shrink-0 text-text-secondary" />
        ) : (
          <ChevronDown size={16} className="mt-0.5 shrink-0 text-text-secondary" />
        )}
      </button>

      {abierto && (
        <div className="space-y-3 border-t border-border p-3">
          <p className="text-caption text-text-secondary">{revision.resumen || v.bajada}</p>

          {revision.hallazgos.length > 0 && (
            <div className="space-y-1.5">
              {revision.hallazgos.map((h, i) => (
                <div key={i} className="radius-control bg-surface-2 px-2.5 py-2">
                  <p className={`text-micro font-semibold ${COLOR_GRAVEDAD[h.gravedad]}`}>
                    {LABEL_CATEGORIA[h.categoria]} · {h.gravedad}
                  </p>
                  <p className="text-caption mt-0.5 text-text-secondary">{h.detalle}</p>
                </div>
              ))}
            </div>
          )}

          {revision.cambios.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold tracking-wide text-text-tertiary">CAMBIOS PROPUESTOS</span>
                {pendientes.length > 1 && (
                  <button type="button" onClick={onAplicarTodos} className="text-caption font-medium text-vip underline">
                    Aplicar los {pendientes.length}
                  </button>
                )}
              </div>
              {revision.cambios.map((c, i) => {
                const yaAplicado = aplicados.has(i);
                return (
                  <div key={i} className="radius-control border border-border px-2.5 py-2">
                    <p className="text-caption font-medium text-text">
                      Día {c.dia} · {descripcionCambio(c)}
                    </p>
                    <p className="text-micro mt-0.5 text-text-tertiary">{c.motivo}</p>
                    {yaAplicado ? (
                      <p className="text-micro mt-1.5 flex items-center gap-1 text-success">
                        <CheckCircle2 size={12} /> Aplicado al borrador
                      </p>
                    ) : c.aplicable ? (
                      <Button size="xsAuto" variant="secondary" onClick={() => onAplicar(i)} className="mt-1.5">
                        Aplicar
                      </Button>
                    ) : (
                      <p className="text-micro mt-1.5 text-text-tertiary">
                        Sugerencia para hacer a mano: el ejercicio propuesto no está en la biblioteca o el día ya cambió.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {error && <p className="text-caption text-error">{error}</p>}

          <button
            type="button"
            onClick={onRevisar}
            disabled={revisando}
            className="text-caption font-medium text-vip underline disabled:opacity-40"
          >
            {revisando ? "Analizando…" : "Volver a analizar con los cambios actuales"}
          </button>
        </div>
      )}
    </Card>
  );
}
