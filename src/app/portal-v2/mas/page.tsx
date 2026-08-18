import Link from "next/link";
import { ChevronRight, FileText, MessageCircle, Settings, Shield, Sparkles, Trophy, UserRound } from "lucide-react";
import styles from "@/components/v2/PortalV2.module.css";
import { requireAlumno } from "@/lib/auth";
import { nombreAlumnoPublicado } from "@/lib/nombre";

const iniciales = (nombre: string) => nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((parte) => parte[0]).join("").toUpperCase();

export default async function MasV2Page() {
  const contexto = await requireAlumno();
  const nombre = nombreAlumnoPublicado(contexto.nombre);

  return (
    <section className={styles.simplePage}>
      <h1 className={styles.simpleTitle}>Más</h1>
      <div className={styles.profileCard}>
        <span className={styles.avatar}>{iniciales(nombre)}</span>
        <div><strong>{nombre}</strong><span>Miembro VIP Fitness</span></div>
        <ChevronRight size={17} />
      </div>

      <p className={styles.moreGroupLabel}>Cuenta y configuración</p>
      <div className={styles.moreCard}>
        <Fila href="/alumno/perfil" icon={UserRound} texto="Gestionar perfil" />
        <Fila href="/alumno/documentos" icon={FileText} texto="Mis documentos" />
        <Fila href="/alumno/asistente" icon={Sparkles} texto="Asistente VIP" />
        <Fila href="/alumno/ranked" icon={Trophy} texto="Comunidad y clasificación" />
      </div>

      <p className={styles.moreGroupLabel}>Ayuda y privacidad</p>
      <div className={styles.moreCard}>
        <Fila href="/alumno/inicio" icon={Settings} texto="Portal clásico" />
        <Fila href="/alumno/politica-privacidad" icon={Shield} texto="Política de privacidad" />
        <Fila href="/alumno/asistente" icon={MessageCircle} texto="Contactar soporte" />
      </div>
    </section>
  );
}

function Fila({ href, icon: Icon, texto }: { href: string; icon: typeof UserRound; texto: string }) {
  return (
    <Link href={href} className={styles.moreRow}>
      <Icon size={16} />
      <strong>{texto}</strong>
      <ChevronRight size={15} />
    </Link>
  );
}
