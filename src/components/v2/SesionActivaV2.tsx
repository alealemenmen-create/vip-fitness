"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Clock3,
  History,
  Lightbulb,
  Pause,
  Play,
  Repeat2,
  Settings,
  X,
} from "lucide-react";
import styles from "./PortalV2.module.css";

const EJERCICIOS_SESION = [
  { codigo: "A1", nombre: "Sentadilla Smith", reps: "10 · 10 · 10 · 10", foto: "/v2/piernas.webp" },
  { codigo: "B1", nombre: "Peso muerto rumano", reps: "8 · 8 · 8", foto: "/v2/espalda.webp" },
  { codigo: "B2", nombre: "Prensa inclinada", reps: "12 · 12 · 12", foto: "/v2/piernas.webp" },
  { codigo: "C1", nombre: "Extensión de cuádriceps", reps: "15 · 15 · 15", foto: "/v2/hombros.webp" },
];

function formatearTiempo(total: number) {
  const minutos = Math.floor(total / 60).toString().padStart(2, "0");
  const segundos = (total % 60).toString().padStart(2, "0");
  return `${minutos}:${segundos}`;
}

export function SesionActivaV2() {
  const [segundos, setSegundos] = useState(0);
  const [pausada, setPausada] = useState(false);
  const [seriesCompletadas, setSeriesCompletadas] = useState<Set<number>>(() => new Set());
  const [confirmarSalida, setConfirmarSalida] = useState(false);

  useEffect(() => {
    if (pausada) return;
    const intervalo = window.setInterval(() => setSegundos((valor) => valor + 1), 1000);
    return () => window.clearInterval(intervalo);
  }, [pausada]);

  const alternarSerie = (serie: number) => {
    setSeriesCompletadas((actuales) => {
      const siguientes = new Set(actuales);
      if (siguientes.has(serie)) siguientes.delete(serie);
      else siguientes.add(serie);
      return siguientes;
    });
  };

  return (
    <div className={styles.activeSessionPage}>
      <header className={styles.sessionTopbar}>
        <span>{formatearTiempo(segundos)}</span>
        <strong>Serie {Math.min(seriesCompletadas.size + 1, 32)}/32</strong>
        <button type="button" onClick={() => setConfirmarSalida(true)}>Terminar</button>
      </header>

      <section className={styles.sessionExerciseFocus}>
        <article className={styles.sessionExerciseSummary}>
          <span><Image src="/v2/piernas.webp" alt="Sentadilla Smith" fill sizes="58px" /></span>
          <div><small>SERIE A</small><strong>Sentadilla Smith</strong><p>Reps: 10 · 10 · 10 · 10</p><p>Tempo: 3/0/1/0</p></div>
        </article>
        <div className={styles.sessionActionChips}>
          <button type="button"><Lightbulb size={13} />Consejo</button>
          <button type="button"><History size={13} />Historial</button>
          <button type="button"><Repeat2 size={13} />Sustituir</button>
        </div>
        <div className={styles.setTable}>
          <div className={styles.setTableHead}><span>Serie</span><span>Reps</span><span>Peso</span><span>Descanso</span><span>Listo</span></div>
          {[1, 2, 3, 4].map((serie) => {
            const completada = seriesCompletadas.has(serie);
            return (
              <div key={serie} className={`${styles.setRow} ${completada ? styles.setRowDone : ""}`}>
                <span><b>{serie}</b><em>TRB</em></span>
                <input aria-label={`Repeticiones de la serie ${serie}`} inputMode="numeric" defaultValue="10" />
                <input aria-label={`Peso de la serie ${serie}`} inputMode="decimal" placeholder="— kg" />
                <span>60 s</span>
                <button type="button" onClick={() => alternarSerie(serie)} aria-label={`Marcar serie ${serie} como completada`} aria-pressed={completada}>
                  {completada ? <Check size={14} strokeWidth={3} /> : <CircleCheck size={16} />}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section className={styles.sessionQueue} aria-label="Siguientes ejercicios">
        {EJERCICIOS_SESION.slice(1).map((ejercicio, indice) => (
          <article className={styles.sessionQueueCard} key={ejercicio.codigo}>
            <span><Image src={ejercicio.foto} alt="" fill sizes="52px" /></span>
            <div><small>{ejercicio.codigo}</small><strong>{ejercicio.nombre}</strong><p>Reps: {ejercicio.reps}</p></div>
            <em>{indice === 0 ? "Superserie" : ""}</em>
          </article>
        ))}
      </section>

      <button type="button" className={styles.videoViewButton}>Ver demostración</button>

      <nav className={styles.sessionControls} aria-label="Controles del entrenamiento">
        <button type="button" aria-label="Ajustes"><Settings size={19} /></button>
        <button type="button" aria-label="Ejercicio anterior"><ChevronLeft size={21} /></button>
        <button type="button" aria-label={pausada ? "Reanudar" : "Pausar"} onClick={() => setPausada((valor) => !valor)}>
          {pausada ? <Play size={19} fill="currentColor" /> : <Pause size={19} fill="currentColor" />}
        </button>
        <button type="button" aria-label="Ejercicio siguiente"><ChevronRight size={21} /></button>
        <button type="button" aria-label="Temporizador"><Clock3 size={18} /></button>
      </nav>

      {confirmarSalida ? (
        <div className={styles.sessionFinishBackdrop} role="presentation" onClick={() => setConfirmarSalida(false)}>
          <section className={styles.sessionFinishSheet} role="dialog" aria-modal="true" aria-label="Finalizar entrenamiento" onClick={(evento) => evento.stopPropagation()}>
            <button type="button" className={styles.finishClose} onClick={() => setConfirmarSalida(false)} aria-label="Cerrar"><X size={18} /></button>
            <h2>¿Finalizar y registrar?</h2>
            <p>Guarda la sesión para incorporarla a tu progreso y al Impulso VIP.</p>
            <div className={styles.finishMetrics}><span><strong>{formatearTiempo(segundos)}</strong>Tiempo total</span><span><strong>{seriesCompletadas.size}</strong>Series</span></div>
            <div className={styles.finishActions}>
              <button type="button" onClick={() => setConfirmarSalida(false)}>Continuar entrenando</button>
              <Link href="/portal-v2/entrenamiento">Registrar sesión</Link>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
