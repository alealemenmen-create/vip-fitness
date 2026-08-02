import Link from "next/link";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { crearMiPerfilAlumno } from "@/app/admin/alumnos/actions";
import { LogoutButton } from "@/components/LogoutButton";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { Bot, Dumbbell } from "lucide-react";
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
  // Igual que los alimentos: solo el número, y si la migración 0032 todavía no
  // está corrida la consulta falla, queda en null y no se pinta nada.
  const [{ count: alimentosPendientes }, { count: solicitudesPendientes }] = await Promise.all([
    supabase
      .from("alimentos")
      .select("id", { count: "exact", head: true })
      .eq("aprobado", false)
      .eq("activo", true),
    supabase
      .from("solicitudes_registro")
      .select("id", { count: "exact", head: true })
      .eq("estado", "pendiente"),
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <div className="mx-auto w-full max-w-md flex-1 px-4 pb-24 pt-8">
        <Logo compact className="mb-3" corner={<ThemeToggle />} />

        <div className="mb-3 flex items-center gap-2">
          <div>
            <p className="text-[10px] text-text-tertiary">PANEL</p>
            <h1 className="text-caption font-semibold text-text">{nombrePublicado(sesion.nombre)}</h1>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-2">
          <Link
            href="/admin/asistente"
            className="btn-accion radius-control flex items-center justify-center gap-2 px-3 py-3 text-secondary font-semibold"
          >
            <Bot size={17} /> Asistente VIP
          </Link>
          {miAlumnoPerfil ? (
            <Link
              href="/alumno/inicio"
              className="radius-control flex items-center justify-center gap-2 border border-border px-3 py-3 text-secondary font-medium text-vip"
            >
              <Dumbbell size={16} /> Mi entrenamiento
            </Link>
          ) : (
            <form action={crearMiPerfilAlumno}>
              <button
                type="submit"
                className="radius-control flex h-full w-full items-center justify-center gap-2 border border-dashed border-border px-2 py-3 text-caption text-text-tertiary"
              >
                <Dumbbell size={16} /> Activar alumno
              </button>
            </form>
          )}
        </div>

        {children}

        <LogoutButton className="text-caption mt-8 block w-full py-2 text-center text-text-tertiary" />
      </div>
      <div className="sticky bottom-0 mx-auto w-full max-w-md">
        <AdminTabs
          alimentosPendientes={alimentosPendientes ?? 0}
          solicitudesPendientes={solicitudesPendientes ?? 0}
        />
      </div>
    </div>
  );
}
