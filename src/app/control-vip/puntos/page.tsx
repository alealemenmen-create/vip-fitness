import { requireControlVipV2Admin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { nombreAlumnoPublicado } from "@/lib/nombre";
import { OtorgarPuntosPanel } from "@/components/admin/OtorgarPuntosPanel";
import { RecompensasAdminPanel } from "@/components/admin/RecompensasAdminPanel";
import { obtenerAdminRecompensasVip } from "@/lib/recompensas/data";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

/** Misma pantalla que `/admin/puntos`, mismos componentes y datos. */
export default async function ControlVipV2PuntosPage() {
  await requireControlVipV2Admin();
  const supabase = await createClient();

  const { data } = await supabase
    .from("alumno_perfil")
    .select("user_id, perfiles!alumno_perfil_user_id_fkey(nombre, rol)")
    .order("created_at");

  const alumnos = (data ?? [])
    .filter((f) => (f.perfiles as unknown as { rol: string } | null)?.rol === "alumno")
    .map((f) => ({
      id: f.user_id,
      nombre: nombreAlumnoPublicado((f.perfiles as unknown as { nombre: string } | null)?.nombre ?? "Alumno"),
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const recompensas = await obtenerAdminRecompensasVip();

  return (
    <div className="space-y-2 pb-8">
      <AdminPageHeader
        eyebrow="Control VIP V2 · Piloto"
        title="Otorgar puntos"
        description="Para reponer puntos que se perdieron por una falla, o premiar algo puntual. El alumno ve el motivo que escribas."
      />
      <OtorgarPuntosPanel alumnos={alumnos} />
      <div className="pt-4">
        <RecompensasAdminPanel {...recompensas} />
      </div>
    </div>
  );
}
