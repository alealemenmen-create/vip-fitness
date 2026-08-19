import Link from "next/link";
import { AlertCircle, ArrowLeft, ShieldCheck } from "lucide-react";
import { obtenerContextoAlumnoOpcional } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PerfilV2 } from "@/components/v2/PerfilV2";
import { obtenerDatosPersonales } from "@/app/alumno/perfil/data";
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

  const carga = await (async () => {
    try {
      const supabase = await createClient();
      const [datos, { data: alumnoPerfil, error: errorPreferencias }] = await Promise.all([
        obtenerDatosPersonales(supabase, contexto.alumnoId),
        supabase.from("alumno_perfil").select("temporizador_descanso, segundos_descanso_preferido").eq("user_id", contexto.alumnoId).maybeSingle(),
      ]);
      if (errorPreferencias || !alumnoPerfil) return null;
      return { datos, alumnoPerfil };
    } catch {
      return null;
    }
  })();

  if (!carga) {
    return (
      <section className={styles.v2BridgePage}>
        <header><Link href="/portal-v2/mas" aria-label="Volver a Más"><ArrowLeft size={22} /></Link><div><span>CUENTA</span><h1>Mi perfil</h1></div></header>
        <article className={styles.v2BridgeDemo} role="alert"><AlertCircle size={23} /><strong>No pudimos cargar tu perfil</strong><p>No mostraremos campos vacíos ni guardaremos cambios parciales. Revisa la conexión y vuelve a intentarlo.</p><Link href="/portal-v2/perfil">Reintentar</Link></article>
      </section>
    );
  }

  return (
    <section className={styles.v2BridgePage}>
      <header><Link href="/portal-v2/mas" aria-label="Volver a Más"><ArrowLeft size={22} /></Link><div><span>CUENTA</span><h1>Mi perfil</h1></div></header>
      {contexto.soloLectura ? <article className={styles.v2BridgeDemo}><ShieldCheck size={23} /><strong>Perfil en modo lectura</strong><p>Estás supervisando a {contexto.nombre}. Puedes revisar su experiencia sin modificar datos personales ni preferencias.</p><Link href="/portal-v2/mas">Volver a configuración</Link></article> : (
        <PerfilV2
          datos={carga.datos}
          temporizadorInicial={carga.alumnoPerfil.temporizador_descanso}
          segundosIniciales={carga.alumnoPerfil.segundos_descanso_preferido}
        />
      )}
    </section>
  );
}
