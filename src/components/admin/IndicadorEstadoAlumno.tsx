import { AlertTriangle, Star, Diamond } from "lucide-react";
import type { IndicadorAlumno } from "@/app/admin/alumnos/data";

const CONFIG = {
  atencion: { Icon: AlertTriangle, color: "var(--color-error)", etiqueta: "Atención" },
  normal: { Icon: Diamond, color: "var(--color-text-secondary)", etiqueta: "Normal" },
  destacado: { Icon: Star, color: "var(--color-vip)", etiqueta: "Felicitar" },
} as const;

/** Semáforo compacto para la lista de alumnos. */
export function IndicadorEstadoAlumno({
  indicador,
  conTexto = false,
}: {
  indicador: IndicadorAlumno;
  conTexto?: boolean;
}) {
  const { Icon, color, etiqueta } = CONFIG[indicador.estado];

  return (
    <span
      className="text-caption inline-flex items-center gap-1.5 font-medium"
      style={{ color }}
      title={indicador.motivo}
    >
      <Icon size={16} strokeWidth={2.25} />
      {conTexto && etiqueta}
    </span>
  );
}

/** Bloque con el detalle de por qué el alumno está en ese estado — se usa en
 * la ficha individual, donde sí hay lugar para explicarlo. */
export function DetalleEstadoAlumno({ indicador }: { indicador: IndicadorAlumno }) {
  const { Icon, color, etiqueta } = CONFIG[indicador.estado];

  return (
    <div className="radius-card border border-border p-4">
      <div className="mb-3 flex items-center gap-2" style={{ color }}>
        <Icon size={20} strokeWidth={2.25} />
        <p className="text-card-title">{etiqueta}</p>
      </div>

      <p className="text-body mb-3 text-text-secondary">{indicador.motivo}</p>

      <div className="grid grid-cols-3 gap-2 border-t border-border pt-3 text-center">
        <div>
          <p className="text-h3 text-text">{indicador.pctSesiones}%</p>
          <p className="text-caption text-text-tertiary">
            Sesiones del mes ({indicador.sesionesHechas}/{indicador.sesionesAsignadas})
          </p>
        </div>
        <div className="border-x border-border">
          <p className="text-h3 text-text">{indicador.diasConComida}/7</p>
          <p className="text-caption text-text-tertiary">Días con comidas</p>
        </div>
        <div>
          <p className="text-h3 text-text">
            {indicador.diasSinEntrenar === null ? "—" : indicador.diasSinEntrenar}
          </p>
          <p className="text-caption text-text-tertiary">Días sin entrenar</p>
        </div>
      </div>
    </div>
  );
}
