import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAlumno } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { leerFicha } from "@/lib/perfil-alumno/datos";
import { FichaAlumnoForm } from "@/components/student/FichaAlumnoForm";
import { guardarMiFicha } from "@/app/completar-perfil/actions";
import { Card } from "@/components/ui/Card";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Donde el alumno corrige su ficha después del ingreso. Es el mismo
 * cuestionario de `/completar-perfil` — un solo formulario, para que no haya
 * dos verdades sobre la misma persona. */
export default async function MiEntrenamientoPage() {
  const { alumnoId, soloLectura } = await requireAlumno();
  const supabase = await createClient();
  const ficha = await leerFicha(supabase as unknown as SupabaseClient, alumnoId);

  return (
    <div className="space-y-4 pb-8">
      <Link href="/alumno/inicio" className="flex items-center gap-2">
        <ArrowLeft size={20} className="text-text-secondary" />
        <h1 className="text-h3 text-text">Mi entrenamiento</h1>
      </Link>
      {soloLectura ? (
        <Card>
          <p className="text-body text-text-secondary">Vista de solo lectura.</p>
        </Card>
      ) : (
        <>
          <p className="text-caption text-text-secondary">
            Si algo cambió —un dolor nuevo, otro objetivo, más o menos días— corrígelo acá y tu entrenador lo ve al
            armarte la próxima rutina.
          </p>
          <FichaAlumnoForm ficha={ficha} accion={guardarMiFicha} modo="edicion" />
        </>
      )}
    </div>
  );
}
