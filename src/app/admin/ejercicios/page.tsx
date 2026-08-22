import Link from "next/link";
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
import { BotonRefrescarCatalogo } from "@/components/admin/BotonRefrescarCatalogo";
import { CircleAlert, Dumbbell, Images, Smartphone, Upload, WandSparkles } from "lucide-react";
import { obtenerInventarioUsosRutina } from "@/lib/ejercicios/inventario";
import { obtenerCambiosRecientesMultimedia } from "@/app/admin/ejercicios/multimediaActions";
import { obtenerItemsIngestaHuerfanos } from "@/app/admin/ejercicios/ingestaActions";

export default async function EjerciciosAdminPage() {
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
  const conFoto = biblioteca.filter((ejercicio) => ejercicio.fotoMiniaturaUrl || ejercicio.fotoCompletaUrl).length;

  return (
    <div className="space-y-6 pb-8">
      <AdminPageHeader
        eyebrow="Ejercicios"
        title="Galería multimedia"
        description="Centro de control para crear, subir, reemplazar, reparar, combinar y revisar fotos y videos de ejercicios."
        actions={<>
          <Link href="/admin/ejercicios#biblioteca-ejercicios" className="btn-accion radius-control flex min-h-10 items-center justify-center gap-2 px-3 text-xs font-bold"><Upload size={15} /> Subir o crear</Link>
          <Link href="/admin/estudio-vip" className="boton-panel-secundario"><Smartphone size={15} /> Estudio VIP</Link>
          <Link href="/admin/generador" className="boton-panel-secundario"><WandSparkles size={15} /> Usar en rutina</Link>
          <BotonRefrescarCatalogo />
        </>}
      />
      <section className="grid gap-3 md:grid-cols-3" aria-label="Flujo recomendado de multimedia">
        <a href="#carga-masiva-ejercicios" className="admin-panel-card rounded-2xl p-4 transition hover:border-vip/40"><span className="text-[10px] font-black uppercase tracking-widest text-vip">1 · Cargar</span><strong className="mt-2 block text-sm text-text">Archivos individuales o masivos</strong><p className="mt-1 text-xs leading-relaxed text-text-secondary">Arrastra fotos y videos; el sistema relaciona nombres, conserva la cola y permite reintentar.</p></a>
        <a href="#biblioteca-ejercicios" className="admin-panel-card rounded-2xl p-4 transition hover:border-vip/40"><span className="text-[10px] font-black uppercase tracking-widest text-vip">2 · Revisar</span><strong className="mt-2 block text-sm text-text">Vista exacta del alumno</strong><p className="mt-1 text-xs leading-relaxed text-text-secondary">Comprueba portada, clip, técnica, calidad y faltantes antes de usar el ejercicio.</p></a>
        <a href="#reportes-ejercicios" className="admin-panel-card rounded-2xl p-4 transition hover:border-vip/40"><span className="text-[10px] font-black uppercase tracking-widest text-vip">3 · Reparar</span><strong className="mt-2 block text-sm text-text">Versiones, fusiones y reportes</strong><p className="mt-1 text-xs leading-relaxed text-text-secondary">Restaura fotos, repara vínculos, combina duplicados y resuelve avisos sin perder historial.</p></a>
      </section>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3" aria-label="Resumen de ejercicios">
        <AdminStatCard href="/admin/ejercicios#biblioteca-ejercicios" icon={<Dumbbell size={20} />} value={biblioteca.length} label="Ejercicios" detail="Ver biblioteca disponible" color="#3b82f6" />
        <AdminStatCard href="/admin/ejercicios#inventario-ejercicios" icon={<Images size={20} />} value={`${conFoto} · ${biblioteca.length - conFoto}`} label="Con foto · Sin foto" detail="Ver inventario alfabético" color="#a78bfa" />
        <AdminStatCard href="/admin/ejercicios#reportes-ejercicios" icon={<CircleAlert size={20} />} value={reportes.length} label="Reportes" detail="Revisar imágenes señaladas" color={reportes.length ? "#f59e0b" : "#22c55e"} />
      </section>
      <section id="biblioteca-ejercicios" className="admin-panel-card scroll-mt-28 rounded-3xl p-4 md:p-5">
        <span id="reportes-ejercicios" className="block scroll-mt-28" />
        <span id="carga-masiva-ejercicios" className="block scroll-mt-28" />
        <GaleriaEjercicios ejercicios={biblioteca} reportes={reportes} usosPorEjercicio={inventario.usosPorEjercicio} nombresRutinaSinVincular={inventario.nombresSinVincular} historialFusiones={historialFusiones} versionesAnterioresFotos={versionesAnterioresFotos} ejerciciosIncompletos={ejerciciosIncompletos} cambiosRecientesMultimedia={cambiosRecientesMultimedia} itemsIngestaHuerfanos={itemsIngestaHuerfanos} />
      </section>
    </div>
  );
}
