import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { obtenerBibliotecaSinCache } from "@/lib/ejercicios/data";
import { GaleriaEjercicios, type ReporteFotoPendiente } from "@/components/admin/GaleriaEjercicios";
import { TituloPestana } from "@/components/admin/TituloPestana";

export default async function EjerciciosAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ demoSolicitudFoto?: string }>;
}) {
  await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();
  // Sin caché a propósito — ver `obtenerBibliotecaSinCache`: esta es la
  // pantalla donde el entrenador acaba de subir una foto y tiene que verla.
  const biblioteca = await obtenerBibliotecaSinCache();
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
    <div className="space-y-4 pb-4">
      <TituloPestana>
        <p className="text-caption text-text-tertiary">GALERÍA</p>
        <h1 className="text-h2 text-text">Fotos de ejercicios</h1>
      </TituloPestana>
      <p className="text-secondary text-text-secondary">
        Toca la foto de cualquier ejercicio para subir una nueva o cambiar la que tiene. Se publica
        para los alumnos al instante.
      </p>
      <GaleriaEjercicios ejercicios={biblioteca} reportes={reportes} />
    </div>
  );
}
