import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import type { SesionHistorial } from "@/app/alumno/entrenar/data";

const ESTADO_LABEL: Record<SesionHistorial["estado"], { texto: string; tone: "success" | "error" | "neutral" }> = {
  completada: { texto: "Completada", tone: "success" },
  finalizada_incompleta: { texto: "Incompleta", tone: "error" },
  abandonada: { texto: "Abandonada", tone: "neutral" },
};

export function HistorialEntrenamiento({
  rutinaActivaNombre,
  sesiones,
}: {
  rutinaActivaNombre: string | null;
  sesiones: SesionHistorial[];
}) {
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-caption text-text-tertiary">ENTRENAMIENTO</p>
        {rutinaActivaNombre && <Pill tone="neutral">{rutinaActivaNombre}</Pill>}
      </div>

      {sesiones.length === 0 ? (
        <p className="text-body text-text-secondary">Todavía no registra entrenamientos.</p>
      ) : (
        <div className="space-y-3">
          {sesiones.map((s) => {
            const estado = ESTADO_LABEL[s.estado];
            return (
              <div key={s.id} className="border-t border-border pt-3 first:border-t-0 first:pt-0">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-body text-text">
                      {s.numeroCalendario ? `#${s.numeroCalendario} · ` : ""}
                      {s.diaNombre}
                    </p>
                    <p className="text-caption text-text-tertiary">
                      {s.fecha} · {s.total === 0 ? "Descanso" : `${s.completados}/${s.total} ejercicios`}
                    </p>
                  </div>
                  <Pill tone={estado.tone}>{estado.texto}</Pill>
                </div>
                {s.comentario && (
                  <p className="text-secondary mt-2 text-text-secondary">&quot;{s.comentario}&quot;</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
