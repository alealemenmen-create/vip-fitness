"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
import { asegurarSuscripcionPush } from "@/lib/entrenamiento/push";
import { obtenerMasV2Action, type MasDatosV2 } from "./actions";

type Panel = "notificaciones" | "plan" | "terminos" | "social" | null;

export default function MasV2Page() {
  const [panel, setPanel] = useState<Panel>(null);
  const [datos, setDatos] = useState<MasDatosV2 | null>(null);
  const [permisoNotificaciones, setPermisoNotificaciones] = useState<NotificationPermission | "no-disponible">(
    () => typeof Notification === "undefined" ? "no-disponible" : Notification.permission,
  );

  useEffect(() => {
    obtenerMasV2Action().then(setDatos).catch(() => setDatos(null));
  }, []);

  const activarNotificaciones = async () => {
    if (typeof Notification === "undefined") {
      setPermisoNotificaciones("no-disponible");
      return;
    }
    const permiso = await Notification.requestPermission();
    setPermisoNotificaciones(permiso);
    if (permiso === "granted") await asegurarSuscripcionPush();
  };

  return (
    <section className={styles.morePage}>
      <h1 className={styles.moreTitle}>Más</h1>

      <Link href="/alumno/perfil" className={styles.moreProfile}>
        <span className={styles.moreAvatar}>{datos?.iniciales ?? "AM"}</span>
        <div><strong>{datos?.nombre ?? "Ale Mendoza"}</strong><small>{datos ? `${datos.rango} · ${datos.rol === "admin" ? "Administrador" : datos.rol === "entrenador" ? "Entrenador" : "Alumno"}` : "Método VIP"}</small></div>
        <span className={styles.moreXp}>{(datos?.puntos ?? 900).toLocaleString("es-CL")} XP <Trophy size={12} /></span>
      </Link>
      <div className={styles.moreLevelTrack} aria-label="Progreso del nivel"><i style={{ width: `${datos?.progresoRango ?? 68}%` }} /></div>

      <Link href="/portal-v2/progreso/comunidad" className={styles.moreCommunityBanner}>
        <div><strong>Nadie progresa solo</strong><span>Comparte avances y celebra a la comunidad VIP.</span></div>
        <b>Ver comunidad <ChevronRight size={14} /></b>
      </Link>

      <p className={styles.moreGroupLabel}>Mis espacios</p>
      <div className={styles.moreCard}>
        <Fila href="/portal-v2/entrenamiento" icon={Dumbbell} texto="Mi entrenamiento" detalle="Vista personal" />
        {datos?.rol === "entrenador" || datos?.rol === "admin" ? <Fila href="/admin/alumnos" icon={UsersRound} texto="Portal del entrenador" detalle="Alumnos y seguimiento" /> : null}
        {datos?.rol === "admin" ? <Fila href="/admin" icon={PanelsTopLeft} texto="Administración" detalle="Control total de VIP Fitness" /> : null}
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
                <Interruptor etiqueta="Avisos de descanso en este dispositivo" activo={permisoNotificaciones === "granted"} onChange={activarNotificaciones} />
                <Link href="/alumno/perfil" className={styles.moreSettingsLink}><span>Temporizador de descanso</span><b>{datos?.temporizadorActivo === false ? "Apagado" : datos?.descansoPreferido ? `${datos.descansoPreferido} s` : "Según rutina"}</b><ChevronRight size={15} /></Link>
                <p className={styles.moreNotificationNote}>{permisoNotificaciones === "denied" ? "Las notificaciones están bloqueadas en el navegador. Actívalas desde los ajustes del teléfono." : "El sonido y la vibración se ejecutan al terminar cada descanso. El push cubre pantalla bloqueada o cambio de aplicación."}</p>
              </div>
            ) : null}
            {panel === "plan" ? <div className={styles.morePlanPanel}><span>PLAN ACTUAL</span><strong>Método VIP</strong><p>Entrenamiento, nutrición, progreso y seguimiento personalizado en un solo lugar.</p><b>Activo</b></div> : null}
            {panel === "terminos" ? <div><p className={styles.moreSheetCopy}>El portal registra entrenamientos, alimentación y progreso para prestar el servicio contratado. Los puntos y premios requieren actividad verificable; cualquier manipulación puede invalidarlos. Las indicaciones no reemplazan evaluación médica.</p><Link href="/alumno/politica-privacidad" className={styles.moreSettingsLink}><span>Leer política de privacidad completa</span><ChevronRight size={15} /></Link></div> : null}
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
