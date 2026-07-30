import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/auth";
import {
  obtenerBibliotecaDocumentos,
  obtenerAlumnosParaAsignar,
} from "@/lib/documentos/data";
import { DocumentosManager } from "@/components/admin/DocumentosManager";

export default async function DocumentosPage() {
  await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();

  const [documentos, alumnos] = await Promise.all([
    obtenerBibliotecaDocumentos(supabase),
    obtenerAlumnosParaAsignar(supabase),
  ]);

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-h2 text-text">Documentos</h1>
        <p className="text-caption mt-1 text-text-secondary">
          Todos los archivos que has subido, en un solo lugar. Desde aquí puedes enviarle el mismo
          documento a otros alumnos, quitárselo, reemplazar el archivo o eliminarlo, sin entrar a
          cada perfil. Para subir uno nuevo, entra al perfil del alumno.
        </p>
      </div>

      <DocumentosManager documentos={documentos} alumnos={alumnos} />
    </div>
  );
}
