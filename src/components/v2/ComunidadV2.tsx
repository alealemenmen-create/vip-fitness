"use client";

import Image from "next/image";
import Link from "next/link";
import { ChangeEvent, useId, useState } from "react";
import {
  ArrowLeft,
  Camera,
  ChevronRight,
  Heart,
  ImagePlus,
  Medal,
  MessageCircle,
  Send,
  Trophy,
  X,
} from "lucide-react";
import styles from "./PortalV2.module.css";

type Vista = "actividad" | "clasificacion";
type Periodo = "general" | "mensual";

const PUBLICACIONES_INICIALES = [
  { id: 1, nombre: "Vale R.", iniciales: "VR", momento: "Hace 18 min", texto: "Piernas terminadas. Hoy el impulso fue mantener la técnica hasta la última serie.", foto: "/v2/piernas.webp", puesto: 1, likes: 18, comentarios: 4 },
  { id: 2, nombre: "Ale Mendoza", iniciales: "AM", momento: "Hace 1 h", texto: "Día 6 completado. Más control, más constancia y una sesión mejor que la anterior.", foto: "/ejercicios/press-militar.webp", puesto: 2, likes: 14, comentarios: 3 },
  { id: 3, nombre: "Seba M.", iniciales: "SM", momento: "Hace 3 h", texto: "Espalda lista. Sumando otro entrenamiento al Método VIP.", foto: "/ejercicios/fondos.webp", puesto: 3, likes: 11, comentarios: 2 },
] as const;

const CLASIFICACION = [
  { puesto: 1, nombre: "Vale R.", iniciales: "VR", puntos: "1.240 XP", foto: "/v2/piernas.webp" },
  { puesto: 2, nombre: "Tú", iniciales: "AM", puntos: "900 XP", foto: "/ejercicios/press-militar.webp" },
  { puesto: 3, nombre: "Seba M.", iniciales: "SM", puntos: "760 XP", foto: "/v2/espalda.webp" },
  { puesto: 4, nombre: "Camila P.", iniciales: "CP", puntos: "690 XP" },
  { puesto: 5, nombre: "Nicolás G.", iniciales: "NG", puntos: "625 XP" },
  { puesto: 6, nombre: "Daniela S.", iniciales: "DS", puntos: "580 XP" },
] as const;

const CLASIFICACION_MENSUAL = [
  { puesto: 1, nombre: "Tú", iniciales: "AM", puntos: "420 XP", foto: "/ejercicios/press-militar.webp" },
  { puesto: 2, nombre: "Vale R.", iniciales: "VR", puntos: "390 XP", foto: "/v2/piernas.webp" },
  { puesto: 3, nombre: "Camila P.", iniciales: "CP", puntos: "340 XP", foto: "/v2/espalda.webp" },
  { puesto: 4, nombre: "Seba M.", iniciales: "SM", puntos: "315 XP" },
  { puesto: 5, nombre: "Daniela S.", iniciales: "DS", puntos: "280 XP" },
  { puesto: 6, nombre: "Nicolás G.", iniciales: "NG", puntos: "245 XP" },
] as const;

export function ComunidadV2() {
  const inputId = useId();
  const [vista, setVista] = useState<Vista>("actividad");
  const [periodo, setPeriodo] = useState<Periodo>("general");
  const [likes, setLikes] = useState(() => new Set<number>());
  const [publicar, setPublicar] = useState(false);
  const [texto, setTexto] = useState("");
  const [foto, setFoto] = useState<string | null>(null);
  const [publicacionPropia, setPublicacionPropia] = useState<{ texto: string; foto: string } | null>(null);
  const clasificacionVisible = periodo === "general" ? CLASIFICACION : CLASIFICACION_MENSUAL;

  const cambiarLike = (id: number) => {
    setLikes((actuales) => {
      const siguientes = new Set(actuales);
      if (siguientes.has(id)) siguientes.delete(id);
      else siguientes.add(id);
      return siguientes;
    });
  };

  const seleccionarFoto = (evento: ChangeEvent<HTMLInputElement>) => {
    const archivo = evento.target.files?.[0];
    if (!archivo) return;
    const lector = new FileReader();
    lector.onload = () => setFoto(typeof lector.result === "string" ? lector.result : null);
    lector.readAsDataURL(archivo);
  };

  const compartir = () => {
    setPublicacionPropia({ texto: texto.trim() || "Nuevo avance completado en Método VIP.", foto: foto || "/ejercicios/press-militar.webp" });
    setTexto("");
    setFoto(null);
    setPublicar(false);
  };

  return (
    <section className={styles.communityPage}>
      <header className={styles.communityHeader}>
        <Link href="/portal-v2/progreso" aria-label="Volver a Progreso"><ArrowLeft size={22} /></Link>
        <h1>Comunidad</h1>
        <button type="button" onClick={() => setPublicar(true)} aria-label="Compartir avance"><Camera size={20} /></button>
      </header>

      <section className={styles.communityMe}>
        <div className={styles.communityMeIdentity}><span>AM</span><div><strong>Ale Mendoza</strong><small>Método VIP · Día 6 de 21</small></div><b>900 XP <Trophy size={12} /></b></div>
        <div className={styles.communityMeStats}><span><strong>2.º</strong><small>Posición</small></span><span><strong>7</strong><small>Impulsos</small></span><span><strong>6</strong><small>Sesiones</small></span></div>
      </section>

      <div className={styles.communityTabs} role="tablist" aria-label="Vistas de comunidad">
        <button type="button" role="tab" aria-selected={vista === "actividad"} onClick={() => setVista("actividad")}>Actividad</button>
        <button type="button" role="tab" aria-selected={vista === "clasificacion"} onClick={() => setVista("clasificacion")}>Clasificación</button>
      </div>

      {vista === "actividad" ? (
        <div className={styles.communityFeed}>
          <button type="button" className={styles.communityComposer} onClick={() => setPublicar(true)}><span><ImagePlus size={17} /></span><strong>Comparte tu avance</strong><ChevronRight size={16} /></button>
          {publicacionPropia ? <Publicacion id={0} nombre="Tú" iniciales="AM" momento="Ahora" texto={publicacionPropia.texto} foto={publicacionPropia.foto} puesto={2} likes={0} comentarios={0} liked={likes.has(0)} onLike={() => cambiarLike(0)} propia /> : null}
          {PUBLICACIONES_INICIALES.map((publicacion) => <Publicacion key={publicacion.id} {...publicacion} liked={likes.has(publicacion.id)} onLike={() => cambiarLike(publicacion.id)} />)}
        </div>
      ) : (
        <section className={styles.communityRanking}>
          <div className={styles.communityPeriod} role="tablist" aria-label="Periodo de clasificación">
            <button type="button" role="tab" aria-selected={periodo === "general"} onClick={() => setPeriodo("general")}>General</button>
            <button type="button" role="tab" aria-selected={periodo === "mensual"} onClick={() => setPeriodo("mensual")}>Este mes</button>
          </div>
          <div className={styles.communityPodium}>
            {clasificacionVisible.slice(0, 3).map((persona) => <Podio key={`${periodo}-${persona.puesto}`} {...persona} />)}
          </div>
          <div className={styles.communityRankingList}>
            {clasificacionVisible.map((persona) => (
              <article className={persona.nombre === "Tú" ? styles.communityRankingMine : ""} key={persona.puesto}>
                <span>{persona.puesto}</span><i>{persona.iniciales}</i><strong>{persona.nombre}</strong><b>{persona.puntos}</b>{persona.nombre === "Tú" ? <em>↑</em> : null}
              </article>
            ))}
          </div>
        </section>
      )}

      {publicar ? (
        <div className={styles.communityPublishBackdrop} role="presentation" onClick={() => setPublicar(false)}>
          <section className={styles.communityPublishSheet} role="dialog" aria-modal="true" aria-label="Compartir avance" onClick={(evento) => evento.stopPropagation()}>
            <header><h2>Compartir avance</h2><button type="button" aria-label="Cerrar" onClick={() => setPublicar(false)}><X size={19} /></button></header>
            <label htmlFor={inputId} className={styles.communityPhotoPicker}>
              {foto ? <Image src={foto} alt="Vista previa del avance" fill sizes="(max-width: 460px) 100vw, 460px" unoptimized /> : <><ImagePlus size={24} /><strong>Añadir fotografía</strong><span>Desde tu galería o cámara</span></>}
            </label>
            <input id={inputId} type="file" accept="image/*" capture="environment" onChange={seleccionarFoto} hidden />
            <textarea value={texto} onChange={(evento) => setTexto(evento.target.value)} placeholder="¿Qué lograste hoy?" maxLength={180} />
            <button type="button" className={styles.communityPublishButton} onClick={compartir}><Send size={16} /> Publicar en la comunidad</button>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function Publicacion({ nombre, iniciales, momento, texto, foto, puesto, likes, comentarios, liked, onLike, propia = false }: { id: number; nombre: string; iniciales: string; momento: string; texto: string; foto: string; puesto: number; likes: number; comentarios: number; liked: boolean; onLike: () => void; propia?: boolean }) {
  return (
    <article className={styles.communityPost}>
      <header><span>{iniciales}</span><div><strong>{nombre}</strong><small>{momento}</small></div>{propia ? <b>Tu publicación</b> : null}</header>
      <div className={styles.communityPostPhoto}>
        <Image src={foto} alt={`Avance de ${nombre}`} fill sizes="(max-width: 460px) 100vw, 460px" unoptimized={foto.startsWith("data:")} />
        <span className={styles.communityPostTrophy} data-place={puesto}><Trophy size={15} /><b>{puesto}</b></span>
      </div>
      <p>{texto}</p>
      <footer><button type="button" className={liked ? styles.communityLiked : ""} aria-pressed={liked} onClick={onLike}><Heart size={17} fill={liked ? "currentColor" : "none"} /> {likes + (liked ? 1 : 0)}</button><button type="button"><MessageCircle size={17} /> {comentarios}</button><span><Medal size={16} /> {puesto === 1 ? "Oro" : puesto === 2 ? "Plata" : "Bronce"}</span></footer>
    </article>
  );
}

function Podio({ puesto, nombre, puntos, foto }: { puesto: number; nombre: string; iniciales: string; puntos: string; foto?: string }) {
  return (
    <article>
      <div>{foto ? <Image src={foto} alt={nombre} fill sizes="(max-width: 460px) 29vw, 126px" /> : null}<span data-place={puesto}><Trophy size={13} /></span></div>
      <strong>{nombre}</strong><small>{puntos}</small>
    </article>
  );
}
