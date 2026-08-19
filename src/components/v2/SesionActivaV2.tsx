"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownUp,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
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
  Zap,
} from "lucide-react";
import { avisarFinDescansoV2, cortarAviso, prepararAviso } from "@/lib/entrenamiento/aviso";
import { planificarBloqueEncadenado, type TecnicaEncadenadaSlug } from "@/lib/entrenamiento/motor-tecnicas-sesion";
import {
  seleccionarMomentosAlejandro,
  type MomentoSesionAlejandro,
} from "@/lib/impulso-vip/alejandro-sesion";
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
  bloqueId?: string;
  tecnicaSlug?: TecnicaEncadenadaSlug;
};

type DescansoActivo = {
  ejercicioId: string;
  serieIndice: number;
  segundos: number;
  tipo: "automatico" | "manual";
  vistaRetorno: Exclude<VistaSesion, "descanso">;
};

type PanelSesion = "consejo" | "historial" | "sustituir" | "reordenar" | "notas" | "ajustes" | "informacion" | "impulso" | null;
type VistaSesion = "lista" | "video" | "descanso";
type UnidadPeso = "kg" | "lb";

const EJERCICIOS: EjercicioSesion[] = [
  { id: "sentadilla-smith", codigo: "A", nombre: "Sentadilla Smith", repeticiones: [10, 10, 10, 10], descanso: 60, foto: "/v2/piernas.webp", equipo: "Máquina Smith", grupo: "Cuádriceps · glúteos" },
  { id: "peso-muerto-rumano", codigo: "B1", nombre: "Peso muerto rumano", repeticiones: [8, 8, 8], descanso: 0, foto: "/v2/espalda.webp", equipo: "Barra", grupo: "Femoral · glúteos", tecnica: "Superserie", bloqueId: "superserie-b", tecnicaSlug: "superserie" },
  { id: "prensa-inclinada", codigo: "B2", nombre: "Prensa inclinada", repeticiones: [12, 12, 12], descanso: 90, foto: "/v2/piernas.webp", equipo: "Prensa 45°", grupo: "Cuádriceps", tecnica: "Superserie", bloqueId: "superserie-b", tecnicaSlug: "superserie" },
  { id: "extension-cuadriceps", codigo: "C", nombre: "Extensión de cuádriceps", repeticiones: [15, 15, 15], descanso: 75, foto: "/v2/hombros.webp", equipo: "Máquina de extensión", grupo: "Cuádriceps" },
];

type PosicionSerie = { ejercicioIndice: number; serieIndice: number };

function crearOrdenEjecucion(): PosicionSerie[] {
  const orden: PosicionSerie[] = [];
  let indice = 0;
  while (indice < EJERCICIOS.length) {
    const ejercicio = EJERCICIOS[indice];
    if (!ejercicio.bloqueId) {
      ejercicio.repeticiones.forEach((_, serieIndice) => orden.push({ ejercicioIndice: indice, serieIndice }));
      indice += 1;
      continue;
    }
    const inicio = indice;
    const bloque: EjercicioSesion[] = [];
    while (indice + bloque.length < EJERCICIOS.length && EJERCICIOS[indice + bloque.length].bloqueId === ejercicio.bloqueId) {
      bloque.push(EJERCICIOS[indice + bloque.length]);
    }
    const pasos = planificarBloqueEncadenado({
      tecnica: ejercicio.tecnicaSlug ?? "superserie",
      ejercicios: bloque.map((item) => ({ ejercicioId: item.id, series: item.repeticiones.length })),
      descansoFinalSegundos: bloque.at(-1)?.descanso ?? 90,
    });
    pasos.filter((paso) => paso.tipo === "serie").forEach((paso) => {
      const posicionBloque = bloque.findIndex((item) => item.id === paso.ejercicioId);
      orden.push({ ejercicioIndice: inicio + posicionBloque, serieIndice: (paso.serieNumero ?? 1) - 1 });
    });
    indice += bloque.length;
  }
  return orden;
}

const ORDEN_EJECUCION = crearOrdenEjecucion();

const MOMENTOS_ALEJANDRO = seleccionarMomentosAlejandro({
  activo: true,
  nivel: "intermedio",
  sesionesValidas: 18,
  constancia30Dias: 0.84,
  registroConfiable: true,
  exitosRecientes: 3,
  desafiosRecientes: 4,
  dolorORestriccion: false,
  intensidadAltaAutorizada: false,
}, EJERCICIOS.map((ejercicio, posicion) => ({
  ejercicioId: ejercicio.id,
  nombre: ejercicio.nombre,
  totalSeries: ejercicio.repeticiones.length,
  posicion,
  compuesto: posicion < 2,
  tecnicaProgramada: Boolean(ejercicio.tecnica),
  perfilRevisado: true,
  tecnicasPermitidas: posicion === EJERCICIOS.length - 1
    ? ["cierre_controlado", "drop_set"]
    : ["cierre_controlado", "repeticion_extra"],
})));

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

function convertirPeso(valor: string, desde: UnidadPeso, hasta: UnidadPeso) {
  if (desde === hasta || valor.trim() === "") return valor;
  const numero = Number(valor.replace(",", "."));
  if (!Number.isFinite(numero)) return valor;
  const convertido = desde === "kg" ? numero * 2.20462 : numero / 2.20462;
  return String(Math.round(convertido * 10) / 10);
}

function pesoHistorico(kilos: number, unidad: UnidadPeso) {
  const valor = unidad === "kg" ? kilos : Math.round(kilos * 2.20462 * 10) / 10;
  return `${valor} ${unidad}`;
}

function desplazarPosicionSerie(ejercicioIndice: number, serieIndice: number, direccion: -1 | 1) {
  const actual = ORDEN_EJECUCION.findIndex((paso) =>
    paso.ejercicioIndice === ejercicioIndice && paso.serieIndice === serieIndice
  );
  if (actual < 0) return { ejercicioIndice, serieIndice };
  return ORDEN_EJECUCION[limitar(actual + direccion, 0, ORDEN_EJECUCION.length - 1)];
}

function requiereDescansoDespues(ejercicioIndice: number, serieIndice: number) {
  const actual = ORDEN_EJECUCION.findIndex((paso) =>
    paso.ejercicioIndice === ejercicioIndice && paso.serieIndice === serieIndice
  );
  const siguiente = ORDEN_EJECUCION[actual + 1];
  if (actual < 0 || !siguiente) return false;
  const ejercicio = EJERCICIOS[ejercicioIndice];
  const siguienteEjercicio = EJERCICIOS[siguiente.ejercicioIndice];
  return !(ejercicio.bloqueId && ejercicio.bloqueId === siguienteEjercicio.bloqueId && serieIndice === siguiente.serieIndice);
}

export function SesionActivaV2() {
  const [segundosSesion, setSegundosSesion] = useState(0);
  const [pausada, setPausada] = useState(false);
  const [registro, setRegistro] = useState(crearRegistroInicial);
  const [ejercicioActivoId, setEjercicioActivoId] = useState(EJERCICIOS[0].id);
  const [serieActivaIndice, setSerieActivaIndice] = useState(0);
  const [ejercicioExpandidoId, setEjercicioExpandidoId] = useState<string | null>(EJERCICIOS[0].id);
  const [descanso, setDescanso] = useState<DescansoActivo | null>(null);
  const [descansoEnFoco, setDescansoEnFoco] = useState(false);
  const [vista, setVista] = useState<VistaSesion>("lista");
  const [controlesVideoVisibles, setControlesVideoVisibles] = useState(true);
  const [panel, setPanel] = useState<PanelSesion>(null);
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [confirmarSalida, setConfirmarSalida] = useState(false);
  const [registrada, setRegistrada] = useState(false);
  const [temporizadorAutomatico, setTemporizadorAutomatico] = useState(true);
  const [sonidoDescansoActivo, setSonidoDescansoActivo] = useState(true);
  const [unidadPeso, setUnidadPeso] = useState<UnidadPeso>("kg");
  const [impulsoAutomaticoActivo, setImpulsoAutomaticoActivo] = useState(true);
  const [momentosVistos, setMomentosVistos] = useState<Record<string, boolean>>({});
  const [momentosLogrados, setMomentosLogrados] = useState<Record<string, boolean>>({});
  const [momentoVisible, setMomentoVisible] = useState<MomentoSesionAlejandro | null>(null);
  const gestoInicioX = useRef<number | null>(null);
  const descansoAvisadoRef = useRef<string | null>(null);
  const paginaSesionRef = useRef<HTMLDivElement | null>(null);

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
  const serieActivaIndiceSeguro = limitar(serieActivaIndice, 0, ejercicioActivo.repeticiones.length - 1);
  const serieActiva = registro[ejercicioActivo.id][serieActivaIndiceSeguro];
  const indicePasoActivo = ORDEN_EJECUCION.findIndex((paso) =>
    paso.ejercicioIndice === ejercicioActivoIndice && paso.serieIndice === serieActivaIndiceSeguro
  );
  const serieActivaNumero = Math.max(0, indicePasoActivo) + 1;
  const puedeIrAtras = indicePasoActivo > 0;
  const puedeIrAdelante = indicePasoActivo >= 0 && indicePasoActivo < ORDEN_EJECUCION.length - 1;
  const ejercicioDescansoIndice = descanso === null
    ? ejercicioActivoIndice
    : EJERCICIOS.findIndex((ejercicio) => ejercicio.id === descanso.ejercicioId);
  const posicionDespuesDescanso = descanso === null || descanso.tipo === "manual"
    ? { ejercicioIndice: ejercicioActivoIndice, serieIndice: serieActivaIndiceSeguro }
    : desplazarPosicionSerie(ejercicioDescansoIndice, descanso.serieIndice, 1);
  const ejercicioDespuesDescanso = EJERCICIOS[posicionDespuesDescanso.ejercicioIndice];
  const progreso = totalSeries === 0 ? 0 : (seriesCompletadas / totalSeries) * 100;
  const impulsoActivo = MOMENTOS_ALEJANDRO.find((momento) =>
    momento.ejercicioId === ejercicioActivo.id && momentosVistos[momento.id]
  ) ?? null;

  const cambiarImpulsoAutomatico = (activo: boolean) => {
    setImpulsoAutomaticoActivo(activo);
    if (!activo) setMomentoVisible(null);
  };

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

  useEffect(() => {
    if (vista === "lista") return;
    window.scrollTo({ top: 0, behavior: "auto" });
    paginaSesionRef.current?.parentElement?.scrollTo({ top: 0, behavior: "auto" });
  }, [vista]);

  useEffect(() => {
    const detenerAviso = () => cortarAviso();
    window.addEventListener("pointerdown", detenerAviso);
    window.addEventListener("focus", detenerAviso);
    return () => {
      window.removeEventListener("pointerdown", detenerAviso);
      window.removeEventListener("focus", detenerAviso);
      cortarAviso();
    };
  }, []);

  useEffect(() => {
    if (descanso === null) return;
    const clave = `${descanso.ejercicioId}-${descanso.serieIndice}`;
    if (descanso.segundos > 0) {
      if (descansoAvisadoRef.current === clave) descansoAvisadoRef.current = null;
      return;
    }
    if (descansoAvisadoRef.current === clave) return;
    descansoAvisadoRef.current = clave;
    avisarFinDescansoV2(sonidoDescansoActivo);
    if (!descansoEnFoco && vista !== "descanso") return;
    const transicion = window.setTimeout(() => {
      if (descansoEnFoco && descanso.tipo === "automatico") {
        const ejercicioIndice = EJERCICIOS.findIndex((ejercicio) => ejercicio.id === descanso.ejercicioId);
        const siguiente = desplazarPosicionSerie(ejercicioIndice, descanso.serieIndice, 1);
        const siguienteEjercicio = EJERCICIOS[siguiente.ejercicioIndice];
        setEjercicioActivoId(siguienteEjercicio.id);
        setSerieActivaIndice(siguiente.serieIndice);
        setEjercicioExpandidoId(siguienteEjercicio.id);
      }
      setDescansoEnFoco(false);
      setDescanso(null);
      // El descanso es un campo propio. Solo al finalizar deja el foco y activa
      // la siguiente serie antes de volver a la demostración.
      if (vista === "descanso") setVista(descanso.vistaRetorno);
    }, 0);
    return () => window.clearTimeout(transicion);
  }, [descanso, descansoEnFoco, sonidoDescansoActivo, vista]);

  useEffect(() => {
    if (!impulsoAutomaticoActivo || descansoEnFoco || confirmarSalida || registrada) return;
    const momento = MOMENTOS_ALEJANDRO.find((item) =>
      item.ejercicioId === ejercicioActivo.id
      && item.serieIndice === serieActivaIndiceSeguro
      && !momentosVistos[item.id]
      && !registro[ejercicioActivo.id][serieActivaIndiceSeguro].completada
    );
    if (momento) setMomentoVisible(momento);
  }, [
    confirmarSalida,
    descansoEnFoco,
    ejercicioActivo.id,
    impulsoAutomaticoActivo,
    momentosVistos,
    registrada,
    registro,
    serieActivaIndiceSeguro,
  ]);

  const actualizarSerie = (ejercicioId: string, indice: number, campo: "reps" | "peso", valor: string) => {
    setRegistro((actual) => ({
      ...actual,
      [ejercicioId]: actual[ejercicioId].map((serie, serieIndice) => serieIndice === indice ? { ...serie, [campo]: valor } : serie),
    }));
  };

  const alternarSerie = (ejercicio: EjercicioSesion, serieIndice: number) => {
    const estabaCompletada = registro[ejercicio.id][serieIndice].completada;
    const ejercicioIndice = EJERCICIOS.findIndex((item) => item.id === ejercicio.id);
    const esUltimaSerieRutina = ejercicioIndice === EJERCICIOS.length - 1
      && serieIndice === ejercicio.repeticiones.length - 1;
    setRegistro((actual) => ({
      ...actual,
      [ejercicio.id]: actual[ejercicio.id].map((serie, indice) => indice === serieIndice ? { ...serie, completada: !serie.completada } : serie),
    }));
    setEjercicioActivoId(ejercicio.id);
    setSerieActivaIndice(serieIndice);
    setEjercicioExpandidoId(ejercicio.id);

    if (estabaCompletada) {
      if (descanso?.ejercicioId === ejercicio.id && descanso.serieIndice === serieIndice) setDescansoEnFoco(false);
      setDescanso((actual) => actual?.ejercicioId === ejercicio.id && actual.serieIndice === serieIndice ? null : actual);
      return;
    }
    const momentoCompletado = MOMENTOS_ALEJANDRO.find((momento) =>
      momento.ejercicioId === ejercicio.id && momento.serieIndice === serieIndice
    );
    if (impulsoAutomaticoActivo && momentoCompletado) {
      setMomentosLogrados((actuales) => ({ ...actuales, [momentoCompletado.id]: true }));
    }
    if (esUltimaSerieRutina) {
      descansoAvisadoRef.current = null;
      cortarAviso();
      setDescanso(null);
      setDescansoEnFoco(false);
      setConfirmarSalida(true);
      return;
    }

    if (!requiereDescansoDespues(ejercicioIndice, serieIndice)) {
      const siguiente = desplazarPosicionSerie(ejercicioIndice, serieIndice, 1);
      const siguienteEjercicio = EJERCICIOS[siguiente.ejercicioIndice];
      cortarAviso();
      setDescanso(null);
      setDescansoEnFoco(false);
      setEjercicioActivoId(siguienteEjercicio.id);
      setSerieActivaIndice(siguiente.serieIndice);
      setEjercicioExpandidoId(siguienteEjercicio.id);
      setControlesVideoVisibles(true);
      return;
    }

    if (!temporizadorAutomatico) {
      const siguiente = desplazarPosicionSerie(ejercicioIndice, serieIndice, 1);
      const siguienteEjercicio = EJERCICIOS[siguiente.ejercicioIndice];
      cortarAviso();
      setDescanso(null);
      setDescansoEnFoco(false);
      setEjercicioActivoId(siguienteEjercicio.id);
      setSerieActivaIndice(siguiente.serieIndice);
      setEjercicioExpandidoId(siguienteEjercicio.id);
      return;
    }

    prepararAviso();
    descansoAvisadoRef.current = null;
    setDescanso({
      ejercicioId: ejercicio.id,
      serieIndice,
      segundos: ejercicio.descanso,
      tipo: "automatico",
      vistaRetorno: vista === "video" ? "video" : "lista",
    });
    setDescansoEnFoco(true);
    if (vista === "video") setVista("descanso");
  };

  const ajustarDescanso = (cantidad: number) => {
    setDescanso((actual) => actual === null ? null : { ...actual, segundos: limitar(actual.segundos + cantidad, 0, 15 * 60) });
  };

  const saltarDescanso = () => {
    if (descanso !== null) {
      descansoAvisadoRef.current = `${descanso.ejercicioId}-${descanso.serieIndice}`;
      if (descansoEnFoco && descanso.tipo === "automatico") {
        const ejercicioIndice = EJERCICIOS.findIndex((ejercicio) => ejercicio.id === descanso.ejercicioId);
        const siguiente = desplazarPosicionSerie(ejercicioIndice, descanso.serieIndice, 1);
        const siguienteEjercicio = EJERCICIOS[siguiente.ejercicioIndice];
        setEjercicioActivoId(siguienteEjercicio.id);
        setSerieActivaIndice(siguiente.serieIndice);
        setEjercicioExpandidoId(siguienteEjercicio.id);
      }
    }
    cortarAviso();
    const vistaRetorno = descanso?.vistaRetorno ?? "video";
    setDescanso(null);
    setDescansoEnFoco(false);
    setVista(vistaRetorno);
  };

  const volverDesdeDescanso = () => {
    const vistaRetorno = descanso?.vistaRetorno ?? "video";
    if (descanso !== null) {
      const ejercicioIndice = EJERCICIOS.findIndex((ejercicio) => ejercicio.id === descanso.ejercicioId);
      const ejercicio = EJERCICIOS[ejercicioIndice];
      setEjercicioActivoId(ejercicio.id);
      setSerieActivaIndice(descanso.serieIndice);
      setEjercicioExpandidoId(ejercicio.id);
    }
    cortarAviso();
    descansoAvisadoRef.current = null;
    setDescanso(null);
    setDescansoEnFoco(false);
    setControlesVideoVisibles(true);
    setVista(vistaRetorno);
  };

  const avanzarDesdeVideo = () => {
    const esUltimaSerieRutina = ejercicioActivoIndice === EJERCICIOS.length - 1
      && serieActivaIndiceSeguro === ejercicioActivo.repeticiones.length - 1;

    if (!serieActiva.completada) {
      alternarSerie(ejercicioActivo, serieActivaIndiceSeguro);
      return;
    }
    if (esUltimaSerieRutina) {
      setConfirmarSalida(true);
      return;
    }
    if (!temporizadorAutomatico || !requiereDescansoDespues(ejercicioActivoIndice, serieActivaIndiceSeguro)) {
      const siguiente = desplazarPosicionSerie(ejercicioActivoIndice, serieActivaIndiceSeguro, 1);
      const siguienteEjercicio = EJERCICIOS[siguiente.ejercicioIndice];
      setEjercicioActivoId(siguienteEjercicio.id);
      setSerieActivaIndice(siguiente.serieIndice);
      setEjercicioExpandidoId(siguienteEjercicio.id);
      setControlesVideoVisibles(true);
      return;
    }

    prepararAviso();
    descansoAvisadoRef.current = null;
    setDescanso({
      ejercicioId: ejercicioActivo.id,
      serieIndice: serieActivaIndiceSeguro,
      segundos: ejercicioActivo.descanso,
      tipo: "automatico",
      vistaRetorno: "video",
    });
    setDescansoEnFoco(true);
    setVista("descanso");
  };

  const cambiarTemporizadorAutomatico = (activo: boolean) => {
    setTemporizadorAutomatico(activo);
    if (activo || descanso === null) return;
    cortarAviso();
    setDescanso(null);
    setDescansoEnFoco(false);
    if (vista === "descanso") setVista(descanso.vistaRetorno);
  };

  const abrirTemporizador = () => {
    prepararAviso();
    descansoAvisadoRef.current = null;
    if (descanso === null) {
      setDescanso({
        ejercicioId: ejercicioActivo.id,
        serieIndice: serieActivaIndiceSeguro,
        segundos: ejercicioActivo.descanso,
        tipo: "manual",
        vistaRetorno: vista === "video" ? "video" : "lista",
      });
    }
    setDescansoEnFoco(true);
    setVista("descanso");
  };

  const cambiarUnidadPeso = (siguienteUnidad: UnidadPeso) => {
    if (siguienteUnidad === unidadPeso) return;
    setRegistro((actual) => Object.fromEntries(
      Object.entries(actual).map(([ejercicioId, series]) => [
        ejercicioId,
        series.map((serie) => ({
          ...serie,
          peso: convertirPeso(serie.peso, unidadPeso, siguienteUnidad),
        })),
      ]),
    ));
    setUnidadPeso(siguienteUnidad);
  };

  const moverSerie = (direccion: -1 | 1) => {
    const siguiente = desplazarPosicionSerie(ejercicioActivoIndice, serieActivaIndiceSeguro, direccion);
    const siguienteEjercicio = EJERCICIOS[siguiente.ejercicioIndice];
    setEjercicioActivoId(siguienteEjercicio.id);
    setSerieActivaIndice(siguiente.serieIndice);
    setEjercicioExpandidoId(siguienteEjercicio.id);
    setDescansoEnFoco(false);
    setControlesVideoVisibles(true);
  };

  const retrocederPaso = () => {
    if (vista === "descanso") {
      volverDesdeDescanso();
      return;
    }
    moverSerie(-1);
  };

  const avanzarPaso = () => {
    if (vista === "descanso") {
      saltarDescanso();
      return;
    }
    if (vista === "video") {
      avanzarDesdeVideo();
      return;
    }
    moverSerie(1);
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
    if (distancia < 0) avanzarPaso();
    else retrocederPaso();
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
    <div ref={paginaSesionRef} className={styles.sessionPage}>
      <header className={styles.topbar}>
        <div className={styles.sessionStatus}><span>{formatearTiempo(segundosSesion)}</span><i aria-hidden="true" /><strong>Serie {serieActivaNumero}/{totalSeries}</strong></div>
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
          {descanso !== null ? <button type="button" className={`${styles.immersiveArrow} ${styles.immersiveArrowLeft}`} onClick={volverDesdeDescanso} aria-label="Volver a la serie actual"><ChevronsLeft size={27} strokeWidth={2.4} /></button> : null}
          {descanso !== null && (descanso.tipo === "manual" || puedeIrAdelante) ? <button type="button" className={`${styles.immersiveArrow} ${styles.immersiveArrowRight}`} onClick={saltarDescanso} aria-label={descanso.tipo === "manual" ? "Finalizar temporizador" : "Ir a la siguiente serie"}><ChevronsRight size={27} strokeWidth={2.4} /></button> : null}
          <div className={styles.restCenter}>
            <span>Descanso</span><strong>{descanso?.segundos ?? 0}</strong><small>segundos</small>
            <div className={styles.restAdjustments}><button type="button" onClick={() => ajustarDescanso(-15)}><Minus size={13} />15 s</button><button type="button" onClick={() => ajustarDescanso(15)}><Plus size={13} />15 s</button></div>
          </div>
          <div className={styles.upNext}><span>{descanso?.tipo === "manual" ? "CONTINÚAS" : "SIGUE"}</span><strong>{ejercicioDespuesDescanso.nombre}</strong><small>Serie {posicionDespuesDescanso.serieIndice + 1} · {ejercicioDespuesDescanso.repeticiones[posicionDespuesDescanso.serieIndice]} repeticiones</small></div>
          <button type="button" className={styles.skipRest} onClick={saltarDescanso}><FastForward size={15} /> Saltar descanso</button>
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
            {controlesVideoVisibles && puedeIrAtras ? <button type="button" className={`${styles.immersiveArrow} ${styles.immersiveArrowLeft}`} onClick={() => moverSerie(-1)} aria-label="Ver serie anterior"><ChevronsLeft size={27} strokeWidth={2.4} /></button> : null}
            {controlesVideoVisibles ? <button type="button" className={`${styles.immersiveArrow} ${styles.immersiveArrowRight}`} onClick={avanzarDesdeVideo} aria-label={puedeIrAdelante ? "Finalizar serie e ir al descanso" : "Finalizar entrenamiento"}><ChevronsRight size={27} strokeWidth={2.4} /></button> : null}
            <span className={styles.videoSpeed}>1× velocidad</span>
            <div className={styles.videoIdentity}><small>SERIE {ejercicioActivo.codigo}</small><h1>{ejercicioActivo.nombre}</h1><p>{ejercicioActivo.equipo}</p></div>
          </div>
          <div className={styles.videoActions}>
            <button type="button" className={styles.impulsoAction} onClick={() => setPanel("impulso")}><Zap size={13} fill="currentColor" />Alejandro</button><button type="button" onClick={() => setPanel("consejo")}><Lightbulb size={13} />Consejo</button><button type="button" onClick={() => setPanel("historial")}><History size={13} />Historial</button><button type="button" onClick={() => setPanel("sustituir")}><Repeat2 size={13} />Sustituir</button><button type="button" onClick={() => setPanel("notas")}><StickyNote size={13} />Notas</button><button type="button" onClick={() => setPanel("reordenar")}><ArrowDownUp size={13} />Reordenar</button><button type="button" onClick={() => setPanel("informacion")}><Info size={13} />Información</button>
          </div>
          {impulsoActivo ? (
            <button type="button" className={styles.impulsoNotice} onClick={() => setPanel("impulso")}>
              <Zap size={15} fill="currentColor" />
              <span><strong>Alejandro</strong><small>{impulsoActivo.instruccion}</small></span>
              <b>{momentosLogrados[impulsoActivo.id] ? "Logrado" : `Serie ${impulsoActivo.serieIndice + 1}`}</b>
            </button>
          ) : null}
          <div className={`${styles.videoSetStrip} ${impulsoActivo?.serieIndice === serieActivaIndiceSeguro ? styles.videoSetStripImpulse : ""}`}>
            <span><b>Serie</b><em>{serieActivaIndiceSeguro + 1} TRB</em></span><span><b>Reps</b><strong>{serieActiva.reps}</strong></span><span><b>Peso ({unidadPeso})</b><strong>{serieActiva.peso || `— ${unidadPeso}`}</strong></span>
            <button
              type="button"
              onClick={() => alternarSerie(ejercicioActivo, serieActivaIndiceSeguro)}
              aria-label={`${serieActiva.completada ? "Desmarcar" : "Registrar"} serie ${serieActivaIndiceSeguro + 1}`}
              aria-pressed={serieActiva.completada}
            >
              {serieActiva.completada ? <Check size={16} strokeWidth={3} /> : <CircleCheck size={19} />}
            </button>
          </div>
          <button type="button" className={styles.switchView} onClick={() => setVista("lista")}><ListVideo size={14} /> Vista de lista</button>
        </section>
      ) : (
        <main className={styles.workoutList}>
          {EJERCICIOS.map((ejercicio) => {
            const activa = ejercicio.id === ejercicioExpandidoId;
            const impulsoEjercicio = MOMENTOS_ALEJANDRO.find((momento) =>
              momento.ejercicioId === ejercicio.id && momentosVistos[momento.id]
            ) ?? null;
            if (!activa) {
              const primeraPendiente = registro[ejercicio.id].findIndex((serie) => !serie.completada);
              return (
                <button type="button" className={styles.compactExercise} key={ejercicio.id} aria-expanded="false" onClick={() => { setEjercicioActivoId(ejercicio.id); setSerieActivaIndice(ejercicio.id === ejercicioActivo.id ? serieActivaIndiceSeguro : Math.max(0, primeraPendiente)); setEjercicioExpandidoId(ejercicio.id); setDescansoEnFoco(false); }}>
                  <span className={styles.compactCode}>{ejercicio.codigo} SERIE</span><span className={styles.compactThumb}><Image src={ejercicio.foto} alt="" fill sizes="68px" /><i><Play size={12} fill="currentColor" /></i></span><span className={styles.compactCopy}><strong>{ejercicio.nombre}</strong><small>Reps: {ejercicio.repeticiones.join(" · ")}</small></span>{ejercicio.tecnica ? <em>{ejercicio.tecnica}</em> : null}
                </button>
              );
            }
            return (
              <section className={styles.activeExercise} key={ejercicio.id}>
                <button type="button" className={styles.seriesLabel} aria-expanded="true" onClick={() => setEjercicioExpandidoId(null)} aria-label={`Contraer ${ejercicio.nombre}`}>SERIE {ejercicio.codigo}<i aria-hidden="true">›››</i>{ejercicio.tecnica ? <em>{ejercicio.tecnica}</em> : null}</button>
                <div className={styles.exerciseHeading}>
                  <button type="button" className={styles.exerciseMedia} onClick={() => setVista("video")} aria-label={`Ver demostración de ${ejercicio.nombre}`}><Image src={ejercicio.foto} alt="" fill sizes="70px" priority={ejercicio.codigo === "A"} /><i><Play size={17} fill="currentColor" /></i></button>
                  <button type="button" className={styles.exerciseHeadingToggle} aria-expanded="true" onClick={() => setEjercicioExpandidoId(null)}><h1>{ejercicio.nombre}</h1><p><b>Reps:</b> {ejercicio.repeticiones.join("  ·  ")}</p></button>
                </div>
                <div className={styles.actionChips}><button type="button" className={styles.impulsoAction} onClick={() => setPanel("impulso")}><Zap size={14} fill="currentColor" />Alejandro</button><button type="button" onClick={() => setPanel("consejo")}><Lightbulb size={14} />Consejo</button><button type="button" onClick={() => setPanel("historial")}><History size={14} />Historial</button><button type="button" onClick={() => setPanel("sustituir")}><Repeat2 size={14} />Sustituir</button><button type="button" onClick={() => setPanel("notas")}><StickyNote size={14} />Notas</button><button type="button" onClick={() => setPanel("reordenar")}><ArrowDownUp size={14} />Reordenar series</button></div>
                {impulsoEjercicio ? (
                  <button type="button" className={styles.impulsoNotice} onClick={() => setPanel("impulso")}>
                    <Zap size={15} fill="currentColor" />
                    <span><strong>Alejandro</strong><small>{impulsoEjercicio.instruccion}</small></span>
                    <b>{momentosLogrados[impulsoEjercicio.id] ? "Logrado" : `Serie ${impulsoEjercicio.serieIndice + 1}`}</b>
                  </button>
                ) : null}
                <div className={styles.setTable}>
                  <div className={styles.setHead}><span>Serie</span><span>Reps</span><span>Peso ({unidadPeso})</span><span>Descanso</span><span>Listo</span></div>
                  {registro[ejercicio.id].map((serie, serieIndice) => {
                    const descansoDeEstaSerie = descanso?.ejercicioId === ejercicio.id && descanso.serieIndice === serieIndice;
                    const esSerieActiva = !descansoEnFoco && ejercicio.id === ejercicioActivo.id && serieIndice === serieActivaIndiceSeguro;
                    const esObjetivoImpulso = impulsoEjercicio?.serieIndice === serieIndice;
                    const esUltimaSerieRutina = ejercicio.id === EJERCICIOS[EJERCICIOS.length - 1].id
                      && serieIndice === ejercicio.repeticiones.length - 1;
                    const activarEstaSerie = () => {
                      setEjercicioActivoId(ejercicio.id);
                      setSerieActivaIndice(serieIndice);
                      setEjercicioExpandidoId(ejercicio.id);
                      setDescansoEnFoco(false);
                    };
                    return (
                      <div className={styles.setGroup} key={`${ejercicio.id}-${serieIndice}`}>
                        <div className={`${styles.setRow} ${serie.completada ? styles.setRowDone : ""} ${descansoDeEstaSerie ? styles.setRowActive : ""} ${esSerieActiva ? styles.setRowSelected : styles.setRowLocked} ${esObjetivoImpulso ? styles.setRowImpulse : ""}`} aria-current={esSerieActiva ? "step" : undefined} onClick={activarEstaSerie}>
                          <span className={styles.setNumber}><b>{serieIndice + 1}</b><em>TRB</em></span>
                          <input aria-label={`Repeticiones, serie ${serieIndice + 1}`} aria-readonly={!esSerieActiva} inputMode="numeric" value={serie.reps} readOnly={!esSerieActiva} tabIndex={esSerieActiva ? 0 : -1} onFocus={activarEstaSerie} onChange={(evento) => actualizarSerie(ejercicio.id, serieIndice, "reps", evento.target.value)} />
                          <input aria-label={`Peso en ${unidadPeso}, serie ${serieIndice + 1}`} aria-readonly={!esSerieActiva} inputMode="decimal" value={serie.peso} readOnly={!esSerieActiva} tabIndex={esSerieActiva ? 0 : -1} placeholder={`— ${unidadPeso}`} onFocus={activarEstaSerie} onChange={(evento) => actualizarSerie(ejercicio.id, serieIndice, "peso", evento.target.value)} />
                          <span className={styles.restValue}>{esUltimaSerieRutina ? "Final" : requiereDescansoDespues(EJERCICIOS.findIndex((item) => item.id === ejercicio.id), serieIndice) ? `${ejercicio.descanso} s` : "Avanza"}</span>
                          <button type="button" className={styles.checkButton} onClick={(evento) => { evento.stopPropagation(); if (esSerieActiva) alternarSerie(ejercicio, serieIndice); else activarEstaSerie(); }} aria-label={esSerieActiva ? `${serie.completada ? "Desmarcar" : "Registrar"} serie ${serieIndice + 1}` : `Activar serie ${serieIndice + 1}`} aria-pressed={serie.completada}>{serie.completada ? <Check size={16} strokeWidth={3} /> : <CircleCheck size={19} />}</button>
                        </div>
                        {descansoDeEstaSerie ? <div className={`${styles.inlineRest} ${descansoEnFoco ? styles.inlineRestActive : ""}`} aria-current={descansoEnFoco ? "step" : undefined} aria-live="polite"><button type="button" onClick={() => ajustarDescanso(-15)}>−15 s</button><button type="button" className={styles.inlineRestTime} onClick={() => { setDescansoEnFoco(true); setVista("descanso"); }}>Descanso {descanso.segundos} s</button><button type="button" onClick={() => ajustarDescanso(15)}>+15 s</button></div> : null}
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
        <button type="button" aria-label={vista === "descanso" ? "Volver a la serie actual" : "Serie anterior"} onClick={retrocederPaso} disabled={vista !== "descanso" && !puedeIrAtras}><ChevronLeft size={23} strokeWidth={2.8} /></button>
        <button type="button" aria-label={pausada ? "Reanudar sesión" : "Pausar sesión"} onClick={() => setPausada((valor) => !valor)}>{pausada ? <Play size={20} fill="currentColor" /> : <Pause size={20} fill="currentColor" />}</button>
        <button type="button" aria-label={vista === "descanso" ? descanso?.tipo === "manual" ? "Finalizar temporizador" : "Ir a la siguiente serie" : vista === "video" ? "Finalizar serie e ir al descanso" : "Serie siguiente"} onClick={avanzarPaso} disabled={vista === "lista" && !puedeIrAdelante}><ChevronRight size={23} strokeWidth={2.8} /></button>
        <button type="button" aria-label={descanso === null ? "Iniciar temporizador manual" : "Abrir temporizador activo"} onClick={abrirTemporizador}><Clock3 size={19} /></button>
      </nav>

      {panel !== null ? (
        <PanelAuxiliar
          tipo={panel}
          ejercicio={ejercicioActivo}
          notaInicial={notas[ejercicioActivo.id] ?? ""}
          temporizadorAutomatico={temporizadorAutomatico}
          sonidoDescansoActivo={sonidoDescansoActivo}
          impulsoAutomaticoActivo={impulsoAutomaticoActivo}
          unidadPeso={unidadPeso}
          cambiarTemporizadorAutomatico={cambiarTemporizadorAutomatico}
          cambiarSonidoDescanso={setSonidoDescansoActivo}
          cambiarImpulsoAutomatico={cambiarImpulsoAutomatico}
          cambiarUnidadPeso={cambiarUnidadPeso}
          impulsoActual={impulsoActivo}
          cupoImpulso={MOMENTOS_ALEJANDRO.length}
          impulsosLogrados={Object.keys(momentosLogrados).length}
          guardarNota={(nota) => setNotas((actuales) => ({ ...actuales, [ejercicioActivo.id]: nota }))}
          cerrar={() => setPanel(null)}
        />
      ) : null}
      {momentoVisible ? (
        <div className={styles.impulsoMomentBackdrop} role="presentation">
          <section className={styles.impulsoMoment} role="alertdialog" aria-modal="true" aria-labelledby="momento-alejandro-titulo">
            <Zap size={28} fill="currentColor" aria-hidden="true" />
            <p id="momento-alejandro-titulo">{momentoVisible.titulo}</p>
            <h2>{momentoVisible.instruccion}</h2>
            <span>{momentoVisible.apoyo}</span>
            <button type="button" onClick={() => {
              setMomentosVistos((actuales) => ({ ...actuales, [momentoVisible.id]: true }));
              setMomentoVisible(null);
            }}>VOY</button>
            <button type="button" className={styles.impulsoSafetyExit} onClick={() => {
              setImpulsoAutomaticoActivo(false);
              setMomentoVisible(null);
            }}>Tengo una molestia</button>
          </section>
        </div>
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
  temporizadorAutomatico,
  sonidoDescansoActivo,
  impulsoAutomaticoActivo,
  unidadPeso,
  cambiarTemporizadorAutomatico,
  cambiarSonidoDescanso,
  cambiarImpulsoAutomatico,
  cambiarUnidadPeso,
  impulsoActual,
  cupoImpulso,
  impulsosLogrados,
  guardarNota,
  cerrar,
}: {
  tipo: Exclude<PanelSesion, null>;
  ejercicio: EjercicioSesion;
  notaInicial: string;
  temporizadorAutomatico: boolean;
  sonidoDescansoActivo: boolean;
  impulsoAutomaticoActivo: boolean;
  unidadPeso: UnidadPeso;
  cambiarTemporizadorAutomatico: (activo: boolean) => void;
  cambiarSonidoDescanso: (activo: boolean) => void;
  cambiarImpulsoAutomatico: (activo: boolean) => void;
  cambiarUnidadPeso: (unidad: UnidadPeso) => void;
  impulsoActual: MomentoSesionAlejandro | null;
  cupoImpulso: number;
  impulsosLogrados: number;
  guardarNota: (nota: string) => void;
  cerrar: () => void;
}) {
  const [notaBorrador, setNotaBorrador] = useState(notaInicial);
  const titulos = { consejo: "Consejo del entrenador", historial: "Historial del ejercicio", sustituir: "Sustituir ejercicio", reordenar: "Reordenar series", notas: "Notas del ejercicio", ajustes: "Ajustes de la sesión", informacion: "Información del ejercicio", impulso: "Alejandro · Impulso VIP" };
  return (
    <div className={styles.sheetBackdrop} role="presentation" onClick={cerrar}>
      <section className={styles.auxSheet} role="dialog" aria-modal="true" aria-label={titulos[tipo]} onClick={(evento) => evento.stopPropagation()}>
        <div className={styles.sheetHandle} />
        <header><div><small>SERIE {ejercicio.codigo}</small><h2>{titulos[tipo]}</h2></div><button type="button" onClick={cerrar} aria-label="Cerrar"><X size={17} /></button></header>
        {tipo === "consejo" ? <p className={styles.sheetCopy}>Mantén el abdomen firme, controla el descenso y conserva la trayectoria estable durante toda la repetición.</p> : null}
        {tipo === "historial" ? <div className={styles.historyGrid}><span>Fecha</span><span>Reps</span><span>Peso</span><strong>11 ago.</strong><strong>10 · 10 · 10</strong><strong>{pesoHistorico(42, unidadPeso)}</strong><strong>4 ago.</strong><strong>12 · 10 · 10</strong><strong>{pesoHistorico(40, unidadPeso)}</strong></div> : null}
        {tipo === "impulso" ? (
          <div className={styles.impulsoPanel}>
            <div className={styles.alejandroAutomatico} data-active={impulsoAutomaticoActivo}>
              <span><strong>{impulsoAutomaticoActivo ? "Impulso automático activo" : "Impulso automático desactivado"}</strong><small>{impulsoAutomaticoActivo ? "Aparecerá solo cuando realmente haga falta." : "La rutina conserva su programación base."}</small></span>
              <button type="button" role="switch" aria-label="Alejandro automático" aria-checked={impulsoAutomaticoActivo} className={styles.settingSwitch} onClick={() => cambiarImpulsoAutomatico(!impulsoAutomaticoActivo)}><i /></button>
            </div>
            <p className={styles.impulsoIntro}>Alejandro estudia historial, repeticiones, carga, constancia y esfuerzo. La progresión normal ocurre en silencio; los retos aparecen solos y son escasos.</p>
            <div className={styles.impulsoRule}><Zap size={17} fill="currentColor" /><span><strong>{cupoImpulso} momentos estratégicos en esta sesión</strong><small>Últimas series elegidas. Nunca cambia todos tus pesos ni interrumpe cada ejercicio.</small></span></div>
            {impulsoActual ? (
              <div className={styles.impulsoResult}><Check size={18} strokeWidth={3} /><span><strong>Momento revelado</strong><small>{impulsoActual.instruccion}</small></span><b>Serie {impulsoActual.serieIndice + 1}</b></div>
            ) : null}
            <div className={styles.alejandroConfidence}><span>Estado de hoy</span><b>{impulsosLogrados}/{cupoImpulso} retos logrados</b></div>
            <button type="button" className={styles.impulsoDone} onClick={cerrar}>Listo</button>
          </div>
        ) : null}
        {tipo === "sustituir" ? <div className={styles.swapList}><button type="button"><Dumbbell size={17} /><span><strong>Sentadilla goblet</strong><small>Mismo patrón de movimiento</small></span><Plus size={17} /></button><button type="button"><Dumbbell size={17} /><span><strong>Prensa horizontal</strong><small>Alternativa para cuádriceps</small></span><Plus size={17} /></button></div> : null}
        {tipo === "notas" ? <label className={styles.exerciseNotes}><span>Nota personal</span><textarea value={notaBorrador} onChange={(evento) => setNotaBorrador(evento.target.value)} placeholder="Escribe una observación para este ejercicio…" /><button type="button" onClick={() => { guardarNota(notaBorrador); cerrar(); }}>Guardar nota</button></label> : null}
        {tipo === "reordenar" ? <div className={styles.reorderPreview}><span><b>1</b> Serie de trabajo <ArrowDownUp size={15} /></span><span><b>2</b> Serie de trabajo <ArrowDownUp size={15} /></span><span><b>3</b> Serie de trabajo <ArrowDownUp size={15} /></span><button type="button" onClick={cerrar}>Guardar orden</button></div> : null}
        {tipo === "ajustes" ? (
          <div className={styles.settingRows}>
            <div className={styles.settingRow}>
              <span><strong>Alejandro automático</strong><small>Activa retos escasos en momentos estratégicos</small></span>
              <button type="button" role="switch" aria-label="Alejandro automático" aria-checked={impulsoAutomaticoActivo} className={styles.settingSwitch} onClick={() => cambiarImpulsoAutomatico(!impulsoAutomaticoActivo)}><i /></button>
            </div>
            <div className={styles.settingRow}>
              <span><strong>Temporizador automático</strong><small>Inicia el descanso al completar cada serie</small></span>
              <button type="button" role="switch" aria-label="Temporizador automático" aria-checked={temporizadorAutomatico} className={styles.settingSwitch} onClick={() => cambiarTemporizadorAutomatico(!temporizadorAutomatico)}><i /></button>
            </div>
            <div className={styles.settingRow}>
              <span><strong>Sonido al terminar</strong><small>La vibración permanece activa</small></span>
              <button type="button" role="switch" aria-label="Sonido al terminar" aria-checked={sonidoDescansoActivo} className={styles.settingSwitch} onClick={() => cambiarSonidoDescanso(!sonidoDescansoActivo)}><i /></button>
            </div>
            <div className={styles.settingRow}>
              <span><strong>Unidad de peso</strong><small>Convierte los pesos registrados</small></span>
              <div className={styles.unitSelector} role="group" aria-label="Unidad de peso"><button type="button" aria-pressed={unidadPeso === "kg"} onClick={() => cambiarUnidadPeso("kg")}>kg</button><button type="button" aria-pressed={unidadPeso === "lb"} onClick={() => cambiarUnidadPeso("lb")}>lb</button></div>
            </div>
          </div>
        ) : null}
        {tipo === "informacion" ? <div className={styles.infoGrid}><span><small>Equipo</small><strong>{ejercicio.equipo}</strong></span><span><small>Objetivo</small><strong>{ejercicio.grupo}</strong></span><span><small>Descanso</small><strong>{ejercicio.descanso} segundos</strong></span></div> : null}
      </section>
    </div>
  );
}
