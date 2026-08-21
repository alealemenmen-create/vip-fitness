"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Dumbbell,
  History,
  LibraryBig,
  Menu,
  Moon,
  Play,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { iniciarRutinaDesdeCalendarioV2 } from "@/app/alumno/entrenar/actions";
import type { DiaVistaPrevia, NumeroCalendario } from "@/app/alumno/entrenar/data";
import { ETIQUETAS_GRUPO_MUSCULAR } from "@/components/student/GrupoMuscularIcon";
import { nombreCortoRutina } from "@/lib/entrenamiento/nombre-rutina";
import { FOTOS_GRUPO_MUSCULAR } from "@/lib/grupos-musculares/fotos";
import { fotoPortadaDia } from "@/lib/entrenamiento/foto-portada-dia";
import { BotonIniciarEntrenamientoV2 } from "@/components/v2/BotonIniciarEntrenamientoV2";
import { ImagenV2Segura } from "@/components/v2/ImagenV2Segura";
import styles from "./PortalV2.module.css";

type Props = {
  numeros: NumeroCalendario[];
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
  // `gruposMusculares` ya viene filtrado por `gruposIdentificadoresDia`
  // (obtenerDiasRutina): cardio solo aparece acá si de verdad identifica al
  // día (todo cardio, o 3+ ejercicios), nunca por un calentamiento suelto.
  const grupos = (numero.dia.resumen?.gruposMusculares ?? []).slice(0, 2);
  if (grupos.length > 0) return grupos.map((grupo) => ETIQUETAS_GRUPO_MUSCULAR[grupo]).join(" · ");
  return numero.dia.nombre || "Entrenamiento";
}

export function EntrenamientoInicioV2({
  numeros,
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

  // Con el ciclo completo (12/16/20/24 días) a la vista sin paginar por
  // semana, el día activo puede caer bien a la derecha de la tira -- sin
  // esto el alumno abría Entrenar y no sabía "dónde viene" hasta scrollear a
  // mano (pedido de Alejandro, 2026-08-21: "muchos alumnos nunca saben qué
  // día vienen"). Solo al montar: un tap manual después no debe reacomodar
  // la tira solo, se ve la posición del tap.
  const tiraDiasRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    tiraDiasRef.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ inline: "center", block: "nearest" });
  }, []);

  // Respaldo si ningún ejercicio del día tiene foto real identificada
  // todavía (biblioteca incompleta) -- el dibujo anatómico de siempre.
  const fotoRespaldo = useMemo(() => {
    const principal = actual?.dia.resumen?.gruposMusculares[0];
    return principal ? FOTOS_GRUPO_MUSCULAR[principal]?.[0] ?? null : null;
  }, [actual]);

  // Portada del día: una foto REAL y curada de algún ejercicio de la sesión
  // (modelo haciendo el movimiento -- ej. press militar en un día de
  // hombros), no el cuerpo genérico resaltado en naranja. Ignora ejercicios
  // de cardio que son solo calentamiento (ver fotoPortadaDia) y solo cae al
  // dibujo anatómico si ningún ejercicio del día tiene foto identificada
  // (pedido de Alejandro, 2026-08-21: "elegí las mejores fotos" + "no me
  // ponga cardio [por una bicicleta de calentamiento]").
  const foto = useMemo(() => {
    const ejerciciosDia = vista?.tipo === "entrenamiento" ? vista.ejercicios : [];
    return fotoPortadaDia(ejerciciosDia) ?? fotoRespaldo;
  }, [vista, fotoRespaldo]);

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
          <h1 className={styles.programName}>{rutinaNombre ? nombreCortoRutina(rutinaNombre) : "Programa VIP"}</h1>
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

      <section id="dias" aria-label="Días de tu programa">
        <div className={styles.dayDial} ref={tiraDiasRef}>
          {numeros.map((numero, indice) => (
            <Fragment key={numero.numero}>
              <button
                type="button"
                className={`${styles.dayItem} ${numero.numero === seleccionado ? styles.dayActive : ""} ${numero.estado === "completado" ? styles.dayCompleted : ""}`}
                onClick={() => setSeleccionado(numero.numero)}
                aria-pressed={numero.numero === seleccionado}
                aria-label={`Día ${indice + 1}${numero.estado === "completado" ? ", completado" : ""}`}
              >
                {/* El cuadro ya marca "hecho" con su propio color (azul
                    sólido) -- no repetimos la palabra en texto. */}
                <span className={styles.dayLabel}>{numero.estado === "completado" ? "" : "DÍA"}</span>
                <span className={styles.dayBox}><b>{indice + 1}</b></span>
              </button>
              {indice < numeros.length - 1 && descansoDespuesDe.includes(numero.dia.id) && (
                <div className={styles.restItem} aria-label="Descanso">
                  <span className={styles.dayLabel}>DESC.</span>
                  <span className={styles.restBox}><Moon size={14} /></span>
                </div>
              )}
            </Fragment>
          ))}
        </div>
      </section>

      <section className={styles.heroCard} aria-label={`Día seleccionado: ${titulo}`}>
        <div className={styles.heroMedia}>
          {foto && (
            <ImagenV2Segura
              src={foto}
              fallbackSrc={fotoRespaldo}
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
          <Link
            href={`/portal-v2/entrenamiento/rutina?dia=${actual.dia.id}&numero=${actual.numero}`}
            className={styles.secondaryButton}
          >
            Ver rutina
          </Link>
          {sesionSeleccionadaActiva ? (
            <Link href={`/portal-v2/entrenamiento/sesion?id=${actual.sesionId}`} className={styles.primaryButton}>
              <Play size={14} fill="currentColor" /> Continuar día {actual.numero}
            </Link>
          ) : sesionEnProgresoId ? (
            <Link href={`/portal-v2/entrenamiento/sesion?id=${sesionEnProgresoId}`} className={styles.primaryButton}>
              <Play size={14} fill="currentColor" /> Continuar sesión
            </Link>
          ) : actual.estado === "completado" && actual.sesionId ? (
            <Link href={`/portal-v2/entrenamiento/sesion?id=${actual.sesionId}`} className={styles.primaryButton}>Ver registro</Link>
          ) : (
            <form action={iniciarRutinaDesdeCalendarioV2}>
              <input type="hidden" name="dia_id" value={actual.dia.id} />
              <input type="hidden" name="rutina_id" value={rutinaId} />
              <input type="hidden" name="numero_calendario" value={actual.numero} />
              <BotonIniciarEntrenamientoV2
                texto={`Iniciar día ${actual.numero}`}
                className={styles.primaryButton}
                deshabilitado={bloqueado}
              />
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
        <button type="button" className={styles.utilityCard} onClick={() => setVerRutina((valor) => !valor)} aria-expanded={verRutina}>
          <LibraryBig size={20} />
          <span><strong>{verRutina ? "Ocultar ejercicios" : "Rutina asignada"}</strong><span>Revisa tu sesión completa</span></span>
        </button>
        <Link href="/portal-v2/entrenamiento/biblioteca" className={styles.utilityCard}>
          <Dumbbell size={20} />
          <span><strong>Biblioteca de ejercicios</strong><span>Técnica, videos y consejos</span></span>
        </Link>
        <Link href="/portal-v2/entrenamiento/programas" className={styles.utilityCard}>
          <CalendarDays size={20} />
          <span><strong>Mis programas</strong><span>Programa actual y recorrido</span></span>
        </Link>
        <Link href="/portal-v2/entrenamiento/historial" className={styles.utilityCard}>
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
            <Link href="/portal-v2/entrenamiento/programas" className={styles.menuItem}><span>Todos mis programas</span><Dumbbell size={16} /></Link>
            <Link href="/portal-v2/entrenamiento/biblioteca" className={styles.menuItem}><span>Biblioteca de ejercicios</span><LibraryBig size={16} /></Link>
            <Link href="/portal-v2/entrenamiento/historial" className={styles.menuItem}><span>Registro de entrenamientos</span><History size={16} /></Link>
            <a href="#dias" className={styles.menuItem} onClick={() => setMenuAbierto(false)}><span>Calendario</span><CalendarDays size={16} /></a>
            <Link href="/alumno/entrenar" className={styles.menuItem}><span>Vista clásica del portal</span><Sparkles size={16} /></Link>
          </div>
        </div>
      )}
    </div>
  );
}

function EjercicioFila({ ejercicio }: { ejercicio: NonNullable<DiaVistaPrevia>["ejercicios"][number] }) {
  const foto = ejercicio.videoCloudflareMiniaturaUrl ?? ejercicio.fotoMiniaturaUrl ?? ejercicio.fotoCompletaUrl;
  const respaldo = ejercicio.grupoMuscular ? FOTOS_GRUPO_MUSCULAR[ejercicio.grupoMuscular]?.[0] : null;
  return (
    <article className={styles.exerciseRow}>
      <div className={styles.exerciseThumb}>
        {foto && <ImagenV2Segura src={foto} fallbackSrc={respaldo} alt="" fill sizes="42px" />}
      </div>
      <div>
        <strong>{ejercicio.nombre}</strong>
        <span>{ejercicio.grupoMuscular ? ETIQUETAS_GRUPO_MUSCULAR[ejercicio.grupoMuscular] : "Entrenamiento"}</span>
      </div>
      <span className={styles.exerciseMeta}>{ejercicio.seriesProgramadas} × {ejercicio.repsProgramadas}</span>
    </article>
  );
}
