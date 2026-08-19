"use client";

import { useActionState, useState } from "react";
import { AlertCircle, Bot, CalendarClock, Dumbbell, Send, Sparkles } from "lucide-react";
import { preguntarAsistenteAlumno, type EstadoAsistenteAlumno } from "@/app/alumno/asistente/actions";
import type { ContextoAlumnoVip } from "@/lib/asistente/alumno";
import styles from "./PortalV2.module.css";

const ESTADO_INICIAL: EstadoAsistenteAlumno = { respuesta: null, error: null };
const PREGUNTAS = [
  "¿Qué entrené recientemente?",
  "¿Cuál fue mi última marca de pecho?",
  "¿Qué tengo pendiente hoy?",
  "¿Cómo debería recuperarme después de entrenar?",
] as const;

export function SoporteV2({ contexto, soloLectura = false }: { contexto: ContextoAlumnoVip; soloLectura?: boolean }) {
  const [estado, accion, consultando] = useActionState(preguntarAsistenteAlumno, ESTADO_INICIAL);
  const [pregunta, setPregunta] = useState("");

  return (
    <div className={styles.supportV2Content}>
      {soloLectura ? <p className={styles.supportV2ReadOnly} role="status">Supervisión activa: puedes revisar recordatorios y marcas, pero no consultar al asistente en nombre del alumno.</p> : null}
      <section className={styles.supportV2Assistant}>
        <header>
          <span><Bot size={21} /></span>
          <div><small>ASISTENTE PERSONAL</small><h2>Pregunta a Alejandro</h2><p>Lee tu historial real y te orienta sin reemplazar las decisiones de tu entrenador.</p></div>
        </header>
        <form action={accion}>
          <textarea name="pregunta" value={pregunta} onChange={(evento) => setPregunta(evento.target.value)} rows={3} minLength={5} maxLength={500} required disabled={soloLectura} placeholder={soloLectura ? "Disponible sólo para el alumno" : "Pregunta por tu entrenamiento, alimentación o progreso…"} />
          <button type="submit" disabled={soloLectura || consultando || !pregunta.trim()}><Send size={17} />{consultando ? "Revisando tu historial…" : soloLectura ? "Modo lectura" : "Consultar"}</button>
        </form>
      </section>

      {!estado.respuesta && !consultando ? (
        <section className={styles.supportV2Suggestions} aria-label="Preguntas sugeridas">
          {PREGUNTAS.map((texto) => <button key={texto} type="button" disabled={soloLectura} onClick={() => setPregunta(texto)}><Sparkles size={14} /><span>{texto}</span></button>)}
        </section>
      ) : null}

      {estado.error ? <p role="alert" className={styles.supportV2Error}>{estado.error}</p> : null}
      {estado.respuesta ? (
        <article className={styles.supportV2Answer}>
          <span><Bot size={18} /></span>
          <div><small>RESPUESTA PERSONAL</small><p>{estado.respuesta.texto}</p>{estado.respuesta.aviso ? <em>{estado.respuesta.aviso}</em> : null}</div>
        </article>
      ) : null}

      <BloqueSoporte titulo="Recordatorios de hoy" detalle={`${contexto.recordatorios.length} ${contexto.recordatorios.length === 1 ? "pendiente" : "pendientes"}`} icono={<CalendarClock size={17} />}>
        <div className={styles.supportV2Reminders}>
          {contexto.recordatorios.length === 0 ? <p className={styles.supportV2AllClear}>Todo al día. No detectamos pendientes.</p> : contexto.recordatorios.map((recordatorio) => <p key={recordatorio}><AlertCircle size={16} /><span>{recordatorio}</span></p>)}
        </div>
      </BloqueSoporte>

      <BloqueSoporte titulo="Tus últimas marcas" detalle="Historial verificado" icono={<Dumbbell size={17} />}>
        <div className={styles.supportV2Marks}>
          {contexto.marcasRecientes.length === 0 ? <p className={styles.supportV2Empty}>Todavía no hay series finalizadas con peso o repeticiones.</p> : contexto.marcasRecientes.slice(0, 8).map((marca, indice) => {
            const carga = marca.pesoCorporal ? "Peso corporal" : marca.pesoKg === null ? "Sin peso" : `${marca.pesoKg} kg`;
            return <article key={`${marca.ejercicio}-${marca.fecha}-${indice}`}><span><Dumbbell size={16} /></span><div><strong>{marca.ejercicio}</strong><small>{marca.grupo ?? "Sin clasificar"} · {formatearFecha(marca.fecha)}</small></div><b>{carga}<small>{marca.repeticiones ?? "—"} reps</small></b></article>;
          })}
        </div>
      </BloqueSoporte>
    </div>
  );
}

function BloqueSoporte({ titulo, detalle, icono, children }: { titulo: string; detalle: string; icono: React.ReactNode; children: React.ReactNode }) {
  return <section className={styles.supportV2Block}><header><span>{icono}</span><div><h2>{titulo}</h2><small>{detalle}</small></div></header>{children}</section>;
}

function formatearFecha(fecha: string): string {
  return new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short" }).format(new Date(`${fecha}T12:00:00`));
}
