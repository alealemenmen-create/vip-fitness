import Link from "next/link";
import { ChevronRight, Dumbbell, Megaphone, Sparkles, WandSparkles } from "lucide-react";
import { requireControlVipV2 } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { nombreAlumnoPublicado, nombrePublicado } from "@/lib/nombre";
import { obtenerColaPendientes } from "@/lib/pendientes/data";
import { obtenerSolicitudesAsistenciaEnVivo } from "@/lib/impulso-vip/asistencia-data";
import { AsistenciaImpulsoEnVivo } from "@/components/admin/AsistenciaImpulsoEnVivo";
import { obtenerReportes } from "@/app/admin/alumnos/data";
import { SugerenciasHoy } from "@/components/admin/SugerenciasHoy";
import { obtenerEjerciciosIncompletos } from "@/lib/ejercicios/data";
import { Card } from "@/components/ui/Card";
import { formatFechaLarga } from "@/lib/date";

const CLASE_SEVERIDAD: Record<string, string> = {
  error: "border-error/30 bg-error/10 text-error",
  warning: "border-warning/30 bg-warning/10 text-warning",
  neutral: "border-border bg-surface-2 text-text-secondary",
};

const MAXIMO_PENDIENTES_VISIBLE = 5;

export default async function ControlVipV2HoyPage() {
  const sesion = await requireControlVipV2();
  const supabase = await createClient();

  const { data: alumnosData } = await supabase
    .from("alumno_perfil")
    .select("user_id, objetivo, perfiles!alumno_perfil_user_id_fkey(nombre, rol)");

  const alumnos = (alumnosData ?? [])
    .filter((a) => {
      const rol = (a.perfiles as unknown as { rol: string } | null)?.rol;
      return rol === "alumno" || a.user_id === sesion.userId;
    })
    .map((a) => ({
      id: a.user_id,
      nombre: nombreAlumnoPublicado((a.perfiles as unknown as { nombre: string } | null)?.nombre ?? "Alumno"),
      objetivo: a.objetivo,
    }));

  const [colaPendientes, solicitudesImpulso, reportes, ejerciciosIncompletos] = await Promise.all([
    obtenerColaPendientes(),
    obtenerSolicitudesAsistenciaEnVivo(supabase),
    obtenerReportes(supabase, alumnos),
    obtenerEjerciciosIncompletos(),
  ]);

  const pendientesVisibles = colaPendientes.slice(0, MAXIMO_PENDIENTES_VISIBLE);

  return (
    <div className="space-y-5 pb-8">
      <div>
        <p className="text-caption font-semibold uppercase tracking-[0.14em] text-vip">{formatFechaLarga()}</p>
        <h1 className="encabezado-panel-titulo font-semibold text-text">Hola, {nombrePublicado(sesion.nombre)}</h1>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-text">Necesita tu decisión</h2>
        {pendientesVisibles.length === 0 ? (
          <Card padding="p-4" className="text-caption text-text-secondary">
            Nada pendiente ahora mismo. Solicitudes, auditoría, errores, borrados y gastos están al día.
          </Card>
        ) : (
          <div className="space-y-2">
            {pendientesVisibles.map((categoria) => (
              <Link key={categoria.id} href={categoria.href} className="block">
                <Card padding="p-3" className="flex items-center gap-3">
                  <span className={`grid size-9 shrink-0 place-items-center rounded-full border text-sm font-bold ${CLASE_SEVERIDAD[categoria.severidad]}`}>
                    {categoria.cantidad > 99 ? "99+" : categoria.cantidad}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-caption font-semibold text-text">{categoria.etiqueta}</span>
                    <span className="block truncate text-micro text-text-tertiary">{categoria.descripcion}</span>
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-text-tertiary" />
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <AsistenciaImpulsoEnVivo solicitudes={solicitudesImpulso} />

      <SugerenciasHoy reportes={reportes} baseHref="/control-vip/alumnos" hrefSinRutina="/control-vip/rutinas" />

      {ejerciciosIncompletos.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-text">Producción</h2>
          <Link href="/control-vip/galeria#biblioteca-ejercicios" className="block">
            <Card padding="p-3" className="flex items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full border border-warning/30 bg-warning/10 text-sm font-bold text-warning">
                {ejerciciosIncompletos.length > 99 ? "99+" : ejerciciosIncompletos.length}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-caption font-semibold text-text">
                  {ejerciciosIncompletos.length === 1 ? "Ficha de ejercicio incompleta" : "Fichas de ejercicio incompletas"}
                </span>
                <span className="block truncate text-micro text-text-tertiary">Faltan grupo, categoría o equipo por clasificar</span>
              </span>
              <ChevronRight size={16} className="shrink-0 text-text-tertiary" />
            </Card>
          </Link>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-text">Acciones rápidas</h2>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Link href="/control-vip/rutinas" className="boton-panel-secundario">
            <WandSparkles size={15} /> Armar rutina
          </Link>
          <Link href="/control-vip/galeria" className="boton-panel-secundario">
            <Dumbbell size={15} /> Subir material
          </Link>
          <Link href="/admin/puntos" className="boton-panel-secundario">
            <Sparkles size={15} /> Otorgar puntos
          </Link>
          <Link href="/admin/noticias" className="boton-panel-secundario">
            <Megaphone size={15} /> Crear noticia
          </Link>
        </div>
      </section>
    </div>
  );
}
