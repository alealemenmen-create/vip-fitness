import { Trash2 } from "lucide-react";
import { requireControlVipV2Admin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import {
  ListaSolicitudesBorrado,
  type SolicitudBorrado,
} from "@/components/admin/ListaSolicitudesBorrado";
import { Card } from "@/components/ui/Card";

/** Misma pantalla que `/admin/borrados`, mismos componentes y datos. */
export default async function ControlVipV2BorradosPage() {
  await requireControlVipV2Admin();
  const supabase = await createClient();

  const { data: filas, error } = await supabase
    .from("solicitudes_borrado_sesion")
    .select("id, alumno_id, sesion_id, dia_nombre, fecha_sesion, numero_calendario, motivo, estado, creado_en")
    .order("creado_en", { ascending: false })
    .limit(100);

  if (error) {
    return (
      <div className="space-y-6 pb-8">
        <AdminPageHeader
          eyebrow="Control VIP V2 · Piloto"
          title="Pedidos de borrado"
          description="Registros que los alumnos piden eliminar."
          backHref="/control-vip/mas"
        />
        <Card className="border border-warning/40" padding="p-5">
          <Trash2 size={22} className="text-warning" />
          <p className="text-body mt-2 font-bold text-text">Falta activar los pedidos de borrado</p>
          <p className="text-caption mt-1 text-text-secondary">
            Corre las migraciones 0075_borrar_sesion_sin_bloqueos.sql y
            0076_solicitudes_borrado_sesion.sql. Después aparecerán acá los pedidos de los alumnos.
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

  const solicitudes: SolicitudBorrado[] = (filas ?? []).map((f) => ({
    id: f.id,
    alumnoNombre: nombres.get(f.alumno_id) ?? "Alumno",
    diaNombre: f.dia_nombre,
    fechaSesion: f.fecha_sesion,
    numeroCalendario: f.numero_calendario,
    motivo: f.motivo,
    estado: f.estado as SolicitudBorrado["estado"],
    creadoEn: f.creado_en,
    sesionExiste: f.sesion_id !== null,
  }));

  const pendientes = solicitudes.filter((s) => s.estado === "pendiente").length;

  return (
    <div className="space-y-6 pb-8">
      <AdminPageHeader
        eyebrow="Control VIP V2 · Piloto"
        title="Pedidos de borrado"
        description="Borrar un registro elimina sus datos y sus Puntos VIP, y no se puede deshacer. Por eso lo decides tú y no el alumno."
        backHref="/control-vip/mas"
      />
      <ListaSolicitudesBorrado solicitudes={solicitudes} pendientes={pendientes} />
    </div>
  );
}
