"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownUp,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Clock3,
  Dumbbell,
  FastForward,
  History,
  Info,
  Lightbulb,
  ListVideo,
  Minus,
  Pause,
  Play,
  Plus,
  Repeat2,
  Settings,
  StickyNote,
  X,
} from "lucide-react";
import styles from "./SesionActivaV2.module.css";

type SerieRegistrada = {
  reps: string;
  peso: string;
  completada: boolean;
};

type EjercicioSesion = {
  id: string;
  codigo: string;
  nombre: string;
  repeticiones: number[];
  descanso: number;
  foto: string;
  equipo: string;
  grupo: string;
  tecnica?: string;
};

type DescansoActivo = {
  ejercicioId: string;
  serieIndice: number;
  segundos: number;
};

type PanelSesion = "consejo" | "historial" | "sustituir" | "reordenar" | "notas" | "ajustes" | "informacion" | null;
type VistaSesion = "lista" | "video" | "descanso";

const EJERCICIOS: EjercicioSesion[] = [
  { id: "sentadilla-smith", codigo: "A", nombre: "Sentadilla Smith", repeticiones: [10, 10, 10, 10], descanso: 60, foto: "/v2/piernas.webp", equipo: "Máquina Smith", grupo: "Cuádriceps · glúteos" },
  { id: "peso-muerto-rumano", codigo: "B1", nombre: "Peso muerto rumano", repeticiones: [8, 8, 8], descanso: 90, foto: "/v2/espalda.webp", equipo: "Barra", grupo: "Femoral · glúteos", tecnica: "Superserie" },
  { id: "prensa-inclinada", codigo: "B2", nombre: "Prensa inclinada", repeticiones: [12, 12, 12], descanso: 120, foto: "/v2/piernas.webp", equipo: "Prensa 45°", grupo: "Cuádriceps", tecnica: "Superserie" },
  { id: "extension-cuadriceps", codigo: "C", nombre: "Extensión de cuádriceps", repeticiones: [15, 15, 15], descanso: 75, foto: "/v2/hombros.webp", equipo: "Máquina de extensión", grupo: "Cuádriceps" },
];

function crearRegistroInicial() {
  return Object.fromEntries(EJERCICIOS.map((ejercicio) => [
    ejercicio.id,
    ejercicio.repeticiones.map((reps) => ({ reps: String(reps), peso: "", completada: false })),
  ])) as Record<string, SerieRegistrada[]>;
}

function formatearTiempo(total: number) {
  const minutos = Math.floor(total / 60).toString().padStart(2, "0");
  const segundos = (total % 60).toString().padStart(2, "0");
  return `${minutos}:${segundos}`;
}

function limitar(valor: number, minimo: number, maximo: number) {
  return Math.min(Math.max(valor, minimo), maximo);
}

export function SesionActivaV2() {
  const [segundosSesion, setSegundosSesion] = useState(0);
  const [pausada, setPausada] = useState(false);
  const [registro, setRegistro] = useState(crearRegistroInicial);
  const [ejercicioActivoId, setEjercicioActivoId] = useState(EJERCICIOS[0].id);
  const [ejercicioExpandidoId, setEjercicioExpandidoId] = useState<string | null>(EJERCICIOS[0].id);
  const [descanso, setDescanso] = useState<DescansoActivo | null>(null);
  const [vista, setVista] = useState<VistaSesion>("lista");
  const [controlesVideoVisibles, setControlesVideoVisibles] = useState(true);
  const [panel, setPanel] = useState<PanelSesion>(null);
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [confirmarSalida, setConfirmarSalida] = useState(false);
  const [registrada, setRegistrada] = useState(false);
  const gestoInicioX = useRef<number | null>(null);

  const totalSeries = useMemo(() => EJERCICIOS.reduce((total, ejercicio) => total + ejercicio.repeticiones.length, 0), []);
  const seriesCompletadas = useMemo(() => Object.values(registro).reduce(
    (total, series) => total + series.filter((serie) => serie.completada).length,
    0,
  ), [registro]);
  const repeticionesCompletadas = useMemo(() => Object.values(registro).reduce(
    (total, series) => total + series.reduce(
      (subtotal, serie) => subtotal + (serie.completada ? Number(serie.reps || 0) : 0),
      0,
    ),
    0,
  ), [registro]);
  const ejercicioActivoIndice = EJERCICIOS.findIndex((ejercicio) => ejercicio.id === ejercicioActivoId);
  const ejercicioActivo = EJERCICIOS[ejercicioActivoIndice] ?? EJERCICIOS[0];
  const progreso = totalSeries === 0 ? 0 : (seriesCompletadas / totalSeries) * 100;

  useEffect(() => {
    if (pausada || registrada) return;
    const intervalo = window.setInterval(() => setSegundosSesion((valor) => valor + 1), 1000);
    return () => window.clearInterval(intervalo);
  }, [pausada, registrada]);

  useEffect(() => {
    if (pausada || descanso === null || descanso.segundos <= 0) return;
    const intervalo = window.setInterval(() => {
      setDescanso((actual) => actual === null ? null : { ...actual, segundos: Math.max(0, actual.segundos - 1) });
    }, 1000);
    return () => window.clearInterval(intervalo);
  }, [descanso, pausada]);

  useEffect(() => {
    if (vista !== "video" || !controlesVideoVisibles) return;
    const temporizador = window.setTimeout(() => setControlesVideoVisibles(false), 2400);
    return () => window.clearTimeout(temporizador);
  }, [controlesVideoVisibles, ejercicioActivoId, vista]);

  const actualizarSerie = (ejercicioId: string, indice: number, campo: "reps" | "peso", valor: string) => {
    setRegistro((actual) => ({
      ...actual,
      [ejercicioId]: actual[ejercicioId].map((serie, serieIndice) => serieIndice === indice ? { ...serie, [campo]: valor } : serie),
    }));
  };

  const alternarSerie = (ejercicio: EjercicioSesion, serieIndice: number) => {
    const estabaCompletada = registro[ejercicio.id][serieIndice].completada;
    setRegistro((actual) => ({
      ...actual,
      [ejercicio.id]: actual[ejercicio.id].map((serie, indice) => indice === serieIndice ? { ...serie, completada: !serie.completada } : serie),
    }));
    setEjercicioActivoId(ejercicio.id);

    if (estabaCompletada) {
      setDescanso((actual) => actual?.ejercicioId === ejercicio.id && actual.serieIndice === serieIndice ? null : actual);
      return;
    }
    setDescanso({ ejercicioId: ejercicio.id, serieIndice, segundos: ejercicio.descanso });

    const esUltimaSerie = ejercicio.id === EJERCICIOS[EJERCICIOS.length - 1].id
      && serieIndice === ejercicio.repeticiones.length - 1;
    if (esUltimaSerie && seriesCompletadas + 1 === totalSeries) setConfirmarSalida(true);
  };

  const ajustarDescanso = (cantidad: number) => {
    setDescanso((actual) => actual === null ? null : { ...actual, segundos: limitar(actual.segundos + cantidad, 0, 15 * 60) });
  };

  const moverEjercicio = (direccion: -1 | 1) => {
    const siguiente = limitar(ejercicioActivoIndice + direccion, 0, EJERCICIOS.length - 1);
    setEjercicioActivoId(EJERCICIOS[siguiente].id);
    setEjercicioExpandidoId(EJERCICIOS[siguiente].id);
    setControlesVideoVisibles(true);
  };

  const iniciarGesto = (clientX: number) => {
    gestoInicioX.current = clientX;
    setControlesVideoVisibles(true);
  };

  const terminarGesto = (clientX: number) => {
    if (gestoInicioX.current === null) return;
    const distancia = clientX - gestoInicioX.current;
    gestoInicioX.current = null;
    if (Math.abs(distancia) < 44) return;
    moverEjercicio(distancia < 0 ? 1 : -1);
    setVista("video");
  };

  if (registrada) {
    return (
      <section className={styles.summaryPage}>
        <span className={styles.summaryEyebrow}>ENTRENAMIENTO REGISTRADO</span>
        <h1>Día de piernas</h1>
        <p>18 de agosto de 2026 · {formatearTiempo(segundosSesion)}</p>
        <div className={styles.summaryMetrics}>
          <span><strong>{EJERCICIOS.length}</strong>Ejercicios</span>
          <span><strong>{seriesCompletadas}</strong>Series</span>
          <span><strong>{repeticionesCompletadas}</strong>Repeticiones</span>
        </div>
        <div className={styles.summaryList}>
          {EJERCICIOS.map((ejercicio) => (
            <article key={ejercicio.id}>
              <Image src={ejercicio.foto} alt="" width={48} height={62} />
              <div><small>SERIE {ejercicio.codigo}</small><strong>{ejercicio.nombre}</strong><p>{registro[ejercicio.id].filter((serie) => serie.completada).length}/{ejercicio.repeticiones.length} series registradas</p></div>
            </article>
          ))}
        </div>
        <label className={styles.notesField}><span>Notas de la sesión</span><textarea placeholder="Escribe cómo te sentiste o qué quieres recordar…" /></label>
        <div className={styles.summaryActions}><button type="button">Compartir</button><Link href="/portal-v2/entrenamiento">Listo</Link></div>
      </section>
    );
  }

  return (
    <div className={styles.sessionPage}>
      <header className={styles.topbar}>
        <div className={styles.sessionStatus}><span>{formatearTiempo(segundosSesion)}</span><i aria-hidden="true" /><strong>Serie {Math.min(seriesCompletadas + 1, totalSeries)}/{totalSeries}</strong></div>
        <button type="button" className={styles.endButton} onClick={() => setConfirmarSalida(true)}>Terminar</button>
        <div className={styles.progressTrack} aria-label={`${Math.round(progreso)}% completado`}><i style={{ width: `${progreso}%` }} /></div>
      </header>

      {vista === "descanso" ? (
        <section
          className={styles.restImmersive}
          aria-live="polite"
          onPointerDown={(evento) => iniciarGesto(evento.clientX)}
          onPointerUp={(evento) => terminarGesto(evento.clientX)}
        >
          {ejercicioActivoIndice > 0 ? <button type="button" className={`${styles.immersiveArrow} ${styles.immersiveArrowLeft}`} onClick={() => { moverEjercicio(-1); setVista("video"); }} aria-label="Ver ejercicio anterior"><ChevronLeft size={25} /></button> : null}
          {ejercicioActivoIndice < EJERCICIOS.length - 1 ? <button type="button" className={`${styles.immersiveArrow} ${styles.immersiveArrowRight}`} onClick={() => { moverEjercicio(1); setVista("video"); }} aria-label="Ver ejercicio siguiente"><ChevronRight size={25} /></button> : null}
          <div className={styles.restCenter}>
            <span>Descanso</span><strong>{descanso?.segundos ?? 0}</strong><small>segundos</small>
            <div className={styles.restAdjustments}><button type="button" onClick={() => ajustarDescanso(-15)}><Minus size={13} />15 s</button><button type="button" onClick={() => ajustarDescanso(15)}><Plus size={13} />15 s</button></div>
          </div>
          <div className={styles.upNext}><span>SIGUE</span><strong>{ejercicioActivo.nombre}</strong><small>{ejercicioActivo.repeticiones[0]} repeticiones</small></div>
          <button type="button" className={styles.skipRest} onClick={() => setDescanso((actual) => actual === null ? null : { ...actual, segundos: 0 })}><FastForward size={15} /> Saltar descanso</button>
          <button type="button" className={styles.switchView} onClick={() => setVista("lista")}><ListVideo size={14} /> Vista de lista</button>
        </section>
      ) : vista === "video" ? (
        <section className={styles.videoMode}>
          <div
            className={styles.videoStage}
            onPointerDown={(evento) => iniciarGesto(evento.clientX)}
            onPointerUp={(evento) => terminarGesto(evento.clientX)}
          >
            <Image src={ejercicioActivo.foto} alt={`Demostración de ${ejercicioActivo.nombre}`} fill priority sizes="(max-width: 460px) 100vw, 460px" />
            <div className={styles.videoShade} />
            <button type="button" className={styles.videoPlay} aria-label="Reproducir demostración"><Play size={23} fill="currentColor" /></button>
            {controlesVideoVisibles && ejercicioActivoIndice > 0 ? <button type="button" className={`${styles.immersiveArrow} ${styles.immersiveArrowLeft}`} onClick={() => moverEjercicio(-1)} aria-label="Ver ejercicio anterior"><ChevronLeft size={25} /></button> : null}
            {controlesVideoVisibles && ejercicioActivoIndice < EJERCICIOS.length - 1 ? <button type="button" className={`${styles.immersiveArrow} ${styles.immersiveArrowRight}`} onClick={() => moverEjercicio(1)} aria-label="Ver ejercicio siguiente"><ChevronRight size={25} /></button> : null}
            <span className={styles.videoSpeed}>1× velocidad</span>
            <div className={styles.videoIdentity}><small>SERIE {ejercicioActivo.codigo}</small><h1>{ejercicioActivo.nombre}</h1><p>{ejercicioActivo.equipo}</p></div>
          </div>
          <div className={styles.videoActions}>
            <button type="button" onClick={() => setPanel("consejo")}><Lightbulb size={13} />Consejo</button><button type="button" onClick={() => setPanel("historial")}><History size={13} />Historial</button><button type="button" onClick={() => setPanel("sustituir")}><Repeat2 size={13} />Sustituir</button><button type="button" onClick={() => setPanel("notas")}><StickyNote size={13} />Notas</button><button type="button" onClick={() => setPanel("reordenar")}><ArrowDownUp size={13} />Reordenar</button><button type="button" onClick={() => setPanel("informacion")}><Info size={13} />Información</button>
          </div>
          <div className={styles.videoSetStrip}>
            <span><b>Serie</b><em>1 TRB</em></span><span><b>Reps</b><strong>{registro[ejercicioActivo.id][0].reps}</strong></span><span><b>Peso</b><strong>{registro[ejercicioActivo.id][0].peso || "— kg"}</strong></span>
            <button
              type="button"
              onClick={() => alternarSerie(ejercicioActivo, 0)}
              aria-label={`${registro[ejercicioActivo.id][0].completada ? "Desmarcar" : "Registrar"} primera serie`}
              aria-pressed={registro[ejercicioActivo.id][0].completada}
            >
              {registro[ejercicioActivo.id][0].completada ? <Check size={16} strokeWidth={3} /> : <CircleCheck size={19} />}
            </button>
          </div>
          <button type="button" className={styles.switchView} onClick={() => setVista("lista")}><ListVideo size={14} /> Vista de lista</button>
        </section>
      ) : (
        <main className={styles.workoutList}>
          {EJERCICIOS.map((ejercicio) => {
            const activa = ejercicio.id === ejercicioExpandidoId;
            if (!activa) {
              return (
                <button type="button" className={styles.compactExercise} key={ejercicio.id} onClick={() => { setEjercicioActivoId(ejercicio.id); setEjercicioExpandidoId(ejercicio.id); }}>
                  <span className={styles.compactCode}>{ejercicio.codigo} SERIE</span><span className={styles.compactThumb}><Image src={ejercicio.foto} alt="" fill sizes="68px" /><i><Play size={12} fill="currentColor" /></i></span><span className={styles.compactCopy}><strong>{ejercicio.nombre}</strong><small>Reps: {ejercicio.repeticiones.join(" · ")}</small></span>{ejercicio.tecnica ? <em>{ejercicio.tecnica}</em> : null}
                </button>
              );
            }
            return (
              <section className={styles.activeExercise} key={ejercicio.id}>
                <button type="button" className={styles.seriesLabel} onClick={() => setEjercicioExpandidoId(null)} aria-label={`Contraer ${ejercicio.nombre}`}>SERIE {ejercicio.codigo}<i aria-hidden="true">›››</i>{ejercicio.tecnica ? <em>{ejercicio.tecnica}</em> : null}</button>
                <div className={styles.exerciseHeading}>
                  <button type="button" className={styles.exerciseMedia} onClick={() => setVista("video")} aria-label={`Ver demostración de ${ejercicio.nombre}`}><Image src={ejercicio.foto} alt="" fill sizes="70px" priority={ejercicio.codigo === "A"} /><i><Play size={17} fill="currentColor" /></i></button>
                  <div><h1>{ejercicio.nombre}</h1><p><b>Reps:</b> {ejercicio.repeticiones.join("  ·  ")}</p></div>
                </div>
                <div className={styles.actionChips}><button type="button" onClick={() => setPanel("consejo")}><Lightbulb size={14} />Consejo</button><button type="button" onClick={() => setPanel("historial")}><History size={14} />Historial</button><button type="button" onClick={() => setPanel("sustituir")}><Repeat2 size={14} />Sustituir</button><button type="button" onClick={() => setPanel("notas")}><StickyNote size={14} />Notas</button><button type="button" onClick={() => setPanel("reordenar")}><ArrowDownUp size={14} />Reordenar series</button></div>
                <div className={styles.setTable}>
                  <div className={styles.setHead}><span>Serie</span><span>Reps</span><span>Peso</span><span>Descanso</span><span>Listo</span></div>
                  {registro[ejercicio.id].map((serie, serieIndice) => {
                    const descansoDeEstaSerie = descanso?.ejercicioId === ejercicio.id && descanso.serieIndice === serieIndice;
                    return (
                      <div className={styles.setGroup} key={`${ejercicio.id}-${serieIndice}`}>
                        <div className={`${styles.setRow} ${serie.completada ? styles.setRowDone : ""} ${descansoDeEstaSerie ? styles.setRowActive : ""}`}>
                          <span className={styles.setNumber}><b>{serieIndice + 1}</b><em>TRB</em></span>
                          <input aria-label={`Repeticiones, serie ${serieIndice + 1}`} inputMode="numeric" value={serie.reps} onChange={(evento) => actualizarSerie(ejercicio.id, serieIndice, "reps", evento.target.value)} />
                          <input aria-label={`Peso, serie ${serieIndice + 1}`} inputMode="decimal" value={serie.peso} placeholder="— kg" onChange={(evento) => actualizarSerie(ejercicio.id, serieIndice, "peso", evento.target.value)} />
                          <span className={styles.restValue}>{ejercicio.descanso} s</span>
                          <button type="button" className={styles.checkButton} onClick={() => alternarSerie(ejercicio, serieIndice)} aria-label={`${serie.completada ? "Desmarcar" : "Registrar"} serie ${serieIndice + 1}`} aria-pressed={serie.completada}>{serie.completada ? <Check size={16} strokeWidth={3} /> : <CircleCheck size={19} />}</button>
                        </div>
                        {descansoDeEstaSerie ? <div className={styles.inlineRest} aria-live="polite"><button type="button" onClick={() => ajustarDescanso(-15)}>−15 s</button><button type="button" className={styles.inlineRestTime} onClick={() => setVista("descanso")}>Descanso {descanso.segundos} s</button><button type="button" onClick={() => ajustarDescanso(15)}>+15 s</button></div> : null}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
          <button type="button" className={styles.videoViewButton} onClick={() => setVista("video")}><ListVideo size={14} /> Vista de video</button>
        </main>
      )}

      <nav className={styles.sessionControls} aria-label="Controles de la sesión">
        <button type="button" aria-label="Ajustes" onClick={() => setPanel("ajustes")}><Settings size={20} /></button>
        <button type="button" aria-label="Ejercicio anterior" onClick={() => moverEjercicio(-1)} disabled={ejercicioActivoIndice === 0}><ChevronLeft size={23} strokeWidth={2.8} /></button>
        <button type="button" aria-label={pausada ? "Reanudar sesión" : "Pausar sesión"} onClick={() => setPausada((valor) => !valor)}>{pausada ? <Play size={20} fill="currentColor" /> : <Pause size={20} fill="currentColor" />}</button>
        <button type="button" aria-label="Ejercicio siguiente" onClick={() => moverEjercicio(1)} disabled={ejercicioActivoIndice === EJERCICIOS.length - 1}><ChevronRight size={23} strokeWidth={2.8} /></button>
        <button type="button" aria-label="Abrir temporizador" onClick={() => setVista("descanso")} disabled={descanso === null}><Clock3 size={19} /></button>
      </nav>

      {panel !== null ? (
        <PanelAuxiliar
          tipo={panel}
          ejercicio={ejercicioActivo}
          notaInicial={notas[ejercicioActivo.id] ?? ""}
          guardarNota={(nota) => setNotas((actuales) => ({ ...actuales, [ejercicioActivo.id]: nota }))}
          cerrar={() => setPanel(null)}
        />
      ) : null}
      {confirmarSalida ? (
        <div className={styles.sheetBackdrop} role="presentation" onClick={() => setConfirmarSalida(false)}>
          <section className={styles.finishSheet} role="dialog" aria-modal="true" aria-label="Finalizar entrenamiento" onClick={(evento) => evento.stopPropagation()}>
            <button type="button" className={styles.closeButton} onClick={() => setConfirmarSalida(false)} aria-label="Cerrar"><X size={18} /></button>
            <h2>¿Finalizar y registrar?</h2><p>Registra tu entrenamiento para guardar el progreso. Si sales y descartas, esta sesión no quedará registrada.</p>
            <div className={styles.finishMetrics}><span><strong>{formatearTiempo(segundosSesion)}</strong>Tiempo total</span><span><strong>{seriesCompletadas}</strong>Series registradas</span></div>
            <div className={styles.finishActions}><Link href="/portal-v2/entrenamiento">Salir y descartar</Link><button type="button" onClick={() => { setConfirmarSalida(false); setRegistrada(true); }}>Registrar entrenamiento</button></div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function PanelAuxiliar({
  tipo,
  ejercicio,
  notaInicial,
  guardarNota,
  cerrar,
}: {
  tipo: Exclude<PanelSesion, null>;
  ejercicio: EjercicioSesion;
  notaInicial: string;
  guardarNota: (nota: string) => void;
  cerrar: () => void;
}) {
  const [notaBorrador, setNotaBorrador] = useState(notaInicial);
  const titulos = { consejo: "Consejo del entrenador", historial: "Historial del ejercicio", sustituir: "Sustituir ejercicio", reordenar: "Reordenar series", notas: "Notas del ejercicio", ajustes: "Ajustes de la sesión", informacion: "Información del ejercicio" };
  return (
    <div className={styles.sheetBackdrop} role="presentation" onClick={cerrar}>
      <section className={styles.auxSheet} role="dialog" aria-modal="true" aria-label={titulos[tipo]} onClick={(evento) => evento.stopPropagation()}>
        <div className={styles.sheetHandle} />
        <header><div><small>SERIE {ejercicio.codigo}</small><h2>{titulos[tipo]}</h2></div><button type="button" onClick={cerrar} aria-label="Cerrar"><X size={17} /></button></header>
        {tipo === "consejo" ? <p className={styles.sheetCopy}>Mantén el abdomen firme, controla el descenso y conserva la trayectoria estable durante toda la repetición.</p> : null}
        {tipo === "historial" ? <div className={styles.historyGrid}><span>Fecha</span><span>Reps</span><span>Peso</span><strong>11 ago.</strong><strong>10 · 10 · 10</strong><strong>42 kg</strong><strong>4 ago.</strong><strong>12 · 10 · 10</strong><strong>40 kg</strong></div> : null}
        {tipo === "sustituir" ? <div className={styles.swapList}><button type="button"><Dumbbell size={17} /><span><strong>Sentadilla goblet</strong><small>Mismo patrón de movimiento</small></span><Plus size={17} /></button><button type="button"><Dumbbell size={17} /><span><strong>Prensa horizontal</strong><small>Alternativa para cuádriceps</small></span><Plus size={17} /></button></div> : null}
        {tipo === "notas" ? <label className={styles.exerciseNotes}><span>Nota personal</span><textarea value={notaBorrador} onChange={(evento) => setNotaBorrador(evento.target.value)} placeholder="Escribe una observación para este ejercicio…" /><button type="button" onClick={() => { guardarNota(notaBorrador); cerrar(); }}>Guardar nota</button></label> : null}
        {tipo === "reordenar" ? <div className={styles.reorderPreview}><span><b>1</b> Serie de trabajo <ArrowDownUp size={15} /></span><span><b>2</b> Serie de trabajo <ArrowDownUp size={15} /></span><span><b>3</b> Serie de trabajo <ArrowDownUp size={15} /></span><button type="button" onClick={cerrar}>Guardar orden</button></div> : null}
        {tipo === "ajustes" ? <div className={styles.settingRows}><span>Temporizador automático <b>Activo</b></span><span>Sonido al terminar <b>Activo</b></span><span>Unidad de peso <b>kg</b></span></div> : null}
        {tipo === "informacion" ? <div className={styles.infoGrid}><span><small>Equipo</small><strong>{ejercicio.equipo}</strong></span><span><small>Objetivo</small><strong>{ejercicio.grupo}</strong></span><span><small>Descanso</small><strong>{ejercicio.descanso} segundos</strong></span></div> : null}
      </section>
    </div>
  );
}
