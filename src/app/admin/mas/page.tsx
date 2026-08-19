import Link from "next/link";
import { Dumbbell, PanelsTopLeft } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { obtenerHallazgosPendientes } from "@/lib/auditoria/data";
import { obtenerResumenAlertasGastos } from "@/lib/gastos/data";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { DirectorioPanel } from "@/components/admin/DirectorioPanel";
import { LogoutButton } from "@/components/LogoutButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ZoomPanel } from "@/components/admin/ZoomPanel";
import { crearMiPerfilAlumno } from "@/app/admin/alumnos/actions";

export const metadata = { title: "Más · Panel VIP" };

/**
 * Directorio completo del panel (instructivo §4.3).
 *
 * `/admin/configuracion` hacía dos trabajos incompatibles: era el destino de
 * la pestaña "Más" del celular Y la pantalla de ajustes del sistema. Como
 * directorio se quedaba corta — mostraba diez atajos de diecinueve destinos,
 * y varios (Errores reportados, Pedidos de borrado, Solicitudes) solo se
 * alcanzaban desde la barra lateral de escritorio, es decir, girando el
 * teléfono. Acá está TODO; allá quedan los ajustes.
 *
 * Los contadores se leen en el servidor y solo aparecen cuando hay trabajo de
 * verdad: un cero en cada fila vuelve a convertirlos en decoración.
 */
export default async function MasPage() {
  const sesion = await requireRol(["entrenador", "admin"]);
  const esAdmin = sesion.rol === "admin";
  const supabase = await createClient();

  const [
    hallazgos,
    gastosAlerta,
    { count: solicitudesPendientes },
    { count: reportesPendientes },
    { count: borradosPendientes },
    { count: alimentosPendientes },
    { data: miAlumnoPerfil },
  ] = await Promise.all([
    esAdmin ? obtenerHallazgosPendientes() : Promise.resolve([]),
    esAdmin ? obtenerResumenAlertasGastos() : Promise.resolve({ pendientes: 0, vencidos: 0, proximos: 0 }),
    esAdmin ? supabase.from("solicitudes_registro").select("id", { count: "exact", head: true }).eq("estado", "pendiente") : Promise.resolve({ count: 0 }),
    esAdmin ? supabase.from("reportes_bugs").select("id", { count: "exact", head: true }).eq("estado", "pendiente") : Promise.resolve({ count: 0 }),
    esAdmin ? supabase
      .from("solicitudes_borrado_sesion")
      .select("id", { count: "exact", head: true })
      .eq("estado", "pendiente") : Promise.resolve({ count: 0 }),
    esAdmin ? supabase
      .from("alimentos")
      .select("id", { count: "exact", head: true })
      .eq("aprobado", false)
      .eq("activo", true) : Promise.resolve({ count: 0 }),
    supabase.from("alumno_perfil").select("user_id").eq("user_id", sesion.userId).maybeSingle(),
  ]);

  const contadores: Record<string, number> = {
    solicitudes: solicitudesPendientes ?? 0,
    reportes: reportesPendientes ?? 0,
    borrados: borradosPendientes ?? 0,
    alimentos: alimentosPendientes ?? 0,
    auditoria: hallazgos.length,
    gastos: gastosAlerta.pendientes,
  };

  return (
    <div className="space-y-4 pb-8">
      <AdminPageHeader
        eyebrow="Mapa completo"
        title="Más"
        description="Todas las funciones del panel están acá. Nunca hace falta girar el teléfono ni abrir la barra lateral."
      />

      <DirectorioPanel rol={esAdmin ? "admin" : "entrenador"} contadores={contadores} />

      <section className="tarjeta-menu-panel">
        <h2 className="tarjeta-menu-panel-titulo">Esta sesión</h2>
        <div className="flex flex-wrap items-center gap-2 border-t border-[#292c32] p-3">
          <ZoomPanel />
          <ThemeToggle />
          <Link href="/portal-v2/mas" className="boton-panel-secundario">
            <PanelsTopLeft size={15} /> Portal V2
          </Link>
          {miAlumnoPerfil ? (
            <Link href="/portal-v2/entrenamiento" className="boton-panel-secundario">
              <Dumbbell size={15} /> Mi rutina
            </Link>
          ) : (
            <form action={crearMiPerfilAlumno}>
              <button type="submit" className="boton-panel-secundario">
                <Dumbbell size={15} /> Activar mi perfil de alumno
              </button>
            </form>
          )}
          {/* `ml-auto` va en el envoltorio y no en `className`: esa prop cae
              en el <button>, que no es hijo directo del flex — LogoutButton
              trae su propio <form> en medio. */}
          <div className="ml-auto">
            <LogoutButton className="boton-panel-secundario" />
          </div>
        </div>
      </section>
    </div>
  );
}
