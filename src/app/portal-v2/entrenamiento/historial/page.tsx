import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Dumbbell,
  Trophy,
} from "lucide-react";
import { obtenerContextoAlumnoOpcional } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  obtenerHistorialSesiones,
  obtenerRutinasHistorial,
  type RutinaHistorial,
  type SesionHistorial,
} from "@/app/alumno/entrenar/data";
import styles from "@/components/v2/PortalV2.module.css";

const RUTINAS_DEMO: RutinaHistorial[] = [
  { id: "metodo-vip", nombre: "Método VIP", activa: true, primeraFecha: "2026-07-22", ultimaFecha: "2026-08-18", cantidadSesiones: 7, puntos: 2100 },
  { id: "base-fuerza", nombre: "Base de fuerza", activa: false, primeraFecha: "2026-06-03", ultimaFecha: "2026-07-16", cantidadSesiones: 12, puntos: 3320 },
];

const SESIONES_DEMO: SesionHistorial[] = [
  { id: "demo-1", fecha: "2026-08-18", numeroCalendario: 7, estado: "completada", diaNombre: "Piernas", completados: 5, total: 5, comentario: null, horaInicio: "2026-08-18T18:32:00-04:00", horaFin: "2026-08-18T19:29:00-04:00", rutinaId: "metodo-vip" },
  { id: "demo-2", fecha: "2026-08-15", numeroCalendario: 6, estado: "completada", diaNombre: "Espalda y bíceps", completados: 6, total: 6, comentario: null, horaInicio: "2026-08-15T17:41:00-04:00", horaFin: "2026-08-15T18:34:00-04:00", rutinaId: "metodo-vip" },
  { id: "demo-3", fecha: "2026-08-12", numeroCalendario: 5, estado: "finalizada_incompleta", diaNombre: "Pecho y hombros", completados: 4, total: 5, comentario: "Sesión cerrada antes del último ejercicio", horaInicio: "2026-08-12T19:05:00-04:00", horaFin: "2026-08-12T19:48:00-04:00", rutinaId: "metodo-vip" },
  { id: "demo-4", fecha: "2026-07-16", numeroCalendario: 12, estado: "completada", diaNombre: "Cuerpo completo", completados: 7, total: 7, comentario: null, horaInicio: "2026-07-16T18:10:00-04:00", horaFin: "2026-07-16T19:14:00-04:00", rutinaId: "base-fuerza" },
];

function fechaLarga(fecha: string) {
  return new Intl.DateTimeFormat("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Santiago",
  }).format(new Date(`${fecha}T12:00:00-04:00`));
}

function duracionMinutos(sesion: SesionHistorial) {
  if (!sesion.horaInicio || !sesion.horaFin) return null;
  const inicio = new Date(sesion.horaInicio).getTime();
  const fin = new Date(sesion.horaFin).getTime();
  if (!Number.isFinite(inicio) || !Number.isFinite(fin) || fin <= inicio) return null;
  return Math.max(1, Math.round((fin - inicio) / 60_000));
}

function estadoSesion(sesion: SesionHistorial) {
  if (sesion.estado === "completada") return "Completada";
  if (sesion.estado === "finalizada_incompleta") return "Finalizada con pendientes";
  return "No finalizada";
}

export default async function HistorialEntrenamientoV2Page({
  searchParams,
}: {
  searchParams: Promise<{ programa?: string }>;
}) {
  const contexto = await obtenerContextoAlumnoOpcional();
  const { programa } = await searchParams;
  let rutinas = RUTINAS_DEMO;
  let sesiones = SESIONES_DEMO;

  if (contexto) {
    const supabase = await createClient();
    rutinas = await obtenerRutinasHistorial(supabase, contexto.alumnoId);
    const filtroValido = programa && rutinas.some((rutina) => rutina.id === programa) ? programa : undefined;
    sesiones = await obtenerHistorialSesiones(supabase, contexto.alumnoId, 60, filtroValido);
  } else if (programa && RUTINAS_DEMO.some((rutina) => rutina.id === programa)) {
    sesiones = SESIONES_DEMO.filter((sesion) => sesion.rutinaId === programa);
  }

  const programaActivo = programa && rutinas.some((rutina) => rutina.id === programa) ? programa : null;
  const completas = sesiones.filter((sesion) => sesion.estado === "completada").length;
  const seriesHechas = sesiones.reduce((total, sesion) => total + sesion.completados, 0);
  const minutos = sesiones.reduce((total, sesion) => total + (duracionMinutos(sesion) ?? 0), 0);
  const cumplimiento = sesiones.length > 0 ? Math.round((completas / sesiones.length) * 100) : 0;

  return (
    <section className={styles.historyV2Page}>
      <header className={styles.historyV2Header}>
        <Link href="/portal-v2/entrenamiento" aria-label="Volver a Entrenamiento"><ArrowLeft size={21} /></Link>
        <div><span>ENTRENAMIENTO</span><h1>Tu historial</h1></div>
      </header>

      {!contexto ? <p className={styles.historyV2Demo}>Vista directa: puedes recorrer el historial sin modificar datos de alumnos.</p> : null}

      <section className={styles.historyV2Summary} aria-label="Resumen del historial">
        <article><CheckCircle2 size={17} /><strong>{sesiones.length}</strong><span>Sesiones</span></article>
        <article><Dumbbell size={17} /><strong>{seriesHechas}</strong><span>Ejercicios</span></article>
        <article><Clock3 size={17} /><strong>{minutos}</strong><span>Minutos</span></article>
        <article><Trophy size={17} /><strong>{cumplimiento}%</strong><span>Completadas</span></article>
      </section>

      <div className={styles.historyV2SectionTitle}>
        <div><h2>Programas</h2><span>{rutinas.length} con actividad</span></div>
        {programaActivo ? <Link href="/portal-v2/entrenamiento/historial">Ver todos</Link> : null}
      </div>
      <div className={styles.historyV2Programs}>
        {rutinas.map((rutina) => (
          <Link
            key={rutina.id}
            href={`/portal-v2/entrenamiento/historial?programa=${encodeURIComponent(rutina.id)}`}
            aria-current={programaActivo === rutina.id ? "true" : undefined}
          >
            <span><Dumbbell size={18} /></span>
            <div><strong>{rutina.nombre}</strong><small>{rutina.cantidadSesiones} sesiones · {rutina.puntos.toLocaleString("es-CL")} XP</small></div>
            {rutina.activa ? <b>ACTIVO</b> : <ChevronRight size={15} />}
          </Link>
        ))}
      </div>

      <div className={styles.historyV2SectionTitle}>
        <div><h2>{programaActivo ? "Sesiones del programa" : "Actividad reciente"}</h2><span>Datos guardados y verificables</span></div>
      </div>
      <div className={styles.historyV2Sessions}>
        {sesiones.length === 0 ? (
          <article className={styles.historyV2Empty}><CalendarDays size={22} /><strong>Aún no hay sesiones cerradas</strong><p>Cuando termines un entrenamiento, su registro aparecerá aquí.</p></article>
        ) : sesiones.map((sesion) => {
          const duracion = duracionMinutos(sesion);
          const href = contexto ? `/portal-v2/entrenamiento/sesion?id=${sesion.id}` : "/portal-v2/entrenamiento/sesion";
          return (
            <Link href={href} className={styles.historyV2Session} key={sesion.id}>
              <span className={styles.historyV2Date}><b>{new Date(`${sesion.fecha}T12:00:00`).getDate()}</b><small>{new Intl.DateTimeFormat("es-CL", { month: "short" }).format(new Date(`${sesion.fecha}T12:00:00`)).replace(".", "")}</small></span>
              <div>
                <small>{fechaLarga(sesion.fecha)}</small>
                <strong>{sesion.diaNombre || "Entrenamiento VIP"}</strong>
                <p>{sesion.completados}/{sesion.total} ejercicios{duracion ? ` · ${duracion} min` : ""}</p>
                <em data-completa={sesion.estado === "completada"}>{estadoSesion(sesion)}</em>
              </div>
              <ChevronRight size={17} />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
