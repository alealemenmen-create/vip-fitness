import Link from "next/link";
import { Bot, Dumbbell } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { nombrePublicado } from "@/lib/nombre";
import { crearMiPerfilAlumno } from "@/app/admin/alumnos/actions";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { LogoutButton } from "@/components/LogoutButton";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const sesion = await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();

  const { data: miAlumnoPerfil } = await supabase
    .from("alumno_perfil")
    .select("user_id")
    .eq("user_id", sesion.userId)
    .maybeSingle();

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

  const badges = {
    alimentosPendientes: alimentosPendientes ?? 0,
    solicitudesPendientes: solicitudesPendientes ?? 0,
  };

  return (
    <div className="admin-shell fixed inset-0 flex overflow-hidden bg-bg">
      <aside className="admin-sidebar hidden w-72 shrink-0 flex-col border-r border-border px-4 md:flex">
        <div className="shrink-0 border-b border-border pb-4 pt-5">
          <Logo compact height={34} corner={<ThemeToggle />} />
          <div className="admin-profile-card mt-4 rounded-2xl p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">
              Panel del entrenador
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-text">
              {nombrePublicado(sesion.nombre)}
            </p>
          </div>
        </div>

        <AdminTabs variant="sidebar" {...badges} />

        <div className="shrink-0 space-y-2 border-t border-border py-4">
          {miAlumnoPerfil ? (
            <Link
              href="/alumno/inicio"
              className="flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-medium text-vip hover:bg-surface-2"
            >
              <Dumbbell size={16} /> Ver mi entrenamiento
            </Link>
          ) : (
            <form action={crearMiPerfilAlumno}>
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border px-3 py-2 text-xs text-text-secondary hover:bg-surface-2"
              >
                <Dumbbell size={16} /> Activar mi perfil de alumno
              </button>
            </form>
          )}
          <LogoutButton className="block w-full py-2 text-center text-xs text-text-tertiary hover:text-text" />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-bg px-3 md:hidden">
          <Logo compact height={20} className="!w-[118px] !rounded-lg !px-2 !py-1 min-[520px]:!w-[138px]" />
          <div className="hidden min-w-0 flex-1 min-[470px]:block">
            <p className="text-[8px] font-semibold uppercase leading-none tracking-[0.14em] text-text-tertiary">Entrenador</p>
            <p className="mt-0.5 truncate text-[11px] font-semibold leading-tight text-text">{nombrePublicado(sesion.nombre)}</p>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
              <ThemeToggle className="!h-8 !w-8" />
              {miAlumnoPerfil ? (
                <Link
                  href="/alumno/inicio"
                  aria-label="Ver mi entrenamiento"
                  className="radius-control flex h-8 items-center gap-1.5 border border-border bg-surface px-2 text-[11px] font-medium text-vip"
                >
                  <Dumbbell size={14} /> <span className="hidden min-[520px]:inline">Mi rutina</span>
                </Link>
              ) : (
                <form action={crearMiPerfilAlumno}>
                  <button
                    type="submit"
                    aria-label="Activar mi perfil de alumno"
                    className="radius-control flex h-8 items-center gap-1.5 border border-dashed border-border bg-surface px-2 text-[11px] text-text-secondary"
                  >
                    <Dumbbell size={14} /> <span className="hidden min-[520px]:inline">Activar</span>
                  </button>
                </form>
              )}
              <Link
                href="/admin/asistente"
                aria-label="Abrir Asistente VIP"
                className="btn-accion radius-control flex h-8 items-center gap-1.5 px-2 text-[11px] font-semibold"
              >
                <Bot size={14} /> <span className="hidden min-[520px]:inline">Asistente</span>
              </Link>
          </div>
        </header>

        <main className="pantalla-scroll min-w-0 flex-1 px-4 pb-28 md:px-8 md:pb-10 lg:px-10">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
          <LogoutButton className="mt-8 block w-full py-2 text-center text-xs text-text-tertiary md:hidden" />
        </main>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 md:hidden">
        <AdminTabs {...badges} />
      </div>
    </div>
  );
}
