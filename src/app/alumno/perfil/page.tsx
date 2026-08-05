import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAlumno } from "@/lib/auth";
import { DatosPersonalesForm } from "@/components/student/DatosPersonalesForm";
import { CambiarMiPassword } from "@/components/admin/CambiarMiPassword";
import { CambiarCorreoForm } from "@/components/admin/CambiarCorreoForm";
import { Card } from "@/components/ui/Card";
import { obtenerDatosPersonales } from "./data";
import { cambiarMiCorreo } from "./actions";

export default async function PerfilPage() {
  const { alumnoId, soloLectura } = await requireAlumno();
  const supabase = await createClient();

  const datos = await obtenerDatosPersonales(supabase, alumnoId);

  return (
    <div className="space-y-4 pb-8">
      <Link href="/alumno/inicio" className="flex items-center gap-2">
        <ArrowLeft size={20} className="text-text-secondary" />
        <h1 className="text-h3 text-text">Mi perfil</h1>
      </Link>

      {soloLectura ? (
        <Card>
          <p className="text-body text-text-secondary">
            Estás viendo este perfil en modo solo lectura, no se puede editar desde aquí.
          </p>
        </Card>
      ) : (
        <>
          <DatosPersonalesForm datos={datos} />
          <CambiarMiPassword />
          <Card>
            <p className="text-caption mb-3 text-text-tertiary">MI CORREO</p>
            <CambiarCorreoForm accion={cambiarMiCorreo} />
          </Card>
        </>
      )}
    </div>
  );
}
