"use client";

import { startTransition, useActionState, useEffect, useState, useTransition } from "react";
import { Check, ShieldAlert, Target, Zap } from "lucide-react";
import {
  calibrarIntervencionEnVivo,
  consultarEstadoAsistenciaAle,
  marcarIntervencionMostrada,
  resolverIntervencionEnVivo,
  solicitarAsistenciaAle,
  type CalibrarIntervencionState,
  type ResolverIntervencionState,
  type SolicitarAsistenciaState,
  type EstadoAsistenciaAlumno,
} from "@/app/alumno/entrenar/impulso-actions";
import type { IntervencionImpulsoEnVivo } from "@/app/alumno/entrenar/data";

const inicial: ResolverIntervencionState = { error: null, ok: false, verificada: false };
const inicialCalibracion: CalibrarIntervencionState = { error: null, ok: false, instruccion: null, tipo: null, prescripcion: null };
const inicialAsistencia: SolicitarAsistenciaState = { error: null, ok: false };

export function MomentoImpulsoEnVivo({
  intervencion,
  visible,
  serieTerminada,
}: {
  intervencion: IntervencionImpulsoEnVivo;
  visible: boolean;
  serieTerminada: boolean;
}) {
  const [state, action, pending] = useActionState(resolverIntervencionEnVivo, inicial);
  const [calibracion, calibrarAction, calibrando] = useActionState(
    calibrarIntervencionEnVivo,
    inicialCalibracion
  );
  const [resultadoElegido, setResultadoElegido] = useState<string | null>(intervencion?.resultado ?? null);
  const [asistencia, asistenciaAction, avisandoAle] = useActionState(
    solicitarAsistenciaAle,
    inicialAsistencia
  );
  const [estadoAsistencia, setEstadoAsistencia] = useState<EstadoAsistenciaAlumno>(null);
  const [expandido, setExpandido] = useState(false);
  const [, iniciarConsultaAsistencia] = useTransition();
  const esOrientacion = intervencion?.tipo === "tempo_controlado";
  const esPersonalAle = intervencion?.origen === "personal_ale" || intervencion?.origen === "preparada_por_ale";
  const tipoActual = calibracion.tipo ?? intervencion?.tipo ?? null;
  const tecnicaIntensiva = tipoActual === "drop_set" || tipoActual === "rest_pause" || tipoActual === "fallo_controlado";
  const prescripcionActual = calibracion.prescripcion ?? intervencion?.prescripcion ?? {};
  const requiereSupervision = prescripcionActual.requiereSupervision === true;
  const listaParaMostrar = !!intervencion
    && (esOrientacion || esPersonalAle || intervencion.calibrada || calibracion.ok || intervencion.estado !== "preparada");
  const resuelta = state.ok || intervencion?.estado === "resuelta";
  const mostrarExpandido = expandido || (serieTerminada && !resuelta);

  useEffect(() => {
    if (!intervencion || !visible || !listaParaMostrar || intervencion.estado !== "preparada") return;
    startTransition(() => void marcarIntervencionMostrada(intervencion.id));
  }, [intervencion, visible, listaParaMostrar]);

  useEffect(() => {
    if (!intervencion || !visible || serieTerminada) return;
    let activo = true;
    const consultar = () => {
      iniciarConsultaAsistencia(async () => {
        const estado = await consultarEstadoAsistenciaAle(intervencion.id).catch(() => null);
        if (activo && estado) setEstadoAsistencia(estado);
      });
    };
    consultar();
    const id = window.setInterval(consultar, 8_000);
    return () => {
      activo = false;
      window.clearInterval(id);
    };
  }, [intervencion, visible, serieTerminada, asistencia.ok]);

  if (!intervencion || !visible || intervencion.estado === "cancelada") return null;

  // En reposo ocupa solo el rayo. La instrucción se abre al tocarlo y el
  // formulario de resultado se abre solo cuando termina la serie objetivo.
  if (!mostrarExpandido) {
    return (
      <div className="mb-1.5 flex justify-center">
        <button
          type="button"
          onClick={() => setExpandido(true)}
          className={`rayo-impulso-vivo relative grid size-10 place-items-center rounded-full border ${resuelta ? "border-success/35 bg-success/10 text-success" : "border-vip/55 bg-vip/15 text-vip"}`}
          aria-label={resuelta ? "Ver resultado de Impulso VIP" : `Abrir indicación de Impulso VIP para la serie ${intervencion.serieObjetivo}`}
          title={resuelta ? "Resultado registrado" : "Indicación de Ale"}
        >
          {resuelta ? <Check size={18} strokeWidth={3} /> : <Zap size={19} fill="currentColor" />}
        </button>
      </div>
    );
  }

  // `tempo_controlado` también es una técnica que Ale puede elegir a mano
  // (panel del entrenador). Sin el `!esPersonalAle`, un mensaje personal con
  // esa técnica se mostraba como si fuera la orientación automática
  // genérica de mitad de ejercicio — perdía el encabezado "Mensaje personal
  // de Ale", el botón de avisar a Ale y el formulario de resultado.
  if (esOrientacion && !esPersonalAle) {
    return (
      <section className="mb-2 flex items-start gap-2.5 rounded-[17px] border border-vip/25 bg-vip/[0.07] p-3">
        <button type="button" onClick={() => setExpandido(false)} aria-label="Cerrar indicación" className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-vip/15 text-vip">
          <Zap size={15} fill="currentColor" />
        </button>
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.14em] text-vip">Ale te marca el ritmo</p>
          <p className="mt-0.5 text-caption leading-relaxed text-text">{intervencion.instruccion}</p>
          <p className="mt-1 text-micro font-semibold text-text-secondary">{intervencion.firma}</p>
        </div>
      </section>
    );
  }

  if (!listaParaMostrar) {
    return (
      <section className="relative mb-2 rounded-[18px] border border-vip/35 bg-vip/10 p-3">
        <button type="button" onClick={() => setExpandido(false)} aria-label="Cerrar indicación" className="absolute right-2 top-2 grid size-7 place-items-center rounded-full text-vip"><Zap size={14} fill="currentColor" /></button>
        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-vip">Ale calibra tu ultima serie</p>
        <p className="mt-1 text-caption font-bold text-text">¿Cuantas repeticiones mas podias hacer?</p>
        <p className="mt-0.5 text-micro text-text-secondary">
          Responde sobre la serie anterior. Impulso ajustara la exigencia sin pedirte esto en todas.
        </p>
        <form action={calibrarAction} className="mt-3 grid grid-cols-4 gap-2">
          <input type="hidden" name="intervencion_id" value={intervencion.id} />
          {[
            ["0", "Ninguna"],
            ["1", "Una"],
            ["2", "Dos"],
            ["3", "3 o mas"],
          ].map(([valor, etiqueta]) => (
            <button
              key={valor}
              type="submit"
              name="rir"
              value={valor}
              disabled={calibrando}
              className="min-h-11 rounded-[13px] border border-white/10 bg-white/[0.055] px-1 text-[10px] font-bold text-text active:border-vip active:text-vip disabled:opacity-50"
            >
              {etiqueta}
            </button>
          ))}
        </form>
        {calibracion.error && <p className="mt-2 text-micro text-error">{calibracion.error}</p>}
      </section>
    );
  }

  if (resuelta) {
    const lograda = (resultadoElegido ?? intervencion.resultado) === "lograda";
    return (
      <button type="button" onClick={() => setExpandido(false)} className="mb-2 w-full rounded-[18px] border border-vip/35 bg-vip/10 p-3 text-left" role="status">
        <p className="flex items-center gap-2 text-caption font-bold text-vip">
          <Check size={16} strokeWidth={3} /> Resultado registrado
        </p>
        <p className="mt-1 text-micro leading-snug text-text-secondary">
          {lograda
            ? state.verificada
              ? "Objetivo logrado y verificado con los datos de tu serie. Queda en la memoria de Impulso VIP."
              : "Objetivo declarado como logrado. Queda registrado, pero faltaron datos para verificarlo automaticamente."
            : "Impulso VIP recordara este resultado para no exigirte a ciegas la proxima vez."}
        </p>
      </button>
    );
  }

  return (
    <section className="momento-impulso-vivo mb-2 overflow-hidden rounded-[20px] border border-vip/45 bg-gradient-to-br from-vip/20 via-surface to-surface p-3 shadow-[0_0_26px_color-mix(in_srgb,var(--color-vip)_12%,transparent)]">
      <div className="flex items-start gap-2.5">
        <button type="button" onClick={() => setExpandido(false)} aria-label="Reducir indicación" className="grid size-10 shrink-0 place-items-center rounded-2xl bg-vip text-black shadow-[0_0_24px_color-mix(in_srgb,var(--color-vip)_38%,transparent)]">
          <Zap size={19} fill="currentColor" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-vip">{esPersonalAle ? "Mensaje personal de Ale" : "Momento Impulso"}</p>
          <p className="mt-0.5 text-card-title font-bold text-text">Serie {intervencion.serieObjetivo}</p>
          {tecnicaIntensiva && (
            <p className="mt-1 inline-flex rounded-full border border-vip/35 bg-vip/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-vip">
              {tipoActual === "drop_set" ? "Drop set" : tipoActual === "rest_pause" ? "Rest-pause" : "Fallo técnico"}
            </p>
          )}
          <p className="mt-1 text-caption leading-relaxed text-text">
            {calibracion.instruccion ?? intervencion.instruccion}
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-micro font-semibold text-text-secondary">
            <Target size={12} className="text-vip" /> {intervencion.firma}
          </p>
          {!serieTerminada && (
            asistencia.ok || estadoAsistencia ? (
              <p className={`mt-2 rounded-xl border px-3 py-2 text-micro font-semibold ${
                estadoAsistencia?.estado === "voy" || estadoAsistencia?.estado === "atendida"
                  ? "border-success/30 bg-success/10 text-success"
                  : estadoAsistencia?.estado === "no_disponible" || estadoAsistencia?.estado === "vencida"
                    ? "border-warning/30 bg-warning/10 text-warning"
                    : "border-vip/25 bg-vip/10 text-vip"
              }`}>
                {estadoAsistencia?.estado === "voy"
                  ? "Ale respondio: voy para alla."
                  : estadoAsistencia?.estado === "atendida"
                    ? "Ale marco esta asistencia como atendida."
                    : estadoAsistencia?.estado === "no_disponible"
                      ? "Ale no esta disponible ahora. Haz la serie normal, sin tecnica intensa y con una repeticion en reserva."
                      : estadoAsistencia?.estado === "vencida"
                        ? "La solicitud vencio. Continua con una serie normal y segura."
                        : "Ale recibio el aviso. Puedes continuar de forma segura mientras responde."}
              </p>
            ) : (
              <form action={asistenciaAction} className="mt-2">
                <input type="hidden" name="intervencion_id" value={intervencion.id} />
                <button
                  type="submit"
                  disabled={avisandoAle}
                  className="min-h-10 w-full rounded-xl border border-vip/35 bg-vip/10 px-3 text-micro font-bold text-vip disabled:opacity-50"
                >
                  {avisandoAle ? "Pidiendo ayuda..." : "Pídele ayuda a Ale"}
                </button>
                {asistencia.error && <p className="mt-1 text-micro text-error">{asistencia.error}</p>}
              </form>
            )
          )}
          {requiereSupervision && !serieTerminada && estadoAsistencia?.estado !== "voy" && estadoAsistencia?.estado !== "atendida" && (
            <p className="mt-2 text-micro font-semibold leading-snug text-warning">
              Esta técnica requiere supervisión. No la ejecutes hasta que Ale confirme; si no responde, haz la serie normal.
            </p>
          )}
        </div>
      </div>

      {!serieTerminada ? (
        <p className="mt-3 rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-center text-micro font-semibold text-text-secondary">
          Completa la serie y registra tus numeros para comprobar el resultado.
        </p>
      ) : (
        <form action={action} className="mt-3 space-y-2 border-t border-white/10 pt-3">
          <input type="hidden" name="intervencion_id" value={intervencion.id} />
          <p className="text-caption font-bold text-text">¿Como salio?</p>
          {(tipoActual === "drop_set" || tipoActual === "rest_pause") && (
            <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-black/10 p-2">
              {tipoActual === "drop_set" && (
                <label className="text-micro font-semibold text-text-secondary">
                  Peso descarga
                  <span className="mt-1 flex items-center rounded-xl border border-border bg-surface px-2">
                    <input
                      name="peso_descarga"
                      inputMode="decimal"
                      className="min-w-0 flex-1 bg-transparent py-2 text-caption font-bold text-text outline-none"
                      placeholder={String(prescripcionActual.pesoDescargaKg ?? "—")}
                    />
                    <span>kg</span>
                  </span>
                </label>
              )}
              <label className="text-micro font-semibold text-text-secondary">
                Reps adicionales
                <input
                  name="reps_extra"
                  type="number"
                  min="0"
                  max="100"
                  inputMode="numeric"
                  className="mt-1 w-full rounded-xl border border-border bg-surface px-2 py-2 text-caption font-bold text-text outline-none"
                  placeholder={tipoActual === "drop_set" ? "6-8" : "3-5"}
                />
              </label>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            {[
              ["lograda", "Lo logre"],
              ["parcial", "Quede corto"],
              ["no_lograda", "No lo logre"],
              ["omitida", "No la hice"],
            ].map(([valor, etiqueta]) => (
              <button
                key={valor}
                type="submit"
                name="resultado"
                value={valor}
                disabled={pending}
                onClick={() => setResultadoElegido(valor)}
                className="min-h-11 rounded-[13px] border border-white/10 bg-white/[0.055] px-2 text-caption font-semibold text-text active:border-vip active:text-vip disabled:opacity-50"
              >
                {etiqueta}
              </button>
            ))}
          </div>
          <button
            type="submit"
            name="resultado"
            value="omitida_molestia"
            disabled={pending}
            onClick={() => setResultadoElegido("omitida_molestia")}
            className="flex min-h-10 w-full items-center justify-center gap-1.5 rounded-[13px] text-micro font-semibold text-warning"
          >
            <ShieldAlert size={14} /> La detuve por molestia
          </button>
          {state.error && <p className="text-micro text-error">{state.error}</p>}
        </form>
      )}
    </section>
  );
}
