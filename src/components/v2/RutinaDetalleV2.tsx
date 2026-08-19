"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Bookmark,
  CalendarDays,
  History,
  Play,
  X,
} from "lucide-react";
import { iniciarRutinaDesdeCalendarioV2 } from "@/app/alumno/entrenar/actions";
import { ImagenV2Segura } from "@/components/v2/ImagenV2Segura";
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
  const puedeIniciar = Boolean(rutina.rutinaId && rutina.diaId && rutina.numeroCalendario && !rutina.soloLectura);

  useEffect(() => {
    const cuadro = window.requestAnimationFrame(() => {
      setGuardada(window.localStorage.getItem(`vip-v2-rutina-guardada-${rutina.diaId ?? rutina.nombre}`) === "true");
    });
    return () => window.cancelAnimationFrame(cuadro);
  }, [rutina.diaId, rutina.nombre]);

  const alternarGuardada = () => {
    const siguiente = !guardada;
    setGuardada(siguiente);
    window.localStorage.setItem(`vip-v2-rutina-guardada-${rutina.diaId ?? rutina.nombre}`, String(siguiente));
  };

  return (
    <div className={styles.workoutDetailPage}>
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
        <Link href="/portal-v2/progreso"><History size={18} /><span>Historial</span></Link>
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
          <button type="submit" className={styles.workoutFixedStart}><Play size={16} fill="currentColor" /> Iniciar entrenamiento</button>
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
    </div>
  );
}
