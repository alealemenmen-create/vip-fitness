import Link from "next/link";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { crearMiPerfilAlumno } from "@/app/admin/alumnos/actions";
import { LogoutButton } from "@/components/LogoutButton";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { Dumbbell } from "lucide-react";
import { nombrePublicado } from "@/lib/nombre";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const sesion = await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();

  const { data: miAlumnoPerfil } = await supabase
    .from("alumno_perfil")
    .select("user_id")
    .eq("user_id", sesion.userId)
    .maybeSingle();

  // Alimentos que crearon los alumnos y todavía nadie miró: pintan el punto
  // rojo en la pestaña Alimentos. Va con `head` para traer solo el número, sin
  // las filas. Si la migración 0030 no está corrida, la consulta falla, `count`
  // queda en null y simplemente no hay punto.
  const { count: alimentosPendientes } = await supabase
    .from("alimentos")
    .select("id", { count: "exact", head: true })
    .eq("aprobado", false)
    .eq("activo", true);

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <div className="mx-auto w-full max-w-md flex-1 px-4 pb-24 pt-8">
        <Logo compact className="mb-5" corner={<ThemeToggle />} />

        <div className="mb-6 flex items-center gap-2">
          <div>
            <p className="text-caption text-text-tertiary">PANEL</p>
            <h1 className="text-h3 text-text">{nombrePublicado(sesion.nombre)}</h1>
          </div>
        </div>

        {miAlumnoPerfil ? (
          <Link
            href="/alumno/inicio"
            className="radius-control mb-6 flex items-center justify-center gap-2 border border-border py-3 text-secondary font-medium text-vip"
          >
            <Dumbbell size={16} /> Mi entrenamiento
          </Link>
        ) : (
          <form action={crearMiPerfilAlumno} className="mb-6">
            <button
              type="submit"
              className="radius-control flex w-full items-center justify-center gap-2 border border-dashed border-border py-3 text-secondary text-text-tertiary"
            >
              <Dumbbell size={16} /> Activar mi perfil de alumno
            </button>
          </form>
        )}

        {children}

        <LogoutButton className="text-caption mt-8 block w-full py-2 text-center text-text-tertiary" />
      </div>
      <div className="sticky bottom-0 mx-auto w-full max-w-md">
        <AdminTabs alimentosPendientes={alimentosPendientes ?? 0} />
      </div>
    </div>
  );
}
