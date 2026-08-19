"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Check,
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CircleCheck,
  Clock3,
  FastForward,
  History,
  Info,
  Lightbulb,
  ListVideo,
  Minus,
  Pause,
  Play,
  Plus,
  Settings,
  Shuffle,
  StickyNote,
  X,
  Zap,
} from "lucide-react";
import { avisarFinDescansoV2, cortarAviso, prepararAviso } from "@/lib/entrenamiento/aviso";
import {
  planificarBloqueEncadenado,
  planificarSegmentosTecnica,
  type SegmentoTecnicaSesion,
  type TecnicaEncadenadaSlug,
  type TecnicaIndividualSlug,
} from "@/lib/entrenamiento/motor-tecnicas-sesion";
import { tecnicaAplicaASerie } from "@/lib/entrenamiento/tecnica-series";
import {
  seleccionarMomentosAlejandro,
  type MomentoSesionAlejandro,
} from "@/lib/impulso-vip/alejandro-sesion";
import {
  actualizarTemporizadorDescansoAlumno,
  guardarSesionV2,
  guardarYFinalizarSesionV2,
  type RegistroSesionV2,
} from "@/app/alumno/entrenar/actions";
import { reordenarEjerciciosSesionV2, sustituirEjercicioSesionV2 } from "@/app/portal-v2/entrenamiento/sesion/actions";
import { ModalVideo } from "@/components/student/ModalVideo";
import { ModalVideoCloudflare } from "@/components/student/ModalVideoCloudflare";
import { VideoCloudflareAutomatico } from "@/components/student/VideoCloudflareAutomatico";
import styles from "./SesionActivaV2.module.css";

export type SerieRegistradaV2 = {
  reps: string;
  peso: string;
  completada: boolean;
};

export type EjercicioSesionV2 = {
  id: string;
  sesionEjercicioId?: string;
  bibliotecaEjercicioId?: string;
  codigo: string;
  nombre: string;
  repeticiones: number[];
  descanso: number;
  foto: string;
  videoUrl?: string;
  videoCloudflareListo?: boolean;
  equipo: string;
  grupo: string;
  tecnica?: string;
  bloqueId?: string;
  tecnicaSlug?: TecnicaEncadenadaSlug;
  tecnicaIndividualSlug?: TecnicaIndividualSlug;
  tecnicaSeries?: number[] | null;
  tecnicaInstruccion?: string;
  notaInicial?: string;
  consejo?: string;
  ultimoRegistro?: { fecha: string; reps: number | null; pesoKg: number | null; esPesoCorporal: boolean };
  seriesIniciales?: SerieRegistradaV2[];
};

export type AlternativaEjercicioV2 = {
  id: string;
  nombre: string;
  foto: string;
  equipo: string;
  grupo: string;
  videoUrl?: string;
  videoCloudflareListo?: boolean;
};

export type SesionActivaModeloV2 = {
  id: string;
  titulo: string;
  fecha: string;
  real: boolean;
  soloLectura: boolean;
  temporizadorAutomaticoInicial?: boolean;
  ejercicios: EjercicioSesionV2[];
  momentosAlejandro: MomentoSesionAlejandro[];
  personalizacionDisponible?: boolean;
  alternativas?: Record<string, AlternativaEjercicioV2[]>;
};

type DescansoActivo = {
  ejercicioId: string;
  serieIndice: number;
  segundos: number;
  tipo: "automatico" | "manual";
  vistaRetorno: Exclude<VistaSesion, "descanso">;
};

type PanelSesion = "consejo" | "historial" | "notas" | "ajustes" | "informacion" | "impulso" | "sustituir" | "reordenar" | null;
type VistaSesion = "lista" | "video" | "descanso";
type UnidadPeso = "kg" | "lb";
type PausaTecnica = { clave: string; segundos: number; pasoSiguiente: number };

const EJERCICIOS_DEMO: EjercicioSesionV2[] = [
  { id: "sentadilla-smith", codigo: "A", nombre: "Sentadilla Smith", repeticiones: [10, 10, 10, 10], descanso: 60, foto: "/v2/piernas.webp", equipo: "Máquina Smith", grupo: "Cuádriceps · glúteos" },
  { id: "peso-muerto-rumano", codigo: "B1", nombre: "Peso muerto rumano", repeticiones: [8, 8, 8], descanso: 0, foto: "/v2/espalda.webp", equipo: "Barra", grupo: "Femoral · glúteos", tecnica: "Superserie", bloqueId: "superserie-b", tecnicaSlug: "superserie" },
  { id: "prensa-inclinada", codigo: "B2", nombre: "Prensa inclinada", repeticiones: [12, 12, 12], descanso: 90, foto: "/v2/piernas.webp", equipo: "Prensa 45°", grupo: "Cuádriceps", tecnica: "Superserie", bloqueId: "superserie-b", tecnicaSlug: "superserie" },
  { id: "extension-cuadriceps", codigo: "C", nombre: "Extensión de cuádriceps", repeticiones: [15, 15, 15], descanso: 75, foto: "/v2/hombros.webp", equipo: "Máquina de extensión", grupo: "Cuádriceps" },
];

const ALTERNATIVAS_DEMO: Record<string, AlternativaEjercicioV2[]> = {
  "sentadilla-smith": [
    { id: "hack-demo", nombre: "Sentadilla Hack", foto: "/v2/piernas.webp", equipo: "Máquina Hack", grupo: "Cuádriceps · glúteos" },
    { id: "prensa-demo", nombre: "Prensa inclinada", foto: "/v2/piernas.webp", equipo: "Prensa 45°", grupo: "Cuádriceps · glúteos" },
  ],
  "extension-cuadriceps": [
    { id: "sissy-demo", nombre: "Sentadilla Sissy asistida", foto: "/v2/piernas.webp", equipo: "Peso corporal", grupo: "Cuádriceps" },
  ],
};

type PosicionSerie = { ejercicioIndice: number; serieIndice: number };

function crearOrdenEjecucion(ejercicios: EjercicioSesionV2[]): PosicionSerie[] {
  const orden: PosicionSerie[] = [];
  let indice = 0;
  while (indice < ejercicios.length) {
    const ejercicio = ejercicios[indice];
    if (!ejercicio.bloqueId) {
      ejercicio.repeticiones.forEach((_, serieIndice) => orden.push({ ejercicioIndice: indice, serieIndice }));
      indice += 1;
      continue;
    }
    const inicio = indice;
    const bloque: EjercicioSesionV2[] = [];
    while (indice + bloque.length < ejercicios.length && ejercicios[indice + bloque.length].bloqueId === ejercicio.bloqueId) {
      bloque.push(ejercicios[indice + bloque.length]);
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

function crearMomentosDemo(ejercicios: EjercicioSesionV2[]) {
  return seleccionarMomentosAlejandro({
  activo: true,
  nivel: "intermedio",
  sesionesValidas: 18,
  constancia30Dias: 0.84,
  registroConfiable: true,
  exitosRecientes: 3,
  desafiosRecientes: 4,
  dolorORestriccion: false,
  intensidadAltaAutorizada: false,
  }, ejercicios.map((ejercicio, posicion) => ({
  ejercicioId: ejercicio.id,
  nombre: ejercicio.nombre,
  totalSeries: ejercicio.repeticiones.length,
  posicion,
  compuesto: posicion < 2,
  tecnicaProgramada: Boolean(ejercicio.tecnica),
  perfilRevisado: true,
  tecnicasPermitidas: posicion === ejercicios.length - 1
    ? ["cierre_controlado", "drop_set"]
    : ["cierre_controlado", "repeticion_extra"],
  })));
}

function crearRegistroInicial(ejercicios: EjercicioSesionV2[]) {
  return Object.fromEntries(ejercicios.map((ejercicio) => [
    ejercicio.id,
    ejercicio.seriesIniciales ?? ejercicio.repeticiones.map((reps) => ({ reps: String(reps), peso: "", completada: false })),
  ])) as Record<string, SerieRegistradaV2[]>;
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

function desplazarPosicionSerie(orden: PosicionSerie[], ejercicioIndice: number, serieIndice: number, direccion: -1 | 1) {
  const actual = orden.findIndex((paso) =>
    paso.ejercicioIndice === ejercicioIndice && paso.serieIndice === serieIndice
  );
  if (actual < 0) return { ejercicioIndice, serieIndice };
  return orden[limitar(actual + direccion, 0, orden.length - 1)];
}

function requiereDescansoDespues(ejercicios: EjercicioSesionV2[], orden: PosicionSerie[], ejercicioIndice: number, serieIndice: number) {
  const actual = orden.findIndex((paso) =>
    paso.ejercicioIndice === ejercicioIndice && paso.serieIndice === serieIndice
  );
  const siguiente = orden[actual + 1];
  if (actual < 0 || !siguiente) return false;
  const ejercicio = ejercicios[ejercicioIndice];
  const siguienteEjercicio = ejercicios[siguiente.ejercicioIndice];
  return !(ejercicio.bloqueId && ejercicio.bloqueId === siguienteEjercicio.bloqueId && serieIndice === siguiente.serieIndice);
}

function segmentosDeSerie(ejercicio: EjercicioSesionV2, serieIndice: number): SegmentoTecnicaSesion[] {
  if (!ejercicio.tecnicaIndividualSlug || !tecnicaAplicaASerie(ejercicio.tecnicaSeries, serieIndice + 1)) return [];
  return planificarSegmentosTecnica({
    tecnica: ejercicio.tecnicaIndividualSlug,
    repsBase: String(ejercicio.repeticiones[serieIndice] ?? ""),
  });
}

export function SesionActivaV2({ sesion }: { sesion?: SesionActivaModeloV2 }) {
  const router = useRouter();
  const [ejerciciosSesion, setEjerciciosSesion] = useState<EjercicioSesionV2[]>(() =>
    sesion?.ejercicios?.length ? sesion.ejercicios : EJERCICIOS_DEMO
  );
  const EJERCICIOS = ejerciciosSesion;
  const alternativas = sesion ? (sesion.alternativas ?? {}) : ALTERNATIVAS_DEMO;
  const personalizacionDisponible = sesion ? Boolean(sesion.personalizacionDisponible) : true;
  const ORDEN_EJECUCION = useMemo(() => crearOrdenEjecucion(EJERCICIOS), [EJERCICIOS]);
  const MOMENTOS_ALEJANDRO = useMemo(
    () => sesion ? sesion.momentosAlejandro : crearMomentosDemo(EJERCICIOS),
    [EJERCICIOS, sesion],
  );
  const [segundosSesion, setSegundosSesion] = useState(0);
  const [pausada, setPausada] = useState(false);
  const [registro, setRegistro] = useState(() => crearRegistroInicial(EJERCICIOS));
  const [ejercicioActivoId, setEjercicioActivoId] = useState(EJERCICIOS[0].id);
  const [serieActivaIndice, setSerieActivaIndice] = useState(0);
  const [ejercicioExpandidoId, setEjercicioExpandidoId] = useState<string | null>(EJERCICIOS[0].id);
  const [descanso, setDescanso] = useState<DescansoActivo | null>(null);
  const [descansoEnFoco, setDescansoEnFoco] = useState(false);
  const [vista, setVista] = useState<VistaSesion>("lista");
  const [controlesVideoVisibles, setControlesVideoVisibles] = useState(true);
  const [panel, setPanel] = useState<PanelSesion>(null);
  const [notas, setNotas] = useState<Record<string, string>>(() => Object.fromEntries(
    EJERCICIOS.map((ejercicio) => [ejercicio.id, ejercicio.notaInicial ?? ""]),
  ));
  const [confirmarSalida, setConfirmarSalida] = useState(false);
  const [registrada, setRegistrada] = useState(false);
  const [temporizadorAutomatico, setTemporizadorAutomatico] = useState(sesion?.temporizadorAutomaticoInicial ?? true);
  const [sonidoDescansoActivo, setSonidoDescansoActivo] = useState(true);
  const [unidadPeso, setUnidadPeso] = useState<UnidadPeso>("kg");
  const [impulsoAutomaticoActivo, setImpulsoAutomaticoActivo] = useState(true);
  const [momentosVistos, setMomentosVistos] = useState<Record<string, boolean>>({});
  const [momentosLogrados, setMomentosLogrados] = useState<Record<string, boolean>>({});
  const [momentoVisible, setMomentoVisible] = useState<MomentoSesionAlejandro | null>(null);
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);
  const [pasosTecnica, setPasosTecnica] = useState<Record<string, number>>({});
  const [pausaTecnica, setPausaTecnica] = useState<PausaTecnica | null>(null);
  const [videoAmpliado, setVideoAmpliado] = useState(false);
  const [mensajeCompartir, setMensajeCompartir] = useState<string | null>(null);
  const [guardando, iniciarGuardado] = useTransition();
  const [personalizando, iniciarPersonalizacion] = useTransition();
  const [errorPersonalizacion, setErrorPersonalizacion] = useState<string | null>(null);
  const gestoInicioX = useRef<number | null>(null);
  const descansoAvisadoRef = useRef<string | null>(null);
  const paginaSesionRef = useRef<HTMLDivElement | null>(null);

  const totalSeries = useMemo(() => EJERCICIOS.reduce((total, ejercicio) => total + ejercicio.repeticiones.length, 0), [EJERCICIOS]);
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
    : desplazarPosicionSerie(ORDEN_EJECUCION, ejercicioDescansoIndice, descanso.serieIndice, 1);
  const ejercicioDespuesDescanso = EJERCICIOS[posicionDespuesDescanso.ejercicioIndice];
  const progreso = totalSeries === 0 ? 0 : (seriesCompletadas / totalSeries) * 100;
  const impulsoActivo = MOMENTOS_ALEJANDRO.find((momento) =>
    momento.ejercicioId === ejercicioActivo.id && momentosVistos[momento.id]
  ) ?? null;
  const claveTecnicaActiva = `${ejercicioActivo.id}-${serieActivaIndiceSeguro}`;
  const segmentosTecnicaActiva = segmentosDeSerie(ejercicioActivo, serieActivaIndiceSeguro);
  const pasoTecnicaActivo = Math.min(pasosTecnica[claveTecnicaActiva] ?? 0, Math.max(0, segmentosTecnicaActiva.length - 1));

  const cambiarImpulsoAutomatico = (activo: boolean) => {
    setImpulsoAutomaticoActivo(activo);
    window.localStorage.setItem("vip-v2-impulso-automatico", String(activo));
    if (!activo) setMomentoVisible(null);
  };

  useEffect(() => {
    const cuadro = window.requestAnimationFrame(() => {
      const sonido = window.localStorage.getItem("vip-v2-sonido-descanso");
      const unidad = window.localStorage.getItem("vip-v2-unidad-peso");
      const impulso = window.localStorage.getItem("vip-v2-impulso-automatico");
      if (sonido !== null) setSonidoDescansoActivo(sonido === "true");
      if (unidad === "lb") {
        setRegistro((actual) => Object.fromEntries(
          Object.entries(actual).map(([ejercicioId, series]) => [
            ejercicioId,
            series.map((serie) => ({ ...serie, peso: convertirPeso(serie.peso, "kg", "lb") })),
          ]),
        ));
        setUnidadPeso("lb");
      }
      if (impulso !== null) setImpulsoAutomaticoActivo(impulso === "true");
    });
    return () => window.cancelAnimationFrame(cuadro);
  }, []);

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
    if (pausada || pausaTecnica === null || pausaTecnica.segundos <= 0) return;
    const intervalo = window.setInterval(() => {
      setPausaTecnica((actual) => actual === null ? null : { ...actual, segundos: Math.max(0, actual.segundos - 1) });
    }, 1000);
    return () => window.clearInterval(intervalo);
  }, [pausaTecnica, pausada]);

  useEffect(() => {
    if (pausaTecnica === null || pausaTecnica.segundos > 0) return;
    const { clave, pasoSiguiente } = pausaTecnica;
    avisarFinDescansoV2(sonidoDescansoActivo);
    const transicion = window.setTimeout(() => {
      setPasosTecnica((actual) => ({ ...actual, [clave]: pasoSiguiente }));
      setPausaTecnica(null);
    }, 0);
    return () => window.clearTimeout(transicion);
  }, [pausaTecnica, sonidoDescansoActivo]);

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
        const siguiente = desplazarPosicionSerie(ORDEN_EJECUCION, ejercicioIndice, descanso.serieIndice, 1);
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
  }, [descanso, descansoEnFoco, EJERCICIOS, ORDEN_EJECUCION, sonidoDescansoActivo, vista]);

  useEffect(() => {
    if (!impulsoAutomaticoActivo || descansoEnFoco || confirmarSalida || registrada) return;
    const momento = MOMENTOS_ALEJANDRO.find((item) =>
      item.ejercicioId === ejercicioActivo.id
      && item.serieIndice === serieActivaIndiceSeguro
      && !momentosVistos[item.id]
      && !registro[ejercicioActivo.id][serieActivaIndiceSeguro].completada
    );
    if (!momento) return;
    const transicion = window.setTimeout(() => setMomentoVisible(momento), 0);
    return () => window.clearTimeout(transicion);
  }, [
    confirmarSalida,
    descansoEnFoco,
    ejercicioActivo.id,
    impulsoAutomaticoActivo,
    MOMENTOS_ALEJANDRO,
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

  const serializarSeries = (series: SerieRegistradaV2[]) => series.map((serie) => ({
    ...serie,
    peso: unidadPeso === "lb" ? convertirPeso(serie.peso, "lb", "kg") : serie.peso,
  }));

  const construirRegistroServidor = (
    ejercicioObjetivo?: EjercicioSesionV2,
    seriesObjetivo?: SerieRegistradaV2[],
  ): RegistroSesionV2 | null => {
    if (!sesion?.real || sesion.soloLectura) return null;
    const ejercicios = ejercicioObjetivo
      ? [{
          sesionEjercicioId: ejercicioObjetivo.sesionEjercicioId ?? "",
          nota: notas[ejercicioObjetivo.id] ?? "",
          series: serializarSeries(seriesObjetivo ?? registro[ejercicioObjetivo.id]),
        }]
      : EJERCICIOS.map((ejercicio) => ({
          sesionEjercicioId: ejercicio.sesionEjercicioId ?? "",
          nota: notas[ejercicio.id] ?? "",
          series: serializarSeries(registro[ejercicio.id]),
        }));
    return { sesionId: sesion.id, ejercicios };
  };

  const persistirEjercicio = (ejercicio: EjercicioSesionV2, series: SerieRegistradaV2[]) => {
    const payload = construirRegistroServidor(ejercicio, series);
    if (!payload) return;
    iniciarGuardado(async () => {
      const resultado = await guardarSesionV2(payload);
      setErrorGuardado(resultado.error);
    });
  };

  const guardarNotaEjercicio = (ejercicio: EjercicioSesionV2, nota: string) => {
    setNotas((actuales) => ({ ...actuales, [ejercicio.id]: nota }));
    if (!sesion?.real || sesion.soloLectura) return;
    const payload: RegistroSesionV2 = {
      sesionId: sesion.id,
      ejercicios: [{
        sesionEjercicioId: ejercicio.sesionEjercicioId ?? "",
        nota,
        series: serializarSeries(registro[ejercicio.id]),
      }],
    };
    iniciarGuardado(async () => {
      const resultado = await guardarSesionV2(payload);
      setErrorGuardado(resultado.error);
    });
  };

  const aplicarSustitucion = (alternativa: AlternativaEjercicioV2) => {
    if (registro[ejercicioActivo.id].some((serie) => serie.completada)) {
      setErrorPersonalizacion("Desmarca primero las series realizadas para que el historial no mezcle dos ejercicios.");
      return;
    }
    const aplicarLocal = () => {
      setEjerciciosSesion((actuales) => actuales.map((ejercicio) => ejercicio.id === ejercicioActivo.id
        ? {
            ...ejercicio,
            bibliotecaEjercicioId: alternativa.id,
            nombre: alternativa.nombre,
            foto: alternativa.foto,
            equipo: alternativa.equipo,
            grupo: alternativa.grupo,
            videoUrl: alternativa.videoUrl,
            videoCloudflareListo: alternativa.videoCloudflareListo,
            ultimoRegistro: undefined,
          }
        : ejercicio));
      setErrorPersonalizacion(null);
      setPanel(null);
    };
    if (!sesion?.real) {
      aplicarLocal();
      return;
    }
    iniciarPersonalizacion(async () => {
      const resultado = await sustituirEjercicioSesionV2({
        sesionEjercicioId: ejercicioActivo.sesionEjercicioId ?? ejercicioActivo.id,
        ejercicioSustitutoId: alternativa.id,
        motivo: "Sustitución elegida por el alumno durante la sesión V2",
      });
      if (!resultado.ok) {
        setErrorPersonalizacion(resultado.error);
        return;
      }
      aplicarLocal();
      router.refresh();
    });
  };

  const moverBloqueEjercicio = (ejercicioId: string, direccion: -1 | 1) => {
    const bloques: EjercicioSesionV2[][] = [];
    for (const ejercicio of EJERCICIOS) {
      const ultimo = bloques.at(-1);
      if (ejercicio.bloqueId && ultimo?.[0]?.bloqueId === ejercicio.bloqueId) ultimo.push(ejercicio);
      else bloques.push([ejercicio]);
    }
    const bloqueIndice = bloques.findIndex((bloque) => bloque.some((ejercicio) => ejercicio.id === ejercicioId));
    const destino = bloqueIndice + direccion;
    if (bloqueIndice < 0 || destino < 0 || destino >= bloques.length) return;
    const siguientesBloques = [...bloques];
    [siguientesBloques[bloqueIndice], siguientesBloques[destino]] = [siguientesBloques[destino], siguientesBloques[bloqueIndice]];
    const siguientes = siguientesBloques.flat();
    const aplicarLocal = () => {
      setEjerciciosSesion(siguientes);
      setErrorPersonalizacion(null);
    };
    if (!sesion?.real) {
      aplicarLocal();
      return;
    }
    iniciarPersonalizacion(async () => {
      const resultado = await reordenarEjerciciosSesionV2({
        sesionId: sesion.id,
        ejerciciosOrdenados: siguientes.map((ejercicio) => ejercicio.sesionEjercicioId ?? ejercicio.id),
      });
      if (!resultado.ok) {
        setErrorPersonalizacion(resultado.error);
        return;
      }
      aplicarLocal();
    });
  };

  const alternarSerie = (ejercicio: EjercicioSesionV2, serieIndice: number) => {
    if (sesion?.soloLectura) return;
    const estabaCompletada = registro[ejercicio.id][serieIndice].completada;
    const claveTecnica = `${ejercicio.id}-${serieIndice}`;
    const segmentos = segmentosDeSerie(ejercicio, serieIndice);
    const pasoActual = Math.min(pasosTecnica[claveTecnica] ?? 0, Math.max(0, segmentos.length - 1));
    if (!estabaCompletada && segmentos.length > 1 && pasoActual < segmentos.length - 1) {
      const siguientePaso = pasoActual + 1;
      const siguienteSegmento = segmentos[siguientePaso];
      setEjercicioActivoId(ejercicio.id);
      setSerieActivaIndice(serieIndice);
      setEjercicioExpandidoId(ejercicio.id);
      setPasosTecnica((actual) => ({ ...actual, [claveTecnica]: siguientePaso }));
      if (siguienteSegmento.tipo === "microdescanso") {
        prepararAviso();
        setPausaTecnica({
          clave: claveTecnica,
          segundos: siguienteSegmento.segundos ?? 15,
          pasoSiguiente: Math.min(siguientePaso + 1, segmentos.length - 1),
        });
      }
      return;
    }
    const ejercicioIndice = EJERCICIOS.findIndex((item) => item.id === ejercicio.id);
    const esUltimaSerieRutina = ejercicioIndice === EJERCICIOS.length - 1
      && serieIndice === ejercicio.repeticiones.length - 1;
    const seriesActualizadas = registro[ejercicio.id].map((serie, indice) =>
      indice === serieIndice ? { ...serie, completada: !serie.completada } : serie
    );
    setRegistro((actual) => ({ ...actual, [ejercicio.id]: seriesActualizadas }));
    persistirEjercicio(ejercicio, seriesActualizadas);
    setEjercicioActivoId(ejercicio.id);
    setSerieActivaIndice(serieIndice);
    setEjercicioExpandidoId(ejercicio.id);

    if (estabaCompletada) {
      setPasosTecnica((actual) => ({ ...actual, [claveTecnica]: 0 }));
      setPausaTecnica((actual) => actual?.clave === claveTecnica ? null : actual);
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

    if (!requiereDescansoDespues(EJERCICIOS, ORDEN_EJECUCION, ejercicioIndice, serieIndice)) {
      const siguiente = desplazarPosicionSerie(ORDEN_EJECUCION, ejercicioIndice, serieIndice, 1);
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
      const siguiente = desplazarPosicionSerie(ORDEN_EJECUCION, ejercicioIndice, serieIndice, 1);
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
        const siguiente = desplazarPosicionSerie(ORDEN_EJECUCION, ejercicioIndice, descanso.serieIndice, 1);
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
    if (!temporizadorAutomatico || !requiereDescansoDespues(EJERCICIOS, ORDEN_EJECUCION, ejercicioActivoIndice, serieActivaIndiceSeguro)) {
      const siguiente = desplazarPosicionSerie(ORDEN_EJECUCION, ejercicioActivoIndice, serieActivaIndiceSeguro, 1);
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
    if (sesion?.real && !sesion.soloLectura) {
      iniciarGuardado(async () => {
        const resultado = await actualizarTemporizadorDescansoAlumno(activo ? "entrenador" : "libre");
        setErrorGuardado(resultado.error);
      });
    }
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

  const abrirVistaVideo = () => {
    // El descanso no desaparece al cambiar el modo visual: es un paso real de
    // la sesión, igual que una serie. Solo cambiamos la vista a la que volverá.
    if (descanso !== null && descansoEnFoco) {
      setDescanso((actual) => actual === null ? null : { ...actual, vistaRetorno: "video" });
      setVista("descanso");
      return;
    }
    setVista("video");
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
    window.localStorage.setItem("vip-v2-unidad-peso", siguienteUnidad);
  };

  const cambiarSonidoDescanso = (activo: boolean) => {
    setSonidoDescansoActivo(activo);
    window.localStorage.setItem("vip-v2-sonido-descanso", String(activo));
  };

  const compartirResumen = async () => {
    const texto = `${sesion?.titulo ?? "Entrenamiento VIP"}: ${seriesCompletadas} series y ${repeticionesCompletadas} repeticiones en ${formatearTiempo(segundosSesion)}.`;
    try {
      const comparteNativo = typeof navigator.share === "function";
      if (comparteNativo) await navigator.share({ title: "Método VIP", text: texto });
      else await navigator.clipboard.writeText(texto);
      setMensajeCompartir(comparteNativo ? "Compartido" : "Resumen copiado");
    } catch (error) {
      if ((error as DOMException).name !== "AbortError") setMensajeCompartir("No se pudo compartir");
    }
  };

  const moverSerie = (direccion: -1 | 1) => {
    const siguiente = desplazarPosicionSerie(ORDEN_EJECUCION, ejercicioActivoIndice, serieActivaIndiceSeguro, direccion);
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

  const registrarEntrenamiento = () => {
    if (!sesion?.real) {
      setConfirmarSalida(false);
      setRegistrada(true);
      return;
    }
    const payload = construirRegistroServidor();
    if (!payload) return;
    iniciarGuardado(async () => {
      const resultado = await guardarYFinalizarSesionV2(payload);
      setErrorGuardado(resultado.error);
      if (!resultado.error) setConfirmarSalida(false);
    });
  };

  if (registrada) {
    return (
      <section className={styles.summaryPage}>
        <span className={styles.summaryEyebrow}>ENTRENAMIENTO REGISTRADO</span>
        <h1>{sesion?.titulo ?? "Día de piernas"}</h1>
        <p>{sesion?.fecha ?? "18 de agosto de 2026"} · {formatearTiempo(segundosSesion)}</p>
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
        {mensajeCompartir ? <p role="status">{mensajeCompartir}</p> : null}
        <div className={styles.summaryActions}><button type="button" onClick={compartirResumen}>Compartir</button><Link href="/portal-v2/entrenamiento">Listo</Link></div>
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
            {ejercicioActivo.videoCloudflareListo ? <VideoCloudflareAutomatico ejercicioId={ejercicioActivo.bibliotecaEjercicioId} activo nombre={ejercicioActivo.nombre} /> : null}
            <div className={styles.videoShade} />
            {(ejercicioActivo.videoCloudflareListo || ejercicioActivo.videoUrl) ? <button type="button" className={styles.videoPlay} onClick={() => setVideoAmpliado(true)} aria-label="Reproducir demostración completa"><Play size={23} fill="currentColor" /></button> : null}
            {controlesVideoVisibles && puedeIrAtras ? <button type="button" className={`${styles.immersiveArrow} ${styles.immersiveArrowLeft}`} onClick={() => moverSerie(-1)} aria-label="Ver serie anterior"><ChevronsLeft size={27} strokeWidth={2.4} /></button> : null}
            {controlesVideoVisibles ? <button type="button" className={`${styles.immersiveArrow} ${styles.immersiveArrowRight}`} onClick={avanzarDesdeVideo} aria-label={puedeIrAdelante ? "Finalizar serie e ir al descanso" : "Finalizar entrenamiento"}><ChevronsRight size={27} strokeWidth={2.4} /></button> : null}
            <span className={styles.videoSpeed}>1× velocidad</span>
            <div className={styles.videoIdentity}><small>SERIE {ejercicioActivo.codigo}</small><h1>{ejercicioActivo.nombre}</h1><p>{ejercicioActivo.equipo}</p></div>
          </div>
          <div className={styles.videoActions}>
            <button type="button" className={styles.impulsoAction} onClick={() => setPanel("impulso")}><Zap size={13} fill="currentColor" />Alejandro</button><button type="button" onClick={() => setPanel("consejo")}><Lightbulb size={13} />Consejo</button><button type="button" onClick={() => setPanel("historial")}><History size={13} />Historial</button><button type="button" onClick={() => setPanel("notas")}><StickyNote size={13} />Notas</button><button type="button" onClick={() => setPanel("informacion")}><Info size={13} />Información</button>{personalizacionDisponible && !sesion?.soloLectura && (alternativas[ejercicioActivo.id]?.length ?? 0) > 0 ? <button type="button" onClick={() => { setErrorPersonalizacion(null); setPanel("sustituir"); }}><Shuffle size={13} />Cambiar</button> : null}{personalizacionDisponible && !sesion?.soloLectura ? <button type="button" onClick={() => { setErrorPersonalizacion(null); setPanel("reordenar"); }}><ArrowUp size={13} />Orden</button> : null}
          </div>
          {impulsoActivo ? (
            <button type="button" className={styles.impulsoNotice} onClick={() => setPanel("impulso")}>
              <Zap size={15} fill="currentColor" />
              <span><strong>Alejandro</strong><small>{impulsoActivo.instruccion}</small></span>
              <b>{momentosLogrados[impulsoActivo.id] ? "Logrado" : `Serie ${impulsoActivo.serieIndice + 1}`}</b>
            </button>
          ) : null}
          {segmentosTecnicaActiva.length ? <TecnicaActivaCard ejercicio={ejercicioActivo} segmentos={segmentosTecnicaActiva} paso={pasoTecnicaActivo} pausa={pausaTecnica?.clave === claveTecnicaActiva ? pausaTecnica.segundos : null} /> : null}
          <div className={`${styles.videoSetStrip} ${impulsoActivo?.serieIndice === serieActivaIndiceSeguro ? styles.videoSetStripImpulse : ""}`}>
            <span><b>Serie</b><em>{serieActivaIndiceSeguro + 1} · trabajo</em></span><span><b>Reps</b><strong>{serieActiva.reps}</strong></span><span><b>Peso ({unidadPeso})</b><strong>{serieActiva.peso || `— ${unidadPeso}`}</strong></span>
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
                  <button type="button" className={styles.exerciseMedia} onClick={abrirVistaVideo} aria-label={`Ver demostración de ${ejercicio.nombre}`}><Image src={ejercicio.foto} alt="" fill sizes="70px" priority={ejercicio.codigo === "A"} /><i><Play size={17} fill="currentColor" /></i></button>
                  <button type="button" className={styles.exerciseHeadingToggle} aria-expanded="true" onClick={() => setEjercicioExpandidoId(null)}><h1>{ejercicio.nombre}</h1><p><b>Reps:</b> {ejercicio.repeticiones.join("  ·  ")}</p></button>
                </div>
                <div className={styles.actionChips}><button type="button" className={styles.impulsoAction} onClick={() => setPanel("impulso")}><Zap size={14} fill="currentColor" />Alejandro</button><button type="button" onClick={() => setPanel("consejo")}><Lightbulb size={14} />Consejo</button><button type="button" onClick={() => setPanel("historial")}><History size={14} />Historial</button><button type="button" onClick={() => setPanel("notas")}><StickyNote size={14} />Notas</button>{personalizacionDisponible && !sesion?.soloLectura && (alternativas[ejercicio.id]?.length ?? 0) > 0 ? <button type="button" onClick={() => { setErrorPersonalizacion(null); setPanel("sustituir"); }}><Shuffle size={14} />Cambiar</button> : null}{personalizacionDisponible && !sesion?.soloLectura ? <button type="button" onClick={() => { setErrorPersonalizacion(null); setPanel("reordenar"); }}><ArrowUp size={14} />Orden</button> : null}</div>
                {impulsoEjercicio ? (
                  <button type="button" className={styles.impulsoNotice} onClick={() => setPanel("impulso")}>
                    <Zap size={15} fill="currentColor" />
                    <span><strong>Alejandro</strong><small>{impulsoEjercicio.instruccion}</small></span>
                    <b>{momentosLogrados[impulsoEjercicio.id] ? "Logrado" : `Serie ${impulsoEjercicio.serieIndice + 1}`}</b>
                  </button>
                ) : null}
                {ejercicio.id === ejercicioActivo.id && segmentosTecnicaActiva.length ? <TecnicaActivaCard ejercicio={ejercicio} segmentos={segmentosTecnicaActiva} paso={pasoTecnicaActivo} pausa={pausaTecnica?.clave === claveTecnicaActiva ? pausaTecnica.segundos : null} /> : null}
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
                          <span className={styles.setNumber}><b>{serieIndice + 1}</b><em aria-label="Serie de trabajo">TRAB.</em></span>
                          <input aria-label={`Repeticiones, serie ${serieIndice + 1}`} aria-readonly={!esSerieActiva || sesion?.soloLectura} inputMode="numeric" value={serie.reps} readOnly={!esSerieActiva || sesion?.soloLectura} tabIndex={esSerieActiva && !sesion?.soloLectura ? 0 : -1} onFocus={activarEstaSerie} onChange={(evento) => actualizarSerie(ejercicio.id, serieIndice, "reps", evento.target.value)} />
                          <input aria-label={`Peso en ${unidadPeso}, serie ${serieIndice + 1}`} aria-readonly={!esSerieActiva || sesion?.soloLectura} inputMode="decimal" value={serie.peso} readOnly={!esSerieActiva || sesion?.soloLectura} tabIndex={esSerieActiva && !sesion?.soloLectura ? 0 : -1} placeholder={`— ${unidadPeso}`} onFocus={activarEstaSerie} onChange={(evento) => actualizarSerie(ejercicio.id, serieIndice, "peso", evento.target.value)} />
                          <span className={styles.restValue}>{esUltimaSerieRutina ? "Final" : requiereDescansoDespues(EJERCICIOS, ORDEN_EJECUCION, EJERCICIOS.findIndex((item) => item.id === ejercicio.id), serieIndice) ? `${ejercicio.descanso} s` : "Avanza"}</span>
                          <button type="button" className={styles.checkButton} disabled={sesion?.soloLectura} onClick={(evento) => { evento.stopPropagation(); if (esSerieActiva) alternarSerie(ejercicio, serieIndice); else activarEstaSerie(); }} aria-label={esSerieActiva ? `${serie.completada ? "Desmarcar" : "Registrar"} serie ${serieIndice + 1}` : `Activar serie ${serieIndice + 1}`} aria-pressed={serie.completada}>{serie.completada ? <Check size={16} strokeWidth={3} /> : <CircleCheck size={19} />}</button>
                        </div>
                        {descansoDeEstaSerie ? <div className={`${styles.inlineRest} ${descansoEnFoco ? styles.inlineRestActive : ""}`} aria-current={descansoEnFoco ? "step" : undefined} aria-live="polite"><button type="button" onClick={() => ajustarDescanso(-15)}>−15 s</button><button type="button" className={styles.inlineRestTime} onClick={() => { setDescansoEnFoco(true); setVista("descanso"); }}>Descanso {descanso.segundos} s</button><button type="button" onClick={() => ajustarDescanso(15)}>+15 s</button></div> : null}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
          <button type="button" className={styles.videoViewButton} onClick={abrirVistaVideo}><ListVideo size={14} /> Vista de video</button>
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
          cambiarSonidoDescanso={cambiarSonidoDescanso}
          cambiarImpulsoAutomatico={cambiarImpulsoAutomatico}
          cambiarUnidadPeso={cambiarUnidadPeso}
          impulsoActual={impulsoActivo}
          cupoImpulso={MOMENTOS_ALEJANDRO.length}
          impulsosLogrados={Object.keys(momentosLogrados).length}
          alternativas={alternativas[ejercicioActivo.id] ?? []}
          ejerciciosSesion={EJERCICIOS}
          personalizando={personalizando}
          errorPersonalizacion={errorPersonalizacion}
          onSustituir={aplicarSustitucion}
          onMover={moverBloqueEjercicio}
          guardarNota={(nota) => guardarNotaEjercicio(ejercicioActivo, nota)}
          cerrar={() => setPanel(null)}
        />
      ) : null}
      {videoAmpliado && ejercicioActivo.videoCloudflareListo && ejercicioActivo.bibliotecaEjercicioId ? <ModalVideoCloudflare ejercicioId={ejercicioActivo.bibliotecaEjercicioId} nombre={ejercicioActivo.nombre} onCerrar={() => setVideoAmpliado(false)} /> : null}
      {videoAmpliado && !ejercicioActivo.videoCloudflareListo && ejercicioActivo.videoUrl ? <ModalVideo videoUrl={ejercicioActivo.videoUrl} nombre={ejercicioActivo.nombre} onCerrar={() => setVideoAmpliado(false)} /> : null}
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
            <h2>¿Finalizar y registrar?</h2><p>Registra el entrenamiento para cerrar la sesión y calcular tu progreso. Si continúas después, los datos ya guardados permanecen en borrador.</p>
            <div className={styles.finishMetrics}><span><strong>{formatearTiempo(segundosSesion)}</strong>Tiempo total</span><span><strong>{seriesCompletadas}</strong>Series registradas</span></div>
            {errorGuardado ? <p role="alert">{errorGuardado}</p> : null}
            <div className={styles.finishActions}><Link href="/portal-v2/entrenamiento">Continuar después</Link><button type="button" disabled={guardando || sesion?.soloLectura} onClick={registrarEntrenamiento}>{guardando ? "Guardando…" : "Registrar entrenamiento"}</button></div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function TecnicaActivaCard({ ejercicio, segmentos, paso, pausa }: { ejercicio: EjercicioSesionV2; segmentos: SegmentoTecnicaSesion[]; paso: number; pausa: number | null }) {
  const actual = segmentos[paso];
  return (
    <section className={styles.techniqueFlow} aria-live="polite">
      <header><span>{ejercicio.tecnica ?? "Técnica avanzada"}</span><b>{paso + 1}/{segmentos.length}</b></header>
      <div><Zap size={16} fill="currentColor" /><strong>{actual.etiqueta}</strong><em>{pausa !== null ? `${pausa} s` : actual.reps ?? (actual.ajusteCargaPorcentaje ? `${actual.ajusteCargaPorcentaje}% de carga` : "LISTO")}</em></div>
      {ejercicio.tecnicaInstruccion ? <p>{ejercicio.tecnicaInstruccion}</p> : null}
      <i aria-hidden="true"><span style={{ width: `${((paso + 1) / segmentos.length) * 100}%` }} /></i>
    </section>
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
  alternativas,
  ejerciciosSesion,
  personalizando,
  errorPersonalizacion,
  onSustituir,
  onMover,
  guardarNota,
  cerrar,
}: {
  tipo: Exclude<PanelSesion, null>;
  ejercicio: EjercicioSesionV2;
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
  alternativas: AlternativaEjercicioV2[];
  ejerciciosSesion: EjercicioSesionV2[];
  personalizando: boolean;
  errorPersonalizacion: string | null;
  onSustituir: (alternativa: AlternativaEjercicioV2) => void;
  onMover: (ejercicioId: string, direccion: -1 | 1) => void;
  guardarNota: (nota: string) => void;
  cerrar: () => void;
}) {
  const [notaBorrador, setNotaBorrador] = useState(notaInicial);
  const titulos = { consejo: "Consejo del entrenador", historial: "Último registro", notas: "Notas del ejercicio", ajustes: "Ajustes de la sesión", informacion: "Información del ejercicio", impulso: "Alejandro · Impulso VIP", sustituir: "Cambiar ejercicio", reordenar: "Orden de la sesión" };
  return (
    <div className={styles.sheetBackdrop} role="presentation" onClick={cerrar}>
      <section className={styles.auxSheet} role="dialog" aria-modal="true" aria-label={titulos[tipo]} onClick={(evento) => evento.stopPropagation()}>
        <div className={styles.sheetHandle} />
        <header><div><small>SERIE {ejercicio.codigo}</small><h2>{titulos[tipo]}</h2></div><button type="button" onClick={cerrar} aria-label="Cerrar"><X size={17} /></button></header>
        {tipo === "consejo" ? <p className={styles.sheetCopy}>{ejercicio.consejo ?? "Tu entrenador no dejó una indicación adicional para este ejercicio. Sigue la técnica mostrada y evita compensaciones."}</p> : null}
        {tipo === "historial" ? ejercicio.ultimoRegistro ? <div className={styles.historyGrid}><span>Fecha</span><span>Reps</span><span>Peso</span><strong>{new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", timeZone: "America/Santiago" }).format(new Date(`${ejercicio.ultimoRegistro.fecha}T12:00:00`))}</strong><strong>{ejercicio.ultimoRegistro.reps ?? "—"}</strong><strong>{ejercicio.ultimoRegistro.esPesoCorporal ? "Corporal" : ejercicio.ultimoRegistro.pesoKg === null ? "—" : pesoHistorico(ejercicio.ultimoRegistro.pesoKg, unidadPeso)}</strong></div> : <p className={styles.sheetCopy}>Todavía no hay un registro anterior de este ejercicio. Lo que guardes hoy será tu primera referencia real.</p> : null}
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
        {tipo === "notas" ? <label className={styles.exerciseNotes}><span>Nota personal</span><textarea value={notaBorrador} onChange={(evento) => setNotaBorrador(evento.target.value)} placeholder="Escribe una observación para este ejercicio…" /><button type="button" onClick={() => { guardarNota(notaBorrador); cerrar(); }}>Guardar nota</button></label> : null}
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
        {tipo === "sustituir" ? (
          <div className={styles.swapList}>
            <p className={styles.sheetCopy}>Sólo aparecen alternativas aprobadas que conservan el grupo muscular y el patrón. El cambio afecta esta sesión, no la rutina publicada.</p>
            {alternativas.map((alternativa) => (
              <button type="button" key={alternativa.id} disabled={personalizando} onClick={() => onSustituir(alternativa)}>
                <Shuffle size={16} /><span><strong>{alternativa.nombre}</strong><small>{alternativa.equipo} · {alternativa.grupo}</small></span><ChevronRight size={17} />
              </button>
            ))}
            {alternativas.length === 0 ? <p className={styles.sheetCopy}>No hay una alternativa compatible y aprobada para este ejercicio.</p> : null}
            {errorPersonalizacion ? <p className={styles.personalizationError} role="alert">{errorPersonalizacion}</p> : null}
          </div>
        ) : null}
        {tipo === "reordenar" ? (
          <div className={styles.reorderPreview}>
            <p className={styles.sheetCopy}>Mueve ejercicios completos. Las biseries, trisets y series gigantes permanecen unidas.</p>
            {ejerciciosSesion.map((item, indice) => {
              const esInicioBloque = !item.bloqueId || ejerciciosSesion[indice - 1]?.bloqueId !== item.bloqueId;
              const esFinBloque = !item.bloqueId || ejerciciosSesion[indice + 1]?.bloqueId !== item.bloqueId;
              return (
                <div key={item.id} data-blocked={!esInicioBloque && !esFinBloque}>
                  <span><b>{item.codigo}</b><strong>{item.nombre}</strong>{item.tecnica ? <small>{item.tecnica}</small> : null}</span>
                  {esInicioBloque ? <button type="button" disabled={personalizando || indice === 0} onClick={() => onMover(item.id, -1)} aria-label={`Subir ${item.nombre}`}><ArrowUp size={16} /></button> : <i />}
                  {esFinBloque ? <button type="button" disabled={personalizando || indice === ejerciciosSesion.length - 1} onClick={() => onMover(item.id, 1)} aria-label={`Bajar ${item.nombre}`}><ArrowDown size={16} /></button> : <i />}
                </div>
              );
            })}
            {errorPersonalizacion ? <p className={styles.personalizationError} role="alert">{errorPersonalizacion}</p> : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
