import { MessageCircle, Star } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Card } from "@/components/ui/Card";
import { nombreAlumnoPublicado } from "@/lib/nombre";
import { linkWhatsApp } from "@/lib/generador-rutinas/whatsapp";

export default async function ResenasAppPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: filas, error } = await supabase
    .from("resenas_app")
    .select("id, alumno_id, estrellas, sugerencia, ruta, creado_en")
    .order("creado_en", { ascending: false })
    .limit(200);

  // La tabla puede no existir todavía (migración sin correr). Mismo criterio
  // que /admin/reportes: se explica qué falta en vez de reventar la pantalla.
  if (error) {
    return (
      <div className="space-y-6 pb-8">
        <AdminPageHeader
          eyebrow="Más · Soporte"
          title="Reseñas de la app"
          description="Estrellas y sugerencias que dejan los alumnos desde su perfil."
          backHref="/admin/configuracion"
        />
        <Card className="border border-warning/40" padding="p-5">
          <Star size={22} className="text-warning" />
          <p className="text-body mt-2 font-bold text-text">Falta activar las reseñas</p>
          <p className="text-caption mt-1 text-text-secondary">
            Corre la migración 0096_resenas_app.sql. Después aparecerán acá las opiniones de los alumnos.
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

  const resenas = filas ?? [];
  const promedio = resenas.length
    ? (resenas.reduce((suma, r) => suma + r.estrellas, 0) / resenas.length).toFixed(1)
    : null;

  return (
    <div className="space-y-6 pb-8">
      <AdminPageHeader
        eyebrow="Más · Soporte"
        title="Reseñas de la app"
        description="Estrellas y sugerencias que dejan los alumnos desde su perfil."
        backHref="/admin/configuracion"
      />
      {resenas.length === 0 ? (
        <Card padding="p-5">
          <Star size={22} className="text-text-tertiary" />
          <p className="text-body mt-2 font-bold text-text">Todavía no hay reseñas</p>
          <p className="text-caption mt-1 text-text-secondary">
            Cuando un alumno puntúe la app desde su perfil, su opinión aparece acá.
          </p>
        </Card>
      ) : (
        <>
          {promedio && (
            <Card padding="p-4" className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-h3 font-bold text-vip">
                <Star size={22} className="fill-vip" /> {promedio}
              </span>
              <span className="text-caption text-text-secondary">
                Promedio de {resenas.length} reseña{resenas.length === 1 ? "" : "s"}
              </span>
            </Card>
          )}
          <div className="space-y-2.5">
            {resenas.map((r) => (
              <Card key={r.id} padding="p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} size={15} className={n <= r.estrellas ? "fill-vip text-vip" : "text-text-tertiary"} />
                    ))}
                  </div>
                  <span className="text-micro text-text-tertiary">
                    {new Date(r.creado_en).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" })}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <p className="text-caption font-semibold text-text">
                    {nombreAlumnoPublicado(nombres.get(r.alumno_id) ?? "Alumno")}
                  </p>
                  {(() => {
                    const telefono = telefonoPorId.get(r.alumno_id);
                    const wa = telefono ? linkWhatsApp(telefono) : null;
                    if (!wa) return null;
                    return (
                      <a
                        href={wa}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Escribirle por WhatsApp a ${nombreAlumnoPublicado(nombres.get(r.alumno_id) ?? "el alumno")}`}
                        className="grid size-8 shrink-0 place-items-center rounded-full bg-success/15 text-success"
                      >
                        <MessageCircle size={15} />
                      </a>
                    );
                  })()}
                </div>
                {r.sugerencia && <p className="text-caption mt-1 text-text-secondary">{r.sugerencia}</p>}
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
