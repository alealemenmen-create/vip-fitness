"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  History,
  LibraryBig,
  ListRestart,
  Menu,
  Moon,
  Play,
  RotateCcw,
  Sparkles,
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
  const actual = useMemo(() => DIAS.find((dia) => dia.numero === seleccionado) ?? DIAS[3], [seleccionado]);

  return (
    <div className={styles.trainingPage}>
      <header className={styles.pageHeader}>
        <div className={styles.programIdentity}>
          <span className={styles.programSlashes} aria-hidden="true">{"//"}</span>
          <div>
            <h1 className={styles.programName}>Método VIP</h1>
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
              onClick={() => { setSeleccionado(dia.numero); setIniciada(false); }}
              aria-pressed={dia.numero === seleccionado}
            >
              <span className={styles.dayLabel}>{dia.etiqueta}</span>
              <span className={styles.dayCircle}>{dia.descanso ? <Moon size={10} /> : dia.numero}</span>
            </button>
          ))}
        </div>
      </section>

      <section className={styles.heroCard} aria-label={actual.titulo}>
        <div className={styles.heroMedia}>
          <Image src={actual.foto} alt={`Entrenamiento de ${actual.titulo}`} fill sizes="(max-width: 460px) 100vw, 460px" loading="eager" className={styles.heroImage} />
        </div>
        <div className={styles.heroCopy}>
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
          {!actual.descanso && <button type="button" className={styles.secondaryButton} onClick={() => setVerRutina((valor) => !valor)}>{verRutina ? "Ocultar rutina" : "Ver rutina"}</button>}
          <button type="button" className={styles.primaryButton} onClick={() => setIniciada(true)}>
            {!actual.descanso && <Play size={14} fill="currentColor" />}
            {iniciada ? "Sesión preparada" : actual.descanso ? `Completar descanso ${actual.numero}` : `Iniciar día ${actual.numero}`}
          </button>
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
          <div className={styles.programMenu} role="dialog" aria-modal="true" aria-label="Opciones del programa" onClick={(evento) => evento.stopPropagation()}>
            <button type="button" className={styles.menuItem} onClick={() => setMenuAbierto(false)}><span>Cerrar opciones</span><X size={16} /></button>
            <button type="button" className={styles.menuItem}><span>Todos los programas</span><Dumbbell size={16} /></button>
            <button type="button" className={styles.menuItem}><span>Registro de entrenamientos</span><History size={16} /></button>
            <button type="button" className={styles.menuItem}><span>Calendario</span><CalendarDays size={16} /></button>
            <button type="button" className={styles.menuItem}><span>Reordenar días</span><ListRestart size={16} /></button>
            <button type="button" className={styles.menuItem}><span>Reiniciar fase</span><RotateCcw size={16} /></button>
            <Link href="/alumno/inicio" className={styles.menuItem}><span>Abrir Portal VIP clásico</span><Sparkles size={16} /></Link>
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
