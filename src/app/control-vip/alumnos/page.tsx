import Link from "next/link";
import { requireControlVipV2 } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { nombreAlumnoPublicado } from "@/lib/nombre";
import { obtenerReportes } from "@/app/admin/alumnos/data";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ListaAlumnos, type FiltroAlumnos } from "@/components/admin/ListaAlumnos";

/**
 * Directorio de alumnos de Control VIP V2 (docs/PROYECTO_CONTROL_VIP_V2.md,
 * Fase 2). Reusa `ListaAlumnos` tal cual usa `/admin/alumnos` — mismo motor
 * de prioridad y filtros — apuntando su navegación a la ficha nueva
 * (`/control-vip/alumnos/[id]`) en vez de la clásica.
 *
 * A diferencia de `/admin/alumnos`, esta versión no repite Impulso VIP,
 * propuestas ni "Prioridades de hoy": esas decisiones ya viven en Hoy
 * (§6.1) — acá el trabajo es encontrar y entrar a un alumno, no decidir.
 */
export default async function ControlVipV2AlumnosPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const sesion = await requireControlVipV2();
  const esAdmin = sesion.rol === "admin";
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
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));

  const reportes = await obtenerReportes(supabase, alumnos);

  const query = await searchParams;
  const filtrosValidos: FiltroAlumnos[] = ["todos", "sin_rutina", "seguimiento", "al_dia", "destacados"];
  const filtroInicial = filtrosValidos.includes(query.estado as FiltroAlumnos)
    ? (query.estado as FiltroAlumnos)
    : "todos";

  return (
    <div className="space-y-4 pb-8">
      <AdminPageHeader
        eyebrow="Control VIP V2 · Piloto"
        title="Alumnos"
        description="Directorio completo, con la misma prioridad y filtros de siempre."
        actions={
          esAdmin ? (
            <Link href="/admin/solicitudes" className="boton-panel-secundario">
              Solicitudes de ingreso
            </Link>
          ) : undefined
        }
      />
      <ListaAlumnos
        key={filtroInicial}
        reportes={reportes}
        sesionUserId={sesion.userId}
        filtroInicial={filtroInicial}
        baseHref="/control-vip/alumnos"
      />
    </div>
  );
}
