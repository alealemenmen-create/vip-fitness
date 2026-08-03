import Link from "next/link";
import { Lightbulb, ChevronRight } from "lucide-react";
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
export function SugerenciasHoy({ reportes }: { reportes: ReporteAlumno[] }) {
  const enAtencion = reportes
    .filter((r) => r.estado === "atencion")
    .sort((a, b) => severidad(b) - severidad(a));

  if (enAtencion.length === 0) return null;

  const visibles = enAtencion.slice(0, MAXIMO_VISIBLE);
  const restantes = enAtencion.length - visibles.length;

  return (
    <Card padding="p-0" className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border bg-surface-2 px-3 py-2">
        <Lightbulb size={14} className="text-vip" />
        <p className="text-caption font-semibold text-text">Sugerencias de hoy</p>
      </div>
      <div className="divide-y divide-border">
        {visibles.map((r) => (
          <Link
            key={r.alumnoId}
            href={`/admin/alumnos/${r.alumnoId}`}
            className="flex items-center gap-2 px-3 py-2 active:bg-surface-2"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-caption font-medium text-text">{r.nombre}</p>
              <p className="truncate text-micro text-text-tertiary">{r.motivo}</p>
            </div>
            <ChevronRight size={14} className="shrink-0 text-text-tertiary" />
          </Link>
        ))}
      </div>
      {restantes > 0 && (
        <p className="border-t border-border px-3 py-1.5 text-micro text-text-tertiary">
          +{restantes} alumno{restantes === 1 ? "" : "s"} más para revisar, en la lista de abajo.
        </p>
      )}
    </Card>
  );
}
