import Link from "next/link";
import { headers } from "next/headers";
import { CircleCheck, Clock3, Inbox, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/auth";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { LinkRegistro } from "@/components/admin/LinkRegistro";
import { SolicitudCard, type SolicitudPendiente } from "@/components/admin/SolicitudCard";
import { obtenerConfiguracionRegistro } from "@/lib/configuracion/registro";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminStatCard } from "@/components/admin/AdminStatCard";

export default async function SolicitudesPage() {
  await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();
  const config = await obtenerConfiguracionRegistro();

  // El link se arma con el host de esta misma petición para que funcione desde
  // donde sea que se esté usando el panel (dominio de producción, la IP del
  // gimnasio en la LAN, localhost). NEXT_PUBLIC_SITE_URL manda cuando está
  // definida: es la URL pública "de verdad" y la que conviene compartir.
  const cabeceras = await headers();
  const host = cabeceras.get("host") ?? "localhost:3000";
  const protocolo = cabeceras.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const urlRegistro = `${process.env.NEXT_PUBLIC_SITE_URL || `${protocolo}://${host}`}/registro`;

  const { data: solicitudes } = await supabase
    .from("solicitudes_registro")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(60);

  const filas = solicitudes ?? [];
  const filasPendientes = filas.filter((s) => s.estado === "pendiente");

  // El bucket de comprobantes es privado: cada carga firma una URL temporal
  // para las que tengan archivo. Una hora alcanza de sobra para revisarlas.
  const rutas = filasPendientes.map((s) => s.comprobante_path).filter((p): p is string => !!p);
  const urlsFirmadas = new Map<string, string>();
  if (rutas.length > 0) {
    const { data: firmadas } = await supabase.storage
      .from("comprobantes")
      .createSignedUrls(rutas, 60 * 60);
    for (const firmada of firmadas ?? []) {
      if (firmada.path && firmada.signedUrl) urlsFirmadas.set(firmada.path, firmada.signedUrl);
    }
  }

  const pendientes: SolicitudPendiente[] = filasPendientes.map((s) => ({
    id: s.id,
    nombre: s.nombre,
    email: s.email,
    telefono: s.telefono,
    comprobanteUrl: s.comprobante_path ? (urlsFirmadas.get(s.comprobante_path) ?? null) : null,
    comprobanteEsPdf: !!s.comprobante_path?.toLowerCase().endsWith(".pdf"),
    pagoVerificado: s.pago_verificado,
    fechaNacimiento: s.fecha_nacimiento,
    sexo: s.sexo,
    estaturaCm: s.estatura_cm,
    pesoKg: s.peso_kg,
    objetivo: s.objetivo,
    condicionMedica: s.condicion_medica,
    restriccionAlimenticia: s.restriccion_alimenticia,
    mensaje: s.mensaje,
    createdAt: s.created_at,
  }));

  const resueltas = filas.filter((s) => s.estado !== "pendiente").slice(0, 15);

  return (
    <div className="space-y-6 pb-8">
      <AdminPageHeader
        eyebrow="Admisiones"
        title="Solicitudes de ingreso"
        description="Verifica los datos, el comprobante y la ficha inicial antes de activar a un nuevo alumno."
        backHref="/admin/alumnos"
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3" aria-label="Resumen de solicitudes">
        <AdminStatCard href="/admin/solicitudes#solicitudes-pendientes" icon={<Clock3 size={20} />} value={pendientes.length} label="Pendientes" detail="Ver solicitudes por revisar" color={pendientes.length ? "#f59e0b" : "#22c55e"} />
        <AdminStatCard href="/admin/solicitudes#solicitudes-resueltas" icon={<CircleCheck size={20} />} value={resueltas.length} label="Resueltas" detail="Ver últimas decisiones" color="#22c55e" />
        <AdminStatCard href="/admin/solicitudes#link-inscripcion" icon={<Users size={20} />} value={filas.length} label="Solicitudes" detail="Compartir link de registro" color="#3b82f6" />
      </section>

      <section id="link-inscripcion" className="admin-panel-card scroll-mt-28 rounded-3xl p-4 md:p-5">
        <LinkRegistro url={urlRegistro} />
      </section>

      <section id="solicitudes-pendientes" className="scroll-mt-28 space-y-3">
      {pendientes.length === 0 ? (
        <Card>
          <div className="flex items-center gap-3">
            <Inbox size={20} className="text-text-tertiary" />
            <p className="text-body text-text-secondary">
              No hay solicitudes esperando. Cuando alguien se inscriba por el link, aparece aquí.
            </p>
          </div>
        </Card>
      ) : (
        <>
          <p className="text-caption pt-2 text-text-tertiary">
            {pendientes.length === 1
              ? "1 SOLICITUD ESPERANDO"
              : `${pendientes.length} SOLICITUDES ESPERANDO`}
          </p>
          {pendientes.map((solicitud) => (
            <SolicitudCard key={solicitud.id} solicitud={solicitud} pagoActivo={config.pagoActivo} />
          ))}
        </>
      )}
      </section>

      <section id="solicitudes-resueltas" className="scroll-mt-28 space-y-3">
      {resueltas.length > 0 ? (
        <>
          <p className="text-caption pt-4 text-text-tertiary">YA RESUELTAS</p>
          <Card>
            <div className="space-y-3">
              {resueltas.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-body truncate uppercase text-text">{s.nombre}</p>
                    <p className="text-caption truncate text-text-tertiary">
                      {s.motivo_rechazo || s.email}
                    </p>
                  </div>
                  {s.estado === "aceptada" && s.alumno_id ? (
                    <Link href={`/admin/alumnos/${s.alumno_id}`} className="shrink-0">
                      <Pill tone="success">Aceptada</Pill>
                    </Link>
                  ) : (
                    <Pill tone={s.estado === "aceptada" ? "success" : "neutral"} className="shrink-0">
                      {s.estado === "aceptada" ? "Aceptada" : "Rechazada"}
                    </Pill>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </>
      ) : (
        <Card><p className="text-body text-text-secondary">Todavía no hay solicitudes resueltas.</p></Card>
      )}
      </section>
    </div>
  );
}
