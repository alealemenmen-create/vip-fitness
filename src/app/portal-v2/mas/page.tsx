"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Bell,
  ChevronRight,
  CreditCard,
  Dumbbell,
  FileText,
  Globe2,
  Headphones,
  LayoutDashboard,
  PanelsTopLeft,
  ShieldCheck,
  Trophy,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import styles from "@/components/v2/PortalV2.module.css";

type Panel = "notificaciones" | "plan" | "terminos" | "social" | null;

export default function MasV2Page() {
  const [panel, setPanel] = useState<Panel>(null);
  const [notificaciones, setNotificaciones] = useState({ entrenamientos: true, impulso: true, comunidad: false });

  return (
    <section className={styles.morePage}>
      <h1 className={styles.moreTitle}>Más</h1>

      <Link href="/alumno/perfil" className={styles.moreProfile}>
        <span className={styles.moreAvatar}>AM</span>
        <div><strong>Ale Mendoza</strong><small>Administrador · Entrenador · Alumno</small></div>
        <span className={styles.moreXp}>900 XP <Trophy size={12} /></span>
      </Link>
      <div className={styles.moreLevelTrack} aria-label="Progreso del nivel"><i style={{ width: "68%" }} /></div>

      <Link href="/alumno/ranked" className={styles.moreCommunityBanner}>
        <div><strong>Nadie progresa solo</strong><span>Comparte avances y celebra a la comunidad VIP.</span></div>
        <b>Ver comunidad <ChevronRight size={14} /></b>
      </Link>

      <p className={styles.moreGroupLabel}>Mis espacios</p>
      <div className={styles.moreCard}>
        <Fila href="/portal-v2/entrenamiento" icon={Dumbbell} texto="Mi entrenamiento" detalle="Vista personal" />
        <Fila href="/admin/alumnos" icon={UsersRound} texto="Portal del entrenador" detalle="Alumnos y seguimiento" />
        <Fila href="/admin" icon={PanelsTopLeft} texto="Administración" detalle="Control total de VIP Fitness" />
      </div>

      <p className={styles.moreGroupLabel}>Cuenta y configuración</p>
      <div className={styles.moreCard}>
        <Fila href="/alumno/perfil" icon={UserRound} texto="Gestionar perfil" />
        <Fila icon={Bell} texto="Gestionar notificaciones" onClick={() => setPanel("notificaciones")} />
        <Fila icon={CreditCard} texto="Plan VIP" onClick={() => setPanel("plan")} />
      </div>

      <p className={styles.moreGroupLabel}>Soporte</p>
      <div className={styles.moreCard}>
        <Fila href="/alumno/asistente" icon={Headphones} texto="Contactar soporte" />
        <Fila href="/alumno/politica-privacidad" icon={ShieldCheck} texto="Política de privacidad" />
        <Fila icon={FileText} texto="Términos y condiciones" onClick={() => setPanel("terminos")} />
        <Fila icon={Globe2} texto="Redes sociales" onClick={() => setPanel("social")} />
      </div>

      <Link href="/alumno/inicio" className={styles.moreClassicButton}>
        <LayoutDashboard size={16} />
        <span><strong>Abrir portal clásico</strong><small>Tu versión actual permanece disponible</small></span>
        <ChevronRight size={16} />
      </Link>
      <p className={styles.moreVersion}>VIP FITNESS V2 · VISTA DE DESARROLLO</p>

      {panel ? (
        <div className={styles.moreSheetBackdrop} role="presentation" onClick={() => setPanel(null)}>
          <section className={styles.moreSheet} role="dialog" aria-modal="true" aria-label={tituloPanel(panel)} onClick={(evento) => evento.stopPropagation()}>
            <header><h2>{tituloPanel(panel)}</h2><button type="button" onClick={() => setPanel(null)} aria-label="Cerrar"><X size={19} /></button></header>
            {panel === "notificaciones" ? (
              <div className={styles.moreSwitchList}>
                <Interruptor etiqueta="Recordatorios de entrenamiento" activo={notificaciones.entrenamientos} onChange={() => setNotificaciones((actual) => ({ ...actual, entrenamientos: !actual.entrenamientos }))} />
                <Interruptor etiqueta="Impulso VIP diario" activo={notificaciones.impulso} onChange={() => setNotificaciones((actual) => ({ ...actual, impulso: !actual.impulso }))} />
                <Interruptor etiqueta="Actividad de la comunidad" activo={notificaciones.comunidad} onChange={() => setNotificaciones((actual) => ({ ...actual, comunidad: !actual.comunidad }))} />
              </div>
            ) : null}
            {panel === "plan" ? <div className={styles.morePlanPanel}><span>PLAN ACTUAL</span><strong>Método VIP</strong><p>Entrenamiento, nutrición, progreso y seguimiento personalizado en un solo lugar.</p><b>Activo</b></div> : null}
            {panel === "terminos" ? <p className={styles.moreSheetCopy}>Las condiciones definitivas se conectarán con los documentos legales del portal antes de publicar la V2. Tu acceso actual y tus datos permanecen sin cambios durante esta etapa.</p> : null}
            {panel === "social" ? <div className={styles.moreSocialList}><span>Instagram <b>@vipfitness</b></span><span>Facebook <b>VIP Fitness</b></span><span>Comunidad <b>Dentro de la aplicación</b></span></div> : null}
          </section>
        </div>
      ) : null}
    </section>
  );
}

function tituloPanel(panel: Exclude<Panel, null>) {
  return { notificaciones: "Notificaciones", plan: "Plan VIP", terminos: "Términos y condiciones", social: "Redes sociales" }[panel];
}

function Fila({ href, icon: Icon, texto, detalle, onClick }: { href?: string; icon: typeof UserRound; texto: string; detalle?: string; onClick?: () => void }) {
  const contenido = <><span className={styles.moreRowIcon}><Icon size={15} /></span><span className={styles.moreRowCopy}><strong>{texto}</strong>{detalle ? <small>{detalle}</small> : null}</span><ChevronRight size={15} /></>;
  if (href) return <Link href={href} className={styles.moreRow}>{contenido}</Link>;
  return <button type="button" className={styles.moreRow} onClick={onClick}>{contenido}</button>;
}

function Interruptor({ etiqueta, activo, onChange }: { etiqueta: string; activo: boolean; onChange: () => void }) {
  return <button type="button" role="switch" aria-checked={activo} onClick={onChange}><span>{etiqueta}</span><i className={activo ? styles.moreSwitchActive : ""}><em /></i></button>;
}
