"use client";

import { useState, useTransition } from "react";
import { Activity, Check, ChevronRight, Droplets, Moon, X, Zap } from "lucide-react";
import { guardarSeguimiento } from "@/app/alumno/inicio/actions";
import type { SeguimientoHoy } from "@/app/alumno/inicio/data";
import styles from "./PortalV2.module.css";

type Props = {
  seguimiento: SeguimientoHoy;
  soloLectura: boolean;
  onGuardado: () => Promise<void>;
  onAviso: (mensaje: string) => void;
};

function RespuestaBinaria({
  etiqueta,
  valor,
  onChange,
}: {
  etiqueta: string;
  valor: boolean | null;
  onChange: (valor: boolean) => void;
}) {
  return (
    <fieldset className={styles.dailyBinary}>
      <legend>{etiqueta}</legend>
      <div>
        <button type="button" aria-pressed={valor === true} onClick={() => onChange(true)}>Sí</button>
        <button type="button" aria-pressed={valor === false} onClick={() => onChange(false)}>No</button>
      </div>
    </fieldset>
  );
}

export function CheckInDiarioV2({ seguimiento, soloLectura, onGuardado, onAviso }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [entreno, setEntreno] = useState<boolean | null>(seguimiento?.entreno_hoy ?? null);
  const [alimentacion, setAlimentacion] = useState<boolean | null>(seguimiento?.cumplio_alimentacion ?? null);
  const [energia, setEnergia] = useState<number | null>(seguimiento?.energia ?? null);
  const [guardando, iniciarGuardado] = useTransition();

  const resumen = seguimiento
    ? [
        seguimiento.energia !== null ? `Energía ${seguimiento.energia}/5` : null,
        seguimiento.horas_sueno !== null ? `${seguimiento.horas_sueno} h de sueño` : null,
        seguimiento.agua_litros !== null ? `${seguimiento.agua_litros} L de agua` : null,
      ].filter(Boolean).join(" · ") || "Registro de hoy guardado"
    : "Sueño, energía, agua y molestias";

  const guardar = (evento: React.FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const formData = new FormData(evento.currentTarget);
    formData.set("entreno_hoy", entreno === null ? "" : String(entreno));
    formData.set("cumplio_alimentacion", alimentacion === null ? "" : String(alimentacion));
    formData.set("energia", energia === null ? "" : String(energia));

    iniciarGuardado(async () => {
      try {
        const resultado = await guardarSeguimiento({ error: null, guardado: false }, formData);
        if (!resultado.guardado) {
          onAviso(resultado.error ?? "No pudimos guardar el check-in");
          return;
        }
        await onGuardado();
        onAviso("Check-in diario guardado. Alejandro y tu entrenador ya pueden usarlo.");
        setAbierto(false);
      } catch {
        onAviso("No hubo conexión con el servidor. El check-in no se marcó como guardado; inténtalo nuevamente.");
      }
    });
  };

  return (
    <>
      <button type="button" onClick={() => setAbierto(true)} disabled={soloLectura}>
        <span><Activity size={18} /></span>
        <div><small>CHECK-IN DIARIO</small><strong>{seguimiento ? "Estado de hoy registrado" : "¿Cómo llegas hoy?"}</strong><p>{resumen}</p></div>
        {seguimiento ? <Check size={17} /> : <ChevronRight size={17} />}
      </button>

      {abierto ? (
        <div className={styles.dailyBackdrop} role="presentation" onClick={() => setAbierto(false)}>
          <section className={styles.dailySheet} role="dialog" aria-modal="true" aria-labelledby="checkin-diario-titulo" onClick={(evento) => evento.stopPropagation()}>
            <header>
              <div><small>IMPULSO ALEJANDRO</small><h2 id="checkin-diario-titulo">¿Cómo llegas hoy?</h2><p>Un minuto. Estas señales ajustan la exigencia y alertan a tu entrenador si algo no va bien.</p></div>
              <button type="button" onClick={() => setAbierto(false)} aria-label="Cerrar"><X size={20} /></button>
            </header>

            <form onSubmit={guardar}>
              <div className={styles.dailyReadiness}>
                <Moon size={18} /><label><span>Horas de sueño</span><input name="horas_sueno" type="number" min="0" max="24" step="0.5" inputMode="decimal" defaultValue={seguimiento?.horas_sueno ?? ""} placeholder="7.5" /></label>
                <Droplets size={18} /><label><span>Agua hasta ahora (L)</span><input name="agua_litros" type="number" min="0" max="15" step="0.1" inputMode="decimal" defaultValue={seguimiento?.agua_litros ?? ""} placeholder="2.0" /></label>
              </div>

              <fieldset className={styles.dailyEnergy}>
                <legend><Zap size={15} /> Nivel de energía</legend>
                <div>{[1, 2, 3, 4, 5].map((nivel) => <button type="button" key={nivel} aria-pressed={energia === nivel} onClick={() => setEnergia(nivel)}>{nivel}</button>)}</div>
                <p><span>Baja</span><span>Alta</span></p>
              </fieldset>

              <div className={styles.dailyAnswers}>
                <RespuestaBinaria etiqueta="¿Entrenaste hoy?" valor={entreno} onChange={setEntreno} />
                <RespuestaBinaria etiqueta="¿Cumpliste tu alimentación?" valor={alimentacion} onChange={setAlimentacion} />
              </div>

              <label className={styles.dailyText}><span>¿Tienes dolor o alguna molestia?</span><input name="molestias" maxLength={300} defaultValue={seguimiento?.molestias ?? ""} placeholder="No, o describe dónde y desde cuándo" /></label>
              <label className={styles.dailyText}><span>Comentario para tu entrenador <small>opcional</small></span><textarea name="comentario" maxLength={600} rows={3} defaultValue={seguimiento?.comentario ?? ""} placeholder="Algo que deba saber antes de tu próxima sesión" /></label>

              <button className={styles.dailySave} type="submit" disabled={guardando}>{guardando ? "Guardando…" : seguimiento ? "Actualizar estado de hoy" : "Guardar estado de hoy"}</button>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
