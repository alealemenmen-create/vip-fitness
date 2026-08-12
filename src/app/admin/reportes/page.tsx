import { Bug } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ListaReportesBugs, type ReporteBug } from "@/components/admin/ListaReportesBugs";
import { Card } from "@/components/ui/Card";
import { nombreAlumnoPublicado } from "@/lib/nombre";

export default async function ReportesBugsPage() {
  await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();

  const { data: filas, error } = await supabase
    .from("reportes_bugs")
    .select("id, alumno_id, ruta, descripcion, captura_path, dispositivo, estado, creado_en")
    .order("creado_en", { ascending: false })
    .limit(100);

  // La tabla puede no existir todavía (migración sin correr). Mismo criterio
  // que /admin/gastos: se explica qué falta en vez de reventar la pantalla.
  if (error) {
    return (
      <div className="space-y-6 pb-8">
        <AdminPageHeader
          eyebrow="Más · Soporte"
          title="Errores reportados"
          description="Lo que los alumnos avisan desde el botón de reportar fallas."
          backHref="/admin/configuracion"
        />
        <Card className="border border-warning/40" padding="p-5">
          <Bug size={22} className="text-warning" />
          <p className="text-body mt-2 font-bold text-text">Falta activar los reportes</p>
          <p className="text-caption mt-1 text-text-secondary">
            Corre la migración 0072_reportes_bugs.sql. Después aparecerán acá los avisos que manden
            los alumnos.
          </p>
        </Card>
      </div>
    );
  }

  const idsAlumnos = [...new Set((filas ?? []).map((f) => f.alumno_id))];
  const { data: perfiles } = idsAlumnos.length
    ? await supabase.from("perfiles").select("id, nombre").in("id", idsAlumnos)
    : { data: [] };
  const nombres = new Map((perfiles ?? []).map((p) => [p.id, p.nombre]));

  // Las capturas viven en un bucket PRIVADO: hay que firmar cada URL. Se
  // firman todas de una sola llamada — una por reporte serían 100 idas y
  // vueltas para abrir la pantalla.
  const rutasCaptura = (filas ?? []).map((f) => f.captura_path).filter((r): r is string => !!r);
  const { data: firmadas } = rutasCaptura.length
    ? await supabase.storage.from("reportes-bugs").createSignedUrls(rutasCaptura, 60 * 60)
    : { data: [] };
  const urlPorRuta = new Map(
    (firmadas ?? []).map((f) => [f.path, f.signedUrl] as const)
  );

  const reportes: ReporteBug[] = (filas ?? []).map((f) => ({
    id: f.id,
    alumnoNombre: nombreAlumnoPublicado(nombres.get(f.alumno_id) ?? "Alumno"),
    ruta: f.ruta,
    descripcion: f.descripcion,
    capturaUrl: f.captura_path ? (urlPorRuta.get(f.captura_path) ?? null) : null,
    dispositivo: f.dispositivo,
    estado: f.estado,
    creadoEn: f.creado_en,
  }));

  const pendientes = reportes.filter((r) => r.estado === "pendiente").length;

  return (
    <div className="space-y-6 pb-8">
      <AdminPageHeader
        eyebrow="Más · Soporte"
        title="Errores reportados"
        description="Lo que los alumnos avisan desde el botón de reportar fallas, con la captura del momento."
        backHref="/admin/configuracion"
      />
      {reportes.length === 0 ? (
        <Card padding="p-5">
          <Bug size={22} className="text-text-tertiary" />
          <p className="text-body mt-2 font-bold text-text">Ningún error reportado</p>
          <p className="text-caption mt-1 text-text-secondary">
            Cuando un alumno toque el botón de reportar falla, su aviso aparece acá con la captura de
            lo que estaba viendo.
          </p>
        </Card>
      ) : (
        <ListaReportesBugs reportes={reportes} pendientes={pendientes} />
      )}
    </div>
  );
}
