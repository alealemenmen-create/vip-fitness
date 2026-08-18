"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  CalendarCheck2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Dumbbell,
  History,
  LibraryBig,
  ListRestart,
  Menu,
  Moon,
  Play,
  RotateCcw,
  RotateCw,
  X,
  Zap,
} from "lucide-react";
import styles from "./PortalV2.module.css";

type DiaDemo = {
  numero: number;
  etiqueta: "DÍA" | "DESC.";
  titulo: string;
  subtitulo: string;
  ejercicios: number;
  series: number;
  minutos: number;
  foto: string;
  descanso?: boolean;
};

const DIAS: DiaDemo[] = [
  { numero: 1, etiqueta: "DÍA", titulo: "Pecho", subtitulo: "Pecho · Tríceps · Hombros", ejercicios: 7, series: 24, minutos: 65, foto: "/v2/hombros.webp" },
  { numero: 2, etiqueta: "DÍA", titulo: "Espalda", subtitulo: "Espalda · Bíceps · Core", ejercicios: 8, series: 28, minutos: 70, foto: "/v2/espalda.webp" },
  { numero: 3, etiqueta: "DESC.", titulo: "Día de descanso", subtitulo: "Recuperación activa · Movilidad", ejercicios: 3, series: 3, minutos: 20, foto: "/v2/espalda.webp", descanso: true },
  { numero: 4, etiqueta: "DÍA", titulo: "Piernas", subtitulo: "Cuádriceps · Glúteos · Femoral · Core", ejercicios: 8, series: 32, minutos: 75, foto: "/v2/piernas.webp" },
  { numero: 5, etiqueta: "DÍA", titulo: "Hombros", subtitulo: "Hombros · Deltoide posterior · Trapecio", ejercicios: 6, series: 18, minutos: 50, foto: "/v2/hombros.webp" },
  { numero: 6, etiqueta: "DÍA", titulo: "Brazos", subtitulo: "Bíceps · Tríceps · Antebrazos", ejercicios: 7, series: 24, minutos: 55, foto: "/v2/espalda.webp" },
  { numero: 7, etiqueta: "DESC.", titulo: "Día de descanso", subtitulo: "Recuperación activa · Sueño · Movilidad", ejercicios: 3, series: 3, minutos: 20, foto: "/v2/piernas.webp", descanso: true },
];

const EJERCICIOS = [
  { nombre: "Sentadilla Smith", detalle: "Intermedio · 4 series · 12 repeticiones", foto: "/v2/piernas.webp" },
  { nombre: "Peso muerto rumano", detalle: "Intermedio · 4 series · 10 repeticiones", foto: "/v2/espalda.webp" },
  { nombre: "Impulso VIP de movilidad", detalle: "Preparación · 10 minutos", foto: "/v2/hombros.webp" },
];

export function EntrenamientoDemoV2() {
  const [seleccionado, setSeleccionado] = useState(4);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [verRutina, setVerRutina] = useState(false);
  const [iniciada, setIniciada] = useState(false);
  const inicioGesto = useRef<{ x: number; y: number } | null>(null);
  const inicioGestoMenu = useRef<number | null>(null);
  const actual = DIAS.find((dia) => dia.numero === seleccionado) ?? DIAS[3];

  const elegirDia = (numero: number) => {
    setSeleccionado(numero);
    setIniciada(false);
    setVerRutina(false);
  };

  const cambiarDia = (desplazamiento: -1 | 1) => {
    setSeleccionado((numeroActual) => {
      const indice = DIAS.findIndex((dia) => dia.numero === numeroActual);
      const siguiente = Math.min(DIAS.length - 1, Math.max(0, indice + desplazamiento));
      return DIAS[siguiente].numero;
    });
    setIniciada(false);
    setVerRutina(false);
  };

  const comenzarGesto = (evento: ReactPointerEvent<HTMLElement>) => {
    inicioGesto.current = { x: evento.clientX, y: evento.clientY };
  };

  const terminarGesto = (evento: ReactPointerEvent<HTMLElement>) => {
    const inicio = inicioGesto.current;
    inicioGesto.current = null;
    if (!inicio) return;
    const distanciaX = evento.clientX - inicio.x;
    const distanciaY = evento.clientY - inicio.y;
    if (Math.abs(distanciaX) < 48 || Math.abs(distanciaX) < Math.abs(distanciaY) * 1.25) return;
    cambiarDia(distanciaX < 0 ? 1 : -1);
  };

  return (
    <div className={styles.trainingPage}>
      <header className={styles.pageHeader}>
        <div className={styles.programIdentity}>
          <span className={styles.programMark} aria-hidden="true"><i /><i /><i /></span>
          <div>
            <h1 className={styles.programName}>Método VIP <ChevronRight size={15} /></h1>
            <p className={styles.phase}>Fase 1</p>
          </div>
        </div>
        <button type="button" className={styles.iconButton} onClick={() => setMenuAbierto(true)} aria-label="Abrir opciones del programa">
          <Menu size={20} />
        </button>
      </header>

      <section className={styles.transformation} aria-label="Progreso del programa">
        <div className={styles.transformationCopy}>
          <div><strong>Impulsa tu transformación</strong><span>1 entrenamiento para completar</span></div>
          <button type="button">¿Por qué?</button>
        </div>
        <div className={styles.progressSegments} aria-hidden="true">
          <span className={styles.progressDone} /><span className={styles.progressDone} /><span className={styles.progressDone} /><span />
        </div>
      </section>

      <section aria-label="Semana 1">
        <div className={styles.weekRow}>
          <button type="button" className={styles.iconButton} aria-label="Semana anterior"><ChevronLeft size={18} /></button>
          <p className={styles.weekTitle}>Semana 1</p>
          <button type="button" className={styles.iconButton} aria-label="Semana siguiente"><ChevronRight size={18} /></button>
        </div>
        <div className={styles.dayDial}>
          {DIAS.map((dia) => (
            <button
              type="button"
              key={dia.numero}
              className={`${styles.dayItem} ${dia.numero === seleccionado ? styles.dayActive : ""}`}
              onClick={() => elegirDia(dia.numero)}
              aria-pressed={dia.numero === seleccionado}
            >
              <span className={styles.dayLabel}>{dia.etiqueta}</span>
              <span className={styles.dayCircle}>{dia.descanso ? <Moon size={10} /> : dia.numero}</span>
            </button>
          ))}
        </div>
      </section>

      <section
        className={styles.heroCard}
        aria-label={`${actual.titulo}. Desliza horizontalmente para cambiar de día.`}
        onPointerDown={comenzarGesto}
        onPointerUp={terminarGesto}
        onPointerCancel={() => { inicioGesto.current = null; }}
      >
        <div key={actual.numero} className={styles.heroAnimated}>
          <div className={styles.heroMedia}>
            <Image src={actual.foto} alt={`Entrenamiento de ${actual.titulo}`} fill sizes="(max-width: 460px) 100vw, 460px" loading="eager" className={styles.heroImage} />
          </div>
          <div className={styles.heroCopy} aria-live="polite">
            <h2 className={styles.heroTitle}>{actual.titulo}</h2>
            <p className={styles.heroSubtitle}>{actual.subtitulo}</p>
          </div>
          {actual.descanso ? (
            <div className={styles.restChecklist}>
              <span>✓ Libera tensión con movilidad suave</span>
              <span>✓ Mantén una hidratación constante</span>
              <span>✓ Prioriza entre 7 y 9 horas de sueño</span>
            </div>
          ) : (
            <div className={styles.metrics}>
              <div className={styles.metric}><strong>{actual.ejercicios}</strong><span>Ejercicios</span></div>
              <div className={styles.metric}><strong>{actual.series}</strong><span>Series</span></div>
              <div className={styles.metric}><strong>{actual.minutos}</strong><span>Minutos</span></div>
            </div>
          )}
          <div className={`${styles.heroActions} ${actual.descanso ? styles.heroActionsSingle : ""}`}>
            {!actual.descanso ? <button type="button" className={styles.secondaryButton} onClick={() => setVerRutina((valor) => !valor)}>{verRutina ? "Ocultar rutina" : "Ver rutina"}</button> : null}
            <button type="button" className={styles.primaryButton} onClick={() => setIniciada(true)}>
              {!actual.descanso ? <Play size={14} fill="currentColor" /> : null}
              {iniciada ? "Sesión preparada" : actual.descanso ? `Completar descanso ${actual.numero}` : `Iniciar día ${actual.numero}`}
            </button>
          </div>
        </div>
      </section>

      {verRutina && !actual.descanso && (
        <section className={`${styles.exerciseList} ${styles.expanded}`} aria-label="Rutina completa">
          {EJERCICIOS.map((ejercicio) => <EjercicioDemo key={ejercicio.nombre} {...ejercicio} />)}
        </section>
      )}

      <div className={styles.utilityGrid}>
        <button type="button" className={styles.utilityCard} onClick={() => setVerRutina(true)}>
          <LibraryBig size={20} />
          <span><strong>Biblioteca de ejercicios</strong><span>Explora más de 500 ejercicios</span></span>
        </button>
        <button type="button" className={styles.utilityCard} onClick={() => setMenuAbierto(true)}>
          <Dumbbell size={20} />
          <span><strong>Constructor de rutinas</strong><span>Crea entrenamientos personalizados</span></span>
        </button>
      </div>

      <section className={styles.impulso}>
        <span className={styles.impulsoIcon}><Zap size={17} fill="currentColor" /></span>
        <div><strong>Impulso VIP</strong><p>Tu guía adapta objetivos, cargas y recuperación a tu rendimiento.</p></div>
        <span className={styles.impulsoBadge}>Activo</span>
      </section>

      <div className={styles.sectionHeader}><div><h2>Entrenamientos adicionales</h2><p>Explora por categoría</p></div><button type="button">Ver todos</button></div>
      <div className={styles.chipRow} aria-label="Categorías">
        <span className={styles.chip}>Calentamiento</span><span className={styles.chip}>Favoritos</span><span className={styles.chip}>Poco tiempo</span><span className={styles.chip}>Movilidad</span>
      </div>
      <section className={styles.exerciseList} aria-label="Entrenamientos recomendados">
        {EJERCICIOS.map((ejercicio) => <EjercicioDemo key={ejercicio.nombre} {...ejercicio} />)}
      </section>

      {menuAbierto && (
        <div className={styles.menuBackdrop} role="presentation" onClick={() => setMenuAbierto(false)}>
          <div
            className={styles.programMenu}
            role="dialog"
            aria-modal="true"
            aria-label="Opciones del programa"
            onClick={(evento) => evento.stopPropagation()}
            onPointerDown={(evento) => { inicioGestoMenu.current = evento.clientX; }}
            onPointerUp={(evento) => {
              if (inicioGestoMenu.current !== null && evento.clientX - inicioGestoMenu.current > 45) setMenuAbierto(false);
              inicioGestoMenu.current = null;
            }}
          >
            <button type="button" className={styles.menuClose} onClick={() => setMenuAbierto(false)} aria-label="Cerrar opciones">
              <Menu size={27} strokeWidth={2.3} />
              <span className={styles.menuCloseBadge}><X size={13} strokeWidth={2.6} /></span>
            </button>
            <div className={styles.menuActions}>
              <button type="button" className={styles.menuItem}><span>Todos los programas</span><i><ClipboardList size={21} /></i></button>
              <button type="button" className={styles.menuItem}><span>Registro de entrenamientos</span><i><History size={21} /></i></button>
              <button type="button" className={styles.menuItem}><span>Calendario</span><i><CalendarDays size={21} /></i></button>
              <button type="button" className={styles.menuItem}><span>Horario de entrenamiento</span><i><CalendarCheck2 size={21} /></i></button>
              <button type="button" className={styles.menuItem}><span>Reordenar días</span><i><ListRestart size={21} /></i></button>
              <button type="button" className={styles.menuItem}><span>Reiniciar fase</span><i><RotateCcw size={21} /></i></button>
              <button type="button" className={styles.menuItem}><span>Reiniciar programa</span><i><RotateCw size={21} /></i></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EjercicioDemo({ nombre, detalle, foto }: { nombre: string; detalle: string; foto: string }) {
  return (
    <article className={styles.exerciseRow}>
      <div className={styles.exerciseThumb}><Image src={foto} alt="" fill sizes="48px" /></div>
      <div><strong>{nombre}</strong><span>{detalle}</span></div>
      <span className={styles.exerciseMeta}>›</span>
    </article>
  );
}
