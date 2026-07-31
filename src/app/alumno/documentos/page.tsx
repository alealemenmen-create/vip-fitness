import { createClient } from "@/lib/supabase/server";
import { requireAlumno } from "@/lib/auth";
import { ListaDocumentos } from "@/components/student/ListaDocumentos";
import { obtenerDocumentos } from "./data";

export default async function DocumentosPage() {
  const { alumnoId } = await requireAlumno();
  const supabase = await createClient();

  const documentos = await obtenerDocumentos(supabase, alumnoId);

  return (
    <div className="space-y-6 pb-8">
      {/* "Mis planes" y no "Documentos": para el alumno esto es donde están la
          rutina y la dieta que le dejó el entrenador. Mismo nombre que en el
          menú, para que no parezcan dos pantallas distintas. */}
      <h1 className="text-h2 text-text">Mis planes</h1>
      <ListaDocumentos documentos={documentos} />
    </div>
  );
}
