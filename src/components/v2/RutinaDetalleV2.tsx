"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Bookmark,
  CalendarDays,
  History,
  Play,
  Type,
  X,
} from "lucide-react";
import { iniciarRutinaDesdeCalendarioV2 } from "@/app/alumno/entrenar/actions";
import { BotonIniciarEntrenamientoV2 } from "@/components/v2/BotonIniciarEntrenamientoV2";
import { ImagenV2Segura } from "@/components/v2/ImagenV2Segura";
import {
  CLAVE_ESCALA_VISUAL_V2,
  ESCALAS_VISUALES_V2,
  ETIQUETAS_ESCALA_VISUAL_V2,
  escalaVisualV2Valida,
  type EscalaVisualV2,
} from "@/lib/v2/escala-visual";
import styles from "./PortalV2.module.css";

export type RutinaDetallePresentacionV2 = {
  nombre: string;
  descripcion: string;
  nivel: string;
  musculos: string[];
  ejercicios: number;
  series: number;
  minutos: number;
  foto: string;
  fotoRespaldo?: string;
  rutinaId: string | null;
  diaId: string | null;
  numeroCalendario: number | null;
  soloLectura: boolean;
  items: {
    id: string;
    nombre: string;
    codigo: string;
    detalle: string;
    tempo: string | null;
    foto: string;
    fotoRespaldo?: string;
    grupo: string;
  }[];
};

const GRUPOS_DEMO = [
  {
    nombre: "Sentadilla Smith",
    codigo: "A1",
    detalle: "10 · 10 · 10 · 10 repeticiones",
    tempo: "3/0/1/0",
    foto: "/v2/piernas.webp",
    grupo: "SERIE A",
  },
  {
    nombre: "Peso muerto rumano",
    codigo: "B1",
    detalle: "8 · 8 · 8 repeticiones",
    tempo: "3/1/1/0",
    foto: "/v2/espalda.webp",
    grupo: "B1/B2 · SUPERSERIE",
  },
  {
    nombre: "Prensa inclinada",
    codigo: "B2",
    detalle: "12 · 12 · 12 repeticiones",
    tempo: "2/0/1/0",
    foto: "/v2/piernas.webp",
    grupo: "",
  },
  {
    nombre: "Extensión de cuádriceps",
    codigo: "C1",
    detalle: "15 · 15 · 15 repeticiones",
    tempo: "2/0/1/2",
    foto: "/v2/hombros.webp",
    grupo: "C1/C2 · TRISERIE",
  },
  {
    nombre: "Curl femoral sentado",
    codigo: "C2",
    detalle: "12 · 12 · 12 repeticiones",
    tempo: "3/0/1/0",
    foto: "/v2/piernas.webp",
    grupo: "",
  },
];

const RUTINA_DEMO: RutinaDetallePresentacionV2 = {
  nombre: "Piernas",
  descripcion: "Cuádriceps · glúteos · femoral · core",
  nivel: "Avanzado",
  musculos: ["Cuádriceps", "Glúteos", "Femoral", "Core"],
  ejercicios: 8,
  series: 32,
  minutos: 75,
  foto: "/v2/piernas.webp",
  rutinaId: null,
  diaId: null,
  numeroCalendario: null,
  soloLectura: false,
  items: GRUPOS_DEMO.map((item) => ({ ...item, id: item.codigo })),
};

export function RutinaDetalleV2({ rutina = RUTINA_DEMO }: { rutina?: RutinaDetallePresentacionV2 }) {
  const [guardada, setGuardada] = useState(false);
  const [ejercicioAbierto, setEjercicioAbierto] = useState<RutinaDetallePresentacionV2["items"][number] | null>(null);
  const [escalaVisual, setEscalaVisual] = useState<EscalaVisualV2>("normal");
  const [selectorEscalaAbierto, setSelectorEscalaAbierto] = useState(false);
  const puedeIniciar = Boolean(rutina.rutinaId && rutina.diaId && rutina.numeroCalendario && !rutina.soloLectura);

  useEffect(() => {
    const cuadro = window.requestAnimationFrame(() => {
      setGuardada(window.localStorage.getItem(`vip-v2-rutina-guardada-${rutina.diaId ?? rutina.nombre}`) === "true");
      const escala = window.localStorage.getItem(CLAVE_ESCALA_VISUAL_V2);
      if (escalaVisualV2Valida(escala)) setEscalaVisual(escala);
    });
    return () => window.cancelAnimationFrame(cuadro);
  }, [rutina.diaId, rutina.nombre]);

  const alternarGuardada = () => {
    const siguiente = !guardada;
    setGuardada(siguiente);
    window.localStorage.setItem(`vip-v2-rutina-guardada-${rutina.diaId ?? rutina.nombre}`, String(siguiente));
  };

  return (
    <div className={styles.workoutDetailPage} data-visual-scale={escalaVisual}>
      <section className={styles.workoutDetailHero}>
        <ImagenV2Segura src={rutina.foto} fallbackSrc={rutina.fotoRespaldo} alt={`Entrenamiento ${rutina.nombre}`} fill priority sizes="(max-width: 460px) 100vw, 460px" className={styles.workoutDetailImage} />
        <div className={styles.workoutDetailShade} />
        <Link href="/portal-v2/entrenamiento" className={styles.workoutBack}><ArrowLeft size={19} /> Atrás</Link>
        <div className={styles.workoutDetailIdentity}>
          <span className={styles.levelBadge}>{rutina.nivel}</span>
          <h1>{rutina.nombre}</h1>
          <div className={styles.muscleTags}>{rutina.musculos.map((musculo) => <span key={musculo}>{musculo}</span>)}</div>
        </div>
      </section>

      <div className={styles.workoutQuickActions} aria-label="Acciones de la rutina">
        <button type="button" onClick={alternarGuardada} aria-pressed={guardada}>
          <Bookmark size={18} fill={guardada ? "currentColor" : "none"} /><span>{guardada ? "Guardada" : "Guardar"}</span>
        </button>
        <Link href="/portal-v2/entrenamiento"><CalendarDays size={18} /><span>Calendario</span></Link>
        <Link href="/portal-v2/entrenamiento/historial"><History size={18} /><span>Historial</span></Link>
        <button type="button" onClick={() => setSelectorEscalaAbierto(true)}><Type size={18} /><span>Tamaño</span></button>
      </div>

      <section className={styles.workoutOverview}>
        <div className={styles.workoutSectionTitle}><h2>Resumen del entrenamiento</h2><span>▣</span></div>
        <div className={styles.workoutOverviewMetrics}>
          <div><strong>{rutina.ejercicios}</strong><span>Ejercicios</span></div>
          <div><strong>{rutina.series}</strong><span>Series</span></div>
          <div><strong>{rutina.minutos}</strong><span>Minutos</span></div>
        </div>
        <div className={styles.workoutExerciseList}>
          {rutina.items.map((ejercicio) => (
            <div key={ejercicio.id}>
              {ejercicio.grupo ? <p className={styles.exerciseGroupLabel}>{ejercicio.grupo}</p> : null}
              <article className={styles.workoutExerciseCard}>
                <span className={styles.workoutExerciseThumb}><ImagenV2Segura src={ejercicio.foto} fallbackSrc={ejercicio.fotoRespaldo} alt="" fill sizes="58px" /></span>
                <div>
                  <strong><b>{ejercicio.codigo}</b> {ejercicio.nombre}</strong>
                  <span>Reps: {ejercicio.detalle}</span>
                  <small>{ejercicio.tempo ? `Técnica: ${ejercicio.tempo}` : "Ejecución controlada"}</small>
                </div>
                <button type="button" aria-label={`Ver detalles de ${ejercicio.nombre}`} onClick={() => setEjercicioAbierto(ejercicio)}><span aria-hidden="true">›</span></button>
              </article>
            </div>
          ))}
        </div>
      </section>

      {puedeIniciar ? (
        <form action={iniciarRutinaDesdeCalendarioV2}>
          <input type="hidden" name="dia_id" value={rutina.diaId ?? ""} />
          <input type="hidden" name="rutina_id" value={rutina.rutinaId ?? ""} />
          <input type="hidden" name="numero_calendario" value={rutina.numeroCalendario ?? ""} />
          <BotonIniciarEntrenamientoV2 texto="Iniciar entrenamiento" />
        </form>
      ) : (
        <Link href="/portal-v2/entrenamiento" className={styles.workoutFixedStart}>
          <Play size={16} fill="currentColor" /> {rutina.soloLectura ? "Volver al programa" : "Explorar entrenamiento"}
        </Link>
      )}
      {ejercicioAbierto ? (
        <div className={styles.nutritionPanelBackdrop} role="presentation" onClick={() => setEjercicioAbierto(null)}>
          <section className={styles.nutritionPanel} role="dialog" aria-modal="true" aria-label={`Detalles de ${ejercicioAbierto.nombre}`} onClick={(evento) => evento.stopPropagation()}>
            <header><button type="button" onClick={() => setEjercicioAbierto(null)} aria-label="Cerrar"><X size={19} /></button></header>
            <h2>{ejercicioAbierto.nombre}</h2>
            <p>{ejercicioAbierto.detalle}</p>
            <div className={styles.infoGrid}><span><small>Bloque</small><strong>{ejercicioAbierto.grupo || ejercicioAbierto.codigo}</strong></span><span><small>Técnica</small><strong>{ejercicioAbierto.tempo || "Ejecución controlada"}</strong></span></div>
          </section>
        </div>
      ) : null}
      {selectorEscalaAbierto ? (
        <div className={styles.nutritionPanelBackdrop} role="presentation" onClick={() => setSelectorEscalaAbierto(false)}>
          <section className={styles.nutritionPanel} role="dialog" aria-modal="true" aria-label="Tamaño de visualización" onClick={(evento) => evento.stopPropagation()}>
            <header><button type="button" onClick={() => setSelectorEscalaAbierto(false)} aria-label="Cerrar"><X size={19} /></button></header>
            <h2>Tamaño de visualización</h2>
            <p>Elige el tamaño que te permita leer y entrenar con comodidad.</p>
            <div className={styles.workoutVisualScaleOptions} role="group" aria-label="Tamaño de visualización">
              {ESCALAS_VISUALES_V2.map((escala) => (
                <button type="button" key={escala} aria-pressed={escalaVisual === escala} onClick={() => {
                  setEscalaVisual(escala);
                  window.localStorage.setItem(CLAVE_ESCALA_VISUAL_V2, escala);
                  setSelectorEscalaAbierto(false);
                }}>
                  <strong>{ETIQUETAS_ESCALA_VISUAL_V2[escala]}</strong>
                  <span>{escala === "compacta" ? "Compacta" : escala === "normal" ? "Normal" : escala === "grande" ? "Grande" : "Máxima"}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
