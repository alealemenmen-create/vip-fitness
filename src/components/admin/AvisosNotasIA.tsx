import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { AvisoNotaIA } from "@/app/admin/alumnos/data";
import { nombreAlumnoPublicado } from "@/lib/nombre";

/** Aviso de que la IA le dejó una nota a algún alumno (motivación por peso o
 * refuerzo semanal porque el entrenador no alcanzó a escribirle). Solo
 * informativo — se marca como visto al entrar a la ficha del alumno. */
export function AvisosNotasIA({ avisos }: { avisos: AvisoNotaIA[] }) {
  if (avisos.length === 0) return null;

  return (
    <Card className="space-y-3 p-4">
      <p className="flex items-center gap-1.5 text-caption text-text-tertiary">
        <Sparkles size={13} className="text-vip" /> LA IA LE DEJÓ NOTA A
      </p>
      <div className="space-y-2">
        {avisos.map((aviso, i) => (
          <Link
            key={`${aviso.alumnoId}-${i}`}
            href={`/admin/alumnos/${aviso.alumnoId}`}
            className="block rounded-xl bg-surface-2 px-3 py-2.5"
          >
            <p className="text-secondary font-medium text-text">
              {nombreAlumnoPublicado(aviso.nombre)}
            </p>
            <p className="truncate text-caption text-text-tertiary">{aviso.texto}</p>
          </Link>
        ))}
      </div>
    </Card>
  );
}
