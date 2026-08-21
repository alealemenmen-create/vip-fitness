import { Bug, Flag, ShieldCheck } from "lucide-react";
import { requireControlVipV2Admin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ListaReportesBugs, type ReporteBug } from "@/components/admin/ListaReportesBugs";
import { Card } from "@/components/ui/Card";
import { nombreAlumnoPublicado } from "@/lib/nombre";
import { resolverReporteComunidad } from "@/app/admin/reportes/actions";

/** Misma pantalla que `/admin/reportes`, mismos componentes, datos y acción. */
export default async function ControlVipV2ReportesPage() {
  await requireControlVipV2Admin();
  const supabase = await createClient();

  const { data: filas, error } = await supabase
    .from("reportes_bugs")
    .select("id, alumno_id, ruta, descripcion, captura_path, dispositivo, estado, creado_en")
    .order("creado_en", { ascending: false })
    .limit(100);

  if (error) {
    return (
      <div className="space-y-6 pb-8">
        <AdminPageHeader
          eyebrow="Control VIP V2 · Piloto"
          title="Errores reportados"
          description="Lo que los alumnos avisan desde el botón de reportar fallas."
          backHref="/control-vip/mas"
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
  const [{ data: perfiles }, { data: telefonos }] = idsAlumnos.length
    ? await Promise.all([
        supabase.from("perfiles").select("id, nombre").in("id", idsAlumnos),
        supabase.from("alumno_perfil").select("user_id, telefono").in("user_id", idsAlumnos),
      ])
    : [{ data: [] }, { data: [] }];
  const nombres = new Map((perfiles ?? []).map((p) => [p.id, p.nombre]));
  const telefonoPorId = new Map((telefonos ?? []).map((t) => [t.user_id, t.telefono]));

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
    alumnoTelefono: telefonoPorId.get(f.alumno_id) ?? null,
    ruta: f.ruta,
    descripcion: f.descripcion,
    capturaUrl: f.captura_path ? (urlPorRuta.get(f.captura_path) ?? null) : null,
    dispositivo: f.dispositivo,
    estado: f.estado,
    creadoEn: f.creado_en,
  }));

  const pendientes = reportes.filter((r) => r.estado === "pendiente").length;
  const { data: reportesSociales, error: errorSocial } = await supabase
    .from("comunidad_reportes")
    .select("id, publicacion_id, reportado_por, motivo, estado, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  const idsPublicaciones = [...new Set((reportesSociales ?? []).map((reporte) => reporte.publicacion_id))];
  const idsReportantes = [...new Set((reportesSociales ?? []).map((reporte) => reporte.reportado_por))];
  const [{ data: publicacionesSociales }, { data: perfilesSociales }] = !errorSocial
    ? await Promise.all([
        idsPublicaciones.length ? supabase.from("comunidad_publicaciones").select("id, alumno_id, texto, estado, created_at").in("id", idsPublicaciones) : Promise.resolve({ data: [] }),
        idsReportantes.length ? supabase.from("perfiles").select("id, nombre").in("id", idsReportantes) : Promise.resolve({ data: [] }),
      ])
    : [{ data: [] }, { data: [] }];
  const publicacionPorId = new Map((publicacionesSociales ?? []).map((publicacion) => [publicacion.id, publicacion]));
  const reportantePorId = new Map((perfilesSociales ?? []).map((perfil) => [perfil.id, perfil.nombre]));

  return (
    <div className="space-y-6 pb-8">
      <AdminPageHeader
        eyebrow="Control VIP V2 · Piloto"
        title="Errores reportados"
        description="Lo que los alumnos avisan desde el botón de reportar fallas, con la captura del momento."
        backHref="/control-vip/mas"
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
      <section className="space-y-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">Comunidad V2</p>
          <h2 className="mt-1 text-lg font-bold text-text">Moderación social</h2>
        </div>
        {errorSocial ? (
          <Card className="border border-border" padding="p-5">
            <ShieldCheck size={21} className="text-text-tertiary" />
            <p className="text-caption mt-2 text-text-secondary">Se habilita al ejecutar la migración 0106_comunidad_social_v2.sql.</p>
          </Card>
        ) : !(reportesSociales ?? []).length ? (
          <Card padding="p-5"><ShieldCheck size={21} className="text-success" /><p className="text-body mt-2 font-bold text-text">Sin reportes sociales</p><p className="text-caption mt-1 text-text-secondary">La comunidad no tiene contenido pendiente de revisión.</p></Card>
        ) : (reportesSociales ?? []).map((reporte) => {
          const publicacion = publicacionPorId.get(reporte.publicacion_id);
          return <Card key={reporte.id} padding="p-4" className={reporte.estado === "pendiente" ? "border border-warning/35" : ""}>
            <div className="flex items-start gap-3"><Flag size={18} className="mt-0.5 shrink-0 text-warning" /><div className="min-w-0 flex-1"><p className="text-body font-bold text-text">{reporte.motivo}</p><p className="text-caption mt-1 text-text-secondary">Reportado por {nombreAlumnoPublicado(reportantePorId.get(reporte.reportado_por) ?? "Alumno")} · estado {reporte.estado}</p>{publicacion ? <p className="text-caption mt-3 rounded-xl bg-surface-2 p-3 text-text">{publicacion.texto || "Publicación con fotografía"}</p> : <p className="text-caption mt-3 text-text-tertiary">La publicación ya no está disponible.</p>}</div></div>
            {reporte.estado === "pendiente" ? <div className="mt-3 flex gap-2"><form action={resolverReporteComunidad}><input type="hidden" name="id" value={reporte.id} /><input type="hidden" name="decision" value="ocultar" /><button type="submit" className="rounded-xl bg-error/15 px-3 py-2 text-xs font-semibold text-error">Ocultar publicación</button></form><form action={resolverReporteComunidad}><input type="hidden" name="id" value={reporte.id} /><input type="hidden" name="decision" value="descartar" /><button type="submit" className="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-text-secondary">Descartar reporte</button></form></div> : null}
          </Card>;
        })}
      </section>
    </div>
  );
}
