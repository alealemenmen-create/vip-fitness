"use client";

import { Fragment, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
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
import { iniciarRutinaDesdeCalendario } from "@/app/alumno/entrenar/actions";
import type { DiaVistaPrevia, NumeroCalendario } from "@/app/alumno/entrenar/data";
import { ETIQUETAS_GRUPO_MUSCULAR } from "@/components/student/GrupoMuscularIcon";
import { FOTOS_GRUPO_MUSCULAR } from "@/lib/grupos-musculares/fotos";
import styles from "./PortalV2.module.css";

type Props = {
  numeros: NumeroCalendario[];
  pagina: number;
  seleccionInicial: number;
  rutinaId: string;
  rutinaNombre: string;
  descansoDespuesDe: string[];
  vistasPrevias: Record<string, NonNullable<DiaVistaPrevia>>;
  sesionEnProgresoId: string | null;
  planNombre: string | null;
  planPausado: boolean;
  cupoAgotado: boolean;
  soloLectura: boolean;
};

function tituloDia(numero: NumeroCalendario) {
  const grupos = numero.dia.resumen?.gruposMusculares ?? [];
  const principales = grupos.filter((grupo) => grupo !== "cardio").slice(0, 2);
  if (principales.length > 0) return principales.map((grupo) => ETIQUETAS_GRUPO_MUSCULAR[grupo]).join(" · ");
  return numero.dia.nombre || "Entrenamiento";
}

export function EntrenamientoInicioV2({
  numeros,
  pagina,
  seleccionInicial,
  rutinaId,
  rutinaNombre,
  descansoDespuesDe,
  vistasPrevias,
  sesionEnProgresoId,
  planNombre,
  planPausado,
  cupoAgotado,
  soloLectura,
}: Props) {
  const [seleccionado, setSeleccionado] = useState(seleccionInicial);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [verRutina, setVerRutina] = useState(false);
  const actual = numeros.find((numero) => numero.numero === seleccionado) ?? numeros[0];
  const vista = actual ? vistasPrevias[actual.dia.id] ?? null : null;

  const foto = useMemo(() => {
    const principal = actual?.dia.resumen?.gruposMusculares.find((grupo) => grupo !== "cardio");
    return principal ? FOTOS_GRUPO_MUSCULAR[principal]?.[0] ?? null : null;
  }, [actual]);

  if (!actual) return null;

  const resumen = actual.dia.resumen;
  const titulo = tituloDia(actual);
  const subtitulo = resumen?.gruposMusculares
    .map((grupo) => ETIQUETAS_GRUPO_MUSCULAR[grupo])
    .join("  ·  ");
  const ejercicios = vista?.tipo === "entrenamiento" ? vista.ejercicios : [];
  const sesionSeleccionadaActiva = actual.estado === "en_progreso" && actual.sesionId;
  const bloqueado = planPausado || cupoAgotado || soloLectura;

  return (
    <div>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.programName}>{rutinaNombre || "Programa VIP"}</h1>
          <p className={styles.phase}>{planNombre ? `${planNombre} · ` : ""}Fase activa</p>
        </div>
        <button
          type="button"
          className={styles.iconButton}
          onClick={() => setMenuAbierto(true)}
          aria-label="Abrir opciones del programa"
        >
          <Menu size={20} />
        </button>
      </header>

      <section id="semana" aria-label={`Semana ${pagina}`}>
        <div className={styles.weekRow}>
          <Link href={`/portal-v2/entrenamiento?pagina=${Math.max(1, pagina - 1)}`} className={styles.iconButton} aria-label="Semana anterior">
            <ChevronLeft size={18} />
          </Link>
          <p className={styles.weekTitle}>Semana {pagina}</p>
          <Link href={`/portal-v2/entrenamiento?pagina=${pagina + 1}`} className={styles.iconButton} aria-label="Semana siguiente">
            <ChevronRight size={18} />
          </Link>
        </div>

        <div className={styles.dayDial}>
          {numeros.map((numero, indice) => (
            <Fragment key={numero.numero}>
              <button
                type="button"
                className={`${styles.dayItem} ${numero.numero === seleccionado ? styles.dayActive : ""} ${numero.estado === "completado" ? styles.dayDone : ""}`}
                onClick={() => setSeleccionado(numero.numero)}
                aria-pressed={numero.numero === seleccionado}
              >
                <span className={styles.dayLabel}>{numero.estado === "completado" ? "HECHO" : "DÍA"}</span>
                <span className={styles.dayCircle}>{indice + 1}</span>
              </button>
              {indice < numeros.length - 1 && descansoDespuesDe.includes(numero.dia.id) && (
                <div className={styles.restItem} aria-label="Descanso">
                  <span className={styles.dayLabel}>DESC.</span>
                  <span className={styles.dayCircle}><Moon size={10} /></span>
                </div>
              )}
            </Fragment>
          ))}
        </div>
      </section>

      <section className={styles.heroCard} aria-label={`Día seleccionado: ${titulo}`}>
        <div className={styles.heroMedia}>
          {foto && (
            <Image
              src={foto}
              alt={`Entrenamiento de ${titulo}`}
              fill
              sizes="(max-width: 460px) 100vw, 460px"
              priority
              className={styles.heroImage}
            />
          )}
        </div>
        <div className={styles.heroCopy}>
          <h2 className={styles.heroTitle}>{titulo}</h2>
          <p className={styles.heroSubtitle}>{subtitulo || actual.dia.nombre}</p>
        </div>
        <div className={styles.metrics}>
          <div className={styles.metric}><strong>{resumen?.cantidadEjercicios ?? 0}</strong><span>Ejercicios</span></div>
          <div className={styles.metric}><strong>{resumen?.cantidadSeries ?? 0}</strong><span>Series</span></div>
          <div className={styles.metric}><strong>{resumen?.minutosEstimados ?? 0}</strong><span>Minutos</span></div>
        </div>
        <div className={styles.heroActions}>
          <button type="button" className={styles.secondaryButton} onClick={() => setVerRutina((valor) => !valor)}>
            {verRutina ? "Ocultar rutina" : "Ver rutina"}
          </button>
          {sesionSeleccionadaActiva ? (
            <Link href={`/alumno/entrenar/sesion/${actual.sesionId}`} className={styles.primaryButton}>
              <Play size={14} fill="currentColor" /> Continuar día {actual.numero}
            </Link>
          ) : sesionEnProgresoId ? (
            <Link href={`/alumno/entrenar/sesion/${sesionEnProgresoId}`} className={styles.primaryButton}>
              <Play size={14} fill="currentColor" /> Continuar sesión
            </Link>
          ) : actual.estado === "completado" && actual.sesionId ? (
            <Link href={`/alumno/entrenar/sesion/${actual.sesionId}`} className={styles.primaryButton}>Ver registro</Link>
          ) : (
            <form action={iniciarRutinaDesdeCalendario}>
              <input type="hidden" name="dia_id" value={actual.dia.id} />
              <input type="hidden" name="rutina_id" value={rutinaId} />
              <input type="hidden" name="numero_calendario" value={actual.numero} />
              <button type="submit" className={styles.primaryButton} disabled={bloqueado}>
                <Play size={14} fill="currentColor" /> Iniciar día {actual.numero}
              </button>
            </form>
          )}
        </div>
      </section>

      {verRutina && ejercicios.length > 0 && (
        <section className={`${styles.exerciseList} ${styles.expanded}`} aria-label="Rutina completa">
          {ejercicios.map((ejercicio) => <EjercicioFila key={ejercicio.id} ejercicio={ejercicio} />)}
        </section>
      )}

      <div className={styles.utilityGrid}>
        <button type="button" className={styles.utilityCard} onClick={() => setVerRutina(true)}>
          <LibraryBig size={20} />
          <span><strong>Biblioteca de ejercicios</strong><span>Explora tu sesión asignada</span></span>
        </button>
        <Link href="/alumno/entrenar/historial" className={styles.utilityCard}>
          <History size={20} />
          <span><strong>Registro de entrenamientos</strong><span>Revisa tus sesiones anteriores</span></span>
        </Link>
      </div>

      <section className={styles.impulso}>
        <span className={styles.impulsoIcon}><Zap size={17} fill="currentColor" /></span>
        <div>
          <strong>Impulso VIP</strong>
          <p>Al iniciar, tu sesión activa objetivos y ajustes según tu rendimiento.</p>
        </div>
        <span className={styles.impulsoBadge}>Preparado</span>
      </section>

      <div className={styles.sectionHeader}>
        <h2>Preparación de hoy</h2>
        <span>{ejercicios.length} ejercicios</span>
      </div>
      <div className={styles.chipRow} aria-label="Categorías">
        <span className={styles.chip}>Calentamiento</span>
        <span className={styles.chip}>Favoritos</span>
        <span className={styles.chip}>Técnica</span>
        <span className={styles.chip}>Movilidad</span>
      </div>
      {ejercicios.length > 0 && (
        <section className={styles.exerciseList} aria-label="Vista previa de ejercicios">
          {ejercicios.slice(0, 3).map((ejercicio) => <EjercicioFila key={ejercicio.id} ejercicio={ejercicio} />)}
        </section>
      )}

      {menuAbierto && (
        <div className={styles.menuBackdrop} role="presentation" onClick={() => setMenuAbierto(false)}>
          <div className={styles.programMenu} role="dialog" aria-modal="true" aria-label="Opciones del programa" onClick={(evento) => evento.stopPropagation()}>
            <button type="button" className={styles.menuItem} onClick={() => setMenuAbierto(false)}>
              <span>Cerrar opciones</span><X size={16} />
            </button>
            <Link href="/alumno/entrenar/historial" className={styles.menuItem}><span>Todos mis programas</span><Dumbbell size={16} /></Link>
            <Link href="/alumno/entrenar/historial" className={styles.menuItem}><span>Registro de entrenamientos</span><History size={16} /></Link>
            <button type="button" className={styles.menuItem} onClick={() => setMenuAbierto(false)}><span>Calendario</span><CalendarDays size={16} /></button>
            <button type="button" className={styles.menuItem} disabled><span>Reordenar días</span><ListRestart size={16} /></button>
            <button type="button" className={styles.menuItem} disabled><span>Reiniciar programa</span><RotateCcw size={16} /></button>
            <Link href="/alumno/entrenar" className={styles.menuItem}><span>Vista clásica del portal</span><Sparkles size={16} /></Link>
          </div>
        </div>
      )}
    </div>
  );
}

function EjercicioFila({ ejercicio }: { ejercicio: NonNullable<DiaVistaPrevia>["ejercicios"][number] }) {
  const foto = ejercicio.videoCloudflareMiniaturaUrl ?? ejercicio.fotoMiniaturaUrl ?? ejercicio.fotoCompletaUrl;
  return (
    <article className={styles.exerciseRow}>
      <div className={styles.exerciseThumb}>
        {foto && <Image src={foto} alt="" fill sizes="42px" />}
      </div>
      <div>
        <strong>{ejercicio.nombre}</strong>
        <span>{ejercicio.grupoMuscular ? ETIQUETAS_GRUPO_MUSCULAR[ejercicio.grupoMuscular] : "Entrenamiento"}</span>
      </div>
      <span className={styles.exerciseMeta}>{ejercicio.seriesProgramadas} × {ejercicio.repsProgramadas}</span>
    </article>
  );
}
