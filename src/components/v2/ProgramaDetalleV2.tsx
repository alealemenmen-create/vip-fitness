"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ChevronRight, Moon, Play } from "lucide-react";
import { iniciarRutinaDesdeCalendarioV2 } from "@/app/alumno/entrenar/actions";
import { ImagenV2Segura } from "@/components/v2/ImagenV2Segura";
import styles from "./PortalV2.module.css";

export type ProgramaDiaV2 = {
  id: string;
  posicion: number;
  nombre: string;
  tipo: "entrenamiento" | "descanso";
  minutos: number | null;
  etiquetaGrupo: string | null;
  foto: string | null;
};

export type ProgramaPresentacionV2 = {
  nombre: string;
  diasPorSemana: number;
  totalDias: number;
  totalEjercicios: number;
  totalSeries: number;
  diaSiguienteId: string | null;
  diaSiguienteNumero: number | null;
  rutinaId: string | null;
  dias: ProgramaDiaV2[];
};

const DIAS_DEMO: ProgramaDiaV2[] = [
  { id: "d1", posicion: 1, nombre: "Hombros", tipo: "entrenamiento", minutos: 45, etiquetaGrupo: "Hombros", foto: "/v2/hombros.webp" },
  { id: "d2", posicion: 2, nombre: "Espalda", tipo: "entrenamiento", minutos: 45, etiquetaGrupo: "Espalda", foto: "/v2/espalda.webp" },
  { id: "d3", posicion: 3, nombre: "Descanso", tipo: "descanso", minutos: null, etiquetaGrupo: null, foto: null },
  { id: "d4", posicion: 4, nombre: "Piernas", tipo: "entrenamiento", minutos: 50, etiquetaGrupo: "Piernas", foto: "/v2/piernas.webp" },
];

const PROGRAMA_DEMO: ProgramaPresentacionV2 = {
  nombre: "Método VIP",
  diasPorSemana: 3,
  totalDias: 4,
  totalEjercicios: 24,
  totalSeries: 84,
  diaSiguienteId: null,
  diaSiguienteNumero: null,
  rutinaId: null,
  dias: DIAS_DEMO,
};

export function ProgramaDetalleV2({ programa = PROGRAMA_DEMO }: { programa?: ProgramaPresentacionV2 }) {
  const [tab, setTab] = useState<"overview" | "lista">("lista");
  const puedeIniciar = Boolean(programa.rutinaId && programa.diaSiguienteId && programa.diaSiguienteNumero);

  return (
    <div className={styles.programaPage}>
      <header className={styles.programaHeader}>
        <Link href="/portal-v2/entrenamiento" aria-label="Volver a Entrenamiento"><ArrowLeft size={20} /></Link>
        <div>
          <h1>{programa.nombre}</h1>
          <p>{programa.diasPorSemana} {programa.diasPorSemana === 1 ? "día" : "días"} de entrenamiento · {programa.totalDias} días en el ciclo</p>
        </div>
      </header>

      <div className={styles.programaMetrics}>
        <div><strong>{programa.diasPorSemana}</strong><span>Días/semana</span></div>
        <div><strong>{programa.totalEjercicios}</strong><span>Ejercicios</span></div>
        <div><strong>{programa.totalSeries}</strong><span>Series</span></div>
      </div>

      <div className={styles.programaTabs} role="tablist" aria-label="Detalle del programa">
        <button type="button" role="tab" aria-selected={tab === "overview"} onClick={() => setTab("overview")}>Resumen</button>
        <button type="button" role="tab" aria-selected={tab === "lista"} onClick={() => setTab("lista")}>Días del programa</button>
      </div>

      {tab === "overview" ? (
        <section className={styles.programaOverview}>
          <h2>Estructura semanal</h2>
          <p>Así se reparte tu programa. Cada día vuelve a repetirse siguiendo este mismo orden.</p>
          <ul className={styles.programaSplitList}>
            {programa.dias.map((dia) => (
              <li key={dia.id}>
                <b>D{dia.posicion}</b>
                <span>{dia.tipo === "descanso" ? "Descanso" : dia.etiquetaGrupo ?? dia.nombre}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className={styles.programaDayList} aria-label="Días del programa">
          {programa.dias.map((dia) => dia.tipo === "descanso" ? (
            <div className={styles.programaDayCard} key={dia.id}>
              <span className={styles.programaDayThumbRest}><Moon size={18} /></span>
              <div><strong>{dia.nombre || "Descanso"}</strong><small>Día {dia.posicion}</small></div>
            </div>
          ) : (
            <Link
              href={dia.id === programa.diaSiguienteId && programa.diaSiguienteNumero
                ? `/portal-v2/entrenamiento/rutina?dia=${dia.id}&numero=${programa.diaSiguienteNumero}`
                : `/portal-v2/entrenamiento/rutina?dia=${dia.id}`}
              className={styles.programaDayCard}
              key={dia.id}
            >
              <span className={styles.programaDayThumb}>
                {dia.foto ? <ImagenV2Segura src={dia.foto} alt="" fill sizes="66px" /> : null}
              </span>
              <div>
                <strong>{dia.etiquetaGrupo ?? dia.nombre}</strong>
                <small>Día {dia.posicion}{dia.minutos ? ` · ${dia.minutos} min` : ""}</small>
              </div>
              <ChevronRight size={16} />
            </Link>
          ))}
        </section>
      )}

      {puedeIniciar ? (
        <form action={iniciarRutinaDesdeCalendarioV2}>
          <input type="hidden" name="dia_id" value={programa.diaSiguienteId ?? ""} />
          <input type="hidden" name="rutina_id" value={programa.rutinaId ?? ""} />
          <input type="hidden" name="numero_calendario" value={programa.diaSiguienteNumero ?? ""} />
          <button type="submit" className={styles.workoutFixedStart}>
            <Play size={16} fill="currentColor" /> Iniciar día {programa.diaSiguienteNumero}
          </button>
        </form>
      ) : null}
    </div>
  );
}
