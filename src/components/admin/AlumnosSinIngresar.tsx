import Link from "next/link";
import { ChevronRight, UserX } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { ResumenIngresoAlumno } from "@/lib/ingresos/data";
import { formatFechaHoraCorta } from "@/lib/date";

const MAXIMO_VISIBLE = 5;

/** Vidriera de "SIN ACTIVIDAD RECIENTE" de /admin/ingresos, arriba del
 * directorio, para que el entrenador lo vea sin entrar a esa pantalla
 * aparte. Misma fuente de datos, no duplica ningún cálculo. */
export function AlumnosSinIngresar({ resumen }: { resumen: ResumenIngresoAlumno[] }) {
  const inactivos = resumen
    .filter((r) => r.estado === "inactivo")
    .sort((a, b) => (a.ultimoIngreso && b.ultimoIngreso
      ? new Date(a.ultimoIngreso).getTime() - new Date(b.ultimoIngreso).getTime()
      : 0));

  if (inactivos.length === 0) return null;

  const visibles = inactivos.slice(0, MAXIMO_VISIBLE);
  const restantes = inactivos.length - visibles.length;

  return (
    <Card padding="p-0" className="admin-panel-card overflow-hidden border border-border">
      <Link
        href="/admin/ingresos?estado=sin_novedad#por-alumno"
        className="flex items-center gap-2 border-b border-border bg-surface-2/60 px-4 py-3.5 transition-colors hover:bg-surface-2"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-warning/10"><UserX size={16} className="text-warning" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-caption font-semibold text-text">Dejaron de entrar</p>
          <p className="text-[10px] text-text-tertiary">Sin ninguna actividad hace más de una semana</p>
        </div>
        <ChevronRight size={14} className="shrink-0 text-text-tertiary" />
      </Link>
      <div className="divide-y divide-border">
        {visibles.map((r) => (
          <Link
            key={r.alumnoId}
            href={`/admin/alumnos/${r.alumnoId}`}
            className="group flex items-center gap-2 px-4 py-3 transition-colors hover:bg-surface-2 active:bg-surface-2"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-caption font-medium text-text">{r.nombre}</p>
              <p className="truncate text-micro text-text-tertiary">
                {r.ultimoIngreso ? `Último ingreso: ${formatFechaHoraCorta(r.ultimoIngreso)}` : "Sin ingresos registrados"}
              </p>
            </div>
            <ChevronRight size={14} className="shrink-0 text-text-tertiary transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>
      {restantes > 0 && (
        <p className="border-t border-border px-4 py-2 text-micro text-text-tertiary">
          +{restantes} alumno{restantes === 1 ? "" : "s"} más sin actividad reciente.
        </p>
      )}
    </Card>
  );
}
