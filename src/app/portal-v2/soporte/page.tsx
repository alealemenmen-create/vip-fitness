import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { obtenerContextoAlumnoOpcional } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { obtenerContextoAlumnoVip } from "@/lib/asistente/alumno";
import { SoporteV2 } from "@/components/v2/SoporteV2";
import styles from "@/components/v2/PortalV2.module.css";

export default async function SoporteV2Page() {
  const contextoSesion = await obtenerContextoAlumnoOpcional();
  if (!contextoSesion) {
    return (
      <section className={styles.v2BridgePage}>
        <header><Link href="/portal-v2/mas" aria-label="Volver a Más"><ArrowLeft size={22} /></Link><div><span>AYUDA</span><h1>Soporte VIP</h1></div></header>
        <article className={styles.v2BridgeDemo}><ShieldCheck size={23} /><strong>Conversaciones protegidas</strong><p>El asistente conserva contexto personal y por eso no se simula con datos inventados. Con una cuenta autorizada, esta misma pantalla muestra el chat, tus recordatorios y tus últimas marcas.</p><Link href="/portal-v2/mas">Volver a configuración</Link></article>
      </section>
    );
  }

  const supabase = await createClient();
  const contexto = await obtenerContextoAlumnoVip(supabase, contextoSesion.alumnoId);
  return (
    <section className={styles.v2BridgePage}>
      <header><Link href="/portal-v2/mas" aria-label="Volver a Más"><ArrowLeft size={22} /></Link><div><span>AYUDA</span><h1>Soporte VIP</h1></div></header>
      <SoporteV2 contexto={contexto} soloLectura={contextoSesion.soloLectura} />
    </section>
  );
}
