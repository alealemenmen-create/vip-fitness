import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/auth";
import {
  obtenerBibliotecaDocumentos,
  obtenerAlumnosParaAsignar,
} from "@/lib/documentos/data";
import { DocumentosManager } from "@/components/admin/DocumentosManager";
import { ArchivosManager } from "@/components/admin/ArchivosManager";

/** Desde aquí se analiza un PDF con IA y se publica la rutina, y las dos cosas
 * tardan más que el límite por defecto de Vercel (10 s): el análisis ronda los
 * 5 s y puede subir con un PDF grande. Sin esto, la función se corta a mitad y
 * el botón queda "Publicando…" para siempre. */
export const maxDuration = 60;

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
          documento a otros alumnos, quitárselo, reemplazar el archivo o eliminarlo.
        </p>
      </div>

      <p className="text-caption text-text-tertiary">RUTINA Y ALIMENTACIÓN</p>
      <ArchivosManager documentos={[]} alumnos={alumnos} />

      <DocumentosManager documentos={documentos} alumnos={alumnos} />
    </div>
  );
}
