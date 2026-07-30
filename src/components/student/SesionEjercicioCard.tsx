"use client";

import { forwardRef, useActionState, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Check, ChevronDown, Play, Hourglass } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Input } from "@/components/ui/Input";
import { guardarSeries, type GuardarSeriesState } from "@/app/alumno/entrenar/actions";
import type { EjercicioSesion } from "@/app/alumno/entrenar/data";
import { IlustracionEjercicio } from "@/components/student/IlustracionEjercicio";

/** Lo que expone cada tarjeta de ejercicio al botón general "Guardar
 * progreso" de la sesión (ver SesionEjercicios.tsx). */
export type SesionEjercicioCardHandle = {
  guardar: () => void;
};

/** Lo que expone cada fila de serie al botón "Ejercicio listo" del
 * ejercicio, que fuerza todas las series como hechas de una sola vez. */
type FilaSerieHandle = {
  completarYa: () => void;
};

const initialState: GuardarSeriesState = { error: null };

function formatUltimo(u: EjercicioSesion["ultimoRegistro"]) {
  if (!u) return null;
  const pesoTxto = u.esPesoCorporal ? "Peso corporal" : u.pesoKg != null ? `${u.pesoKg} kg` : "—";
  const repsTxto = u.reps != null ? `${u.reps} reps` : "";
  return `${pesoTxto}${repsTxto ? ` × ${repsTxto}` : ""}`;
}

/** Avisa sin sonido (el usuario pidió que la app nunca suene en el gimnasio). */
function vibrarAviso() {
  try {
    navigator.vibrate?.([180, 90, 180]);
  } catch {
    // Si el navegador no permite vibrar, no pasa nada.
  }
}

const FilaSerie = forwardRef<
  FilaSerieHandle,
  {
    numero: number;
    inicial: EjercicioSesion["series"][number] | undefined;
    descansoSegundos: number | null;
    soloLectura: boolean;
    /** Solo el temporizador "activo" de todo el ejercicio corre — arrancar el
     * de otra serie pausa este solo. */
    activo: boolean;
    onCicloCompleto: (numero: number) => void;
    onIniciar: (numero: number) => void;
  }
>(function FilaSerie(
  { numero, inicial, descansoSegundos, soloLectura, activo, onCicloCompleto, onIniciar },
  ref
) {
  const esPesoCorporal = inicial?.esPesoCorporal ?? false;
  const [realizada, setRealizada] = useState(inicial?.realizada ?? false);
  const [restante, setRestante] = useState<number | null>(null);
  const avisadoRef = useRef(inicial?.realizada ?? false);

  useImperativeHandle(ref, () => ({
    completarYa: () => {
      // Fuerza la serie como hecha ya mismo, corte el descanso si estaba
      // corriendo — lo usa el botón "Ejercicio listo" para saltar todo.
      setRealizada(true);
      setRestante(null);
      if (!avisadoRef.current) {
        avisadoRef.current = true;
        onCicloCompleto(numero);
      }
    },
  }));

  const descansando = restante !== null;

  // Cuenta regresiva controlada por efecto: solo corre si esta serie es la
  // "activa" del ejercicio — al arrancar el descanso de otra serie, esta
  // queda pausada sola (restante se congela donde iba).
  useEffect(() => {
    if (!descansando || !activo) return;
    const id = setInterval(() => {
      setRestante((prev) => {
        if (prev === null || prev <= 1) {
          vibrarAviso();
          if (!avisadoRef.current) {
            avisadoRef.current = true;
            onCicloCompleto(numero);
          }
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [descansando, activo]);

  function presionarListo() {
    if (soloLectura) return;

    if (descansando) {
      // Tocarlo mientras corre lo reinicia (no lo pausa).
      onIniciar(numero);
      setRestante(descansoSegundos);
      return;
    }

    if (realizada) {
      // Ya terminó el descanso: permite deshacer un toque accidental.
      setRealizada(false);
      avisadoRef.current = false;
      return;
    }

    setRealizada(true);
    if (descansoSegundos && descansoSegundos > 0) {
      onIniciar(numero);
      setRestante(descansoSegundos);
    } else if (!avisadoRef.current) {
      avisadoRef.current = true;
      onCicloCompleto(numero);
    }
  }

  return (
    <div className="radius-control border border-border bg-surface-2 p-2">
      <input type="hidden" name={`peso_corporal_${numero}`} value={esPesoCorporal ? "true" : "false"} />
      <input type="hidden" name={`realizada_${numero}`} value={realizada ? "true" : "false"} />

      <div className="flex items-center gap-1.5">
        <span className="text-caption w-4 shrink-0 text-text-tertiary">#{numero}</span>
        <div className="min-w-0 flex-1">
          <Input
            name={`peso_${numero}`}
            type="number"
            step="0.5"
            min="0"
            inputMode="decimal"
            placeholder="KG"
            disabled={esPesoCorporal}
            defaultValue={inicial?.pesoKg ?? ""}
            className="py-1 text-caption uppercase"
          />
        </div>
        <div className="w-12 shrink-0">
          <Input
            name={`reps_${numero}`}
            type="number"
            min="0"
            inputMode="numeric"
            placeholder="RP"
            defaultValue={inicial?.repsRealizadas ?? ""}
            className="py-1 text-caption"
          />
        </div>
        {!soloLectura && (
          <button
            type="button"
            onClick={presionarListo}
            data-descansando={descansando ? "true" : "false"}
            data-realizada={realizada ? "true" : "false"}
            data-pausado={descansando && !activo ? "true" : "false"}
            className="boton-listo-serie"
            aria-label={
              descansando
                ? activo
                  ? `Descanso, ${restante}s — tocar para reiniciar`
                  : `En pausa, ${restante}s — arrancó el descanso de otra serie`
                : realizada
                  ? "Serie lista"
                  : "Iniciar descanso"
            }
          >
            {descansando ? (
              activo ? (
                <span>{restante}s</span>
              ) : (
                <>
                  <Play size={14} strokeWidth={3} />
                  <span>Seguir</span>
                </>
              )
            ) : realizada ? (
              <>
                <Check size={15} strokeWidth={3} />
                <span>Listo</span>
              </>
            ) : (
              <>
                <Hourglass size={14} strokeWidth={2.5} />
                <span>Descanso</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
});

export const SesionEjercicioCard = forwardRef<
  SesionEjercicioCardHandle,
  {
    ejercicio: EjercicioSesion;
    sesionId: string;
    soloLectura: boolean;
    /** Es el próximo ejercicio pendiente de la sesión: panel espejo negro con
     * el brillo corriendo, para que se note de lejos en cuál está parado. */
    activo?: boolean;
  }
>(function SesionEjercicioCard({ ejercicio, sesionId, soloLectura, activo = false }, ref) {
  const [state, formAction, pending] = useActionState(guardarSeries, initialState);
  const ultimoTexto = formatUltimo(ejercicio.ultimoRegistro);
  const cardRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const enviadoRef = useRef(false);
  const completadasRef = useRef(
    new Set(ejercicio.series.filter((s) => s.realizada).map((s) => s.numeroSerie))
  );
  // Solo el descanso de esta serie corre — arrancar el de otra la pausa sola.
  const [serieActivaNumero, setSerieActivaNumero] = useState<number | null>(null);
  const [mostrandoSiguiente, setMostrandoSiguiente] = useState(false);
  const filasRef = useRef(new Map<number, FilaSerieHandle>());

  const filas = Array.from({ length: ejercicio.seriesProgramadas }, (_, i) => i + 1);

  function marcarEjercicioListo() {
    // Fuerza todas las series pendientes como hechas y salta al siguiente
    // ejercicio, sin esperar los descansos — el botón cuadrado de "listo".
    filasRef.current.forEach((handle) => handle.completarYa());
  }

  useImperativeHandle(ref, () => ({
    guardar: () => formRef.current?.requestSubmit(),
  }));

  useEffect(() => {
    if (activo && !soloLectura) {
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activo, soloLectura]);

  function alCompletarCicloSerie(numero: number) {
    completadasRef.current.add(numero);
    if (!enviadoRef.current && completadasRef.current.size === ejercicio.seriesProgramadas) {
      enviadoRef.current = true;
      // El aviso visual aparece antes de guardar; al revalidar, el siguiente
      // ejercicio pasa a ser el activo y recibe el destello sutil.
      setMostrandoSiguiente(true);
      window.setTimeout(() => {
        formRef.current?.requestSubmit();
        setMostrandoSiguiente(false);
      }, 1200);
    }
  }

  return (
    <div ref={cardRef}>
      <Card className={`p-3.5 ${activo && !soloLectura ? "panel-ejercicio-activo" : ""}`}>
        {/* El nombre del ejercicio es lo primero que hay que ver desde lejos,
            con el celular apoyado y las manos ocupadas. */}
        <div className="mb-2.5 flex items-start gap-2">
          <IlustracionEjercicio
            ilustracionSlug={ejercicio.ilustracionSlug}
            grupoMuscular={ejercicio.grupoMuscular}
            nombre={ejercicio.nombre}
            tamano={48}
            className="mt-1"
          />
          <div className="min-w-0">
            <p className="text-caption font-semibold tracking-wide text-vip">
              EJERCICIO {ejercicio.orden}
            </p>
            <p className="text-card-title leading-tight text-text">{ejercicio.nombre}</p>
            <p className="text-caption mt-0.5 text-text-tertiary">
              {ejercicio.seriesProgramadas} series × {ejercicio.repsProgramadas}
              {ejercicio.descansoSegundos ? ` · descanso ${ejercicio.descansoSegundos}s` : ""}
            </p>
          </div>
        </div>

      {ejercicio.tecnicaTipo && (
        <div className="radius-control mb-2 bg-surface-2 p-2.5">
          <Pill tone="error">{ejercicio.tecnicaTipo}</Pill>
          {ejercicio.tecnicaInstruccion && (
            <p className="text-secondary mt-1 text-text-secondary">{ejercicio.tecnicaInstruccion}</p>
          )}
        </div>
      )}

      {ejercicio.observacion && (
        <p className="text-secondary mb-2 text-text-secondary">Observación: {ejercicio.observacion}</p>
      )}

      {ultimoTexto && (
        <p className="text-caption mb-2 text-text-tertiary">
          Último registro: {ultimoTexto} ({ejercicio.ultimoRegistro?.fecha})
        </p>
      )}

      {soloLectura ? (
        <div className="space-y-1">
          {ejercicio.series.map((s) => (
            <div key={s.numeroSerie} className="text-secondary flex justify-between text-text">
              <span>
                Serie {s.numeroSerie} {s.realizada && "✓"}
              </span>
              <span>
                {s.esPesoCorporal ? "Peso corporal" : s.pesoKg != null ? `${s.pesoKg} kg` : "—"}
                {s.repsRealizadas != null ? ` × ${s.repsRealizadas} reps` : ""}
              </span>
            </div>
          ))}
          {ejercicio.notaEjercicio && (
            <p className="text-caption text-text-tertiary">Nota: {ejercicio.notaEjercicio}</p>
          )}
        </div>
      ) : (
        <form ref={formRef} action={formAction} className="space-y-1.5">
          <input type="hidden" name="sesion_ejercicio_id" value={ejercicio.sesionEjercicioId} />
          <input type="hidden" name="sesion_id" value={sesionId} />
          <input type="hidden" name="cantidad_series" value={ejercicio.seriesProgramadas} />

          {filas.map((n) => (
            <FilaSerie
              key={n}
              ref={(handle) => {
                if (handle) filasRef.current.set(n, handle);
                else filasRef.current.delete(n);
              }}
              numero={n}
              inicial={ejercicio.series.find((s) => s.numeroSerie === n)}
              descansoSegundos={ejercicio.descansoSegundos}
              soloLectura={soloLectura}
              activo={serieActivaNumero === n}
              onIniciar={setSerieActivaNumero}
              onCicloCompleto={alCompletarCicloSerie}
            />
          ))}

          {!ejercicio.completado && (
            <button
              type="button"
              onClick={marcarEjercicioListo}
              className="radius-control flex h-11 w-full items-center justify-center gap-2 border border-border bg-surface-2 text-secondary font-semibold text-text"
            >
              <Check size={16} strokeWidth={3} /> Finalizado
            </button>
          )}

          <Input
            name="nota_ejercicio"
            type="text"
            placeholder="Nota de este ejercicio (opcional)"
            defaultValue={ejercicio.notaEjercicio ?? ""}
            className="mt-1 py-2 text-caption"
          />
          {state.error && <p className="text-caption text-error">{state.error}</p>}
          <p className="text-caption text-center text-text-tertiary">
            {pending
              ? "Guardando…"
              : ejercicio.completado
                ? "Ejercicio finalizado ✓"
                : "Marca cada serie al terminarla. El descanso se inicia y el progreso se guarda automáticamente."}
          </p>
        </form>
      )}
      </Card>
      {mostrandoSiguiente && (
        <div
          className="indicador-siguiente-ejercicio"
          role="status"
          aria-label="Siguiente ejercicio"
        >
          {[0, 1, 2].map((indice) => (
            <ChevronDown
              key={indice}
              size={18}
              className="flecha-siguiente-ejercicio"
              style={{ animationDelay: `${indice * 140}ms` }}
            />
          ))}
        </div>
      )}
    </div>
  );
});
