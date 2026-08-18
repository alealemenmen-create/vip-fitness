"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  Bookmark,
  CalendarDays,
  CheckCircle2,
  Ellipsis,
  History,
  Play,
} from "lucide-react";
import styles from "./PortalV2.module.css";

const GRUPOS = [
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

export function RutinaDetalleV2() {
  const [guardada, setGuardada] = useState(false);

  return (
    <div className={styles.workoutDetailPage}>
      <section className={styles.workoutDetailHero}>
        <Image src="/v2/piernas.webp" alt="Entrenamiento de piernas" fill priority sizes="(max-width: 460px) 100vw, 460px" className={styles.workoutDetailImage} />
        <div className={styles.workoutDetailShade} />
        <Link href="/portal-v2/entrenamiento" className={styles.workoutBack}><ArrowLeft size={19} /> Atrás</Link>
        <div className={styles.workoutDetailIdentity}>
          <span className={styles.levelBadge}>Avanzado</span>
          <h1>Piernas</h1>
          <div className={styles.muscleTags}><span>Cuádriceps</span><span>Glúteos</span><span>Femoral</span><span>Core</span></div>
        </div>
      </section>

      <div className={styles.workoutQuickActions} aria-label="Acciones de la rutina">
        <button type="button" onClick={() => setGuardada((valor) => !valor)} aria-pressed={guardada}>
          <Bookmark size={18} fill={guardada ? "currentColor" : "none"} /><span>{guardada ? "Guardada" : "Guardar"}</span>
        </button>
        <button type="button"><CalendarDays size={18} /><span>Programar</span></button>
        <button type="button"><History size={18} /><span>Historial</span></button>
        <button type="button"><CheckCircle2 size={18} /><span>Completar</span></button>
      </div>

      <section className={styles.workoutOverview}>
        <div className={styles.workoutSectionTitle}><h2>Resumen del entrenamiento</h2><span>▣</span></div>
        <div className={styles.workoutOverviewMetrics}>
          <div><strong>8</strong><span>Ejercicios</span></div>
          <div><strong>32</strong><span>Series</span></div>
          <div><strong>75</strong><span>Minutos</span></div>
        </div>
        <div className={styles.workoutExerciseList}>
          {GRUPOS.map((ejercicio) => (
            <div key={ejercicio.codigo}>
              {ejercicio.grupo ? <p className={styles.exerciseGroupLabel}>{ejercicio.grupo}</p> : null}
              <article className={styles.workoutExerciseCard}>
                <span className={styles.workoutExerciseThumb}><Image src={ejercicio.foto} alt="" fill sizes="58px" /></span>
                <div>
                  <strong><b>{ejercicio.codigo}</b> {ejercicio.nombre}</strong>
                  <span>Reps: {ejercicio.detalle}</span>
                  <small>Tempo: {ejercicio.tempo}</small>
                </div>
                <button type="button" aria-label={`Opciones de ${ejercicio.nombre}`}><Ellipsis size={18} /></button>
              </article>
            </div>
          ))}
        </div>
      </section>

      <Link href="/portal-v2/entrenamiento/sesion" className={styles.workoutFixedStart}><Play size={16} fill="currentColor" /> Iniciar entrenamiento</Link>
    </div>
  );
}
