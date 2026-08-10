import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/auth";
import {
  obtenerBibliotecaDocumentos,
  obtenerAlumnosParaAsignar,
} from "@/lib/documentos/data";
import { obtenerBiblioteca } from "@/lib/ejercicios/data";
import { DocumentosManager } from "@/components/admin/DocumentosManager";
import { ArchivosManager } from "@/components/admin/ArchivosManager";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminStatCard } from "@/components/admin/AdminStatCard";
import { FileCheck2, FileUp, Users } from "lucide-react";

/** Desde aquí se analiza un PDF con IA y se publica la rutina, y las dos cosas
 * tardan más que el límite por defecto de Vercel (10 s): el análisis ronda los
 * 5 s y puede subir con un PDF grande. Sin esto, la función se corta a mitad y
 * el botón queda "Publicando…" para siempre. */
export const maxDuration = 60;

export default async function DocumentosPage() {
  await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();

  const [documentos, alumnos, ejercicios] = await Promise.all([
    obtenerBibliotecaDocumentos(supabase),
    obtenerAlumnosParaAsignar(supabase),
    obtenerBiblioteca(),
  ]);

  return (
    <div className="space-y-6 pb-8">
      <AdminPageHeader
        eyebrow="Centro de archivos"
        title="Documentos"
        description="Carga rutinas o planes, analízalos y asígnalos a uno o varios alumnos desde un solo lugar."
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3" aria-label="Resumen de documentos">
        <AdminStatCard href="/admin/documentos#biblioteca-documentos" icon={<FileCheck2 size={20} />} value={documentos.length} label="Documentos" detail="Ver biblioteca guardada" color="#3b82f6" />
        <AdminStatCard href="/admin/documentos#nueva-carga" icon={<Users size={20} />} value={alumnos.length} label="Alumnos" detail="Asignar un documento" color="#22c55e" />
        <AdminStatCard href="/admin/documentos#nueva-carga" icon={<FileUp size={20} />} value="Nueva" label="Cargar documento" detail="Rutina o alimentación · PDF/TXT" color="#a78bfa" />
      </section>

      <section id="nueva-carga" className="admin-panel-card scroll-mt-28 space-y-3 rounded-3xl p-4 md:p-5">
        <p className="text-caption font-semibold text-text-tertiary">NUEVA CARGA</p>
        <ArchivosManager
          documentos={[]}
          alumnos={alumnos}
          ejercicios={ejercicios.map((e) => ({ id: e.id, nombre: e.nombre, grupo: e.grupoMuscular, equipo: e.equipo }))}
        />
      </section>

      <section id="biblioteca-documentos" className="admin-panel-card scroll-mt-28 space-y-3 rounded-3xl p-4 md:p-5">
        <p className="text-caption font-semibold text-text-tertiary">BIBLIOTECA Y ASIGNACIONES</p>
        <DocumentosManager documentos={documentos} alumnos={alumnos} />
      </section>
    </div>
  );
}
