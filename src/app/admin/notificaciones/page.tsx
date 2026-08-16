import Link from "next/link";
import { Bell, Bug, Camera, MessageCircle, Star, TrendingDown, Utensils } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { obtenerNotificacionesEntrenador, contarNotificacionesSinLeer } from "@/lib/notificaciones/data";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { MarcarNotificacionesLeidas } from "@/components/admin/MarcarNotificacionesLeidas";
import { Card } from "@/components/ui/Card";
import { linkWhatsApp } from "@/lib/generador-rutinas/whatsapp";

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
            const wa = n.alumnoTelefono ? linkWhatsApp(n.alumnoTelefono) : null;
            const cuerpoTexto = (
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
            );
            return (
              <Card
                key={n.id}
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
                {n.ruta ? (
                  <Link href={n.ruta} className="min-w-0 flex-1">
                    {cuerpoTexto}
                  </Link>
                ) : (
                  cuerpoTexto
                )}
                {wa && (
                  <a
                    href={wa}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Escribirle por WhatsApp a ${n.alumnoNombre ?? "el alumno"}`}
                    className="grid size-9 shrink-0 place-items-center rounded-full bg-success/15 text-success"
                  >
                    <MessageCircle size={17} />
                  </a>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
