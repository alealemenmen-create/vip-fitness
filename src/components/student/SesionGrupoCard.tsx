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

/** Letras para identificar cada ejercicio del grupo — hasta 8 (giant set
 * grande), más que eso ya no tiene sentido como técnica encadenada. */
const LETRAS = "ABCDEFGH".split("");

/** Sufijo de campo por posición dentro del grupo: "" para el primero,
 * "_1", "_2"... para el resto (ver `guardarSeriesGrupo` en actions.ts, que
 * lee `cantidad_ejercicios_grupo` para saber cuántos namespaces recorrer). */
function sufijoDe(pos: number): string {
  return pos === 0 ? "" : `_${pos}`;
}

type Paso = { pos: number; numero: number };

/**
 * Tarjeta combinada para una técnica encadenada (biserie, triserie, giant
 * set): los ejercicios se hacen alternados, serie por serie — se muestran
 * como UNA sola tarjeta con las filas intercaladas (1A, 1B, 1C, 2A, 2B,
 * 2C...), en vez de tarjetas separadas donde había que bajar toda una para
 * encontrar la siguiente.
 *
 * Reusa `FilaSerie` tal cual (descanso, exceso, aviso, precarga de Impulso
 * VIP — nada de eso se reimplementa) namespaceando sus campos con
 * `sufijoNombre` para que todos los ejercicios compartan un único <form> y
 * un único guardado (`guardarSeriesGrupo`), en vez de envíos separados.
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
    /** 2 o más — biserie, triserie, giant set. */
    ejercicios: EjercicioSesion[];
    sesionId: string;
    soloLectura: boolean;
    activo?: boolean;
  }
>(function SesionGrupoCard({ ejercicios, sesionId, soloLectura, activo = false }, ref) {
  const [state, formAction, pending] = useActionState(guardarSeriesGrupo, initialState);
  const n = ejercicios.length;
  const completoTodo = ejercicios.every((e) => e.completado);
  const [expandido, setExpandido] = useState(activo || soloLectura || completoTodo);

  const grupoTecnica = ejercicios.map((e) => resolverGrupoTecnica(e.tecnicaTipo)).find((g) => g) ?? null;
  const etiquetaGrupo = grupoTecnica?.etiqueta ?? "Técnica encadenada";

  const formRef = useRef<HTMLFormElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const enviadoRef = useRef(false);
  const completadasRef = useRef<Set<number>[]>(
    ejercicios.map((ej) => new Set(ej.series.filter((s) => s.realizada).map((s) => s.numeroSerie)))
  );
  const [seriesHechas, setSeriesHechas] = useState<ReadonlySet<number>[]>(() =>
    completadasRef.current.map((s) => new Set(s))
  );
  const [serieActiva, setSerieActiva] = useState<{ pos: number; numero: number } | null>(null);
  const [mostrandoSiguiente, setMostrandoSiguiente] = useState(false);
  const filasRef = useRef<Map<number, FilaSerieHandle>[]>(ejercicios.map(() => new Map()));
  const filaNodoRef = useRef<Map<number, HTMLDivElement>[]>(ejercicios.map(() => new Map()));

  // La secuencia intercalada: 1A, 1B, 1C, 2A, 2B, 2C... Si un ejercicio
  // tiene menos series programadas que los demás (caso raro, pero no
  // imposible), sus rondas de más simplemente no tienen "pareja" y se
  // muestran solas.
  const pasos: Paso[] = [];
  const maxRondas = Math.max(...ejercicios.map((e) => e.seriesProgramadas));
  for (let ronda = 1; ronda <= maxRondas; ronda++) {
    for (let pos = 0; pos < n; pos++) {
      if (ronda <= ejercicios[pos].seriesProgramadas) pasos.push({ pos, numero: ronda });
    }
  }

  const pasoQueToca =
    activo && !soloLectura && !completoTodo
      ? (pasos.find((p) => !seriesHechas[p.pos].has(p.numero)) ?? null)
      : null;

  function guardarAhora() {
    formRef.current?.requestSubmit();
  }

  function alIniciar(pos: number) {
    return (numero: number) => setSerieActiva({ pos, numero });
  }

  function alDeshacerCiclo(pos: number) {
    return (numero: number) => {
      completadasRef.current[pos].delete(numero);
      enviadoRef.current = false;
      setSeriesHechas((prev) => {
        const copia = prev.map((s) => new Set(s));
        copia[pos].delete(numero);
        return copia;
      });
    };
  }

  function alCompletarCiclo(pos: number) {
    return (numero: number) => {
      completadasRef.current[pos].add(numero);
      setSeriesHechas((prev) => {
        const copia = prev.map((s) => new Set(s));
        copia[pos].add(numero);
        return copia;
      });

      const totalHecho = completadasRef.current.reduce((acc, s) => acc + s.size, 0);
      const totalPasos = ejercicios.reduce((acc, e) => acc + e.seriesProgramadas, 0);
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
    filasRef.current.forEach((mapa) => mapa.forEach((handle) => handle.completarYa()));
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

  const esTiempoPorPos = ejercicios.map((e) => esEjercicioDeTiempo(e.repsProgramadas));

  const recomendacionAprobada = (ej: EjercicioSesion) =>
    ej.recomendacionImpulso &&
    (ej.recomendacionImpulso.estado === "aprobada" || ej.recomendacionImpulso.estado === "modificada")
      ? ej.recomendacionImpulso
      : null;
  const objetivoRepsPorPos = ejercicios.map(
    (ej) => recomendacionAprobada(ej)?.repsObjetivoMax ?? calcularRepsObjetivo(ej.repsProgramadas)
  );
  const pesoSugeridoPorPos = ejercicios.map((ej) => {
    const rec = recomendacionAprobada(ej);
    return rec && !rec.esPesoCorporal ? (rec.pesoSugeridoKg ?? null) : null;
  });

  // El descanso "real" de la ronda es el del ÚLTIMO ejercicio del grupo —
  // en la práctica es el único que suele tener un descanso propio (los
  // anteriores encadenan directo), y es el que se muestra en la fila de
  // datos como resumen. Cada fila sigue usando el descanso de SU PROPIO
  // ejercicio, esto es solo el resumen de arriba.
  const descansoRonda = ejercicios[n - 1]?.descansoSegundos ?? null;

  return (
    <div
      ref={cardRef}
      className={`tarjeta-modelo-oscura tarjeta-ejercicio-oscura p-3 ${activo && !soloLectura ? "panel-ejercicio-activo" : ""}`}
      style={grupoTecnica ? ({ "--color-glow-tecnica": grupoTecnica.color } as React.CSSProperties) : undefined}
    >
      {/* Cabecera única para el grupo: la etiqueta de técnica (coloreada por
          familia, ver tecnica-grupo.ts) y los ejercicios lado a lado — antes
          cada uno tenía su propia cabecera completa y había que scrollear
          una entera para encontrar la siguiente. */}
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
              videoUrl={ej.videoUrl}
              nombre={ej.nombre}
              compacto
            />
            <div className="min-w-0">
              <p className="text-micro font-bold leading-tight text-vip">{LETRAS[pos]}</p>
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
        <Dato icono={<Layers size={13} />} valor={ejercicios.map((e) => e.seriesProgramadas).join("+")} etiqueta="Series" />
        <Dato
          icono={esTiempoPorPos.some(Boolean) ? <Timer size={13} /> : <Repeat size={13} />}
          valor={ejercicios.map((e) => e.repsProgramadas).join(" / ")}
          etiqueta={esTiempoPorPos.some(Boolean) ? "Tiempo" : "Reps"}
        />
        <Dato
          icono={<Timer size={13} />}
          valor={descansoRonda ? `${descansoRonda}s` : "—"}
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
            {maxRondas} rondas · {ejercicios.map((e) => e.nombre).join(" + ")}
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

          {ejercicios.map((ej) => (
            <TarjetaImpulsoVip key={ej.sesionEjercicioId} recomendacion={ej.recomendacionImpulso} />
          ))}

          {soloLectura ? (
            <div className="space-y-2">
              {ejercicios.map((ej, pos) => (
                <div key={ej.sesionEjercicioId} className="space-y-1">
                  <p className="text-micro font-semibold text-vip">
                    {LETRAS[pos]} · {ej.nombre}
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
              <input type="hidden" name="cantidad_ejercicios_grupo" value={n} />
              {ejercicios.map((ej, pos) => (
                <span key={ej.sesionEjercicioId}>
                  <input type="hidden" name={`sesion_ejercicio_id${sufijoDe(pos)}`} value={ej.sesionEjercicioId} />
                  <input type="hidden" name={`cantidad_series${sufijoDe(pos)}`} value={ej.seriesProgramadas} />
                </span>
              ))}

              <p className="text-micro mb-1 font-bold tracking-wide text-vip">SERIES INTERCALADAS</p>

              {pasos.map((paso) => {
                const ej = ejercicios[paso.pos];
                return (
                  <div key={`${paso.pos}-${paso.numero}`}>
                    <div className="mb-0.5 flex items-center gap-1">
                      <span className="text-micro font-bold text-vip">{LETRAS[paso.pos]}</span>
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
                        sufijoNombre={sufijoDe(paso.pos)}
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
                  <Check size={14} strokeWidth={3} /> Marcar {etiquetaGrupo.toLowerCase()} como completada
                </button>
              )}

              {ejercicios.map((ej, pos) => (
                <div key={ej.sesionEjercicioId}>
                  <SelectorDificultad
                    valorInicial={ej.dificultadPercibida}
                    disabled={seriesHechas[pos].size < ej.seriesProgramadas}
                    onGuardar={guardarAhora}
                    nombreCampo={`dificultad_ejercicio${sufijoDe(pos)}`}
                  />
                  <label className="radius-control mt-1 flex items-center gap-2 border border-border bg-surface-2 px-2.5 py-1.5">
                    <NotebookPen size={14} className="shrink-0 text-text-tertiary" />
                    <input
                      name={`nota_ejercicio${sufijoDe(pos)}`}
                      type="text"
                      placeholder={`Nota de ${LETRAS[pos]} (opcional)`}
                      defaultValue={ej.notaEjercicio ?? ""}
                      className="text-caption w-full min-w-0 bg-transparent text-text outline-none placeholder:text-text-tertiary"
                    />
                  </label>
                </div>
              ))}

              {state.error && <p className="text-caption text-error">{state.error}</p>}
              {(pending || completoTodo) && (
                <p className="text-micro text-center text-text-tertiary">
                  {pending ? "Guardando…" : mostrandoSiguiente ? "Guardando…" : `${etiquetaGrupo} finalizada ✓`}
                </p>
              )}
            </form>
          )}
        </>
      )}
    </div>
  );
});
