import Link from "next/link";
import { ArrowLeft, Archive, CalendarDays, ChevronRight, Dumbbell, History, ShieldCheck } from "lucide-react";
import { obtenerContextoAlumnoOpcional } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { obtenerProgramasAlumno, type ProgramaAlumno } from "@/app/alumno/entrenar/data";
import styles from "@/components/v2/PortalV2.module.css";

const PROGRAMAS_DEMO: ProgramaAlumno[] = [
  { id: "metodo-vip", nombre: "Método VIP", activa: true, archivada: false, version: 3, creadoEn: "2026-07-22T12:00:00-04:00", diasEntrenamiento: 5, ejercicios: 36, series: 122, sesionesCerradas: 7, ultimaSesion: "2026-08-18" },
  { id: "base-fuerza", nombre: "Base de fuerza", activa: false, archivada: false, version: 2, creadoEn: "2026-06-03T12:00:00-04:00", diasEntrenamiento: 4, ejercicios: 28, series: 96, sesionesCerradas: 12, ultimaSesion: "2026-07-16" },
];

function fechaPrograma(fecha: string | null) {
  if (!fecha) return "Sin sesiones todavía";
  return `Última sesión ${new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Santiago" }).format(new Date(`${fecha}T12:00:00-04:00`)).replace(".", "")}`;
}

export default async function ProgramasV2Page() {
  const contexto = await obtenerContextoAlumnoOpcional();
  const programas = contexto
    ? await obtenerProgramasAlumno(await createClient(), contexto.alumnoId)
    : PROGRAMAS_DEMO;
  const activos = programas.filter((programa) => programa.activa && !programa.archivada);
  const anteriores = programas.filter((programa) => !programa.activa || programa.archivada);

  return (
    <section className={styles.programsV2Page}>
      <header className={styles.historyV2Header}>
        <Link href="/portal-v2/entrenamiento" aria-label="Volver a Entrenamiento"><ArrowLeft size={21} /></Link>
        <div><span>ENTRENAMIENTO</span><h1>Mis programas</h1></div>
      </header>

      {!contexto ? <p className={styles.historyV2Demo}>Vista directa de demostración. Al entrar con un alumno, aquí aparecen únicamente sus programas publicados y sus cifras reales.</p> : null}

      <section className={styles.programsV2Intro}>
        <ShieldCheck size={20} />
        <div><strong>Tu planificación, sin perder el recorrido</strong><p>El programa activo dirige el entrenamiento de hoy. Los anteriores conservan sus sesiones y resultados.</p></div>
      </section>

      <div className={styles.historyV2SectionTitle}><div><h2>Programa actual</h2><span>Asignado y aprobado por tu entrenador</span></div></div>
      <div className={styles.programsV2Grid}>
        {activos.length ? activos.map((programa) => (
          <article className={`${styles.programsV2Card} ${styles.programsV2CardActive}`} key={programa.id}>
            <div className={styles.programsV2CardTop}><span><Dumbbell size={21} /></span><b>ACTIVO</b></div>
            <h2>{programa.nombre}</h2>
            <p>Versión {programa.version} · {fechaPrograma(programa.ultimaSesion)}</p>
            <div className={styles.programsV2Metrics}>
              <span><strong>{programa.diasEntrenamiento}</strong>Días</span>
              <span><strong>{programa.ejercicios}</strong>Ejercicios</span>
              <span><strong>{programa.series}</strong>Series</span>
              <span><strong>{programa.sesionesCerradas}</strong>Completadas</span>
            </div>
            <div className={styles.programsV2Actions}>
              <Link href="/portal-v2/entrenamiento">Abrir programa <ChevronRight size={15} /></Link>
              <Link href={`/portal-v2/entrenamiento/historial?programa=${encodeURIComponent(programa.id)}`}>Ver historial</Link>
            </div>
          </article>
        )) : (
          <article className={styles.historyV2Empty}><CalendarDays size={22} /><strong>No hay un programa activo</strong><p>Cuando tu entrenador publique el siguiente programa, aparecerá aquí sin borrar tu historial.</p></article>
        )}
      </div>

      <div className={styles.historyV2SectionTitle}><div><h2>Programas anteriores</h2><span>Historial completo, incluso si fueron archivados</span></div></div>
      <div className={styles.programsV2Grid}>
        {anteriores.length ? anteriores.map((programa) => (
          <Link className={styles.programsV2Past} href={`/portal-v2/entrenamiento/historial?programa=${encodeURIComponent(programa.id)}`} key={programa.id}>
            <span><Archive size={18} /></span>
            <div><strong>{programa.nombre}</strong><small>v{programa.version} · {programa.sesionesCerradas} sesiones · {fechaPrograma(programa.ultimaSesion)}</small></div>
            <ChevronRight size={16} />
          </Link>
        )) : <p className={styles.programsV2Quiet}>Todavía no hay programas anteriores.</p>}
      </div>

      <Link href="/portal-v2/entrenamiento/historial" className={styles.programsV2History}><History size={18} /><span><strong>Registro de entrenamientos</strong><small>Abre todas tus sesiones, tiempos y resultados</small></span><ChevronRight size={16} /></Link>
    </section>
  );
}
