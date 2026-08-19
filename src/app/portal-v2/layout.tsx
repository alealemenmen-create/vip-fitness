import { redirect } from "next/navigation";
import { BottomNavV2 } from "@/components/v2/BottomNavV2";
import { EstadoConexionV2 } from "@/components/v2/EstadoConexionV2";
import { VipSplash } from "@/components/v2/VipSplash";
import styles from "@/components/v2/PortalV2.module.css";
import { obtenerSesionActualOpcional } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function PortalV2Layout({ children }: { children: React.ReactNode }) {
  const sesion = await obtenerSesionActualOpcional();

  // El piloto ya usa cuentas reales. Sin sesión siempre se vuelve al login:
  // así el enlace corto no puede confundirse con la antigua demostración y
  // cada alumno entra con su propia rutina, historial y progreso.
  if (!sesion) redirect("/login");

  // Una cuenta de alumno entra sólo cuando Alejandro la habilitó. El equipo
  // profesional conserva acceso para supervisar y probar el producto.
  if (sesion.rol === "alumno") {
    const supabase = await createClient();
    const { data: perfil } = await supabase
      .from("alumno_perfil")
      .select("portal_v2_habilitado")
      .eq("user_id", sesion.userId)
      .maybeSingle();

    if (perfil?.portal_v2_habilitado !== true) {
      redirect("/alumno/entrenar?portal_v2=no_habilitado");
    }
  }

  return (
    <div className={styles.shell}>
      <VipSplash />
      <EstadoConexionV2 />
      <main className={styles.content}>{children}</main>
      <BottomNavV2 />
    </div>
  );
}
