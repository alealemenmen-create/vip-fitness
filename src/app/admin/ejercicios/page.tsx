import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  obtenerBibliotecaSinCache,
  obtenerEjerciciosIncompletos,
  obtenerHistorialFusiones,
  obtenerVersionesAnterioresFotos,
} from "@/lib/ejercicios/data";
import { GaleriaEjercicios, type ReporteFotoPendiente } from "@/components/admin/GaleriaEjercicios";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminStatCard } from "@/components/admin/AdminStatCard";
import { CircleAlert, Dumbbell, Images } from "lucide-react";
import { obtenerInventarioUsosRutina } from "@/lib/ejercicios/inventario";
import { obtenerCambiosRecientesMultimedia } from "@/app/admin/ejercicios/multimediaActions";
import { obtenerItemsIngestaHuerfanos } from "@/app/admin/ejercicios/ingestaActions";

export default async function EjerciciosAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ demoSolicitudFoto?: string }>;
}) {
  await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();
  // Sin caché a propósito — ver `obtenerBibliotecaSinCache`: esta es la
  // pantalla donde el entrenador acaba de subir una foto y tiene que verla.
  const [
    biblioteca,
    inventario,
    historialFusiones,
    versionesAnterioresFotos,
    ejerciciosIncompletos,
    cambiosRecientesMultimedia,
    itemsIngestaHuerfanos,
  ] = await Promise.all([
    obtenerBibliotecaSinCache(),
    obtenerInventarioUsosRutina(),
    obtenerHistorialFusiones(),
    obtenerVersionesAnterioresFotos(),
    obtenerEjerciciosIncompletos(),
    obtenerCambiosRecientesMultimedia(),
    obtenerItemsIngestaHuerfanos(),
  ]);
  const { data: filasReportes } = await supabase
    .from("reportes_fotos_ejercicios")
    .select("id, alumno_id, ejercicio_id, nombre_ejercicio, foto_url_reportada, creado_en")
    .eq("estado", "pendiente")
    .order("creado_en", { ascending: false });
  const idsAlumnos = [...new Set((filasReportes ?? []).map((fila) => fila.alumno_id))];
  const { data: perfiles } = idsAlumnos.length
    ? await supabase.from("perfiles").select("id, nombre").in("id", idsAlumnos)
    : { data: [] };
  const nombres = new Map((perfiles ?? []).map((perfil) => [perfil.id, perfil.nombre]));
  const reportes: ReporteFotoPendiente[] = (filasReportes ?? []).map((fila) => ({
    id: fila.id,
    ejercicioId: fila.ejercicio_id,
    nombreEjercicio: fila.nombre_ejercicio,
    fotoUrl: fila.foto_url_reportada,
    creadoEn: fila.creado_en,
    alumnoNombre: nombres.get(fila.alumno_id) ?? "Alumno",
  }));
  const { demoSolicitudFoto } = await searchParams;
  const conFoto = biblioteca.filter((ejercicio) => ejercicio.fotoMiniaturaUrl || ejercicio.fotoCompletaUrl).length;
  if (demoSolicitudFoto === "1") {
    const ejercicioDemo = biblioteca.find((ejercicio) =>
      ejercicio.nombre.toLowerCase().includes("cuerda") && ejercicio.nombre.toLowerCase().includes("jal")
    );
    reportes.unshift({
      id: "demo-solicitud-foto",
      ejercicioId: ejercicioDemo?.id ?? null,
      nombreEjercicio: ejercicioDemo?.nombre ?? "Jal\u00f3n con cuerda",
      fotoUrl: null,
      creadoEn: new Date().toISOString(),
      alumnoNombre: "Solicitud de ejemplo",
    });
  }

  return (
    <div className="space-y-6 pb-8">
      <AdminPageHeader
        eyebrow="Ejercicios"
        title="Galería multimedia"
        description="Administra fotos y clips técnicos. La vista previa coincide con lo que verá el alumno en su rutina."
      />
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3" aria-label="Resumen de ejercicios">
        <AdminStatCard href="/admin/ejercicios#biblioteca-ejercicios" icon={<Dumbbell size={20} />} value={biblioteca.length} label="Ejercicios" detail="Ver biblioteca disponible" color="#3b82f6" />
        <AdminStatCard href="/admin/ejercicios#inventario-ejercicios" icon={<Images size={20} />} value={`${conFoto} · ${biblioteca.length - conFoto}`} label="Con foto · Sin foto" detail="Ver inventario alfabético" color="#a78bfa" />
        <AdminStatCard href="/admin/ejercicios#reportes-ejercicios" icon={<CircleAlert size={20} />} value={reportes.length} label="Reportes" detail="Revisar imágenes señaladas" color={reportes.length ? "#f59e0b" : "#22c55e"} />
      </section>
      <section id="biblioteca-ejercicios" className="admin-panel-card scroll-mt-28 rounded-3xl p-4 md:p-5">
        <span id="reportes-ejercicios" className="block scroll-mt-28" />
        <GaleriaEjercicios ejercicios={biblioteca} reportes={reportes} usosPorEjercicio={inventario.usosPorEjercicio} nombresRutinaSinVincular={inventario.nombresSinVincular} historialFusiones={historialFusiones} versionesAnterioresFotos={versionesAnterioresFotos} ejerciciosIncompletos={ejerciciosIncompletos} cambiosRecientesMultimedia={cambiosRecientesMultimedia} itemsIngestaHuerfanos={itemsIngestaHuerfanos} />
      </section>
    </div>
  );
}
