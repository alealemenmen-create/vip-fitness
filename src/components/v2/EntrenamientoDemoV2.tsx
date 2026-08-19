"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  Archive,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  History,
  LayoutGrid,
  Menu,
  Moon,
  Play,
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

const ADICIONALES = [
  { nombre: "Calentamiento dinámico", nivel: "Principiante", detalle: "10 min · 5 series" },
  { nombre: "Recuperación post-entreno", nivel: "Principiante", detalle: "5 min · 1 serie" },
  { nombre: "Movilidad preventiva de hombros", nivel: "Principiante", detalle: "10 min · 3 series" },
];

export function EntrenamientoDemoV2() {
  const [seleccionado, setSeleccionado] = useState(4);
  const [direccion, setDireccion] = useState<1 | -1>(1);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [iniciada, setIniciada] = useState(false);
  const [semana, setSemana] = useState(1);
  const [explicacion, setExplicacion] = useState(false);
  const inicioGesto = useRef<{ x: number; y: number } | null>(null);
  const inicioGestoMenu = useRef<number | null>(null);
  const actual = DIAS.find((dia) => dia.numero === seleccionado) ?? DIAS[3];

  const elegirDia = (numero: number) => {
    if (numero === seleccionado) return;
    setDireccion(numero > seleccionado ? 1 : -1);
    setSeleccionado(numero);
    setIniciada(false);
  };

  const cambiarDia = (desplazamiento: -1 | 1) => {
    setDireccion(desplazamiento);
    setSeleccionado((numeroActual) => {
      const indice = DIAS.findIndex((dia) => dia.numero === numeroActual);
      const siguiente = Math.min(DIAS.length - 1, Math.max(0, indice + desplazamiento));
      return DIAS[siguiente].numero;
    });
    setIniciada(false);
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
          <button type="button" onClick={() => setExplicacion((valor) => !valor)} aria-expanded={explicacion}>¿Por qué?</button>
        </div>
        {explicacion ? <p className={styles.sheetCopy}>La barra avanza con sesiones registradas, no con visitas a la pantalla. El último tramo se completa al cerrar el entrenamiento pendiente.</p> : null}
        <div className={styles.progressSegments} aria-hidden="true">
          <span className={styles.progressDone} /><span className={styles.progressDone} /><span className={styles.progressDone} /><span />
        </div>
      </section>

      <section id="semana-entrenamiento" aria-label={`Semana ${semana}`}>
        <div className={styles.weekRow}>
          <button type="button" className={styles.iconButton} aria-label="Semana anterior" disabled={semana === 1} onClick={() => setSemana((valor) => Math.max(1, valor - 1))}><ChevronLeft size={18} /></button>
          <p className={styles.weekTitle}>Semana {semana}</p>
          <button type="button" className={styles.iconButton} aria-label="Semana siguiente" disabled={semana === 8} onClick={() => setSemana((valor) => Math.min(8, valor + 1))}><ChevronRight size={18} /></button>
        </div>
        <div className={styles.dayDial}>
          {DIAS.map((dia) => (
            <button
              type="button"
              key={dia.numero}
              className={`${styles.dayItem} ${dia.numero === seleccionado ? styles.dayActive : ""} ${dia.numero < seleccionado ? styles.dayCompleted : ""}`}
              onClick={() => elegirDia(dia.numero)}
              aria-pressed={dia.numero === seleccionado}
            >
              <span className={styles.dayLabel}>{dia.etiqueta}</span>
              <span className={styles.dayCircle}>
                {dia.numero < seleccionado ? <Check size={11} strokeWidth={3} /> : dia.descanso ? <Moon size={10} /> : dia.numero}
              </span>
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
        <div key={actual.numero} className={`${styles.heroAnimated} ${direccion > 0 ? styles.heroFromRight : styles.heroFromLeft}`}>
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
            {!actual.descanso ? <Link href="/portal-v2/entrenamiento/rutina" className={styles.secondaryButton}>Ver rutina</Link> : null}
            {!actual.descanso ? (
              <Link href="/portal-v2/entrenamiento/sesion" className={styles.primaryButton}><Play size={14} fill="currentColor" />Iniciar día {actual.numero}</Link>
            ) : (
              <button type="button" className={styles.primaryButton} onClick={() => setIniciada(true)}>{iniciada ? "Descanso completado" : `Completar descanso ${actual.numero}`}</button>
            )}
          </div>
        </div>
      </section>

      <div className={styles.utilityGrid}>
        <Link href="/portal-v2/entrenamiento/rutina" className={styles.utilityCard}>
          <span className={styles.utilityIcon} aria-hidden="true"><Archive size={28} strokeWidth={1.85} /></span>
          <span className={styles.utilityCopy}><strong>Rutina del programa</strong><span>Revisa ejercicios, series y técnica</span></span>
        </Link>
        <Link href="/portal-v2/progreso" className={styles.utilityCard}>
          <span className={styles.utilityIcon} aria-hidden="true">
            <LayoutGrid size={27} strokeWidth={1.75} />
            <i className={styles.utilityIconPlus}>+</i>
          </span>
          <span className={styles.utilityCopy}><strong>Mi progreso</strong><span>Rendimiento, constancia y clasificación</span></span>
        </Link>
      </div>

      <section className={styles.impulso}>
        <span className={styles.impulsoIcon}><Zap size={17} fill="currentColor" /></span>
        <div><strong>Impulso VIP</strong><p>Tu guía adapta objetivos, cargas y recuperación a tu rendimiento.</p></div>
        <span className={styles.impulsoBadge}>Activo</span>
      </section>

      <div className={styles.sectionHeader}>
        <div><h2>Entrenamientos adicionales</h2><p>Explora por categoría</p></div>
        <Link href="/portal-v2/entrenamiento/rutina">Ver todos <ChevronRight size={14} /></Link>
      </div>
      <div className={styles.chipRow} aria-label="Categorías">
        <span className={`${styles.chip} ${styles.chipActive}`}>Calentamiento</span><span className={styles.chip}>Favoritos</span><span className={styles.chip}>Poco tiempo</span><span className={styles.chip}>Movilidad</span>
      </div>
      <section className={styles.additionalList} aria-label="Entrenamientos recomendados">
        {ADICIONALES.map((entrenamiento) => (
          <Link href="/portal-v2/entrenamiento/rutina" className={styles.additionalCard} key={entrenamiento.nombre}>
            <strong>{entrenamiento.nombre}</strong>
            <span className={styles.additionalMeta}><b>{entrenamiento.nivel}</b><span>·</span>{entrenamiento.detalle}</span>
          </Link>
        ))}
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
              <Link href="/portal-v2/entrenamiento/rutina" className={styles.menuItem}><span>Programa y ejercicios</span><i><Archive size={21} /></i></Link>
              <Link href="/portal-v2/progreso" className={styles.menuItem}><span>Registro y rendimiento</span><i><History size={21} /></i></Link>
              <a href="#semana-entrenamiento" className={styles.menuItem} onClick={() => setMenuAbierto(false)}><span>Calendario</span><i><CalendarDays size={21} /></i></a>
              <Link href="/portal-v2/nutricion" className={styles.menuItem}><span>Nutrición del día</span><i><LayoutGrid size={21} /></i></Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
