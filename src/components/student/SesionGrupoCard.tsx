"use client";

import { forwardRef, useActionState, useEffect, useImperativeHandle, useRef, useState, useSyncExternalStore } from "react";
import { Check, ChevronDown, ChevronRight, Info, NotebookPen, Repeat, Timer } from "lucide-react";
import { guardarSeriesGrupo, type GuardarSeriesState } from "@/app/alumno/entrenar/actions";
import type { EjercicioSesion } from "@/app/alumno/entrenar/data";
import {
  CuadroFotoReferencia,
  Dato,
  FilaSerie,
  SelectorDificultad,
  TarjetaImpulsoVip,
  formatUltimo,
  resolverTecnica,
  type FilaSerieHandle,
  type SesionEjercicioCardHandle,
} from "@/components/student/SesionEjercicioCard";
import { ETIQUETAS_GRUPO_MUSCULAR } from "@/components/student/GrupoMuscularIcon";
import { esEjercicioDeTiempo, repsObjetivo as calcularRepsObjetivo } from "@/lib/entrenamiento/reps";
import { resolverGrupoTecnica } from "@/lib/entrenamiento/tecnica-grupo";
import {
  guardarBorrador,
  leerBorrador,
  type BorradorEjercicio,
} from "@/lib/entrenamiento/borrador";

const initialState: GuardarSeriesState = { error: null };
const suscribirSinCambios = () => () => {};

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
 * Cada ejercicio mantiene además su propio respaldo local. Así un corte de
 * conexión, una llamada o una recarga no mezcla ni pierde los kilos de A, B
 * o C antes de que el servidor confirme el guardado.
 */
export const SesionGrupoCard = forwardRef<
  SesionEjercicioCardHandle,
  {
    /** 2 o más — biserie, triserie, giant set. */
    ejercicios: EjercicioSesion[];
    sesionId: string;
    soloLectura: boolean;
    activo?: boolean;
    modoEnfocado?: boolean;
    onAnterior?: () => void;
    onSiguiente?: () => void;
    hayAnterior?: boolean;
    haySiguiente?: boolean;
    onDificultadRespondida?: () => void;
  }
>(function SesionGrupoCard({ ejercicios, sesionId, soloLectura, activo = false, modoEnfocado = false, onAnterior, onSiguiente, hayAnterior = false, haySiguiente = false, onDificultadRespondida }, ref) {
  const [state, formAction, pending] = useActionState(guardarSeriesGrupo, initialState);
  const n = ejercicios.length;
  const completoTodo = ejercicios.every((e) => e.completado);
  const [expandido, setExpandido] = useState(activo || soloLectura || completoTodo);

  const grupoTecnica = ejercicios.map((e) => resolverGrupoTecnica(e.tecnicaTipo)).find((g) => g) ?? null;
  const etiquetaGrupo = grupoTecnica?.etiqueta ?? "Técnica encadenada";

  const formRef = useRef<HTMLFormElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const enviadoRef = useRef(false);
  const montado = useSyncExternalStore(suscribirSinCambios, () => true, () => false);
  const borradoresLocales: (BorradorEjercicio | null)[] = montado
    ? ejercicios.map((ej) => leerBorrador(sesionId, ej.sesionEjercicioId))
    : ejercicios.map(() => null);
  const completadasRef = useRef<Set<number>[]>(
    ejercicios.map((ej) => new Set(ej.series.filter((s) => s.realizada).map((s) => s.numeroSerie)))
  );
  const [seriesHechas, setSeriesHechas] = useState<ReadonlySet<number>[]>(() =>
    completadasRef.current.map((s) => new Set(s))
  );
  const [encuestasRespondidas, setEncuestasRespondidas] = useState<ReadonlySet<number>>(
    () => new Set(ejercicios.flatMap((ej, pos) => (ej.dificultadPercibida ? [pos] : [])))
  );
  const [serieActiva, setSerieActiva] = useState<{ pos: number; numero: number } | null>(null);
  const [mostrandoSiguiente, setMostrandoSiguiente] = useState(false);
  /** Igual que en `SesionEjercicioCard`: la encuesta se abre sola solamente si
   * el grupo se terminó recién acá. Navegar con Anterior/Siguiente hasta una
   * biserie ya hecha no la vuelve a disparar. */
  const [recienCompletado, setRecienCompletado] = useState(false);
  /** Pidió cerrar el grupo con series sin hacer: se le muestra qué implica. */
  const [confirmandoIncompleto, setConfirmandoIncompleto] = useState(false);
  /** Mismo criterio que en la tarjeta de ejercicio suelto (ver el comentario
   * ahí): segundo paso adentro de "Cerrar igual" para cuando el alumno sí
   * hizo todo pero se olvidó de tocar "Listo" en cada serie. */
  const [confirmandoDeVerdad, setConfirmandoDeVerdad] = useState(false);
  const filasRef = useRef<Map<number, FilaSerieHandle>[]>(ejercicios.map(() => new Map()));
  const filaNodoRef = useRef<Map<number, HTMLDivElement>[]>(ejercicios.map(() => new Map()));
  const [cantidadesSeries, setCantidadesSeries] = useState(() => ejercicios.map((ejercicio) =>
    Math.max(ejercicio.seriesProgramadas, ...ejercicio.series.map((serie) => serie.numeroSerie), 0)
  ));

  // La secuencia intercalada: 1A, 1B, 1C, 2A, 2B, 2C... Si un ejercicio
  // tiene menos series programadas que los demás (caso raro, pero no
  // imposible), sus rondas de más simplemente no tienen "pareja" y se
  // muestran solas.
  const pasos: Paso[] = [];
  const maxRondas = Math.max(...cantidadesSeries);
  for (let ronda = 1; ronda <= maxRondas; ronda++) {
    for (let pos = 0; pos < n; pos++) {
      if (ronda <= cantidadesSeries[pos]) pasos.push({ pos, numero: ronda });
    }
  }
  const [indicePasoVisible, setIndicePasoVisible] = useState(
    () => Math.max(0, pasos.findIndex((paso) => !ejercicios[paso.pos].series.some(
      (serie) => serie.numeroSerie === paso.numero && serie.realizada
    )))
  );

  const pasoExtraPendiente = pasos.find(
    (paso) => paso.numero > ejercicios[paso.pos].seriesProgramadas && !seriesHechas[paso.pos].has(paso.numero)
  ) ?? null;
  const pasoQueToca =
    activo && !soloLectura && !completoTodo
      ? (pasos.find((paso) => paso.numero <= ejercicios[paso.pos].seriesProgramadas && !seriesHechas[paso.pos].has(paso.numero)) ?? pasoExtraPendiente)
      : pasoExtraPendiente;
  const programadasGrupoHechas = ejercicios.every((ejercicio, pos) =>
    Array.from({ length: ejercicio.seriesProgramadas }, (_, indice) => indice + 1)
      .every((numero) => seriesHechas[pos].has(numero))
  );

  // Rediseño en tarjetas apiladas (modo enfocado): en vez de mostrar los
  // pasos intercalados de a uno, se ve toda la ronda actual junta — un
  // ejercicio por tarjeta. `rondaActualNumero` es la ronda del paso que
  // toca ahora (o la última si el grupo ya se completó).
  const rondaActualNumero = pasoQueToca?.numero ?? maxRondas;
  const pasosDeRondaActual = pasos.filter((paso) => paso.numero === rondaActualNumero);
  /** Tarjetas ya hechas que el alumno cerró a mano para no ver sus números
   * todo el tiempo — arranca abierto por defecto (como en la referencia). */
  const [colapsadosManual, setColapsadosManual] = useState<Set<number>>(() => new Set());

  function respaldarLocal() {
    const form = formRef.current;
    if (!form) return;
    const datos = new FormData(form);
    ejercicios.forEach((ej, pos) => {
      const sufijo = sufijoDe(pos);
      guardarBorrador(sesionId, ej.sesionEjercicioId, {
        series: Array.from({ length: cantidadesSeries[pos] }, (_, indice) => {
          const numero = indice + 1;
          return {
            numero,
            peso: String(datos.get(`peso_${numero}${sufijo}`) ?? ""),
            reps: String(datos.get(`reps_${numero}${sufijo}`) ?? ""),
            rir: String(datos.get(`rir_${numero}${sufijo}`) ?? ""),
            realizada: datos.get(`realizada_${numero}${sufijo}`) === "true",
            esPesoCorporal: datos.get(`peso_corporal_${numero}${sufijo}`) === "true",
          };
        }),
        nota: String(datos.get(`nota_ejercicio${sufijo}`) ?? ""),
      });
    });
  }

  function guardarAhora() {
    respaldarLocal();
    enviadoRef.current = true;
    formRef.current?.requestSubmit();
  }

  function serieInicial(pos: number, numero: number) {
    const local = borradoresLocales[pos]?.series.find((serie) => serie.numero === numero);
    if (!local) return ejercicios[pos].series.find((serie) => serie.numeroSerie === numero);
    return {
      numeroSerie: numero,
      pesoKg: local.peso ? Number(local.peso.replace(",", ".")) : null,
      esPesoCorporal: local.esPesoCorporal,
      repsRealizadas: local.reps ? Number(local.reps) : null,
      rirEstimado: local.rir ? Number(local.rir) : null,
      realizada: local.realizada,
    };
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
        setRecienCompletado(true);
        // Ver el mismo fix en SesionEjercicioCard: sin esto, la última fila
        // se quedaba "activa" para siempre y el contador de exceso de
        // descanso seguía corriendo sobre una serie ya terminada.
        setSerieActiva(null);
        setMostrandoSiguiente(true);
        window.setTimeout(() => {
          guardarAhora();
          setMostrandoSiguiente(false);
        }, 400);
      } else {
        const idxActual = pasos.findIndex((p) => p.pos === pos && p.numero === numero);
        const siguiente = pasos.slice(idxActual + 1).find((p) => !completadasRef.current[p.pos].has(p.numero));
        if (siguiente) {
          const indiceSiguiente = pasos.findIndex((paso) => paso.pos === siguiente.pos && paso.numero === siguiente.numero);
          if (indiceSiguiente >= 0) setIndicePasoVisible(indiceSiguiente);
          window.requestAnimationFrame(() => {
            filaNodoRef.current[siguiente.pos].get(siguiente.numero)?.scrollIntoView({ behavior: "smooth", block: "center" });
          });
        }
      }
    };
  }

  /** Series del grupo que todavía no se hicieron: lo que se daría por hecho
   * sin haberse hecho si se cierra ahora. */
  const seriesFaltantes = ejercicios.reduce(
    (acc, ej, pos) => acc + Math.max(0, ej.seriesProgramadas - seriesHechas[pos].size),
    0
  );

  function marcarGrupoListo() {
    // Mismo aviso que en la tarjeta de ejercicio suelto: cerrar con series
    // pendientes las marca como hechas y el grupo puntúa entero. Sin esto la
    // biserie era la puerta de atrás — el único camino que cerraba sin decir
    // nada.
    if (seriesFaltantes > 0 && !confirmandoIncompleto) {
      setConfirmandoIncompleto(true);
      return;
    }
    setConfirmandoIncompleto(false);
    setConfirmandoDeVerdad(false);
    // Un solo envío después de actualizar todas las filas evita carreras entre
    // respuestas parciales del mismo grupo (el mismo problema corregido en la
    // tarjeta de ejercicio individual).
    filasRef.current.forEach((mapa) => mapa.forEach((handle) => handle.completarYa(false)));
    setRecienCompletado(true);
    guardarAhora();
  }

  useImperativeHandle(ref, () => ({
    guardar: guardarAhora,
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
  const todasLasSeriesHechas = ejercicios.every(
    (ej, pos) => seriesHechas[pos].size >= ej.seriesProgramadas
  );
  const encuestaPendiente =
    todasLasSeriesHechas && recienCompletado
      ? ejercicios.findIndex((_, pos) => !encuestasRespondidas.has(pos))
      : -1;

  function alResponderEncuesta(pos: number) {
    const proximo = new Set(encuestasRespondidas).add(pos);
    setEncuestasRespondidas(proximo);
    if (ejercicios.every((_, indice) => proximo.has(indice))) onDificultadRespondida?.();
  }

  return (
    <div
      ref={cardRef}
      // Ya NO fuerza negro plano — ver el comentario en SesionEjercicioCard.tsx
      // sobre por qué esto se saca (los temas VIP/Steel Fit/Lady Fit se veían
      // "trabados" acá). El fondo negro real que necesitaba el ícono de
      // respaldo (recorte transparente del modelo) sigue puesto aparte,
      // inline, en IlustracionEjercicio/FONDO_FOTO_GRUPO.
      className={`p-3 ${modoEnfocado ? "tarjeta-ejercicio-enfocada tarjeta-grupo-enfocada" : ""} ${activo && !soloLectura ? "panel-ejercicio-activo" : ""}`}
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
      <div className={`mb-2 grid gap-2 ${modoEnfocado ? "hidden" : "grid-cols-2"}`}>
        {ejercicios.map((ej, pos) => (
          <div key={ej.sesionEjercicioId} className="flex min-w-0 items-center gap-1.5">
            <CuadroFotoReferencia
              ilustracionSlug={ej.ilustracionSlug}
              fotoMiniaturaUrl={ej.fotoMiniaturaUrl}
              fotoCompletaUrl={ej.fotoCompletaUrl}
              videoUrl={ej.videoUrl}
              videoCloudflareUid={ej.videoCloudflareUid}
              videoCloudflareEstado={ej.videoCloudflareEstado}
              videoCloudflareMiniaturaUrl={ej.videoCloudflareMiniaturaUrl}
              nombre={ej.nombre}
              sesionEjercicioId={ej.sesionEjercicioId}
              ejercicioId={ej.ejercicioId}
              fotoPanoramaX={ej.fotoPanoramaX}
              fotoPanoramaY={ej.fotoPanoramaY}
              fotoCuadradaX={ej.fotoCuadradaX}
              fotoCuadradaY={ej.fotoCuadradaY}
              compacto
              tamanoCompacto={modoEnfocado ? 60 : 44}
            />
            <div className="min-w-0">
              <p className="text-micro font-bold leading-tight text-vip">{LETRAS[pos]}</p>
              <p className="text-caption leading-tight text-text">{ej.nombre}</p>
              {ej.grupoMuscular && (
                <p className="text-micro leading-tight text-text-tertiary">
                  {ETIQUETAS_GRUPO_MUSCULAR[ej.grupoMuscular]}
                </p>
              )}
              {/* Series y reps/tiempo DE ESTE ejercicio, no amontonados con los
                  de los otros cinco en una sola línea de la barra de abajo —
                  con seis ejercicios distintos ese resumen se volvía
                  ilegible ("5+5+5+5+5+5 / 30s/30s/40s/12-15/12"). */}
              <p className="text-micro leading-tight text-text-secondary">
                {ej.seriesProgramadas}× {ej.repsProgramadas}
              </p>
              {formatUltimo(ej.ultimoRegistro, esTiempoPorPos[pos]) && (
                <p className="text-micro leading-tight text-text-tertiary">
                  Último: {formatUltimo(ej.ultimoRegistro, esTiempoPorPos[pos])}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {!modoEnfocado && (
        <div className="radius-control mb-1.5 flex items-stretch overflow-hidden border border-border bg-surface-2">
          <Dato icono={<Repeat size={13} />} valor={String(maxRondas)} etiqueta="Rondas" />
          <Dato
            icono={<Timer size={13} />}
            valor={descansoRonda ? `${descansoRonda}s` : "—"}
            etiqueta="Desc. entre rondas"
          />
        </div>
      )}

      {modoEnfocado && (onAnterior || onSiguiente) && (
        <div className="navegacion-ejercicios-junto-foto">
          <button type="button" onClick={onAnterior} disabled={!hayAnterior} aria-label="Ejercicio anterior">
            ← Anterior
          </button>
          <button type="button" onClick={onSiguiente} disabled={!haySiguiente} aria-label="Siguiente ejercicio">
            Siguiente →
          </button>
        </div>
      )}

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

          {!modoEnfocado && ejercicios.map((ej) => (
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
            <form ref={formRef} action={formAction} onChange={respaldarLocal} className="space-y-1">
              <input type="hidden" name="sesion_id" value={sesionId} />
              <input type="hidden" name="cantidad_ejercicios_grupo" value={n} />
              {ejercicios.map((ej, pos) => (
                <span key={ej.sesionEjercicioId}>
                  <input type="hidden" name={`sesion_ejercicio_id${sufijoDe(pos)}`} value={ej.sesionEjercicioId} />
                  <input type="hidden" name={`cantidad_series${sufijoDe(pos)}`} value={ej.seriesProgramadas} />
                  <input type="hidden" name={`cantidad_series_registradas${sufijoDe(pos)}`} value={cantidadesSeries[pos]} />
                  <input type="hidden" name={`permitir_series_extra${sufijoDe(pos)}`} value="true" />
                </span>
              ))}

              {!modoEnfocado && (
                <div className="encabezado-pasos-grupo mb-1 flex items-center justify-between gap-2">
                  <p className="text-micro font-bold tracking-wide text-vip">SERIES INTERCALADAS</p>
                  {pasoQueToca && (
                    <p className="text-micro text-text-secondary">
                      Ahora: {LETRAS[pasoQueToca.pos]} · serie {pasoQueToca.numero}
                    </p>
                  )}
                </div>
              )}

              {!modoEnfocado && (
                <div className="selector-series-foco" aria-label="Seleccionar paso de la técnica">
                  {pasos.map((paso, indice) => (
                    <button
                      key={`${paso.pos}-${paso.numero}`}
                      type="button"
                      onClick={() => setIndicePasoVisible(indice)}
                      data-estado={
                        seriesHechas[paso.pos].has(paso.numero)
                          ? "completa"
                          : indice === indicePasoVisible
                            ? "actual"
                            : "pendiente"
                      }
                      aria-label={`Ver ${LETRAS[paso.pos]}, serie ${paso.numero}`}
                      aria-current={indice === indicePasoVisible ? "step" : undefined}
                    >
                      <span />
                    </button>
                  ))}
                </div>
              )}

              {/* Rediseño pedido por Alejandro (captura de referencia): en vez del
                  paso-a-paso intercalado (1A, 1B, 2A, 2B...) se ven los ejercicios
                  de LA RONDA ACTUAL apilados en tarjetas — el ya hecho arriba con
                  su check, el que toca ahora abierto y editable, los que faltan
                  colapsados. Reusa `FilaSerie` tal cual (descanso, exceso, aviso,
                  Impulso VIP): nada de esa lógica se reimplementa acá, solo cambia
                  el envoltorio visual. */}
              {modoEnfocado && (
                <div className="ronda-grupo-foco">
                  <p className="ronda-grupo-foco-titulo">
                    Ronda {rondaActualNumero} de {maxRondas}
                  </p>
                  <div className="ronda-grupo-foco-info">
                    <Info size={16} aria-hidden />
                    <p>
                      <strong>Haz los {n} ejercicios seguidos.</strong>
                      <span>
                        {" "}Descansa al terminar el {LETRAS[n - 1]} y repite la ronda.
                      </span>
                    </p>
                  </div>

                  {pasosDeRondaActual.map((paso) => {
                    const ej = ejercicios[paso.pos];
                    const hecho = seriesHechas[paso.pos].has(paso.numero);
                    const esActual = pasoQueToca?.pos === paso.pos && pasoQueToca?.numero === paso.numero;
                    const colapsadoManual = colapsadosManual.has(paso.pos);
                    const abierto = esActual || (hecho && !colapsadoManual);
                    return (
                      <div
                        key={`${paso.pos}-${paso.numero}-${montado ? "local" : "server"}`}
                        className="tarjeta-paso-grupo-foco"
                        data-estado={hecho ? "completa" : esActual ? "actual" : "pendiente"}
                      >
                        <div className="cabecera-tarjeta-paso-grupo">
                          <span className="numero-paso-grupo">
                            {hecho ? <Check size={15} strokeWidth={3} /> : paso.pos + 1}
                          </span>
                          <CuadroFotoReferencia
                            ilustracionSlug={ej.ilustracionSlug}
                            fotoMiniaturaUrl={ej.fotoMiniaturaUrl}
                            fotoCompletaUrl={ej.fotoCompletaUrl}
                            videoUrl={ej.videoUrl}
                            videoCloudflareUid={ej.videoCloudflareUid}
                            videoCloudflareEstado={ej.videoCloudflareEstado}
                            videoCloudflareMiniaturaUrl={ej.videoCloudflareMiniaturaUrl}
                            nombre={ej.nombre}
                            sesionEjercicioId={ej.sesionEjercicioId}
                            ejercicioId={ej.ejercicioId}
                            fotoPanoramaX={ej.fotoPanoramaX}
                            fotoPanoramaY={ej.fotoPanoramaY}
                            fotoCuadradaX={ej.fotoCuadradaX}
                            fotoCuadradaY={ej.fotoCuadradaY}
                            compacto
                            tamanoCompacto={52}
                          />
                          <span className="info-paso-grupo">
                            <strong>{ej.nombre}</strong>
                            <small>
                              {ej.grupoMuscular ? `${ETIQUETAS_GRUPO_MUSCULAR[ej.grupoMuscular]} · ` : ""}
                              {ej.seriesProgramadas}× {ej.repsProgramadas}
                            </small>
                          </span>
                          {hecho && (
                            <button
                              type="button"
                              className="boton-chevron-paso-grupo"
                              onClick={() => {
                                setColapsadosManual((actuales) => {
                                  const copia = new Set(actuales);
                                  if (copia.has(paso.pos)) copia.delete(paso.pos);
                                  else copia.add(paso.pos);
                                  return copia;
                                });
                              }}
                              aria-expanded={abierto}
                              aria-label={abierto ? "Ocultar detalle" : "Mostrar detalle"}
                            >
                              <ChevronDown
                                size={16}
                                className="chevron-paso-grupo"
                                style={{ transform: abierto ? "rotate(180deg)" : undefined }}
                              />
                            </button>
                          )}
                        </div>
                        {abierto && (
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
                              inicial={serieInicial(paso.pos, paso.numero)}
                              repsObjetivo={objetivoRepsPorPos[paso.pos]}
                              pesoSugerido={pesoSugeridoPorPos[paso.pos]}
                              esTiempo={esTiempoPorPos[paso.pos]}
                              descansoSegundos={ej.descansoSegundos}
                              temporizadorDescanso={ej.temporizadorDescanso}
                              soloLectura={soloLectura}
                              sesionId={sesionId}
                              sesionEjercicioId={ej.sesionEjercicioId}
                              activo={serieActiva?.pos === paso.pos && serieActiva?.numero === paso.numero}
                              esLaQueToca={esActual}
                              onIniciar={alIniciar(paso.pos)}
                              onCicloCompleto={alCompletarCiclo(paso.pos)}
                              onCicloDeshecho={alDeshacerCiclo(paso.pos)}
                              onGuardar={guardarAhora}
                              colorGrupoTecnica={grupoTecnica?.color}
                              modoDestacado={esActual}
                              // Solo el ÚLTIMO ejercicio del grupo descansa de verdad — A y B
                              // (o A y B de una triserie) encadenan directo al siguiente, sin
                              // cronómetro, sea cual sea la ronda. Pedido de Alejandro: "primer
                              // ejercicio avanza, segundo avanza, tercero descansa".
                              saltaDescanso={paso.pos !== n - 1}
                              textoAlSaltarDescanso="Avanza"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {!modoEnfocado && pasos.map((paso, indicePaso) => {
                const ej = ejercicios[paso.pos];
                return (
                  <div
                    key={`${paso.pos}-${paso.numero}-${montado ? "local" : "server"}`}
                    data-visible={indicePaso === indicePasoVisible ? "true" : "false"}
                  >
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
                        inicial={serieInicial(paso.pos, paso.numero)}
                        repsObjetivo={objetivoRepsPorPos[paso.pos]}
                        pesoSugerido={pesoSugeridoPorPos[paso.pos]}
                        esTiempo={esTiempoPorPos[paso.pos]}
                        descansoSegundos={ej.descansoSegundos}
                        temporizadorDescanso={ej.temporizadorDescanso}
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
                        modoDestacado={indicePaso === indicePasoVisible}
                      />
                    </div>
                  </div>
                );
              })}

              {modoEnfocado && (
                <div className="acciones-series-extra">
                  <button
                    type="button"
                    onClick={() => {
                      if (!programadasGrupoHechas) return;
                      if (cantidadesSeries.some((cantidad, pos) => cantidad >= ejercicios[pos].seriesProgramadas + 3)) return;
                      setCantidadesSeries((actuales) => actuales.map((cantidad) => cantidad + 1));
                      setIndicePasoVisible(pasos.length);
                    }}
                    disabled={!programadasGrupoHechas || cantidadesSeries.some((cantidad, pos) => cantidad >= ejercicios[pos].seriesProgramadas + 3)}
                    title={!programadasGrupoHechas ? "Completa primero todas las rondas programadas" : undefined}
                  >
                    + Añadir ronda extra
                  </button>
                  {cantidadesSeries.some((cantidad, pos) => cantidad > ejercicios[pos].seriesProgramadas) &&
                    ejercicios.every((_, pos) => !seriesHechas[pos].has(cantidadesSeries[pos])) && (
                      <button
                        type="button"
                        onClick={() => {
                          setCantidadesSeries((actuales) => actuales.map((cantidad, pos) =>
                            Math.max(ejercicios[pos].seriesProgramadas, cantidad - 1)
                          ));
                          setIndicePasoVisible((actual) => Math.max(0, Math.min(actual, pasos.length - n - 1)));
                          window.requestAnimationFrame(() => formRef.current?.requestSubmit());
                        }}
                      >
                        Quitar ronda
                      </button>
                    )}
                </div>
              )}

              {!completoTodo &&
                (confirmandoIncompleto ? (
                  confirmandoDeVerdad ? (
                    <div className="panel-cerrar-incompleto space-y-2">
                      <p className="text-caption font-semibold text-warning">
                        ¿De verdad hiciste esta {etiquetaGrupo.toLowerCase()} completa?
                      </p>
                      <p className="text-micro text-text-secondary">
                        Van a quedar marcadas como hechas sin kilos ni repeticiones exactas, pero
                        cuentan entero para tu progreso. Confirmá solo si de verdad las hiciste.
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmandoDeVerdad(false)}
                          className="text-caption h-10 flex-1 rounded-[12px] border border-border font-semibold text-text"
                        >
                          No, volver
                        </button>
                        <button
                          type="button"
                          onClick={marcarGrupoListo}
                          className="text-caption h-10 flex-1 rounded-[12px] border border-vip/60 font-bold text-vip"
                        >
                          Sí, las hice
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="panel-cerrar-incompleto space-y-2">
                      <p className="text-caption font-semibold text-warning">
                        Te faltan {seriesFaltantes}{" "}
                        {seriesFaltantes === 1 ? "serie" : "series"} de esta {etiquetaGrupo.toLowerCase()}
                      </p>
                      <p className="text-micro text-text-secondary">
                        Si la cierras ahora, esas series quedan marcadas como hechas y sin kilos ni
                        repeticiones registradas. Tu entrenador lo va a ver así.
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmandoIncompleto(false);
                            setConfirmandoDeVerdad(false);
                          }}
                          className="text-caption h-10 flex-1 rounded-[12px] border border-border font-semibold text-text"
                        >
                          Sigo entrenando
                        </button>
                        <button
                          type="button"
                          onClick={marcarGrupoListo}
                          className="text-caption h-10 flex-1 rounded-[12px] border border-border font-semibold text-text-secondary"
                        >
                          Cerrar igual
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setConfirmandoDeVerdad(true)}
                        className="text-micro block w-full text-center text-text-secondary underline decoration-dotted underline-offset-2"
                      >
                        Ya la hice, solo olvidé anotarla
                      </button>
                    </div>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={marcarGrupoListo}
                    className="boton-completar-ejercicio flex h-11 w-full items-center justify-center gap-2 rounded-[14px] font-bold"
                  >
                    <Check size={14} strokeWidth={3.5} /> Completar y guardar {etiquetaGrupo.toLowerCase()}
                  </button>
                ))}

              {ejercicios.map((ej, pos) => (
                <div key={ej.sesionEjercicioId}>
                  <SelectorDificultad
                    valorInicial={ej.dificultadPercibida}
                    disabled={seriesHechas[pos].size < ej.seriesProgramadas}
                    onGuardar={guardarAhora}
                    forzarModal={pos === encuestaPendiente}
                    onResponder={() => alResponderEncuesta(pos)}
                    nombreCampo={`dificultad_ejercicio${sufijoDe(pos)}`}
                  />
                  <label className="radius-control mt-1 flex items-center gap-2 border border-border bg-surface-2 px-2.5 py-1.5">
                    <NotebookPen size={14} className="shrink-0 text-text-tertiary" />
                    <input
                      name={`nota_ejercicio${sufijoDe(pos)}`}
                      type="text"
                      placeholder={`Nota de ${LETRAS[pos]} (opcional)`}
                      defaultValue={borradoresLocales[pos]?.nota ?? ej.notaEjercicio ?? ""}
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
