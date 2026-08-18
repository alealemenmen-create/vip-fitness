"use client";

import Image from "next/image";
import { useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Dumbbell,
  Gauge,
  Images,
  ListChecks,
  Medal,
  Moon,
  Plus,
  Timer,
  Utensils,
  X,
  Zap,
} from "lucide-react";
import styles from "@/components/v2/PortalV2.module.css";

const ESTADISTICAS = [
  { valor: "7", unidad: "", etiqueta: "Entrenamientos completados", detalle: "Este mes: +6", Icono: Dumbbell },
  { valor: "1", unidad: "día", etiqueta: "Alimentación registrada", detalle: "Este mes: +1", Icono: Utensils },
  { valor: "≈1", unidad: "", etiqueta: "Promedio semanal", detalle: "Últimos 30 días", Icono: Gauge },
  { valor: "5", unidad: "h", etiqueta: "Tiempo entrenado", detalle: "≈ 3 días acumulados", Icono: Timer },
  { valor: "6", unidad: "", etiqueta: "Impulsos cumplidos", detalle: "Precisión: 100 %", Icono: Zap },
  { valor: "16", unidad: "", etiqueta: "Series registradas", detalle: "En todos tus entrenamientos", Icono: ListChecks },
];

const DIAS_PROGRAMA = [
  ["ok", "ok", "ok", "ok", "ok", "6", "descanso"],
  ["8", "9", "descanso", "11", "12", "13", "descanso"],
  ["15", "16", "descanso", "18", "19", "20", "fin"],
] as const;

export default function ProgresoV2Page() {
  const [peso, setPeso] = useState("88.0");
  const [pesoBorrador, setPesoBorrador] = useState(peso);
  const [modalPeso, setModalPeso] = useState(false);
  const [detallePrograma, setDetallePrograma] = useState(false);
  const [aviso, setAviso] = useState("");

  const abrirPeso = () => {
    setPesoBorrador(peso);
    setModalPeso(true);
  };

  const abrirPrograma = () => {
    setAviso("");
    setDetallePrograma(true);
  };

  const guardarPeso = () => {
    const numero = Number(pesoBorrador.replace(",", "."));
    if (!Number.isFinite(numero) || numero <= 0) return;
    setPeso(numero.toFixed(1));
    setModalPeso(false);
    setAviso("Peso registrado correctamente");
  };

  return (
    <section className={styles.progressPage}>
      <div className={styles.progressSectionHeading}>
        <h1>Peso corporal</h1>
        <button type="button">Ver todo <ChevronRight size={16} /></button>
      </div>

      <section className={styles.bodyweightCard} aria-label="Peso corporal actual">
        <div className={styles.bodyweightMain}>
          <span><Images size={24} /></span>
          <div><strong>{peso} kg</strong><small>Último registro: 18 de agosto de 2026</small></div>
        </div>
        <div className={styles.bodyweightFooter}>
          <p><strong>0 kg</strong> este mes</p>
          <button type="button" onClick={abrirPeso}>Registrar <Plus size={17} /></button>
        </div>
      </section>

      <div className={styles.progressSectionHeading}>
        <h2>Estadísticas generales</h2>
      </div>
      <div className={styles.lifetimeGrid}>
        {ESTADISTICAS.map(({ valor, unidad, etiqueta, detalle, Icono }) => (
          <article key={etiqueta}>
            <Icono size={16} />
            <p><strong>{valor}</strong>{unidad ? <span>{unidad}</span> : null}</p>
            <h3>{etiqueta}</h3>
            <small>{detalle}</small>
          </article>
        ))}
      </div>

      <div className={styles.progressSectionHeading}>
        <h2>Programa actual</h2>
        <button type="button" onClick={abrirPrograma}>Ver progreso <ChevronRight size={16} /></button>
      </div>
      <button type="button" className={styles.programProgressCard} onClick={abrirPrograma}>
        <div><span>Método VIP</span><strong>Día 6 de 21</strong><small>Semana 1 · Piernas</small></div>
        <i><em style={{ width: "29%" }} /></i>
        <p><b>5 sesiones</b><span>29 % completado</span></p>
      </button>

      <div className={styles.progressSectionHeading}>
        <h2>Medallas</h2>
        <button type="button">Ver todas <ChevronRight size={16} /></button>
      </div>
      <article className={styles.latestMedalCard}>
        <Image src="/rangos/rank_bronze.png" alt="Medalla VIP de constancia" width={76} height={76} />
        <div><strong>Primer impulso</strong><span>18 de agosto de 2026</span></div>
        <p>900 XP <Medal size={19} /></p>
      </article>

      {modalPeso ? (
        <div className={styles.progressModalBackdrop} role="presentation" onClick={() => setModalPeso(false)}>
          <section className={styles.progressModal} role="dialog" aria-modal="true" aria-label="Registrar peso" onClick={(evento) => evento.stopPropagation()}>
            <header><h2>Registrar peso</h2><button type="button" onClick={() => setModalPeso(false)} aria-label="Cerrar"><X size={19} /></button></header>
            <p>Guarda tu peso actual para seguir la tendencia corporal.</p>
            <label><span>Peso actual</span><input inputMode="decimal" value={pesoBorrador} onChange={(evento) => setPesoBorrador(evento.target.value)} autoFocus /><b>kg</b></label>
            <button type="button" className={styles.progressSaveButton} onClick={guardarPeso}>Guardar registro</button>
          </section>
        </div>
      ) : null}

      {detallePrograma ? <DetallePrograma onClose={() => setDetallePrograma(false)} /> : null}
      {aviso ? <button type="button" className={styles.progressToast} onClick={() => setAviso("")}><span>{aviso}</span><X size={14} /></button> : null}
    </section>
  );
}

function DetallePrograma({ onClose }: { onClose: () => void }) {
  return (
    <section className={styles.programDetail} role="dialog" aria-modal="true" aria-label="Progreso del programa">
      <header><button type="button" onClick={onClose} aria-label="Volver a Progreso"><ArrowLeft size={24} /></button></header>
      <h2>Progreso del programa</h2>
      <strong>Día 6 de 21</strong>
      <p>Iniciado el 18 de agosto de 2026</p>

      <div className={styles.programCalendar}>
        <h3>Método VIP</h3>
        {DIAS_PROGRAMA.map((semana, indice) => (
          <div className={styles.programWeek} key={`semana-${indice + 1}`}>
            <span>S{indice + 1}</span>
            {semana.map((dia, diaIndice) => (
              <i className={dia === "ok" ? styles.programDayDone : dia === "6" ? styles.programDayActive : ""} key={`${dia}-${diaIndice}`}>
                {dia === "ok" ? <Check size={16} /> : dia === "descanso" ? <Moon size={14} /> : dia === "fin" ? <Dumbbell size={14} /> : dia}
              </i>
            ))}
          </div>
        ))}
      </div>

      <div className={styles.programTotals}>
        <span><strong>2.450 kg</strong><small>Volumen total levantado</small></span>
        <span><strong>16</strong><small>Series registradas</small></span>
      </div>
      <article className={styles.impulsoProgressCard}><Zap size={19} fill="currentColor" /><div><strong>Impulso VIP</strong><span>6 de 6 recomendaciones cumplidas</span></div><b>100 %</b></article>
    </section>
  );
}
