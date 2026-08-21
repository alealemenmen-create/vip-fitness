import Link from "next/link";
import { Lightbulb, ChevronRight, Dumbbell } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { ReporteAlumno } from "@/app/admin/alumnos/data";

const MAXIMO_VISIBLE = 5;

/** Qué tan urgente es revisar a este alumno — no es solo "atención sí/no",
 * ordena DENTRO de los que están en atención: sin rutina asignada primero
 * (no puede ni empezar), después quien nunca entrenó, después por días sin
 * entrenar (más días, más arriba). Reusa los mismos campos que ya calcula
 * `obtenerIndicadores`, no agrega ninguna consulta nueva. */
function severidad(r: ReporteAlumno): number {
  if (r.sesionesAsignadas === 0) return 100000;
  if (r.diasSinEntrenar === null) return 90000;
  return r.diasSinEntrenar;
}

/**
 * Canal de sugerencias del entrenador: mismo motor que ya alimenta el
 * semáforo de `/admin/alumnos` (`obtenerIndicadores`/`ReporteAlumno.motivo`),
 * pero con vidriera propia arriba de la lista — antes había que abrir la
 * vista detallada o entrar a cada ficha para enterarse de POR QUÉ un alumno
 * necesita atención; acá está listo para actuar de un vistazo.
 */
export function SugerenciasHoy({
  reportes,
  baseHref = "/admin/alumnos",
}: {
  reportes: ReporteAlumno[];
  /** Ver `ListaAlumnos` — mismo criterio para que Control VIP V2 abra su
   * propia ficha (`/control-vip/alumnos/[id]`) en vez de la clásica. */
  baseHref?: string;
}) {
  const sinRutina = reportes.filter((r) => r.motivo === "Sin rutina activa asignada");
  const enAtencion = reportes
    .filter((r) => r.estado === "atencion" && r.motivo !== "Sin rutina activa asignada")
    .sort((a, b) => severidad(b) - severidad(a));

  if (enAtencion.length === 0 && sinRutina.length === 0) return null;

  const visibles = enAtencion.slice(0, MAXIMO_VISIBLE);
  const restantes = enAtencion.length - visibles.length;

  return (
    <Card padding="p-0" className="admin-panel-card overflow-hidden border border-border">
      <div className="flex items-center gap-2 border-b border-border bg-surface-2/60 px-4 py-3.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-vip/10"><Lightbulb size={16} className="text-vip" /></span>
        <div>
          <p className="text-caption font-semibold text-text">Prioridades de hoy</p>
          <p className="text-[10px] text-text-tertiary">Alumnos que conviene revisar primero</p>
        </div>
      </div>
      {sinRutina.length > 0 && (
        <Link
          href="/admin/generador"
          className="group flex items-center gap-3 border-b border-border bg-error/5 px-4 py-3.5 transition-colors hover:bg-error/10"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-error/10 text-error">
            <Dumbbell size={16} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold text-text">
              {sinRutina.length} alumno{sinRutina.length === 1 ? "" : "s"} sin rutina
            </span>
            <span className="block text-[10px] text-text-tertiary">Abrir el generador y planificar</span>
          </span>
          <ChevronRight size={14} className="text-text-tertiary transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
      <div className="divide-y divide-border">
        {visibles.map((r) => (
          <Link
            key={r.alumnoId}
            href={`${baseHref}/${r.alumnoId}`}
            className="group flex items-center gap-2 px-4 py-3 transition-colors hover:bg-surface-2 active:bg-surface-2"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-caption font-medium text-text">{r.nombre}</p>
              <p className="truncate text-micro text-text-tertiary">{r.motivo}</p>
            </div>
            <ChevronRight size={14} className="shrink-0 text-text-tertiary transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>
      {restantes > 0 && (
        <p className="border-t border-border px-4 py-2 text-micro text-text-tertiary">
          +{restantes} alumno{restantes === 1 ? "" : "s"} más para revisar en el directorio.
        </p>
      )}
    </Card>
  );
}
