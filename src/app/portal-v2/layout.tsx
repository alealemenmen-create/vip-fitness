import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BottomNavV2 } from "@/components/v2/BottomNavV2";
import { VipSplash } from "@/components/v2/VipSplash";
import styles from "@/components/v2/PortalV2.module.css";
import { requireAlumno } from "@/lib/auth";
import { fichaCompleta } from "@/lib/perfil-alumno/ficha";
import { leerFicha } from "@/lib/perfil-alumno/datos";
import { createClient } from "@/lib/supabase/server";

export default async function PortalV2Layout({ children }: { children: React.ReactNode }) {
  const contexto = await requireAlumno();

  if (contexto.rolSesion === "alumno" && !contexto.soloLectura) {
    const supabase = await createClient();
    const ficha = await leerFicha(supabase as unknown as SupabaseClient, contexto.alumnoId);
    if (!fichaCompleta(ficha)) redirect("/completar-perfil");
  }

  return (
    <div className={styles.shell}>
      <VipSplash />
      <main className={styles.content}>{children}</main>
      <BottomNavV2 />
    </div>
  );
}
