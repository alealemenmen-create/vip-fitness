import { Card } from "@/components/ui/Card";
import type { SeguimientoDia } from "@/app/alumno/inicio/data";

function SiNo({ valor }: { valor: boolean | null }) {
  if (valor === null) return <span className="text-text-tertiary">—</span>;
  return <span className={valor ? "text-success" : "text-error"}>{valor ? "Sí" : "No"}</span>;
}

export function SeguimientoDiarioSoloLectura({ seguimientos }: { seguimientos: SeguimientoDia[] }) {
  return (
    <Card>
      <p className="text-caption mb-3 text-text-tertiary">SEGUIMIENTO DIARIO</p>

      {seguimientos.length === 0 ? (
        <p className="text-body text-text-secondary">Todavía no registra seguimiento diario.</p>
      ) : (
        <div className="space-y-3">
          {seguimientos.map((s) => (
            <div key={s.fecha} className="border-t border-border pt-3 first:border-t-0 first:pt-0">
              <div className="flex items-center justify-between">
                <p className="text-body text-text">{s.fecha}</p>
                <p className="text-caption text-text-tertiary">
                  Entrenó: <SiNo valor={s.entrenoHoy} /> · Comió bien: <SiNo valor={s.cumplioAlimentacion} />
                </p>
              </div>
              <p className="text-caption mt-1 text-text-tertiary">
                {s.aguaLitros !== null && `${s.aguaLitros}L agua · `}
                {s.horasSueno !== null && `${s.horasSueno}h sueño · `}
                {s.energia !== null && `Energía ${s.energia}/5`}
              </p>
              {s.molestias && <p className="text-secondary mt-1 text-error">Molestia: {s.molestias}</p>}
              {s.comentario && (
                <p className="text-secondary mt-1 text-text-secondary">&quot;{s.comentario}&quot;</p>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
