"use client";

import { forwardRef, useActionState, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Check, ChevronRight, Info, Layers, NotebookPen, Repeat, Timer } from "lucide-react";
import { guardarSeriesGrupo, type GuardarSeriesState } from "@/app/alumno/entrenar/actions";
import type { EjercicioSesion } from "@/app/alumno/entrenar/data";
import {
  CuadroFotoReferencia,
  Dato,
  FilaSerie,
  SelectorDificultad,
  TarjetaImpulsoVip,
  resolverTecnica,
  type FilaSerieHandle,
  type SesionEjercicioCardHandle,
} from "@/components/student/SesionEjercicioCard";
import { ETIQUETAS_GRUPO_MUSCULAR } from "@/components/student/GrupoMuscularIcon";
import { esEjercicioDeTiempo, repsObjetivo as calcularRepsObjetivo } from "@/lib/entrenamiento/reps";
import { resolverGrupoTecnica } from "@/lib/entrenamiento/tecnica-grupo";

const initialState: GuardarSeriesState = { error: null };

/** Sufijo de campo por posición dentro del par — "" para el primero, "_b"
 * para el segundo, ver `guardarSeriesGrupo` en actions.ts. Esta tarjeta
 * combinada cubre el caso de a PAR (biserie): un grupo de 3+ (triserie,
 * giant set) sigue mostrándose como tarjetas sueltas alternando turno —
 * ver la condición en SesionEjercicios.tsx. */
const SUFIJOS = ["", "_b"] as const;

type Paso = { pos: 0 | 1; numero: number };

/**
 * Tarjeta combinada para una biserie: dos ejercicios encadenados que se
 * hacen alternados, serie por serie — "press pecho plano" y "press
 * inclinado" se muestran como UNA sola tarjeta con las filas intercaladas
 * (1A, 1B, 2A, 2B...), en vez de dos tarjetas separadas donde había que
 * bajar toda una para encontrar la otra.
 *
 * Reusa `FilaSerie` tal cual (descanso, exceso, aviso, precarga de Impulso
 * VIP — nada de eso se reimplementa) namespaceando sus campos con
 * `sufijoNombre` para que los dos ejercicios compartan un único <form> y un
 * único guardado (`guardarSeriesGrupo`), en vez de dos envíos separados.
 *
 * Deliberadamente NO tiene (todavía): respaldo local en el teléfono
 * (borrador) ni reporte de dolor — quedan pendientes de una vuelta
 * siguiente; ningún alumno pierde el guardado en el servidor por esto, solo
 * la resiliencia extra ante cortes de conexión que sí tiene la tarjeta
 * suelta.
 */
export const SesionGrupoCard = forwardRef<
  SesionEjercicioCardHandle,
  {
    ejercicios: [EjercicioSesion, EjercicioSesion];
    sesionId: string;
    soloLectura: boolean;
    activo?: boolean;
  }
>(function SesionGrupoCard({ ejercicios, sesionId, soloLectura, activo = false }, ref) {
  const [state, formAction, pending] = useActionState(guardarSeriesGrupo, initialState);
  const completoTodo = ejercicios[0].completado && ejercicios[1].completado;
  const [expandido, setExpandido] = useState(activo || soloLectura || completoTodo);

  const grupoTecnica = resolverGrupoTecnica(ejercicios[0].tecnicaTipo) ?? resolverGrupoTecnica(ejercicios[1].tecnicaTipo);

  const formRef = useRef<HTMLFormElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const enviadoRef = useRef(false);
  const completadasRef = useRef<[Set<number>, Set<number>]>([
    new Set(ejercicios[0].series.filter((s) => s.realizada).map((s) => s.numeroSerie)),
    new Set(ejercicios[1].series.filter((s) => s.realizada).map((s) => s.numeroSerie)),
  ]);
  const [seriesHechas, setSeriesHechas] = useState<[ReadonlySet<number>, ReadonlySet<number>]>(
    () => [new Set(completadasRef.current[0]), new Set(completadasRef.current[1])]
  );
  const [serieActiva, setSerieActiva] = useState<{ pos: 0 | 1; numero: number } | null>(null);
  const [mostrandoSiguiente, setMostrandoSiguiente] = useState(false);
  const filasRef = useRef<[Map<number, FilaSerieHandle>, Map<number, FilaSerieHandle>]>([new Map(), new Map()]);
  const filaNodoRef = useRef<[Map<number, HTMLDivElement>, Map<number, HTMLDivElement>]>([new Map(), new Map()]);

  // La secuencia intercalada: 1A, 1B, 2A, 2B... Si un ejercicio tiene menos
  // series programadas que el otro (caso raro, pero no imposible), sus
  // rondas de más simplemente no tienen "pareja" y se muestran solas.
  const pasos: Paso[] = [];
  const maxRondas = Math.max(ejercicios[0].seriesProgramadas, ejercicios[1].seriesProgramadas);
  for (let n = 1; n <= maxRondas; n++) {
    if (n <= ejercicios[0].seriesProgramadas) pasos.push({ pos: 0, numero: n });
    if (n <= ejercicios[1].seriesProgramadas) pasos.push({ pos: 1, numero: n });
  }

  const pasoQueToca =
    activo && !soloLectura && !completoTodo
      ? (pasos.find((p) => !seriesHechas[p.pos].has(p.numero)) ?? null)
      : null;

  function guardarAhora() {
    formRef.current?.requestSubmit();
  }

  function alIniciar(pos: 0 | 1) {
    return (numero: number) => setSerieActiva({ pos, numero });
  }

  function alDeshacerCiclo(pos: 0 | 1) {
    return (numero: number) => {
      completadasRef.current[pos].delete(numero);
      enviadoRef.current = false;
      setSeriesHechas((prev) => {
        const copia = [new Set(prev[0]), new Set(prev[1])] as [Set<number>, Set<number>];
        copia[pos].delete(numero);
        return copia;
      });
    };
  }

  function alCompletarCiclo(pos: 0 | 1) {
    return (numero: number) => {
      completadasRef.current[pos].add(numero);
      setSeriesHechas((prev) => {
        const copia = [new Set(prev[0]), new Set(prev[1])] as [Set<number>, Set<number>];
        copia[pos].add(numero);
        return copia;
      });

      const totalHecho = completadasRef.current[0].size + completadasRef.current[1].size;
      const totalPasos = ejercicios[0].seriesProgramadas + ejercicios[1].seriesProgramadas;
      if (!enviadoRef.current && totalHecho === totalPasos) {
        enviadoRef.current = true;
        // Ver el mismo fix en SesionEjercicioCard: sin esto, la última fila
        // se quedaba "activa" para siempre y el contador de exceso de
        // descanso seguía corriendo sobre una serie ya terminada.
        setSerieActiva(null);
        setMostrandoSiguiente(true);
        window.setTimeout(() => {
          formRef.current?.requestSubmit();
          setMostrandoSiguiente(false);
        }, 400);
      } else {
        const idxActual = pasos.findIndex((p) => p.pos === pos && p.numero === numero);
        const siguiente = pasos.slice(idxActual + 1).find((p) => !completadasRef.current[p.pos].has(p.numero));
        if (siguiente) {
          window.requestAnimationFrame(() => {
            filaNodoRef.current[siguiente.pos].get(siguiente.numero)?.scrollIntoView({ behavior: "smooth", block: "center" });
          });
        }
      }
    };
  }

  function marcarGrupoListo() {
    filasRef.current[0].forEach((handle) => handle.completarYa());
    filasRef.current[1].forEach((handle) => handle.completarYa());
  }

  useImperativeHandle(ref, () => ({
    guardar: () => formRef.current?.requestSubmit(),
  }));

  useEffect(() => {
    if (activo && !soloLectura) setExpandido(true);
  }, [activo, soloLectura]);

  useEffect(() => {
    if (activo && !soloLectura) {
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activo]);

  const esTiempo0 = esEjercicioDeTiempo(ejercicios[0].repsProgramadas);
  const esTiempo1 = esEjercicioDeTiempo(ejercicios[1].repsProgramadas);
  const esTiempoPorPos = [esTiempo0, esTiempo1] as const;

  const recomendacionAprobada = (ej: EjercicioSesion) =>
    ej.recomendacionImpulso &&
    (ej.recomendacionImpulso.estado === "aprobada" || ej.recomendacionImpulso.estado === "modificada")
      ? ej.recomendacionImpulso
      : null;
  const objetivoRepsPorPos = [
    recomendacionAprobada(ejercicios[0])?.repsObjetivoMax ?? calcularRepsObjetivo(ejercicios[0].repsProgramadas),
    recomendacionAprobada(ejercicios[1])?.repsObjetivoMax ?? calcularRepsObjetivo(ejercicios[1].repsProgramadas),
  ] as const;
  const pesoSugeridoPorPos = [
    recomendacionAprobada(ejercicios[0]) && !recomendacionAprobada(ejercicios[0])?.esPesoCorporal
      ? (recomendacionAprobada(ejercicios[0])?.pesoSugeridoKg ?? null)
      : null,
    recomendacionAprobada(ejercicios[1]) && !recomendacionAprobada(ejercicios[1])?.esPesoCorporal
      ? (recomendacionAprobada(ejercicios[1])?.pesoSugeridoKg ?? null)
      : null,
  ] as const;

  return (
    <div
      ref={cardRef}
      className={`tarjeta-modelo-oscura tarjeta-ejercicio-oscura p-3 ${activo && !soloLectura ? "panel-ejercicio-activo" : ""}`}
      style={grupoTecnica ? ({ "--color-glow-tecnica": grupoTecnica.color } as React.CSSProperties) : undefined}
    >
      {/* Cabecera única para el par: la etiqueta de técnica (coloreada por
          familia, ver tecnica-grupo.ts) y los dos ejercicios lado a lado —
          antes cada uno tenía su propia cabecera completa y había que
          scrollear toda la de A para encontrar la de B. */}
      {grupoTecnica && (
        <span
          className="pill-tecnica mb-1.5 inline-block"
          style={{
            color: grupoTecnica.color,
            borderColor: grupoTecnica.color,
            background: `color-mix(in srgb, ${grupoTecnica.color} 16%, transparent)`,
          }}
        >
          {grupoTecnica.etiqueta}
        </span>
      )}
      <div className="mb-2 grid grid-cols-2 gap-2">
        {ejercicios.map((ej, pos) => (
          <div key={ej.sesionEjercicioId} className="flex min-w-0 items-center gap-1.5">
            <CuadroFotoReferencia
              ilustracionSlug={ej.ilustracionSlug}
              fotoMiniaturaUrl={ej.fotoMiniaturaUrl}
              fotoCompletaUrl={ej.fotoCompletaUrl}
              nombre={ej.nombre}
            />
            <div className="min-w-0">
              <p className="text-micro font-bold leading-tight text-vip">{pos === 0 ? "A" : "B"}</p>
              <p className="text-caption leading-tight text-text">{ej.nombre}</p>
              {ej.grupoMuscular && (
                <p className="text-micro leading-tight text-text-tertiary">
                  {ETIQUETAS_GRUPO_MUSCULAR[ej.grupoMuscular]}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="radius-control mb-1.5 flex items-stretch overflow-hidden border border-border bg-surface-2">
        <Dato icono={<Layers size={13} />} valor={`${ejercicios[0].seriesProgramadas}+${ejercicios[1].seriesProgramadas}`} etiqueta="Series" />
        <Dato
          icono={esTiempo0 || esTiempo1 ? <Timer size={13} /> : <Repeat size={13} />}
          valor={`${ejercicios[0].repsProgramadas} / ${ejercicios[1].repsProgramadas}`}
          etiqueta={esTiempo0 || esTiempo1 ? "Tiempo" : "Reps"}
        />
        <Dato
          icono={<Timer size={13} />}
          valor={ejercicios[1].descansoSegundos ? `${ejercicios[1].descansoSegundos}s` : "—"}
          etiqueta="Desc. entre rondas"
        />
      </div>

      {!expandido ? (
        <button
          type="button"
          onClick={() => setExpandido(true)}
          aria-expanded={false}
          className="flex w-full items-center justify-between gap-2 text-left"
        >
          <span className="text-caption text-text-secondary">
            {maxRondas} rondas · {ejercicios[0].nombre} + {ejercicios[1].nombre}
          </span>
          <ChevronRight size={16} className="shrink-0 text-vip" />
        </button>
      ) : (
        <>
          {ejercicios.map((ej, pos) => {
            const tecnica = pos === 0 ? resolverTecnica(ej) : null;
            return (
              tecnica && (
                <div key={ej.sesionEjercicioId} className="tarjeta-tecnica mb-1.5 flex items-start gap-2">
                  <Info size={13} className="mt-0.5 shrink-0 text-vip" strokeWidth={2.5} />
                  <p className="text-micro leading-snug text-text-secondary">
                    <span className="font-semibold text-vip">{tecnica.sugerida ? "Técnica sugerida: " : "Técnica: "}</span>
                    {tecnica.texto}
                  </p>
                </div>
              )
            );
          })}

          <TarjetaImpulsoVip recomendacion={ejercicios[0].recomendacionImpulso} />
          <TarjetaImpulsoVip recomendacion={ejercicios[1].recomendacionImpulso} />

          {soloLectura ? (
            <div className="space-y-2">
              {ejercicios.map((ej, pos) => (
                <div key={ej.sesionEjercicioId} className="space-y-1">
                  <p className="text-micro font-semibold text-vip">
                    {pos === 0 ? "A" : "B"} · {ej.nombre}
                  </p>
                  {ej.series.map((s) => (
                    <div key={s.numeroSerie} className="text-secondary flex justify-between text-text">
                      <span>
                        Serie {s.numeroSerie} {s.realizada && "✓"}
                      </span>
                      <span>
                        {s.esPesoCorporal ? "Peso corporal" : s.pesoKg != null ? `${s.pesoKg} kg` : "—"}
                        {s.repsRealizadas != null ? ` × ${s.repsRealizadas} ${esTiempoPorPos[pos] ? "seg" : "reps"}` : ""}
                      </span>
                    </div>
                  ))}
                  {ej.notaEjercicio && <p className="text-caption text-text-tertiary">Nota: {ej.notaEjercicio}</p>}
                </div>
              ))}
            </div>
          ) : (
            <form ref={formRef} action={formAction} className="space-y-1">
              <input type="hidden" name="sesion_id" value={sesionId} />
              {ejercicios.map((ej, pos) => (
                <span key={ej.sesionEjercicioId}>
                  <input type="hidden" name={`sesion_ejercicio_id${SUFIJOS[pos]}`} value={ej.sesionEjercicioId} />
                  <input type="hidden" name={`cantidad_series${SUFIJOS[pos]}`} value={ej.seriesProgramadas} />
                </span>
              ))}

              <p className="text-micro mb-1 font-bold tracking-wide text-vip">SERIES INTERCALADAS</p>

              {pasos.map((paso) => {
                const ej = ejercicios[paso.pos];
                return (
                  <div key={`${paso.pos}-${paso.numero}`}>
                    <div className="mb-0.5 flex items-center gap-1">
                      <span className="text-micro font-bold text-vip">{paso.pos === 0 ? "A" : "B"}</span>
                      <span className="text-micro truncate text-text-tertiary">{ej.nombre}</span>
                    </div>
                    <div
                      ref={(nodo) => {
                        if (nodo) filaNodoRef.current[paso.pos].set(paso.numero, nodo);
                        else filaNodoRef.current[paso.pos].delete(paso.numero);
                      }}
                    >
                      <FilaSerie
                        ref={(handle) => {
                          if (handle) filasRef.current[paso.pos].set(paso.numero, handle);
                          else filasRef.current[paso.pos].delete(paso.numero);
                        }}
                        numero={paso.numero}
                        sufijoNombre={SUFIJOS[paso.pos]}
                        inicial={ej.series.find((s) => s.numeroSerie === paso.numero)}
                        repsObjetivo={objetivoRepsPorPos[paso.pos]}
                        pesoSugerido={pesoSugeridoPorPos[paso.pos]}
                        esTiempo={esTiempoPorPos[paso.pos]}
                        descansoSegundos={ej.descansoSegundos}
                        soloLectura={soloLectura}
                        sesionId={sesionId}
                        sesionEjercicioId={ej.sesionEjercicioId}
                        activo={serieActiva?.pos === paso.pos && serieActiva?.numero === paso.numero}
                        esLaQueToca={pasoQueToca?.pos === paso.pos && pasoQueToca?.numero === paso.numero}
                        onIniciar={alIniciar(paso.pos)}
                        onCicloCompleto={alCompletarCiclo(paso.pos)}
                        onCicloDeshecho={alDeshacerCiclo(paso.pos)}
                        onGuardar={guardarAhora}
                        colorGrupoTecnica={grupoTecnica?.color}
                      />
                    </div>
                  </div>
                );
              })}

              {!completoTodo && (
                <button
                  type="button"
                  onClick={marcarGrupoListo}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-vip/50 bg-transparent text-secondary font-semibold text-vip"
                >
                  <Check size={14} strokeWidth={3} /> Marcar biserie como completada
                </button>
              )}

              {ejercicios.map((ej, pos) => (
                <div key={ej.sesionEjercicioId}>
                  <SelectorDificultad
                    valorInicial={ej.dificultadPercibida}
                    disabled={seriesHechas[pos].size < ej.seriesProgramadas}
                    onGuardar={guardarAhora}
                    nombreCampo={`dificultad_ejercicio${SUFIJOS[pos]}`}
                  />
                  <label className="radius-control mt-1 flex items-center gap-2 border border-border bg-surface-2 px-2.5 py-1.5">
                    <NotebookPen size={14} className="shrink-0 text-text-tertiary" />
                    <input
                      name={`nota_ejercicio${SUFIJOS[pos]}`}
                      type="text"
                      placeholder={`Nota de ${pos === 0 ? "A" : "B"} (opcional)`}
                      defaultValue={ej.notaEjercicio ?? ""}
                      className="text-caption w-full min-w-0 bg-transparent text-text outline-none placeholder:text-text-tertiary"
                    />
                  </label>
                </div>
              ))}

              {state.error && <p className="text-caption text-error">{state.error}</p>}
              {(pending || completoTodo) && (
                <p className="text-micro text-center text-text-tertiary">
                  {pending ? "Guardando…" : mostrandoSiguiente ? "Guardando…" : "Biserie finalizada ✓"}
                </p>
              )}
            </form>
          )}
        </>
      )}
    </div>
  );
});
