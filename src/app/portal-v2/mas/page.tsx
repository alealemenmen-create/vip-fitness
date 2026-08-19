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
  LogOut,
  PanelsTopLeft,
  ShieldCheck,
  Trophy,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { logout } from "@/app/actions";
import styles from "@/components/v2/PortalV2.module.css";
import { asegurarSuscripcionPush, desactivarSuscripcionPush, suscripcionPushActiva } from "@/lib/entrenamiento/push";
import { obtenerMasV2Action, type MasDatosV2 } from "./actions";

type Panel = "perfil" | "notificaciones" | "plan" | "soporte" | "terminos" | "social" | null;

export default function MasV2Page() {
  const [panel, setPanel] = useState<Panel>(null);
  const [datos, setDatos] = useState<MasDatosV2 | null>(null);
  const [permisoNotificaciones, setPermisoNotificaciones] = useState<NotificationPermission | "no-disponible">(
    () => typeof Notification === "undefined" ? "no-disponible" : Notification.permission,
  );
  const [pushActiva, setPushActiva] = useState(false);
  const [procesandoNotificaciones, setProcesandoNotificaciones] = useState(false);
  const [mensajeNotificaciones, setMensajeNotificaciones] = useState<string | null>(null);

  useEffect(() => {
    obtenerMasV2Action().then(setDatos).catch(() => setDatos(null));
    suscripcionPushActiva().then(setPushActiva).catch(() => setPushActiva(false));
  }, []);

  const cambiarNotificaciones = async () => {
    setMensajeNotificaciones(null);
    setProcesandoNotificaciones(true);
    try {
      if (pushActiva) {
        await desactivarSuscripcionPush();
        setPushActiva(false);
        setMensajeNotificaciones("Avisos desactivados en este dispositivo.");
        return;
      }
      if (!datos) {
        setMensajeNotificaciones("La vista directa no registra dispositivos. Con una cuenta del piloto podrás activar aquí los avisos reales.");
        return;
      }
      if (typeof Notification === "undefined") {
        setPermisoNotificaciones("no-disponible");
        return;
      }
      const permiso = await Notification.requestPermission();
      setPermisoNotificaciones(permiso);
      if (permiso === "granted") {
        await asegurarSuscripcionPush();
        const activa = await suscripcionPushActiva();
        setPushActiva(activa);
        setMensajeNotificaciones(activa ? "Avisos activados en este dispositivo." : "No fue posible registrar este dispositivo. Revisa la instalación y la clave VAPID.");
      }
    } catch {
      setMensajeNotificaciones("No fue posible cambiar los avisos. Tu configuración anterior se conserva.");
    } finally {
      setProcesandoNotificaciones(false);
    }
  };

  return (
    <section className={styles.morePage}>
      <h1 className={styles.moreTitle}>Más</h1>

      {datos ? <Link href="/portal-v2/perfil" className={styles.moreProfile}>
        <span className={styles.moreAvatar}>{datos?.iniciales ?? "AM"}</span>
        <div><strong>{datos?.nombre ?? "Ale Mendoza"}</strong><small>{datos ? `${datos.rango} · ${datos.rol === "admin" ? "Administrador" : datos.rol === "entrenador" ? "Entrenador" : "Alumno"}` : "Método VIP"}</small></div>
        <span className={styles.moreXp}>{(datos?.puntos ?? 900).toLocaleString("es-CL")} XP <Trophy size={12} /></span>
      </Link> : <button type="button" className={styles.moreProfile} onClick={() => setPanel("perfil")}>
        <span className={styles.moreAvatar}>AM</span><div><strong>Ale Mendoza</strong><small>Método VIP · vista directa</small></div><span className={styles.moreXp}>900 XP <Trophy size={12} /></span>
      </button>}
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
        <Fila href={datos ? "/portal-v2/perfil" : undefined} icon={UserRound} texto="Gestionar perfil" onClick={!datos ? () => setPanel("perfil") : undefined} />
        <Fila icon={Bell} texto="Gestionar notificaciones" onClick={() => setPanel("notificaciones")} />
        <Fila icon={CreditCard} texto="Plan VIP" onClick={() => setPanel("plan")} />
      </div>

      <p className={styles.moreGroupLabel}>Soporte</p>
      <div className={styles.moreCard}>
        <Fila href={datos ? "/portal-v2/soporte" : undefined} icon={Headphones} texto="Contactar soporte" onClick={!datos ? () => setPanel("soporte") : undefined} />
        <Fila href="/portal-v2/privacidad" icon={ShieldCheck} texto="Política de privacidad" />
        <Fila icon={FileText} texto="Términos y condiciones" onClick={() => setPanel("terminos")} />
        <Fila icon={Globe2} texto="Redes sociales" onClick={() => setPanel("social")} />
      </div>

      <Link href="/alumno/inicio" className={styles.moreClassicButton}>
        <LayoutDashboard size={16} />
        <span><strong>{datos ? "Abrir portal clásico" : "Portal clásico protegido"}</strong><small>{datos ? "Tu versión actual permanece disponible" : "La V2 directa continúa abierta sin contraseña"}</small></span>
        <ChevronRight size={16} />
      </Link>
      {datos ? <form action={logout} className={styles.moreLogoutForm}><button type="submit"><LogOut size={16} />Cerrar sesión</button></form> : null}
      <p className={styles.moreVersion}>VIP FITNESS V2 · VISTA DE DESARROLLO</p>

      {panel ? (
        <div className={styles.moreSheetBackdrop} role="presentation" onClick={() => setPanel(null)}>
          <section className={styles.moreSheet} role="dialog" aria-modal="true" aria-label={tituloPanel(panel)} onClick={(evento) => evento.stopPropagation()}>
            <header><h2>{tituloPanel(panel)}</h2><button type="button" onClick={() => setPanel(null)} aria-label="Cerrar"><X size={19} /></button></header>
            {panel === "notificaciones" ? (
              <div className={styles.moreSwitchList}>
                <Interruptor etiqueta="Avisos de descanso en este dispositivo" activo={pushActiva} onChange={cambiarNotificaciones} disabled={procesandoNotificaciones} />
                {datos ? <Link href="/portal-v2/perfil#descanso" className={styles.moreSettingsLink}><span>Temporizador de descanso</span><b>{datos.temporizadorActivo === false ? "Apagado" : datos.descansoPreferido ? `${datos.descansoPreferido} s` : "Según rutina"}</b><ChevronRight size={15} /></Link> : <button type="button" className={styles.moreSettingsLink} onClick={() => setPanel("perfil")}><span>Temporizador de descanso</span><b>Según rutina</b><ChevronRight size={15} /></button>}
                <p className={styles.moreNotificationNote}>{mensajeNotificaciones ?? (permisoNotificaciones === "denied" ? "Las notificaciones están bloqueadas en el navegador. Actívalas desde los ajustes del teléfono." : pushActiva ? "Este dispositivo recibirá avisos aun con la pantalla bloqueada. Puedes desactivarlos aquí sin cambiar los permisos del teléfono." : "Los avisos push de VIP Fitness están desactivados en este dispositivo.")}</p>
              </div>
            ) : null}
            {panel === "perfil" ? <div className={styles.morePlanPanel}><span>PERFIL DE DEMOSTRACIÓN</span><strong>Ale Mendoza</strong><p>Esta identidad permite recorrer la experiencia completa sin exponer alumnos. Los cambios personales, el historial y las notificaciones reales sólo se guardan con una cuenta autorizada del piloto.</p><b>Modo seguro</b></div> : null}
            {panel === "plan" ? <div className={styles.morePlanPanel}><span>PLAN ACTUAL</span><strong>{datos?.planNombre ?? "Método VIP"}</strong><p>{datos?.planDetalle ?? "Entrenamiento, nutrición, progreso y seguimiento personalizado"}</p><b>{datos?.planActivo === false ? "Pausado" : "Activo"}</b></div> : null}
            {panel === "soporte" ? <div className={styles.morePlanPanel}><span>SOPORTE VIP</span><strong>La conversación queda ligada a tu cuenta</strong><p>En la vista directa no fingimos el envío de mensajes. Al usar una cuenta autorizada, este acceso abre el asistente y conserva el contexto para que el equipo pueda responder.</p><b>Sin mensajes perdidos</b></div> : null}
            {panel === "terminos" ? <div><p className={styles.moreSheetCopy}>El portal registra entrenamientos, alimentación y progreso para prestar el servicio contratado. Los puntos y premios requieren actividad verificable; cualquier manipulación puede invalidarlos. Las indicaciones no reemplazan evaluación médica.</p><Link href="/portal-v2/privacidad" className={styles.moreSettingsLink}><span>Leer política de privacidad</span><ChevronRight size={15} /></Link></div> : null}
            {panel === "social" ? <div className={styles.moreSocialList}><span>Instagram <b>@vipfitness</b></span><span>Facebook <b>VIP Fitness</b></span><span>Comunidad <b>Dentro de la aplicación</b></span></div> : null}
          </section>
        </div>
      ) : null}
    </section>
  );
}

function tituloPanel(panel: Exclude<Panel, null>) {
  return { perfil: "Perfil", notificaciones: "Notificaciones", plan: "Plan VIP", soporte: "Soporte", terminos: "Términos y condiciones", social: "Redes sociales" }[panel];
}

function Fila({ href, icon: Icon, texto, detalle, onClick }: { href?: string; icon: typeof UserRound; texto: string; detalle?: string; onClick?: () => void }) {
  const contenido = <><span className={styles.moreRowIcon}><Icon size={15} /></span><span className={styles.moreRowCopy}><strong>{texto}</strong>{detalle ? <small>{detalle}</small> : null}</span><ChevronRight size={15} /></>;
  if (href) return <Link href={href} className={styles.moreRow}>{contenido}</Link>;
  return <button type="button" className={styles.moreRow} onClick={onClick}>{contenido}</button>;
}

function Interruptor({ etiqueta, activo, onChange, disabled = false }: { etiqueta: string; activo: boolean; onChange: () => void; disabled?: boolean }) {
  return <button type="button" role="switch" aria-checked={activo} onClick={onChange} disabled={disabled}><span>{etiqueta}</span><i className={activo ? styles.moreSwitchActive : ""}><em /></i></button>;
}
