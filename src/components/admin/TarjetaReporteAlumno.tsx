import Link from "next/link";
import {
  ChevronRight,
  AlertTriangle,
  Star,
  Diamond,
  Dumbbell,
  UtensilsCrossed,
  Scale,
  BatteryMedium,
  CalendarClock,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { ReporteAlumno } from "@/app/admin/alumnos/data";
import { nombreAlumnoPublicado } from "@/lib/nombre";

const CONFIG = {
  atencion: { Icon: AlertTriangle, color: "var(--color-error)", etiqueta: "Atención" },
  normal: { Icon: Diamond, color: "var(--color-text-secondary)", etiqueta: "Normal" },
  destacado: { Icon: Star, color: "var(--color-vip)", etiqueta: "Felicitar" },
} as const;

function colorPorcentaje(pct: number): string {
  if (pct >= 85) return "var(--color-success)";
  if (pct >= 50) return "var(--color-vip)";
  return "var(--color-error)";
}

/** Una fila de dato del reporte: ícono, valor y una aclaración corta. */
function Dato({
  icono,
  valor,
  detalle,
  color,
}: {
  icono: React.ReactNode;
  valor: string;
  detalle: string;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="shrink-0 text-text-tertiary">{icono}</span>
      <div className="min-w-0">
        <p className="text-secondary font-medium" style={{ color: color ?? "var(--color-text)" }}>
          {valor}
        </p>
        <p className="text-caption truncate text-text-tertiary">{detalle}</p>
      </div>
    </div>
  );
}

/**
 * Todo el estado del alumno en la lista del entrenador, sin tener que entrar a
 * su ficha: cumplimiento del mes, comidas, peso, energía y avisos.
 */
export function TarjetaReporteAlumno({
  reporte,
  esTuPerfil = false,
}: {
  reporte: ReporteAlumno;
  esTuPerfil?: boolean;
}) {
  const { Icon, color, etiqueta } = CONFIG[reporte.estado];

  const textoComidas =
    reporte.kcalPromedio === null
      ? "Sin registros esta semana"
      : reporte.kcalObjetivo
        ? `meta ${reporte.kcalObjetivo} kcal`
        : "sin meta asignada";

  const desvioKcal =
    reporte.kcalPromedio !== null && reporte.kcalObjetivo
      ? Math.round(((reporte.kcalPromedio - reporte.kcalObjetivo) / reporte.kcalObjetivo) * 100)
      : null;

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span style={{ color }}>
              <Icon size={18} strokeWidth={2.25} />
            </span>
            <p className="text-card-title text-text">
              {nombreAlumnoPublicado(reporte.nombre)}
              {esTuPerfil && <span className="text-text-tertiary"> (Tú)</span>}
            </p>
          </div>
          <p className="text-caption mt-1" style={{ color }}>
            {etiqueta} · {reporte.motivo}
          </p>
        </div>
        <Link
          href={`/admin/alumnos/${reporte.alumnoId}`}
          className="text-caption flex shrink-0 items-center gap-1 text-text-tertiary"
        >
          Ficha <ChevronRight size={14} />
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 border-t border-border pt-4">
        <Dato
          icono={<Dumbbell size={16} />}
          valor={`${reporte.pctSesiones}%`}
          detalle={`${reporte.sesionesHechas}/${reporte.sesionesAsignadas} sesiones del mes`}
          color={colorPorcentaje(reporte.pctSesiones)}
        />

        <Dato
          icono={<CalendarClock size={16} />}
          valor={
            reporte.diasSinEntrenar === null
              ? "Nunca entrenó"
              : reporte.diasSinEntrenar === 0
                ? "Entrenó hoy"
                : `Hace ${reporte.diasSinEntrenar} d`
          }
          detalle="último entrenamiento"
          color={
            reporte.diasSinEntrenar !== null && reporte.diasSinEntrenar >= 7
              ? "var(--color-error)"
              : undefined
          }
        />

        <Dato
          icono={<UtensilsCrossed size={16} />}
          valor={
            reporte.kcalPromedio === null
              ? `${reporte.diasConComida}/7 días`
              : `${reporte.kcalPromedio} kcal`
          }
          detalle={
            desvioKcal !== null
              ? `${textoComidas} · ${desvioKcal > 0 ? "+" : ""}${desvioKcal}%`
              : textoComidas
          }
          color={
            desvioKcal !== null && Math.abs(desvioKcal) > 15 ? "var(--color-vip)" : undefined
          }
        />

        <Dato
          icono={<Scale size={16} />}
          valor={reporte.pesoActual !== null ? `${reporte.pesoActual} kg` : "Sin dato"}
          detalle={
            reporte.pesoVariacion !== null
              ? `${reporte.pesoVariacion > 0 ? "+" : ""}${reporte.pesoVariacion} kg en 30 días`
              : "sin peso registrado"
          }
        />

        <Dato
          icono={<BatteryMedium size={16} />}
          valor={reporte.energiaPromedio !== null ? `${reporte.energiaPromedio}/5` : "Sin dato"}
          detalle={`energía · ${reporte.diasConSeguimiento}/7 días reportados`}
          color={
            reporte.energiaPromedio !== null && reporte.energiaPromedio <= 2
              ? "var(--color-error)"
              : undefined
          }
        />

        <Dato
          icono={<UtensilsCrossed size={16} />}
          valor={`${reporte.diasConComida}/7 días`}
          detalle="registró comidas"
          color={reporte.diasConComida <= 2 ? "var(--color-error)" : undefined}
        />
      </div>

      {reporte.molestias.length > 0 && (
        <div className="radius-control mt-3 border border-error/40 p-3">
          <p className="text-caption mb-1 font-semibold text-error">
            Molestias reportadas esta semana
          </p>
          {reporte.molestias.slice(0, 2).map((m, i) => (
            <p key={i} className="text-caption text-text-secondary">
              &quot;{m}&quot;
            </p>
          ))}
        </div>
      )}

      {reporte.objetivo && (
        <p className="text-caption mt-3 text-text-tertiary">Objetivo: {reporte.objetivo}</p>
      )}
    </Card>
  );
}
