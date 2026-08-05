import Link from "next/link";
import { ArrowLeft, Eye } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAlumno } from "@/lib/auth";
import { obtenerPlanAlimentacion } from "@/app/alumno/comer/data";
import { EditorMisMacros } from "@/components/student/EditorMisMacros";
import { Card } from "@/components/ui/Card";

export default async function MacrosPage() {
  const { alumnoId, soloLectura } = await requireAlumno();
  const supabase = await createClient();
  const plan = await obtenerPlanAlimentacion(supabase, alumnoId);

  return (
    <div className="space-y-4 pb-8">
      <Link href="/alumno/inicio" className="flex items-center gap-2">
        <ArrowLeft size={20} className="text-text-secondary" />
        <h1 className="text-h3 text-text">Macros</h1>
      </Link>

      {soloLectura ? (
        <Card>
          <p className="text-body flex items-center gap-2 text-text-secondary">
            <Eye size={16} /> Modo solo lectura: no se puede editar la meta de otro alumno desde
            aquí.
          </p>
        </Card>
      ) : (
        <EditorMisMacros
          planActual={
            plan
              ? {
                  kcalObjetivo: plan.kcalObjetivo,
                  protObjetivo: plan.protObjetivo,
                  carbObjetivo: plan.carbObjetivo,
                  grasaObjetivo: plan.grasaObjetivo,
                }
              : null
          }
        />
      )}
    </div>
  );
}
