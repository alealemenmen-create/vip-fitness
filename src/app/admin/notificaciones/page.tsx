import Link from "next/link";
import { Bell, Bug, Camera, Star, TrendingDown, Utensils } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { obtenerNotificacionesEntrenador, contarNotificacionesSinLeer } from "@/lib/notificaciones/data";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { MarcarNotificacionesLeidas } from "@/components/admin/MarcarNotificacionesLeidas";
import { Card } from "@/components/ui/Card";

const ICONOS: Record<string, typeof Bell> = {
  habito_comida: Utensils,
  habito_entrenamiento: TrendingDown,
  bug: Bug,
  resena: Star,
  foto_reporte: Camera,
};

export default async function NotificacionesPage() {
  await requireRol(["entrenador", "admin"]);
  const [notificaciones, sinLeer] = await Promise.all([
    obtenerNotificacionesEntrenador(),
    contarNotificacionesSinLeer(),
  ]);

  return (
    <div className="space-y-6 pb-8">
      <AdminPageHeader
        eyebrow="Automatización y control"
        title="Notificaciones"
        description="Lo que de verdad amerita tu atención — hábitos rotos, errores, reseñas y fotos reportadas."
      />
      <MarcarNotificacionesLeidas sinLeer={sinLeer} />
      {notificaciones.length === 0 ? (
        <Card padding="p-5">
          <Bell size={22} className="text-text-tertiary" />
          <p className="text-body mt-2 font-bold text-text">Sin avisos por ahora</p>
          <p className="text-caption mt-1 text-text-secondary">
            Cuando algo importante de verdad pase — un alumno que rompió un hábito, un bug reportado, una
            reseña nueva — aparece acá.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {notificaciones.map((n) => {
            const Icono = ICONOS[n.tipo] ?? Bell;
            const contenido = (
              <Card
                padding="p-3.5"
                className={`flex items-start gap-3 ${n.leida ? "" : "border-vip/40"}`}
              >
                <span
                  className={`grid size-9 shrink-0 place-items-center rounded-full ${
                    n.prioridad === "alta" ? "bg-error/15 text-error" : "bg-vip/15 text-vip"
                  }`}
                >
                  <Icono size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-caption font-bold text-text">{n.titulo}</p>
                    {!n.leida && <span className="size-1.5 shrink-0 rounded-full bg-vip" />}
                  </div>
                  <p className="text-caption mt-0.5 text-text-secondary">{n.cuerpo}</p>
                  <p className="text-micro mt-1 text-text-tertiary">
                    {n.alumnoNombre ? `${n.alumnoNombre} · ` : ""}
                    {new Date(n.creadoEn).toLocaleString("es-CL", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </Card>
            );
            return n.ruta ? (
              <Link key={n.id} href={n.ruta} className="block">
                {contenido}
              </Link>
            ) : (
              <div key={n.id}>{contenido}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
