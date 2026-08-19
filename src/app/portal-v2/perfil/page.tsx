import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { obtenerContextoAlumnoOpcional } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DatosPersonalesForm } from "@/components/student/DatosPersonalesForm";
import { CambiarMiPassword } from "@/components/admin/CambiarMiPassword";
import { CambiarCorreoForm } from "@/components/admin/CambiarCorreoForm";
import { TemporizadorDescansoToggle } from "@/components/student/TemporizadorDescansoToggle";
import { ResenaApp } from "@/components/student/ResenaApp";
import { Card } from "@/components/ui/Card";
import { obtenerDatosPersonales } from "@/app/alumno/perfil/data";
import { cambiarMiCorreo } from "@/app/alumno/perfil/actions";
import styles from "@/components/v2/PortalV2.module.css";

export default async function PerfilV2Page() {
  const contexto = await obtenerContextoAlumnoOpcional();
  if (!contexto) {
    return (
      <section className={styles.v2BridgePage}>
        <header><Link href="/portal-v2/mas" aria-label="Volver a Más"><ArrowLeft size={22} /></Link><div><span>CUENTA</span><h1>Mi perfil</h1></div></header>
        <article className={styles.v2BridgeDemo}><ShieldCheck size={23} /><strong>Perfil protegido</strong><p>La vista directa permite recorrer V2 sin contraseña, pero no muestra ni modifica datos personales. Al entrar con una cuenta del piloto, aquí aparecen los formularios reales del Portal VIP.</p><Link href="/portal-v2/mas">Volver a configuración</Link></article>
      </section>
    );
  }

  const supabase = await createClient();
  const [datos, { data: alumnoPerfil }] = await Promise.all([
    obtenerDatosPersonales(supabase, contexto.alumnoId),
    supabase.from("alumno_perfil").select("temporizador_descanso, segundos_descanso_preferido").eq("user_id", contexto.alumnoId).maybeSingle(),
  ]);

  return (
    <section className={styles.v2BridgePage}>
      <header><Link href="/portal-v2/mas" aria-label="Volver a Más"><ArrowLeft size={22} /></Link><div><span>CUENTA</span><h1>Mi perfil</h1></div></header>
      {contexto.soloLectura ? <Card><p className="text-body text-text-secondary">Estás viendo este perfil en modo solo lectura.</p></Card> : (
        <div className={styles.v2BridgeContent}>
          <DatosPersonalesForm datos={datos} />
          <div id="descanso"><TemporizadorDescansoToggle activoInicial={alumnoPerfil?.temporizador_descanso ?? true} segundosPreferidoInicial={alumnoPerfil?.segundos_descanso_preferido ?? null} /></div>
          <CambiarMiPassword />
          <Card><p className="text-caption mb-3 text-text-tertiary">MI CORREO</p><CambiarCorreoForm accion={cambiarMiCorreo} /></Card>
          <ResenaApp />
        </div>
      )}
    </section>
  );
}
