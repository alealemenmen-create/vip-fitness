"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { Check, ShieldAlert, Target, X, Zap } from "lucide-react";
import {
  calibrarIntervencionEnVivo,
  marcarIntervencionMostrada,
  resolverIntervencionEnVivo,
  type CalibrarIntervencionState,
  type ResolverIntervencionState,
} from "@/app/alumno/entrenar/impulso-actions";
import type { IntervencionImpulsoEnVivo } from "@/app/alumno/entrenar/data";
import { guardarDecisionReto, leerDecisionReto } from "@/lib/entrenamiento/decision-impulso";

const inicial: ResolverIntervencionState = { error: null, ok: false, verificada: false };
const inicialCalibracion: CalibrarIntervencionState = { error: null, ok: false, instruccion: null, tipo: null, prescripcion: null };

export function MomentoImpulsoEnVivo({
  intervencion,
  visible,
  puedeVerInstruccion,
  serieTerminada,
  onDecision,
}: {
  intervencion: IntervencionImpulsoEnVivo;
  visible: boolean;
  /** La serie ANTERIOR a la que apunta esta intervención ya terminó de
   * verdad (con su descanso incluido, o de inmediato si el ejercicio no
   * tiene descanso) — recién ahí corresponde revelar la instrucción
   * completa. Mientras esto sea `false` pero `visible` sea `true`, todavía
   * se puede calibrar (¿cuántas más pudiste hacer en la anterior?), pero
   * no se le dice todavía qué hacer en la serie objetivo — pedido de
   * Alejandro, 2026-08-17: la instrucción tiene que llegar "cuando termina
   * el temporizador", no antes ni junto con la calibración. */
  puedeVerInstruccion: boolean;
  serieTerminada: boolean;
  /** Avisa al padre (`SesionEjercicioCard`/`SesionGrupoCard`) si el alumno ya
   * respondió el reto (aceptado o rechazado) — la serie objetivo se bloquea
   * mientras esto siga en `false`, ver `bloqueadaPorImpulso` en `FilaSerie`.
   * Bug real, 2026-08-18: sin este aviso se podía completar la serie sin
   * haber tocado el Momento Impulso para nada — quedaba
   * `estado: "preparada"`, `resultado: null` para siempre en la base. */
  onDecision?: (decidido: boolean) => void;
}) {
  const [state, action, pending] = useActionState(resolverIntervencionEnVivo, inicial);
  const [calibracion, calibrarAction, calibrando] = useActionState(
    calibrarIntervencionEnVivo,
    inicialCalibracion
  );
  const [resultadoElegido, setResultadoElegido] = useState<string | null>(intervencion?.resultado ?? null);
  const [expandido, setExpandido] = useState(false);
  const decisionGuardada = intervencion ? leerDecisionReto(intervencion.id) : null;
  const [retoAceptado, setRetoAceptado] = useState(decisionGuardada === "aceptado");
  const [retoRechazado, setRetoRechazado] = useState(decisionGuardada === "rechazado");
  const esOrientacion = intervencion?.tipo === "tempo_controlado";
  const esPersonalAle = intervencion?.origen === "personal_ale" || intervencion?.origen === "preparada_por_ale";
  const tipoActual = calibracion.tipo ?? intervencion?.tipo ?? null;
  const tecnicaIntensiva = tipoActual === "drop_set" || tipoActual === "rest_pause" || tipoActual === "fallo_controlado";
  const prescripcionActual = calibracion.prescripcion ?? intervencion?.prescripcion ?? {};
  const listaParaMostrar = !!intervencion
    && (esOrientacion || esPersonalAle || intervencion.calibrada || calibracion.ok || intervencion.estado !== "preparada");
  const resuelta = state.ok || intervencion?.estado === "resuelta";
  /* Tres momentos que se abren solos, pedido de Alejandro (2026-08-17) —
     nunca compiten entre sí porque cada uno depende de una condición propia
     (calibrada/no, hecha/no):
       1. Todavía sin calibrar → "¿cuántas más pudiste hacer?" (la burbuja
          ya está visible porque `visible` ya lo permite, ver el padre).
       2. Calibrada y la serie anterior ya terminó de verdad, pero la serie
          objetivo todavía no se hizo → la instrucción completa.
       3. La serie objetivo ya se hizo → "¿cómo salió?". */
  const necesitaCalibrar = !listaParaMostrar;
  // `!decisionTomada`: sin esto, "Acepto el reto" no tenía ningún efecto
  // visible — el botón solo hace `setExpandido(false)`, pero esta condición
  // por sí sola ya forzaba el panel abierto, así que quedaba igual pase lo
  // que pase. Aceptar (o rechazar, ver el botón de al lado) es justamente lo
  // que le da permiso al alumno de replegarlo: la burbuja calma su pulso (ver
  // `[data-reto-aceptado="true"]` en globals.css) para confirmar que quedó
  // registrado. Bug reportado en vivo, 2026-08-17, mismo día del fix de
  // timing de arriba — efecto colateral de esa misma condición nueva.
  const decisionTomada = retoAceptado || retoRechazado;
  const listoParaInstruccion = listaParaMostrar && puedeVerInstruccion && !serieTerminada && !decisionTomada;
  const listoParaResultado = serieTerminada && !resuelta;
  const mostrarExpandido = expandido || necesitaCalibrar || listoParaInstruccion || listoParaResultado;
  const pesoObjetivo = typeof intervencion.prescripcion?.pesoKg === "number"
    ? `sube a ${intervencion.prescripcion.pesoKg} kg`
    : intervencion.tipo === "rest_pause"
      ? "rest-pause"
      : intervencion.tipo === "drop_set"
        ? "drop set"
        : "serie especial";

  useEffect(() => {
    if (!intervencion || !visible || !listaParaMostrar || intervencion.estado !== "preparada") return;
    startTransition(() => void marcarIntervencionMostrada(intervencion.id));
  }, [intervencion, visible, listaParaMostrar]);

  // Las técnicas de orientación a mitad de ejercicio (`tempo_controlado` sin
  // ser un mensaje personal) no tienen reto que aceptar/rechazar — se
  // resuelven solas más abajo con su propio return temprano, así que nunca
  // deben bloquear ninguna serie.
  useEffect(() => {
    onDecision?.(decisionTomada || (esOrientacion && !esPersonalAle));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decisionTomada, esOrientacion, esPersonalAle]);

  if (!intervencion || !visible || intervencion.estado === "cancelada") return null;

  // En reposo ocupa solo el rayo. La instrucción se abre al tocarlo y el
  // formulario de resultado se abre solo cuando termina la serie objetivo.
  if (!mostrarExpandido) {
    return (
      <div className="burbuja-impulso-vivo mb-1.5 flex justify-center">
        <button
          type="button"
          onClick={() => setExpandido(true)}
          className={`rayo-impulso-vivo relative inline-flex items-center justify-center gap-1.5 border ${resuelta ? "border-success/35 bg-success/10 text-success" : "border-vip/55 bg-vip/15 text-vip"}`}
          data-reto-aceptado={decisionTomada ? "true" : "false"}
          aria-label={resuelta ? "Ver resultado de Impulso VIP" : `Abrir indicación de Impulso VIP para la serie ${intervencion.serieObjetivo}`}
          title={resuelta ? "Resultado registrado" : "Indicación de Ale"}
        >
          {resuelta ? <Check size={14} strokeWidth={3} /> : <Zap size={14} fill="currentColor" />}
          <strong>Impulso VIP</strong>
          <span aria-hidden>·</span>
          <span>{resuelta ? "resultado listo" : pesoObjetivo}</span>
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
            <p className="mt-2 rounded-xl border border-vip/45 bg-black/25 px-3 py-2 text-center">
              <span className="flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-vip">
                <ShieldAlert size={13} strokeWidth={2.8} aria-hidden />
                Supervisión obligatoria
              </span>
              <span className="mt-1 block text-micro font-semibold leading-snug text-white">
                Realiza esta serie con tu entrenador vigilando.
              </span>
            </p>
          )}
          {!serieTerminada && (
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  guardarDecisionReto(intervencion.id, "aceptado");
                  setRetoAceptado(true);
                  setExpandido(false);
                }}
                className="flex min-h-10 flex-[2] items-center justify-center gap-2 rounded-xl border border-vip/55 bg-vip/15 px-3 text-caption font-extrabold text-vip shadow-[0_0_18px_color-mix(in_srgb,var(--color-vip)_16%,transparent)] active:scale-[.98]"
              >
                <Check size={15} strokeWidth={3} aria-hidden />
                Acepto el reto
              </button>
              {/* La serie objetivo queda bloqueada (ver `bloqueadaPorImpulso`
                  en FilaSerie) hasta que el alumno responda algo acá —
                  aceptar o, con este botón, decir explícitamente que hoy no.
                  Sin esta segunda opción, alguien que de verdad no quiere el
                  reto quedaría trabado sin salida. */}
              <button
                type="button"
                onClick={() => {
                  guardarDecisionReto(intervencion.id, "rechazado");
                  setRetoRechazado(true);
                  setExpandido(false);
                }}
                aria-label="No aceptar el reto por ahora"
                title="No aceptar el reto por ahora"
                className="flex min-h-10 flex-1 items-center justify-center rounded-xl border border-white/12 bg-white/[0.04] text-text-secondary active:scale-[.98]"
              >
                <X size={15} strokeWidth={3} aria-hidden />
              </button>
            </div>
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
