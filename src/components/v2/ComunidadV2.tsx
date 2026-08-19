"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeft, CalendarDays, Camera, Check, ChevronRight, Flag, Gift, Heart, Medal, MessageCircle, Send, ShieldCheck, Sparkles, Trash2, Trophy, X } from "lucide-react";
import type { ComunidadDatosV2, FilaComunidadV2 } from "@/app/portal-v2/progreso/comunidad/data";
import { obtenerDesglosePuntosAlumno, type DesglosePuntos } from "@/app/alumno/inicio/actions";
import { alternarAplausoComunidadV2, comentarComunidadV2, crearPublicacionComunidadV2, eliminarContenidoComunidadV2, reportarPublicacionComunidadV2, responderRetoComunidadV2 } from "@/app/portal-v2/progreso/comunidad/actions";
import styles from "./PortalV2.module.css";

type Vista = "actividad" | "clasificacion";
type Periodo = "general" | "mensual";

const DEMO_FILAS: FilaComunidadV2[] = [
  { alumnoId: "vale", puesto: 1, nombre: "Vale R.", iniciales: "VR", puntos: 1240, esActual: false },
  { alumnoId: "tu", puesto: 2, nombre: "Tú", iniciales: "AM", puntos: 900, esActual: true },
  { alumnoId: "seba", puesto: 3, nombre: "Seba M.", iniciales: "SM", puntos: 760, esActual: false },
  { alumnoId: "camila", puesto: 4, nombre: "Camila P.", iniciales: "CP", puntos: 690, esActual: false },
  { alumnoId: "nicolas", puesto: 5, nombre: "Nicolás G.", iniciales: "NG", puntos: 625, esActual: false },
  { alumnoId: "daniela", puesto: 6, nombre: "Daniela S.", iniciales: "DS", puntos: 580, esActual: false },
];

const DEMO_ACTIVIDAD = [
  { id: "1", nombre: "Vale R.", fecha: "2026-08-18", titulo: "Constancia que se nota", detalle: "Completó su semana de entrenamiento y mantuvo cada registro al día.", tipo: "reconocimiento" },
  { id: "2", nombre: "VIP Fitness", fecha: "2026-08-18", titulo: "Nuevo desafío de fuerza", detalle: "Puntos verificados por sesiones cerradas y registros válidos.", tipo: "torneo" },
];

function fechaCorta(fecha: string) {
  const instante = fecha.includes("T") ? new Date(fecha) : new Date(`${fecha}T12:00:00-04:00`);
  return new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", timeZone: "America/Santiago" })
    .format(instante);
}

export function ComunidadV2({ datos }: { datos: ComunidadDatosV2 | null }) {
  const router = useRouter();
  const [vista, setVista] = useState<Vista>("actividad");
  const [periodo, setPeriodo] = useState<Periodo>("mensual");
  const [detallePuntos, setDetallePuntos] = useState<{ nombre: string; datos: DesglosePuntos; demo?: boolean } | null>(null);
  const [cargandoDetalle, iniciarDetalle] = useTransition();
  const [procesandoSocial, iniciarSocial] = useTransition();
  const [componiendo, setComponiendo] = useState(false);
  const [textoPublicacion, setTextoPublicacion] = useState("");
  const [fotoElegida, setFotoElegida] = useState<string | null>(null);
  const [comentarioAbierto, setComentarioAbierto] = useState<string | null>(null);
  const [textoComentario, setTextoComentario] = useState("");
  const [errorSocial, setErrorSocial] = useState<string | null>(null);
  const [avisoSocial, setAvisoSocial] = useState<string | null>(null);
  const clasificacionVisible = periodo === "general"
    ? (datos ? datos.general : DEMO_FILAS)
    : (datos ? datos.mensual : DEMO_FILAS);
  const actividad = datos ? datos.actividad : DEMO_ACTIVIDAD;

  const abrirDesglose = (persona: FilaComunidadV2) => {
    if (!datos) {
      const fecha = "2026-08-19";
      setDetallePuntos({
        nombre: persona.nombre,
        demo: true,
        datos: {
          rango: "semana",
          movimientos: [
            { id: `${persona.alumnoId}-sesion`, categoria: "entrenamiento", puntos: 300, titulo: "Sesión finalizada", fecha },
            { id: `${persona.alumnoId}-constancia`, categoria: "constancia", puntos: 30, titulo: "Constancia diaria", fecha },
            { id: `${persona.alumnoId}-progreso`, categoria: "progreso", puntos: 75, titulo: "Seguimiento registrado", fecha: "2026-08-18" },
          ],
        },
      });
      return;
    }
    iniciarDetalle(async () => {
      try {
        const desglose = await obtenerDesglosePuntosAlumno(persona.alumnoId);
        setDetallePuntos({ nombre: persona.nombre, datos: desglose });
      } catch {
        setErrorSocial("No pudimos abrir el desglose de puntos. Inténtalo nuevamente.");
      }
    });
  };

  const ejecutarSocial = (
    tarea: () => Promise<{ ok: boolean; error: string | null }>,
    alCompletar?: () => void,
    mensaje?: string,
  ) => {
    setErrorSocial(null);
    setAvisoSocial(null);
    iniciarSocial(async () => {
      try {
        const resultado = await tarea();
        if (!resultado.ok) return setErrorSocial(resultado.error ?? "No pudimos completar la acción.");
        alCompletar?.();
        if (mensaje) setAvisoSocial(mensaje);
        router.refresh();
      } catch {
        setErrorSocial("La acción no llegó al servidor. Revisa tu conexión e intenta nuevamente.");
      }
    });
  };

  return (
    <section className={styles.communityPage}>
      <header className={styles.communityHeader}>
        <Link href="/portal-v2/progreso" aria-label="Volver a Progreso"><ArrowLeft size={22} /></Link>
        <h1>Comunidad</h1>
        <Link href="/portal-v2/progreso#checkin" aria-label="Registrar avance corporal"><Camera size={20} /></Link>
      </header>

      <section className={styles.communityMe}>
        <div className={styles.communityMeIdentity}>
          <span>{datos?.iniciales ?? "AM"}</span>
          <div><strong>{datos?.nombre ?? "Ale Mendoza"}</strong><small>Actividad y puntos verificados</small></div>
          <b>{(datos?.puntosMes ?? 900).toLocaleString("es-CL")} XP <Trophy size={12} /></b>
        </div>
        <div className={styles.communityMeStats}>
          <span><strong>{datos?.posicionMes ? `${datos.posicionMes}.º` : "—"}</strong><small>Este mes</small></span>
          <span><strong>{datos?.impulsos ?? 7}</strong><small>Impulsos</small></span>
          <span><strong>{datos?.sesiones ?? 6}</strong><small>Sesiones 30D</small></span>
        </div>
      </section>

      <div className={styles.communityTabs} role="tablist" aria-label="Vistas de comunidad">
        <button type="button" role="tab" aria-selected={vista === "actividad"} onClick={() => setVista("actividad")}>Actividad</button>
        <button type="button" role="tab" aria-selected={vista === "clasificacion"} onClick={() => setVista("clasificacion")}>Clasificación</button>
      </div>

      {vista === "actividad" ? (
        <div className={styles.communityFeed}>
          {datos?.socialDisponible ? (
            <button className={styles.communityComposer} type="button" onClick={() => setComponiendo(true)} disabled={datos.soloLectura}>
              <span><Camera size={17} /></span><strong>Compartir avance con la comunidad</strong><ChevronRight size={16} />
            </button>
          ) : (
            <Link className={styles.communityComposer} href="/portal-v2/progreso#checkin">
              <span><Camera size={17} /></span><strong>Registrar foto de progreso privada</strong><ChevronRight size={16} />
            </Link>
          )}

          {datos?.socialError ? <p className={styles.communitySocialError} role="alert">{datos.socialError} <button type="button" onClick={() => router.refresh()}>Reintentar</button></p> : null}
          {errorSocial ? <p className={styles.communitySocialError} role="alert">{errorSocial}</p> : null}
          {avisoSocial ? <button type="button" className={styles.communitySocialNotice} onClick={() => setAvisoSocial(null)}><Check size={14} />{avisoSocial}<X size={13} /></button> : null}

          {datos?.publicaciones.map((publicacion) => (
            <article className={styles.communityPost} key={publicacion.id}>
              <header>
                <span>{publicacion.iniciales}</span>
                <div><strong>{publicacion.nombre}</strong><small>{fechaCorta(publicacion.fecha)}</small></div>
                {publicacion.esPropia ? <button type="button" aria-label="Eliminar publicación" disabled={procesandoSocial} onClick={() => ejecutarSocial(() => eliminarContenidoComunidadV2("publicacion", publicacion.id), undefined, "Publicación eliminada.")}><Trash2 size={15} /></button> : <button type="button" aria-label="Reportar publicación" disabled={procesandoSocial || datos.soloLectura} onClick={() => ejecutarSocial(() => reportarPublicacionComunidadV2(publicacion.id, "Contenido inapropiado o fuera de las reglas"), undefined, "Reporte enviado para revisión.")}><Flag size={15} /></button>}
              </header>
              {publicacion.fotoUrl ? <div className={styles.communityPostPhoto}><Image src={publicacion.fotoUrl} alt={`Avance compartido por ${publicacion.nombre}`} fill sizes="(max-width: 640px) 100vw, 520px" /></div> : null}
              {publicacion.texto ? <p>{publicacion.texto}</p> : null}
              {publicacion.comentarios.length ? <div className={styles.communityComments}>{publicacion.comentarios.map((comentario) => <div key={comentario.id}><i>{comentario.iniciales}</i><p><strong>{comentario.nombre}</strong>{comentario.texto}</p>{comentario.esPropio ? <button type="button" aria-label="Eliminar comentario" onClick={() => ejecutarSocial(() => eliminarContenidoComunidadV2("comentario", comentario.id))}><X size={12} /></button> : null}</div>)}</div> : null}
              {comentarioAbierto === publicacion.id ? <form className={styles.communityCommentForm} onSubmit={(evento) => { evento.preventDefault(); ejecutarSocial(() => comentarComunidadV2(publicacion.id, textoComentario), () => { setTextoComentario(""); setComentarioAbierto(null); }, "Comentario publicado."); }}><input value={textoComentario} onChange={(evento) => setTextoComentario(evento.target.value)} maxLength={280} placeholder="Escribe algo útil y respetuoso" autoFocus /><button type="submit" disabled={procesandoSocial || textoComentario.trim().length < 2} aria-label="Enviar comentario"><Send size={15} /></button></form> : null}
              <footer>
                <button type="button" className={publicacion.aplaudida ? styles.communityLiked : ""} disabled={procesandoSocial || datos.soloLectura} onClick={() => ejecutarSocial(() => alternarAplausoComunidadV2(publicacion.id, !publicacion.aplaudida))}><Heart size={16} fill={publicacion.aplaudida ? "currentColor" : "none"} /> {publicacion.aplausos || "Aplaudir"}</button>
                <button type="button" disabled={datos.soloLectura} onClick={() => { setComentarioAbierto(comentarioAbierto === publicacion.id ? null : publicacion.id); setTextoComentario(""); }}><MessageCircle size={16} /> {publicacion.comentarios.length || "Comentar"}</button>
                <span><ShieldCheck size={15} /> Publicado voluntariamente</span>
              </footer>
            </article>
          ))}

          {datos?.retos.length ? (
            <section className={styles.communityChallenges} aria-label="Desafíos activos">
              <header><strong>Desafíos activos</strong><span>{datos.retos.length}</span></header>
              {datos.retos.slice(0, 2).map((reto) => (
                <article key={reto.id}>
                  <Link href="/portal-v2/progreso/ranking">
                    <Trophy size={18} />
                    <div><strong>{reto.nombre}</strong><small>{reto.participantes} participantes · termina {fechaCorta(reto.fechaFin)}</small></div>
                    <b>{reto.puntos.toLocaleString("es-CL")} XP</b>
                  </Link>
                  {reto.regla ? <p>{reto.regla}</p> : null}
                  {reto.miEstado === "pendiente" && !datos.soloLectura ? <div className={styles.communityChallengeActions}>
                    <button type="button" disabled={procesandoSocial} onClick={() => ejecutarSocial(() => responderRetoComunidadV2({ torneoId: reto.id, decision: "aceptado" }), undefined, "Reto aceptado. Ya estás compitiendo.")}><Check size={14} />Aceptar</button>
                    <button type="button" disabled={procesandoSocial} onClick={() => ejecutarSocial(() => responderRetoComunidadV2({ torneoId: reto.id, decision: "rechazado" }), undefined, "Invitación rechazada.")}><X size={14} />Rechazar</button>
                  </div> : reto.miEstado === "pendiente" ? <small className={styles.communityChallengeAccepted}><ShieldCheck size={13} /> Modo solo lectura</small> : reto.miEstado === "aceptado" ? <small className={styles.communityChallengeAccepted}><Check size={13} /> Estás compitiendo</small> : null}
                </article>
              ))}
            </section>
          ) : null}

          {actividad.map((evento) => (
            <article className={styles.communityPost} key={evento.id}>
              <header>
                <span>{evento.nombre.split(/\s+/).slice(0, 2).map((parte) => parte[0]).join("").toUpperCase()}</span>
                <div><strong>{evento.nombre}</strong><small>{fechaCorta(evento.fecha)}</small></div>
                <b>Verificado</b>
              </header>
              <div className={styles.communityEventVisual} data-type={evento.tipo}>
                {evento.tipo === "torneo" ? <Trophy size={35} /> : evento.tipo === "reconocimiento" ? <Sparkles size={35} /> : <Medal size={35} />}
                <span>{evento.tipo === "torneo" ? "ARENA VIP" : evento.tipo === "reconocimiento" ? "LOGRO VIP" : "PROGRESO VIP"}</span>
              </div>
              <h2>{evento.titulo}</h2>
              <p>{evento.detalle}</p>
              <footer><span><ShieldCheck size={16} /> Datos validados</span><span><CalendarDays size={15} /> {fechaCorta(evento.fecha)}</span></footer>
            </article>
          ))}
        </div>
      ) : (
        <section className={styles.communityRanking}>
          <div className={styles.communityPeriod} role="tablist" aria-label="Periodo de clasificación">
            <button type="button" role="tab" aria-selected={periodo === "general"} onClick={() => setPeriodo("general")}>Acumulado</button>
            <button type="button" role="tab" aria-selected={periodo === "mensual"} onClick={() => setPeriodo("mensual")}>Este mes</button>
          </div>
          <div className={styles.communityPodium}>
            {clasificacionVisible.slice(0, 3).map((persona) => <Podio key={`${periodo}-${persona.alumnoId}`} persona={persona} />)}
          </div>
          <div className={styles.communityRankingList}>
            {clasificacionVisible.map((persona) => (
              <button type="button" disabled={cargandoDetalle} onClick={() => abrirDesglose(persona)} className={persona.esActual ? styles.communityRankingMine : ""} key={persona.alumnoId}>
                <span>{persona.puesto}</span><i>{persona.iniciales}</i><strong>{persona.nombre}</strong><b>{persona.puntos.toLocaleString("es-CL")} XP</b>{persona.esActual ? <em>•</em> : null}
              </button>
            ))}
          </div>
          <p className={styles.communityFairPlay}><ShieldCheck size={15} /> Solo cuentan sesiones finalizadas, registros válidos y eventos auditables. No se premian clics.</p>
          <Link className={styles.communityRankedCta} href="/portal-v2/progreso/ranking"><Gift size={17} /><span><strong>Arena y recompensas VIP</strong><small>Retos, apuestas, premios y canjes con tu saldo real</small></span><ChevronRight size={16} /></Link>
        </section>
      )}
      {detallePuntos ? (
        <div className={styles.nutritionPanelBackdrop} role="presentation" onClick={() => setDetallePuntos(null)}>
          <section className={styles.nutritionPanel} role="dialog" aria-modal="true" aria-label={`Puntos de ${detallePuntos.nombre}`} onClick={(evento) => evento.stopPropagation()}>
            <header><button type="button" onClick={() => setDetallePuntos(null)} aria-label="Cerrar"><X size={19} /></button></header>
            <h2>{detallePuntos.nombre}</h2>
            <p className={styles.copyFoodsIntro}>{detallePuntos.demo ? "Ejemplo de cómo V2 explica cada punto sin exponer información privada." : `Movimientos verificables de ${detallePuntos.datos.rango === "dia" ? "hoy" : "esta semana"}. No se exponen datos privados de alimentación.`}</p>
            <div className={styles.communityPointsBreakdown}>
              {detallePuntos.datos.movimientos.length ? detallePuntos.datos.movimientos.map((movimiento) => <article key={movimiento.id}><span>{movimiento.categoria}</span><strong>{movimiento.titulo}</strong><b>{movimiento.puntos > 0 ? "+" : ""}{movimiento.puntos} XP</b></article>) : <p>No hay movimientos puntuables en este periodo.</p>}
            </div>
          </section>
        </div>
      ) : null}
      {componiendo && datos?.socialDisponible ? (
        <div className={styles.nutritionPanelBackdrop} role="presentation" onClick={() => setComponiendo(false)}>
          <section className={styles.nutritionPanel} role="dialog" aria-modal="true" aria-label="Nueva publicación" onClick={(evento) => evento.stopPropagation()}>
            <header><button type="button" onClick={() => setComponiendo(false)} aria-label="Cerrar"><X size={19} /></button></header>
            <h2>Compartir un avance</h2>
            <p className={styles.copyFoodsIntro}>Solo la foto que elijas aquí se mostrará en Comunidad. Tu galería continúa privada.</p>
            <textarea className={styles.communityComposeText} value={textoPublicacion} onChange={(evento) => setTextoPublicacion(evento.target.value)} maxLength={500} placeholder="Cuenta qué lograste, qué aprendiste o qué viene ahora." />
            {datos.fotosPublicables.length ? <div className={styles.communityPhotoPicker} aria-label="Fotos privadas disponibles">{datos.fotosPublicables.map((foto) => <button type="button" aria-pressed={fotoElegida === foto.id} key={foto.id} onClick={() => setFotoElegida(fotoElegida === foto.id ? null : foto.id)}>{foto.url ? <Image src={foto.url} alt={`Foto del ${fechaCorta(foto.fecha)}`} fill sizes="96px" /> : <Camera size={19} />}<span>{fechaCorta(foto.fecha)}</span></button>)}</div> : <Link className={styles.communityNoPhotos} href="/portal-v2/progreso#checkin">Aún no tienes fotos. Registrar una en Progreso <ChevronRight size={14} /></Link>}
            <button className={styles.communityPublishButton} type="button" disabled={procesandoSocial || (!textoPublicacion.trim() && !fotoElegida)} onClick={() => ejecutarSocial(() => crearPublicacionComunidadV2({ texto: textoPublicacion, fotoId: fotoElegida }), () => { setTextoPublicacion(""); setFotoElegida(null); setComponiendo(false); }, "Publicación compartida con la comunidad.")}>{procesandoSocial ? "Publicando…" : "Publicar en Comunidad"}</button>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function Podio({ persona }: { persona: FilaComunidadV2 }) {
  return (
    <article>
      <div className={styles.communityPodiumInitial}><b>{persona.iniciales}</b><span data-place={persona.puesto}><Trophy size={13} /></span></div>
      <strong>{persona.nombre}</strong><small>{persona.puntos.toLocaleString("es-CL")} XP</small>
    </article>
  );
}
