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
      <h1 className="text-h2 text-text">Documentos</h1>
      <ListaDocumentos documentos={documentos} />
    </div>
  );
}
