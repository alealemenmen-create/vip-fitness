"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Activity,
  ArrowLeft,
  Check,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CircleCheck,
  Dumbbell,
  FastForward,
  Gauge,
  History,
  Info,
  Lightbulb,
  ListVideo,
  Minus,
  Pause,
  Play,
  Plus,
  Settings,
  ShieldAlert,
  Shuffle,
  StickyNote,
  Target,
  X,
  Zap,
} from "lucide-react";
import { programarAvisoAusenciaDescansoV2 } from "@/app/alumno/entrenar/push-actions";
import { avisarFinDescansoV2, cortarAviso, prepararAviso } from "@/lib/entrenamiento/aviso";
import {
  claveBorradorSesionV2,
  restaurarBorradorSesionV2,
  resolverVistaAlRestaurarDescanso,
  type BorradorSesionV2,
} from "@/lib/entrenamiento/borrador-sesion-v2";
import { reconciliarDuracionSesionSegundos } from "@/lib/entrenamiento/duracion-sesion";
import {
  consumirSalidaTemporalSesionV2,
  marcarSalidaTemporalSesionV2,
  UMBRAL_AUSENCIA_MS,
} from "@/lib/entrenamiento/salida-temporal-sesion-v2";
import {
  ajustarFinDescanso,
  claveDescansoSesion,
  destinoAlAvanzarSerieCompletada,
  segundosRestantesDescanso,
} from "@/lib/entrenamiento/descanso-navegacion";
import {
  esUltimaPosicionSerie,
  planificarBloqueEncadenado,
  planificarSegmentosTecnica,
  type SegmentoTecnicaSesion,
  type TecnicaEncadenadaSlug,
  type TecnicaIndividualSlug,
} from "@/lib/entrenamiento/motor-tecnicas-sesion";
import { tecnicaAplicaASerie } from "@/lib/entrenamiento/tecnica-series";
import { EVENTO_XP_GANADO } from "@/lib/xp-eventos";
import {
  encontrarMomentoPendienteDeResultado,
  seleccionarMomentosAlejandro,
  type MomentoSesionAlejandro,
} from "@/lib/impulso-vip/alejandro-sesion";
import type { PreparacionDiariaAlejandro } from "@/lib/impulso-vip/preparacion-diaria";
import {
  calibrarIntervencionEnVivoV2,
  marcarIntervencionMostrada,
  resolverIntervencionAutomaticaV2,
} from "@/app/alumno/entrenar/impulso-actions";
import type { ResultadoIntervencionImpulso } from "@/lib/supabase/types";
import {
  actualizarTemporizadorDescansoAlumno,
  cancelarSesionEnCurso,
  guardarAvanceSesionV2,
  guardarSesionV2,
  guardarYFinalizarSesionV2,
  type RegistroSesionV2,
} from "@/app/alumno/entrenar/actions";
import { reordenarEjerciciosSesionV2, sustituirEjercicioSesionV2 } from "@/app/portal-v2/entrenamiento/sesion/actions";
import { ModalVideo } from "@/components/student/ModalVideo";
import { ModalVideoCloudflare } from "@/components/student/ModalVideoCloudflare";
import { VideoCloudflareAutomatico } from "@/components/student/VideoCloudflareAutomatico";
import { ImagenV2Segura } from "@/components/v2/ImagenV2Segura";
import { agruparEnBloques, AsaArrastre, BloqueArrastrableEnLinea, DndContextOrden, OrdenSesionV2 } from "@/components/v2/OrdenSesionV2";
import {
  CLAVE_ESCALA_VISUAL_V2,
  ESCALAS_VISUALES_V2,
  ETIQUETAS_ESCALA_VISUAL_V2,
  escalaVisualV2Valida,
  type EscalaVisualV2,
} from "@/lib/v2/escala-visual";
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
  fotoRespaldo?: string;
  videoUrl?: string;
  videoCloudflareListo?: boolean;
  videoPoster?: string;
  equipo: string;
  grupo: string;
  grupoClave?: string;
  gruposSecundarios?: string[];
  categoria?: string;
  patronMovimiento?: string;
  nivel?: string;
  descripcion?: string;
  instrucciones?: string[];
  erroresComunes?: string[];
  tecnica?: string;
  /** Color de la familia de técnica (superserie, biserie...), ver
   * `resolverGrupoTecnica` en tecnica-grupo.ts. Pinta el "lazo" que une los
   * ejercicios de un mismo bloque en vista de lista y la etiqueta de técnica
   * en vista de video — antes ese color se calculaba en el servidor
   * (sesion/page.tsx) pero se descartaba, solo viajaba el nombre. */
  tecnicaColor?: string;
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
  fotoRespaldo?: string;
  equipo: string;
  grupo: string;
  videoUrl?: string;
  videoCloudflareListo?: boolean;
  videoPoster?: string;
};

export type SesionActivaModeloV2 = {
  id: string;
  titulo: string;
  fecha: string;
  real: boolean;
  soloLectura: boolean;
  duracionSegundosInicial?: number;
  temporizadorAutomaticoInicial?: boolean;
  comentarioInicial?: string;
  ejercicios: EjercicioSesionV2[];
  momentosAlejandro: MomentoSesionAlejandro[];
  preparacionAlejandro?: PreparacionDiariaAlejandro;
  personalizacionDisponible?: boolean;
  alternativas?: Record<string, AlternativaEjercicioV2[]>;
};

type DescansoActivo = {
  ejercicioId: string;
  serieIndice: number;
  segundos: number;
  finEn: number;
  tipo: "automatico" | "manual" | "referencia";
  vistaRetorno: Exclude<VistaSesion, "descanso">;
};

type PanelSesion = "consejo" | "historial" | "notas" | "ajustes" | "informacion" | "impulso" | "sustituir" | "reordenar" | null;
type EstadoSincronizacion = "listo" | "pendiente" | "guardando" | "guardado" | "error";
type VistaSesion = "lista" | "video" | "descanso";
type UnidadPeso = "kg" | "lb";
type PausaTecnica = { clave: string; segundos: number; pasoSiguiente: number };
type DificultadImpulsoVIP = "muy_facil" | "facil" | "justo" | "dificil" | "fallo";

const OPCIONES_DIFICULTAD_IMPULSO: { valor: DificultadImpulsoVIP; etiqueta: string }[] = [
  { valor: "muy_facil", etiqueta: "Estuvo fácil" },
  { valor: "facil", etiqueta: "Podía hacer más" },
  { valor: "justo", etiqueta: "Estuvo justo" },
  { valor: "dificil", etiqueta: "Estuvo muy difícil" },
  { valor: "fallo", etiqueta: "No pude completarlo" },
];

const EJERCICIOS_DEMO: EjercicioSesionV2[] = [
  { id: "sentadilla-smith", codigo: "A", nombre: "Sentadilla Smith", repeticiones: [10, 10, 10, 10], descanso: 60, foto: "/v2/piernas.webp", equipo: "Máquina Smith", grupo: "Cuádriceps · glúteos" },
  { id: "peso-muerto-rumano", codigo: "B1", nombre: "Peso muerto rumano", repeticiones: [8, 8, 8], descanso: 0, foto: "/v2/espalda.webp", equipo: "Barra", grupo: "Femoral · glúteos", tecnica: "Superserie", tecnicaColor: "var(--color-tecnica-superserie)", bloqueId: "superserie-b", tecnicaSlug: "superserie" },
  { id: "prensa-inclinada", codigo: "B2", nombre: "Prensa inclinada", repeticiones: [12, 12, 12], descanso: 90, foto: "/v2/piernas.webp", equipo: "Prensa 45°", grupo: "Cuádriceps", tecnica: "Superserie", tecnicaColor: "var(--color-tecnica-superserie)", bloqueId: "superserie-b", tecnicaSlug: "superserie" },
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

function finDescansoDesdeAhora(segundos: number) {
  return Date.now() + segundos * 1_000;
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
  const [segundosSesion, setSegundosSesion] = useState(() => sesion?.duracionSegundosInicial ?? 0);
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
  const [comentarioSesion, setComentarioSesion] = useState(sesion?.comentarioInicial ?? "");
  const [confirmarSalida, setConfirmarSalida] = useState(false);
  const [avisoRegresoTardio, setAvisoRegresoTardio] = useState(false);
  const [registrada, setRegistrada] = useState(false);
  const [puntosGanados, setPuntosGanados] = useState<number | null>(null);
  const [temporizadorAutomatico, setTemporizadorAutomatico] = useState(sesion?.temporizadorAutomaticoInicial ?? true);
  const [sonidoDescansoActivo, setSonidoDescansoActivo] = useState(true);
  const [unidadPeso, setUnidadPeso] = useState<UnidadPeso>("kg");
  const [escalaVisual, setEscalaVisual] = useState<EscalaVisualV2>("normal");
  const [impulsoAutomaticoActivo, setImpulsoAutomaticoActivo] = useState(true);
  const [momentosVistos, setMomentosVistos] = useState<Record<string, boolean>>(() => Object.fromEntries(
    MOMENTOS_ALEJANDRO.filter((momento) => momento.mostradoInicial).map((momento) => [momento.id, true]),
  ));
  const [momentosLogrados, setMomentosLogrados] = useState<Record<string, boolean>>({});
  const [momentosRegistrados, setMomentosRegistrados] = useState<Record<string, boolean>>({});
  const [momentoVisible, setMomentoVisible] = useState<MomentoSesionAlejandro | null>(null);
  const [momentoPorCalibrar, setMomentoPorCalibrar] = useState<MomentoSesionAlejandro | null>(null);
  const [errorCalibracion, setErrorCalibracion] = useState<string | null>(null);
  const [momentoParaResultado, setMomentoParaResultado] = useState<MomentoSesionAlejandro | null>(null);
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);
  const [estadoSincronizacion, setEstadoSincronizacion] = useState<EstadoSincronizacion>("listo");
  const [borradorCargado, setBorradorCargado] = useState(false);
  const [pasosTecnica, setPasosTecnica] = useState<Record<string, number>>({});
  const [pausaTecnica, setPausaTecnica] = useState<PausaTecnica | null>(null);
  const [videoAmpliado, setVideoAmpliado] = useState(false);
  const [fichaEjercicioId, setFichaEjercicioId] = useState<string | null>(null);
  const [mensajeCompartir, setMensajeCompartir] = useState<string | null>(null);
  const [guardando, iniciarGuardado] = useTransition();
  const [personalizando, iniciarPersonalizacion] = useTransition();
  const [errorPersonalizacion, setErrorPersonalizacion] = useState<string | null>(null);
  const [ordenAnterior, setOrdenAnterior] = useState<EjercicioSesionV2[] | null>(null);
  const deshacerOrdenTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gestoInicioX = useRef<number | null>(null);
  const descansoAvisadoRef = useRef<string | null>(null);
  const avisoAusenciaProgramadoRef = useRef<string | null>(null);
  const descansosResueltosRef = useRef<Set<string>>(new Set());
  const paginaSesionRef = useRef<HTMLDivElement | null>(null);
  const resumenRef = useRef<HTMLElement | null>(null);
  const temporizadoresAutoguardadoRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const colaGuardadoRef = useRef<Promise<void>>(Promise.resolve());

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
  const fichaEjercicio = fichaEjercicioId === null
    ? null
    : EJERCICIOS.find((ejercicio) => ejercicio.id === fichaEjercicioId) ?? null;
  const serieActivaIndiceSeguro = limitar(serieActivaIndice, 0, ejercicioActivo.repeticiones.length - 1);
  const serieActiva = registro[ejercicioActivo.id][serieActivaIndiceSeguro];
  const seriesCompletadasEjercicioActivo = registro[ejercicioActivo.id].filter((serie) => serie.completada).length;
  const ejercicioActivoRealizado = seriesCompletadasEjercicioActivo === registro[ejercicioActivo.id].length;
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
    const temporizadoresAutoguardado = temporizadoresAutoguardadoRef.current;
    return () => {
      if (deshacerOrdenTimeoutRef.current) clearTimeout(deshacerOrdenTimeoutRef.current);
      for (const temporizador of temporizadoresAutoguardado.values()) clearTimeout(temporizador);
      temporizadoresAutoguardado.clear();
    };
  }, []);

  useEffect(() => {
    const cuadro = window.requestAnimationFrame(() => {
      const sonido = window.localStorage.getItem("vip-v2-sonido-descanso");
      const unidad = window.localStorage.getItem("vip-v2-unidad-peso");
      const impulso = window.localStorage.getItem("vip-v2-impulso-automatico");
      const escala = window.localStorage.getItem(CLAVE_ESCALA_VISUAL_V2);
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
      if (escalaVisualV2Valida(escala)) setEscalaVisual(escala);
    });
    return () => window.cancelAnimationFrame(cuadro);
  }, []);

  useEffect(() => {
    const cuadro = window.requestAnimationFrame(() => {
      if (!sesion?.real || sesion.soloLectura) {
        setBorradorCargado(true);
        return;
      }

      const registroBase = crearRegistroInicial(sesion.ejercicios);
      const notasBase = Object.fromEntries(sesion.ejercicios.map((ejercicio) => [
        ejercicio.id,
        ejercicio.notaInicial ?? "",
      ]));
      const clave = claveBorradorSesionV2(sesion.id);
      const borrador = restaurarBorradorSesionV2(window.localStorage.getItem(clave), {
        sesionId: sesion.id,
        registroBase,
        notasBase,
        comentarioBase: sesion.comentarioInicial ?? "",
      });

      if (borrador) {
        setRegistro(borrador.registro);
        setNotas(borrador.notas);
        setComentarioSesion(borrador.comentarioSesion);
        setSegundosSesion(reconciliarDuracionSesionSegundos(
          sesion.duracionSegundosInicial ?? 0,
          borrador.segundosSesion,
        ));
        setEjercicioActivoId(borrador.ejercicioActivoId);
        setSerieActivaIndice(borrador.serieActivaIndice);
        setEjercicioExpandidoId(borrador.ejercicioActivoId);
        setUnidadPeso(borrador.unidadPeso);
        setPasosTecnica(borrador.pasosTecnica);
        setPausaTecnica(borrador.pausaTecnica);
        if (borrador.descanso) {
          setDescanso({
            ejercicioId: borrador.descanso.ejercicioId,
            serieIndice: borrador.descanso.serieIndice,
            segundos: segundosRestantesDescanso(borrador.descanso.finEn),
            finEn: borrador.descanso.finEn,
            tipo: borrador.descanso.tipo,
            vistaRetorno: borrador.descanso.vistaRetorno,
          });
          setDescansoEnFoco(borrador.descanso.enFoco);
          const vistaRestaurada = resolverVistaAlRestaurarDescanso(borrador.descanso);
          if (vistaRestaurada) setVista(vistaRestaurada);
        }
      } else if (window.localStorage.getItem(clave)) {
        window.localStorage.removeItem(clave);
      }
      setBorradorCargado(true);
    });
    return () => window.cancelAnimationFrame(cuadro);
  }, [sesion]);

  // Si el alumno usó "Salir un momento" (por ejemplo, para anotar algo en
  // Nutrición) y tardó 5 minutos o más en volver, se le fuerza a elegir en
  // vez de retomar en silencio -- puede haber pasado mucho rato entrenando
  // "de fondo" sin darse cuenta. Si volvió antes, sigue como si nada.
  useEffect(() => {
    if (!sesion?.real || sesion.soloLectura) return;
    const cuadro = window.requestAnimationFrame(() => {
      const ausenciaMs = consumirSalidaTemporalSesionV2(sesion.id);
      if (ausenciaMs !== null && ausenciaMs >= UMBRAL_AUSENCIA_MS) setAvisoRegresoTardio(true);
    });
    return () => window.cancelAnimationFrame(cuadro);
  }, [sesion]);

  // El push de "sigues de descanso" se dispara cuando la app pasa a segundo
  // plano DE VERDAD con un descanso pendiente -- no cuando se cumple el
  // tiempo configurado, que mandaba el aviso aunque el alumno siguiera
  // activo mirando la pantalla (reporte real: llegó en plena serie 4).
  // `visibilitychange` es el único evento que sobrevive a cambiar de app o
  // bloquear la pantalla. Una vez por descanso alcanza -- Alejandro pidió
  // un solo aviso, no una cadena.
  useEffect(() => {
    if (!descanso || !temporizadorAutomatico || !sesion?.real) return;
    const clave = claveDescansoSesion(descanso.ejercicioId, descanso.serieIndice);
    const alCambiarVisibilidad = () => {
      if (document.visibilityState !== "hidden") return;
      if (avisoAusenciaProgramadoRef.current === clave) return;
      avisoAusenciaProgramadoRef.current = clave;
      void programarAvisoAusenciaDescansoV2(sesion.id).catch(() => {});
    };
    document.addEventListener("visibilitychange", alCambiarVisibilidad);
    return () => document.removeEventListener("visibilitychange", alCambiarVisibilidad);
  }, [descanso, temporizadorAutomatico, sesion?.real, sesion?.id]);

  useEffect(() => {
    if (!borradorCargado || !sesion?.real || sesion.soloLectura || registrada) return;
    const clave = claveBorradorSesionV2(sesion.id);
    const temporizador = window.setTimeout(() => {
      const borrador: BorradorSesionV2 = {
        version: 1,
        sesionId: sesion.id,
        actualizadoEn: Date.now(),
        registro,
        notas,
        comentarioSesion,
        segundosSesion,
        ejercicioActivoId,
        serieActivaIndice,
        unidadPeso,
        pasosTecnica,
        pausaTecnica,
        descanso: descanso && descanso.tipo !== "referencia" ? {
          ejercicioId: descanso.ejercicioId,
          serieIndice: descanso.serieIndice,
          finEn: descanso.finEn,
          tipo: descanso.tipo,
          vistaRetorno: descanso.vistaRetorno,
          enFoco: descansoEnFoco,
        } : null,
      };
      window.localStorage.setItem(clave, JSON.stringify(borrador));
    }, 180);
    return () => window.clearTimeout(temporizador);
  }, [
    borradorCargado,
    ejercicioActivoId,
    comentarioSesion,
    descanso,
    descansoEnFoco,
    notas,
    pasosTecnica,
    pausaTecnica,
    registrada,
    registro,
    segundosSesion,
    serieActivaIndice,
    sesion,
    unidadPeso,
  ]);

  useEffect(() => {
    if (pausada || registrada || sesion?.soloLectura) return;
    const intervalo = window.setInterval(() => setSegundosSesion((valor) => valor + 1), 1000);
    return () => window.clearInterval(intervalo);
  }, [pausada, registrada, sesion?.soloLectura]);

  const finDescansoActivo = descanso?.tipo === "referencia" ? null : descanso?.finEn ?? null;
  useEffect(() => {
    if (pausada || finDescansoActivo === null) return;
    const actualizar = () => {
      setDescanso((actual) => {
        if (actual === null) return null;
        const segundos = segundosRestantesDescanso(actual.finEn);
        return segundos === actual.segundos ? actual : { ...actual, segundos };
      });
    };
    actualizar();
    const intervalo = window.setInterval(actualizar, 250);
    return () => window.clearInterval(intervalo);
  }, [finDescansoActivo, pausada]);

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
    // Con el temporizador automatico desactivado el descanso sigue siendo un
    // campo real del entrenamiento, pero no debe descontar ni emitir avisos.
    if (descanso.tipo === "referencia") return;
    const clave = claveDescansoSesion(descanso.ejercicioId, descanso.serieIndice);
    if (descanso.segundos > 0) {
      if (descansoAvisadoRef.current === clave) descansoAvisadoRef.current = null;
      return;
    }
    if (descansoAvisadoRef.current === clave) return;
    descansoAvisadoRef.current = clave;
    if (descanso.tipo === "automatico") descansosResueltosRef.current.add(clave);
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
    if (!impulsoAutomaticoActivo || descansoEnFoco || confirmarSalida || registrada || sesion?.soloLectura) return;
    const momento = MOMENTOS_ALEJANDRO.find((item) =>
      item.ejercicioId === ejercicioActivo.id
      && item.serieIndice === serieActivaIndiceSeguro
      && !momentosVistos[item.id]
      && !registro[ejercicioActivo.id][serieActivaIndiceSeguro].completada
    );
    if (!momento) return;
    // Antes de mostrar el momento, si todavia no se calibro con la
    // pregunta "¿cuantas mas podias hacer?" sobre la serie anterior -- y
    // esa serie anterior ya esta hecha -- se pide esa calibracion primero
    // (mismo criterio que MomentoImpulsoEnVivo.tsx en la sesion clasica).
    // Sin esto, el motor automatico de V2 nunca llegaba a escalar a
    // drop set/rest-pause/fallo controlado por esta via.
    if (momento.estado === "preparada" && !momento.calibrada) {
      const previa = registro[momento.ejercicioId]?.[momento.serieIndice - 1];
      if (!previa?.completada) return;
      const transicion = window.setTimeout(() => setMomentoPorCalibrar(momento), 0);
      return () => window.clearTimeout(transicion);
    }
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
    sesion?.soloLectura,
    serieActivaIndiceSeguro,
  ]);

  const calibrarMomento = (momento: MomentoSesionAlejandro, rir: number) => {
    setMomentoPorCalibrar(null);
    setErrorCalibracion(null);
    if (!sesion?.real) return;
    iniciarGuardado(async () => {
      try {
        const resultado = await calibrarIntervencionEnVivoV2(momento.id, rir);
        if (!resultado.ok) {
          setErrorCalibracion(resultado.error ?? "No pudimos calibrar esa serie.");
          return;
        }
        // La calibracion puede haber cambiado la tecnica (por ejemplo, a
        // drop set) o la instruccion -- se vuelve a pedir la sesion al
        // servidor para traer ese resultado real en vez de intentar
        // reconstruirlo a mano en el cliente.
        router.refresh();
      } catch {
        setErrorCalibracion("No pudimos enviar tu respuesta. Intenta de nuevo desde Impulso VIP.");
      }
    });
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
    return { sesionId: sesion.id, ejercicios, comentario: comentarioSesion };
  };

  const encolarGuardado = (
    guardar: () => Promise<{ error: string | null }>,
    mensajeConexion: string,
    alGuardar?: () => void,
  ) => {
    setEstadoSincronizacion("guardando");
    const tarea = colaGuardadoRef.current
      .catch(() => undefined)
      .then(async () => {
        try {
          const resultado = await guardar();
          setErrorGuardado(resultado.error);
          setEstadoSincronizacion(resultado.error ? "error" : "guardado");
          if (!resultado.error) alGuardar?.();
        } catch {
          setEstadoSincronizacion("error");
          setErrorGuardado(mensajeConexion);
        }
      });
    colaGuardadoRef.current = tarea;
    iniciarGuardado(async () => tarea);
  };

  const cancelarAutoguardado = (ejercicioId: string) => {
    const temporizador = temporizadoresAutoguardadoRef.current.get(ejercicioId);
    if (temporizador) clearTimeout(temporizador);
    temporizadoresAutoguardadoRef.current.delete(ejercicioId);
  };

  const guardarAvanceEjercicio = (ejercicio: EjercicioSesionV2, series: SerieRegistradaV2[]) => {
    cancelarAutoguardado(ejercicio.id);
    const payload = construirRegistroServidor(ejercicio, series);
    if (!payload) return;
    encolarGuardado(
      () => guardarAvanceSesionV2(payload),
      "No pudimos sincronizar el peso. Quedó protegido en este dispositivo y se reintentará al marcar la serie.",
    );
  };

  const programarAutoguardado = (ejercicio: EjercicioSesionV2, series: SerieRegistradaV2[]) => {
    cancelarAutoguardado(ejercicio.id);
    setEstadoSincronizacion("pendiente");
    const temporizador = setTimeout(() => guardarAvanceEjercicio(ejercicio, series), 650);
    temporizadoresAutoguardadoRef.current.set(ejercicio.id, temporizador);
  };

  const actualizarSerie = (ejercicio: EjercicioSesionV2, indice: number, campo: "reps" | "peso", valor: string) => {
    const seriesActualizadas = registro[ejercicio.id].map((serie, serieIndice) =>
      serieIndice === indice ? { ...serie, [campo]: valor } : serie
    );
    setRegistro((actual) => ({ ...actual, [ejercicio.id]: seriesActualizadas }));
    programarAutoguardado(ejercicio, seriesActualizadas);
  };

  const persistirEjercicio = (
    ejercicio: EjercicioSesionV2,
    series: SerieRegistradaV2[],
    momentoCompletado?: MomentoSesionAlejandro,
  ) => {
    const payload = construirRegistroServidor(ejercicio, series);
    if (!payload) return;
    cancelarAutoguardado(ejercicio.id);
    encolarGuardado(
      () => guardarSesionV2(payload),
      "No pudimos sincronizar esta serie. Quedó protegida en este dispositivo para reintentarla.",
      // No se auto-resuelve acá: se le pregunta al alumno cómo le fue en
      // esta serie puntual y recién con su respuesta se resuelve Impulso VIP.
      momentoCompletado ? () => setMomentoParaResultado(momentoCompletado) : undefined,
    );
  };

  const responderResultadoImpulso = (momento: MomentoSesionAlejandro, dificultad: DificultadImpulsoVIP) => {
    setMomentoParaResultado(null);
    // Antes esto colapsaba las 5 respuestas en solo dos resultados posibles
    // (lograda/no_lograda), perdiendo el matiz de "quedé corto" que la
    // memoria adaptativa necesita para no volver a ofrecer algo que costó
    // demasiado. "Muy difícil" no es lo mismo que "estuvo justo": completar
    // algo al límite de sufrimiento es una señal de cautela, no un éxito
    // limpio que habilite subir más la próxima vez.
    const resultado: ResultadoIntervencionImpulso = dificultad === "fallo"
      ? "no_lograda"
      : dificultad === "dificil"
        ? "parcial"
        : "lograda";
    iniciarGuardado(async () => {
      try {
        const resolucion = await resolverIntervencionAutomaticaV2(momento.id, resultado, dificultad);
        if (resolucion.ok) {
          setErrorGuardado(null);
          setMomentosRegistrados((actuales) => ({ ...actuales, [momento.id]: true }));
          if (resolucion.verificada) {
            setMomentosLogrados((actuales) => ({ ...actuales, [momento.id]: true }));
          }
        } else if (resolucion.error) {
          setErrorGuardado(`La serie quedó guardada, pero Impulso VIP no pudo confirmar el reto: ${resolucion.error}`);
        }
      } catch {
        setErrorGuardado("La serie quedó guardada, pero no pudimos enviar tu respuesta. Intenta de nuevo desde Impulso VIP.");
      }
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
      try {
        const resultado = await guardarSesionV2(payload);
        setErrorGuardado(resultado.error);
      } catch {
        setErrorGuardado("No pudimos sincronizar la nota. Quedó protegida en este dispositivo.");
      }
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
            videoPoster: alternativa.videoPoster,
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

  const aplicarNuevoOrden = (siguientes: EjercicioSesionV2[], opciones?: { conDeshacer?: boolean }) => {
    const anterior = ejerciciosSesion;
    const aplicarLocal = () => {
      setEjerciciosSesion(siguientes);
      setErrorPersonalizacion(null);
      if (opciones?.conDeshacer !== false) {
        setOrdenAnterior(anterior);
        if (deshacerOrdenTimeoutRef.current) clearTimeout(deshacerOrdenTimeoutRef.current);
        deshacerOrdenTimeoutRef.current = setTimeout(() => setOrdenAnterior(null), 9000);
      }
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

  const deshacerOrden = () => {
    if (!ordenAnterior) return;
    if (deshacerOrdenTimeoutRef.current) clearTimeout(deshacerOrdenTimeoutRef.current);
    setOrdenAnterior(null);
    aplicarNuevoOrden(ordenAnterior, { conDeshacer: false });
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
    const esUltimaSerieRutina = esUltimaPosicionSerie(ORDEN_EJECUCION, ejercicioIndice, serieIndice);
    const seriesActualizadas = registro[ejercicio.id].map((serie, indice) =>
      indice === serieIndice ? { ...serie, completada: !serie.completada } : serie
    );
    const momentoCompletado = encontrarMomentoPendienteDeResultado(
      MOMENTOS_ALEJANDRO,
      ejercicio.id,
      serieIndice,
      momentosRegistrados,
    );
    setRegistro((actual) => ({ ...actual, [ejercicio.id]: seriesActualizadas }));
    persistirEjercicio(ejercicio, seriesActualizadas, estabaCompletada ? undefined : momentoCompletado);
    setEjercicioActivoId(ejercicio.id);
    setSerieActivaIndice(serieIndice);
    setEjercicioExpandidoId(ejercicio.id);

    if (estabaCompletada) {
      descansosResueltosRef.current.delete(claveDescansoSesion(ejercicio.id, serieIndice));
      setPasosTecnica((actual) => ({ ...actual, [claveTecnica]: 0 }));
      setPausaTecnica((actual) => actual?.clave === claveTecnica ? null : actual);
      if (descanso?.ejercicioId === ejercicio.id && descanso.serieIndice === serieIndice) setDescansoEnFoco(false);
      setDescanso((actual) => actual?.ejercicioId === ejercicio.id && actual.serieIndice === serieIndice ? null : actual);
      return;
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

    if (temporizadorAutomatico) prepararAviso();
    else cortarAviso();
    descansoAvisadoRef.current = null;
    descansosResueltosRef.current.delete(claveDescansoSesion(ejercicio.id, serieIndice));
    const finEn = finDescansoDesdeAhora(ejercicio.descanso);
    setDescanso({
      ejercicioId: ejercicio.id,
      serieIndice,
      segundos: ejercicio.descanso,
      finEn,
      tipo: temporizadorAutomatico ? "automatico" : "referencia",
      vistaRetorno: vista === "video" ? "video" : "lista",
    });
    setDescansoEnFoco(true);
    if (vista === "video") setVista("descanso");
  };

  const ajustarDescanso = (cantidad: number) => {
    setDescanso((actual) => {
      if (actual === null) return null;
      if (actual.tipo === "referencia") {
        const segundos = Math.max(0, actual.segundos + cantidad);
        return { ...actual, segundos, finEn: finDescansoDesdeAhora(segundos) };
      }
      return { ...actual, ...ajustarFinDescanso({ finEn: actual.finEn, cambioSegundos: cantidad }) };
    });
  };

  const saltarDescanso = () => {
    if (descanso !== null) {
      const clave = claveDescansoSesion(descanso.ejercicioId, descanso.serieIndice);
      descansoAvisadoRef.current = clave;
      if (descanso.tipo !== "manual") descansosResueltosRef.current.add(clave);
      if (descansoEnFoco && descanso.tipo !== "manual") {
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
      if (descanso.tipo !== "manual") {
        descansosResueltosRef.current.add(claveDescansoSesion(descanso.ejercicioId, descanso.serieIndice));
      }
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
    const esUltimaSerieRutina = esUltimaPosicionSerie(
      ORDEN_EJECUCION,
      ejercicioActivoIndice,
      serieActivaIndiceSeguro,
    );

    if (!serieActiva.completada) {
      alternarSerie(ejercicioActivo, serieActivaIndiceSeguro);
      return;
    }
    if (esUltimaSerieRutina) {
      setConfirmarSalida(true);
      return;
    }
    const claveDescanso = claveDescansoSesion(ejercicioActivo.id, serieActivaIndiceSeguro);
    const destino = destinoAlAvanzarSerieCompletada({
      temporizadorAutomatico,
      requiereDescanso: requiereDescansoDespues(EJERCICIOS, ORDEN_EJECUCION, ejercicioActivoIndice, serieActivaIndiceSeguro),
      descansoYaResuelto: descansosResueltosRef.current.has(claveDescanso),
    });
    if (destino === "siguiente") {
      const siguiente = desplazarPosicionSerie(ORDEN_EJECUCION, ejercicioActivoIndice, serieActivaIndiceSeguro, 1);
      const siguienteEjercicio = EJERCICIOS[siguiente.ejercicioIndice];
      setEjercicioActivoId(siguienteEjercicio.id);
      setSerieActivaIndice(siguiente.serieIndice);
      setEjercicioExpandidoId(siguienteEjercicio.id);
      setControlesVideoVisibles(true);
      return;
    }

    if (temporizadorAutomatico) prepararAviso();
    else cortarAviso();
    descansoAvisadoRef.current = null;
    const finEn = finDescansoDesdeAhora(ejercicioActivo.descanso);
    setDescanso({
      ejercicioId: ejercicioActivo.id,
      serieIndice: serieActivaIndiceSeguro,
      segundos: ejercicioActivo.descanso,
      finEn,
      tipo: temporizadorAutomatico ? "automatico" : "referencia",
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
    if (descanso === null) return;
    if (activo && descanso.tipo === "referencia") {
      prepararAviso();
      const finEn = finDescansoDesdeAhora(descanso.segundos);
      setDescanso({ ...descanso, tipo: "automatico", finEn });
      return;
    }
    if (activo) return;
    cortarAviso();
    if (descanso.tipo === "automatico") {
      setDescanso({ ...descanso, tipo: "referencia", finEn: finDescansoDesdeAhora(descanso.segundos) });
    }
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

  const abrirFichaEjercicio = (ejercicio: EjercicioSesionV2) => {
    const primeraPendiente = registro[ejercicio.id].findIndex((serie) => !serie.completada);
    setEjercicioActivoId(ejercicio.id);
    setSerieActivaIndice(primeraPendiente < 0 ? 0 : primeraPendiente);
    setFichaEjercicioId(ejercicio.id);
    setVideoAmpliado(false);
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "auto" });
      paginaSesionRef.current?.parentElement?.scrollTo({ top: 0, behavior: "auto" });
    });
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

  /**
   * El menú nativo de compartir (WhatsApp, Mensajes, etc.) sólo acepta un
   * archivo real, no un link a una pantalla que exige sesión iniciada -- por
   * eso se captura la tarjeta de resumen como imagen (mismo patrón que
   * `PasoPago.enviarPorWhatsApp`: `canShare({ files })` + `share({ files })`,
   * con el texto de siempre como respaldo si el navegador no soporta
   * compartir archivos (típico en computador).
   */
  const compartirResumen = async () => {
    const texto = `${sesion?.titulo ?? "Entrenamiento VIP"}: ${seriesCompletadas} series y ${repeticionesCompletadas} repeticiones en ${formatearTiempo(segundosSesion)}.`;
    try {
      if (resumenRef.current) {
        const { toBlob } = await import("html-to-image");
        const blob = await toBlob(resumenRef.current, {
          pixelRatio: 2,
          backgroundColor: "#080909",
          // Los botones de acción no aportan nada a la imagen que se comparte.
          filter: (nodo) => !(nodo instanceof HTMLElement && nodo.classList?.contains(styles.summaryActions)),
        });
        const archivo = blob ? new File([blob], "entrenamiento-vip.png", { type: "image/png" }) : null;
        if (archivo && navigator.canShare?.({ files: [archivo] })) {
          await navigator.share({ files: [archivo], text: texto });
          setMensajeCompartir("Compartido");
          return;
        }
      }
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
      setAvisoRegresoTardio(false);
      setRegistrada(true);
      return;
    }
    for (const temporizador of temporizadoresAutoguardadoRef.current.values()) clearTimeout(temporizador);
    temporizadoresAutoguardadoRef.current.clear();
    const payload = construirRegistroServidor();
    if (!payload) return;
    iniciarGuardado(async () => {
      try {
        // Un peso escrito justo antes de terminar puede tener un autoguardado
        // anterior todavía viajando. Se espera esa cola y el cierre completo
        // se ejecuta al final, por lo que la versión más nueva siempre gana.
        await colaGuardadoRef.current;
        const resultado = await guardarYFinalizarSesionV2(payload);
        setErrorGuardado(resultado.error);
        if (!resultado.error) {
          window.localStorage.removeItem(claveBorradorSesionV2(sesion.id));
          setConfirmarSalida(false);
          setAvisoRegresoTardio(false);
          setPuntosGanados(resultado.puntosGanados ?? 0);
          setRegistrada(true);
          if (resultado.puntosGanados) {
            window.dispatchEvent(new CustomEvent(EVENTO_XP_GANADO, { detail: { puntos: resultado.puntosGanados } }));
          }
        }
      } catch {
        setErrorGuardado("No pudimos cerrar la sesión. Tu progreso sigue protegido en este dispositivo; vuelve a intentarlo con conexión.");
      }
    });
  };

  /** El progreso ya queda guardado (borrador local + servidor por cada
   * serie), así que "salir un momento" sólo necesita marcar cuándo se fue y
   * mandar al alumno a Nutrición -- ahí puede volver por la barra inferior,
   * que en esta pantalla inmersiva no se ve. */
  const salirUnMomento = () => {
    if (sesion?.real) marcarSalidaTemporalSesionV2(sesion.id);
    setConfirmarSalida(false);
    router.push("/portal-v2/nutricion");
  };

  const alternarPausaSesion = () => {
    if (!pausada) {
      setPausada(true);
      return;
    }
    // Mientras la sesión está pausada se conserva exactamente el número que
    // el alumno ve. Al reanudar, se vuelve a anclar ese tiempo al reloj real.
    setDescanso((actual) => actual === null || actual.segundos <= 0
      ? actual
      : { ...actual, finEn: finDescansoDesdeAhora(actual.segundos) });
    setPausada(false);
  };

  if (registrada) {
    return (
      <section className={styles.summaryPage} ref={resumenRef}>
        <span className={styles.summaryEyebrow}>ENTRENAMIENTO REGISTRADO</span>
        <h1>{sesion?.titulo ?? "Día de piernas"}</h1>
        <p>{sesion?.fecha ?? "18 de agosto de 2026"} · {formatearTiempo(segundosSesion)}</p>
        <div className={`${styles.summaryMetrics} ${puntosGanados !== null ? styles.summaryMetricsXp : ""}`}>
          <span><strong>{EJERCICIOS.length}</strong>Ejercicios</span>
          <span><strong>{seriesCompletadas}</strong>Series</span>
          <span><strong>{repeticionesCompletadas}</strong>Repeticiones</span>
          {puntosGanados !== null ? <span><strong>+{puntosGanados.toLocaleString("es-CL")}</strong>XP ganado</span> : null}
        </div>
        <div className={styles.summaryList}>
          {EJERCICIOS.map((ejercicio) => (
            <article key={ejercicio.id}>
              <ImagenV2Segura src={ejercicio.foto} fallbackSrc={ejercicio.fotoRespaldo} alt="" width={48} height={62} />
              <div><small>SERIE {ejercicio.codigo}</small><strong>{ejercicio.nombre}</strong><p>{registro[ejercicio.id].filter((serie) => serie.completada).length}/{ejercicio.repeticiones.length} series registradas</p></div>
            </article>
          ))}
        </div>
        <label className={styles.notesField}><span>Notas de la sesión</span><textarea value={comentarioSesion} readOnly placeholder="No registraste una nota para esta sesión." /></label>
        {mensajeCompartir ? <p role="status">{mensajeCompartir}</p> : null}
        <div className={styles.summaryActions}><button type="button" onClick={compartirResumen}>Compartir</button><Link href="/portal-v2/entrenamiento">Listo</Link></div>
      </section>
    );
  }

  return (
    <div ref={paginaSesionRef} className={styles.sessionPage} data-visual-scale={escalaVisual} data-vista={vista}>
      <header className={styles.topbar} data-transparente={vista === "video" ? "true" : undefined}>
        <div className={styles.sessionStatus}>
          <span>{formatearTiempo(segundosSesion)}</span><i aria-hidden="true" /><strong>{sesion?.soloLectura ? "Registro" : "Serie"} {serieActivaNumero}/{totalSeries}</strong>
          {!sesion?.soloLectura && estadoSincronizacion !== "listo" ? (
            <small className={styles.saveStatus} data-estado={estadoSincronizacion} aria-live="polite">
              {estadoSincronizacion === "guardado" ? "Guardado" : estadoSincronizacion === "error" ? "En dispositivo" : "Guardando…"}
            </small>
          ) : null}
        </div>
        {sesion?.soloLectura
          ? <Link className={styles.endButton} href="/portal-v2/entrenamiento/historial">Historial</Link>
          : <button type="button" className={styles.endButton} onClick={() => setConfirmarSalida(true)}>Terminar</button>}
        <div className={styles.progressTrack} aria-label={`${Math.round(progreso)}% completado`}><i style={{ width: `${progreso}%` }} /></div>
      </header>

      {sesion?.soloLectura ? <div className={styles.historicalNotice} role="status"><History size={15} /><span><strong>Sesión registrada</strong><small>{comentarioSesion || "Resultados guardados · solo lectura"}</small></span></div> : null}

      {errorGuardado ? (
        <button
          type="button"
          className={`${styles.sessionNotice} ${styles.sessionNoticeError}`}
          role="alert"
          onClick={() => setErrorGuardado(null)}
        >
          <span>{errorGuardado}</span><X size={15} />
        </button>
      ) : null}

      {ordenAnterior ? (
        <div className={styles.ordenToast} role="status">
          <span>Orden actualizado</span>
          <div className={styles.ordenToastActions}>
            <button type="button" onClick={deshacerOrden}>Deshacer</button>
            <button
              type="button"
              aria-label="Cerrar aviso"
              onClick={() => {
                if (deshacerOrdenTimeoutRef.current) clearTimeout(deshacerOrdenTimeoutRef.current);
                setOrdenAnterior(null);
              }}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ) : null}

      {fichaEjercicio ? (
        <FichaEjercicioActiva
          ejercicio={fichaEjercicio}
          onCerrar={() => {
            setFichaEjercicioId(null);
            setVideoAmpliado(false);
          }}
          onAmpliarVideo={() => setVideoAmpliado(true)}
        />
      ) : vista === "descanso" ? (
        <section
          className={styles.restImmersive}
          aria-live="polite"
          onPointerDown={(evento) => iniciarGesto(evento.clientX)}
          onPointerUp={(evento) => terminarGesto(evento.clientX)}
        >
          {descanso !== null ? <button type="button" className={`${styles.immersiveArrow} ${styles.immersiveArrowLeft}`} onClick={volverDesdeDescanso} aria-label="Volver a la serie actual"><ChevronsLeft size={27} strokeWidth={2.4} /></button> : null}
          {descanso !== null && (descanso.tipo === "manual" || puedeIrAdelante) ? <button type="button" className={`${styles.immersiveArrow} ${styles.immersiveArrowRight}`} onClick={saltarDescanso} aria-label={descanso.tipo === "manual" ? "Finalizar temporizador" : "Ir a la siguiente serie"}><ChevronsRight size={27} strokeWidth={2.4} /></button> : null}
          <div className={styles.restCenter}>
            <span>{descanso?.tipo === "referencia" ? "Descanso recomendado" : "Descanso"}</span><strong>{descanso?.segundos ?? 0}</strong><small>{descanso?.tipo === "referencia" ? "segundos · sin conteo" : "segundos"}</small>
            {descanso?.tipo === "referencia" ? (
              <button type="button" className={styles.enableCountdown} onClick={() => cambiarTemporizadorAutomatico(true)}>
                Activar cuenta regresiva
              </button>
            ) : (
              <div className={styles.restAdjustments}><button type="button" onClick={() => ajustarDescanso(-15)} aria-label="Restar 15 segundos"><Minus size={13} />15 s</button><button type="button" onClick={() => ajustarDescanso(15)} aria-label="Sumar 15 segundos"><Plus size={13} />15 s</button></div>
            )}
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
            <ImagenV2Segura
              src={ejercicioActivo.videoCloudflareListo && ejercicioActivo.videoPoster ? ejercicioActivo.videoPoster : ejercicioActivo.foto}
              fallbackSrc={ejercicioActivo.fotoRespaldo ?? ejercicioActivo.foto}
              alt={`Demostración de ${ejercicioActivo.nombre}`}
              fill
              loading="eager"
              sizes="(max-width: 460px) 100vw, 460px"
              className={ejercicioActivo.videoCloudflareListo && ejercicioActivo.videoPoster ? styles.videoPoster : undefined}
            />
            {ejercicioActivo.videoCloudflareListo ? <VideoCloudflareAutomatico ejercicioId={ejercicioActivo.bibliotecaEjercicioId} activo nombre={ejercicioActivo.nombre} modoInmersivo claseSuperficieToque={styles.videoTapSurface} /> : null}
            <div className={styles.videoShade} />
            {controlesVideoVisibles && puedeIrAtras ? <button type="button" className={`${styles.immersiveArrow} ${styles.immersiveArrowLeft}`} onClick={() => moverSerie(-1)} aria-label="Ver serie anterior"><ChevronsLeft size={27} strokeWidth={2.4} /></button> : null}
            {controlesVideoVisibles && (!sesion?.soloLectura || puedeIrAdelante) ? <button type="button" className={`${styles.immersiveArrow} ${styles.immersiveArrowRight}`} onClick={sesion?.soloLectura ? () => moverSerie(1) : avanzarDesdeVideo} aria-label={sesion?.soloLectura ? "Ver serie siguiente" : puedeIrAdelante ? "Finalizar serie e ir al descanso" : "Finalizar entrenamiento"}><ChevronsRight size={27} strokeWidth={2.4} /></button> : null}
          </div>
          <div className={styles.videoOverlay}>
            <div className={styles.videoOverlaySpacer} />
            <div className={styles.videoBottomGroup}>
              <div className={styles.videoToolRow}>
                {!sesion?.soloLectura ? <button type="button" className={styles.videoToolButton} aria-label="Ajustes" onClick={() => setPanel("ajustes")}><Settings size={17} /></button> : <span />}
                <button type="button" className={styles.switchView} onClick={() => setVista("lista")}><ListVideo size={14} /> Vista de lista</button>
              </div>
              <div className={styles.videoIdentity}>
                <small>SERIE {ejercicioActivo.codigo}{ejercicioActivo.tecnica ? <em className={styles.videoTecnicaTag} style={ejercicioActivo.tecnicaColor ? { color: ejercicioActivo.tecnicaColor } : undefined}> · {ejercicioActivo.tecnica}</em> : null}</small>
                <div className={styles.videoIdentityTitleRow}>
                  <h1>{ejercicioActivo.nombre}</h1>
                  <span className={`${styles.exerciseProgress} ${ejercicioActivoRealizado ? styles.exerciseProgressDone : ""}`} aria-label={`${seriesCompletadasEjercicioActivo} de ${registro[ejercicioActivo.id].length} series realizadas`}>
                    {ejercicioActivoRealizado ? <><Check size={18} strokeWidth={3} /> Realizado</> : `${seriesCompletadasEjercicioActivo}/${registro[ejercicioActivo.id].length}`}
                  </span>
                  <button
                    type="button"
                    className={styles.videoCheckFloating}
                    disabled={sesion?.soloLectura}
                    onClick={() => alternarSerie(ejercicioActivo, serieActivaIndiceSeguro)}
                    aria-label={`${serieActiva.completada ? "Desmarcar" : "Registrar"} serie ${serieActivaIndiceSeguro + 1}`}
                    aria-pressed={serieActiva.completada}
                  >
                    {serieActiva.completada ? <Check size={16} strokeWidth={3} /> : <CircleCheck size={19} />}
                  </button>
                </div>
              </div>
              <div className={styles.videoActions}>
                <button type="button" className={styles.impulsoAction} onClick={() => setPanel("impulso")}><Zap size={13} fill="currentColor" />Impulso VIP</button><button type="button" onClick={() => setPanel("consejo")}><Lightbulb size={13} />Consejo</button><button type="button" onClick={() => setPanel("historial")}><History size={13} />Historial</button><button type="button" onClick={() => setPanel("notas")}><StickyNote size={13} />Notas</button><button type="button" onClick={() => setPanel("informacion")}><Info size={13} />Información</button>{personalizacionDisponible && !sesion?.soloLectura && (alternativas[ejercicioActivo.id]?.length ?? 0) > 0 ? <button type="button" onClick={() => { setErrorPersonalizacion(null); setPanel("sustituir"); }}><Shuffle size={13} />Cambiar</button> : null}{personalizacionDisponible && !sesion?.soloLectura ? <button type="button" onClick={() => { setErrorPersonalizacion(null); setPanel("reordenar"); }}><ArrowUp size={13} />Orden</button> : null}
              </div>
              {impulsoActivo ? (
                <button type="button" className={styles.impulsoNotice} onClick={() => setPanel("impulso")}>
                  <Zap size={15} fill="currentColor" />
                  <span><strong>Impulso VIP</strong><small>{impulsoActivo.instruccion}</small></span>
                  <b>{momentosLogrados[impulsoActivo.id] ? "Verificado" : momentosRegistrados[impulsoActivo.id] ? "Registrado" : `Serie ${impulsoActivo.serieIndice + 1}`}</b>
                </button>
              ) : null}
              {segmentosTecnicaActiva.length ? <TecnicaActivaCard ejercicio={ejercicioActivo} segmentos={segmentosTecnicaActiva} paso={pasoTecnicaActivo} pausa={pausaTecnica?.clave === claveTecnicaActiva ? pausaTecnica.segundos : null} /> : null}
              <div className={`${styles.videoSetStrip} ${impulsoActivo?.serieIndice === serieActivaIndiceSeguro ? styles.videoSetStripImpulse : ""}`}>
                <span><b>Serie</b><em className={styles.videoSeriesNumber} aria-label={`Serie ${serieActivaIndiceSeguro + 1}`}>{serieActivaIndiceSeguro + 1}</em></span>
                <span><b>Reps</b><input type="text" autoComplete="off" enterKeyHint="next" aria-label={`Repeticiones, serie ${serieActivaIndiceSeguro + 1}`} inputMode="numeric" value={serieActiva.reps} readOnly={sesion?.soloLectura} onBlur={() => guardarAvanceEjercicio(ejercicioActivo, registro[ejercicioActivo.id])} onChange={(evento) => actualizarSerie(ejercicioActivo, serieActivaIndiceSeguro, "reps", evento.target.value)} /></span>
                <span><b>Peso ({unidadPeso})</b><input type="text" autoComplete="off" enterKeyHint={serieActivaIndiceSeguro === registro[ejercicioActivo.id].length - 1 ? "done" : "next"} aria-label={`Peso en ${unidadPeso}, serie ${serieActivaIndiceSeguro + 1}`} inputMode="decimal" value={serieActiva.peso} readOnly={sesion?.soloLectura} placeholder={`— ${unidadPeso}`} onBlur={() => guardarAvanceEjercicio(ejercicioActivo, registro[ejercicioActivo.id])} onChange={(evento) => actualizarSerie(ejercicioActivo, serieActivaIndiceSeguro, "peso", evento.target.value)} /></span>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <main className={styles.workoutList}>
          <DndContextOrden id="orden-sesion-lista" ejercicios={EJERCICIOS} deshabilitado={!personalizacionDisponible || sesion?.soloLectura} onReordenar={aplicarNuevoOrden}>
            {agruparEnBloques(EJERCICIOS).map((bloque) => {
              // El bloque con el ejercicio expandido (inputs de reps/peso en
              // vivo) no se arrastra directo -- hay que contraerlo primero.
              // El resto se arrastra tal cual se ve, sin pantalla aparte
              // (pedido de Alejandro: "sin que me mande a la segunda foto").
              const bloqueDeshabilitado = !personalizacionDisponible || sesion?.soloLectura || bloque.some((item) => item.id === ejercicioExpandidoId);
              // El "lazo" que une visualmente los ejercicios de una técnica
              // encadenada (biserie, triserie, serie gigante...): solo tiene
              // sentido con 2+ ejercicios reales en el bloque, nunca en uno
              // suelto (pedido de Alejandro: identificar de un vistazo qué
              // ejercicios van encadenados en vista de lista).
              const colorLazo = bloque.length > 1 ? bloque[0].tecnicaColor : undefined;
              return (
                <div key={bloque[0].id} className={`${styles.exerciseBlock} ${colorLazo ? styles.exerciseBlockChained : ""}`} style={colorLazo ? ({ "--tecnica-color": colorLazo } as React.CSSProperties) : undefined}>
                <BloqueArrastrableEnLinea id={bloque[0].id} deshabilitado={bloqueDeshabilitado}>
                  {bloque.map((ejercicio) => {
                    const activa = ejercicio.id === ejercicioExpandidoId;
                    const seriesEjercicio = registro[ejercicio.id];
                    const cantidadCompletadas = seriesEjercicio.filter((serie) => serie.completada).length;
                    const ejercicioRealizado = cantidadCompletadas === seriesEjercicio.length;
                    const impulsoEjercicio = MOMENTOS_ALEJANDRO.find((momento) =>
                      momento.ejercicioId === ejercicio.id && momentosVistos[momento.id]
                    ) ?? null;
                    if (!activa) {
                      const primeraPendiente = registro[ejercicio.id].findIndex((serie) => !serie.completada);
                      const expandirEjercicio = () => {
                        setEjercicioActivoId(ejercicio.id);
                        setSerieActivaIndice(ejercicio.id === ejercicioActivo.id ? serieActivaIndiceSeguro : Math.max(0, primeraPendiente));
                        setEjercicioExpandidoId(ejercicio.id);
                        setDescansoEnFoco(false);
                      };
                      return (
                        <article className={styles.compactExercise} key={ejercicio.id}>
                          <span className={styles.compactCode}>{ejercicio.codigo} SERIE</span>
                          <button type="button" className={styles.compactThumb} onClick={() => abrirFichaEjercicio(ejercicio)} aria-label={`Abrir ficha técnica de ${ejercicio.nombre}`}>
                            <ImagenV2Segura src={ejercicio.foto} fallbackSrc={ejercicio.fotoRespaldo} alt="" fill sizes="68px" loading="eager" /><i><Play size={12} fill="currentColor" /></i>
                          </button>
                          <button type="button" className={styles.compactCopy} aria-expanded="false" onClick={expandirEjercicio}>
                            <span className={styles.compactTitleLine}>
                              <strong>{ejercicio.nombre}</strong>
                              <span className={`${styles.exerciseProgress} ${ejercicioRealizado ? styles.exerciseProgressDone : ""}`} aria-label={`${cantidadCompletadas} de ${seriesEjercicio.length} series realizadas`}>
                                {ejercicioRealizado ? <><Check size={16} strokeWidth={3} /> Realizado</> : `${cantidadCompletadas}/${seriesEjercicio.length}`}
                              </span>
                            </span>
                            <small>Reps: {ejercicio.repeticiones.join(" · ")}</small>
                            {ejercicio.tecnica ? <em style={ejercicio.tecnicaColor ? { color: ejercicio.tecnicaColor } : undefined}>{ejercicio.tecnica}</em> : null}
                          </button>
                          <AsaArrastre />
                        </article>
                      );
                    }
                    return (
                      <section className={styles.activeExercise} key={ejercicio.id}>
                        <button type="button" className={styles.seriesLabel} aria-expanded="true" onClick={() => setEjercicioExpandidoId(null)} aria-label={`Contraer ${ejercicio.nombre}`}>SERIE {ejercicio.codigo}<i aria-hidden="true">›››</i>{ejercicio.tecnica ? <em style={ejercicio.tecnicaColor ? { color: ejercicio.tecnicaColor } : undefined}>{ejercicio.tecnica}</em> : null}</button>
                        <div className={styles.exerciseHeading}>
                          <button type="button" className={styles.exerciseMedia} onClick={() => abrirFichaEjercicio(ejercicio)} aria-label={`Abrir ficha técnica de ${ejercicio.nombre}`}><ImagenV2Segura src={ejercicio.foto} fallbackSrc={ejercicio.fotoRespaldo} alt="" fill sizes="70px" loading={ejercicio.codigo === "A" ? "eager" : "lazy"} /><i><Play size={17} fill="currentColor" /></i></button>
                          <button type="button" className={styles.exerciseHeadingToggle} aria-expanded="true" onClick={() => setEjercicioExpandidoId(null)}>
                            <span className={styles.exerciseTitleLine}>
                              <h1>{ejercicio.nombre}</h1>
                              <span className={`${styles.exerciseProgress} ${ejercicioRealizado ? styles.exerciseProgressDone : ""}`} aria-label={`${cantidadCompletadas} de ${seriesEjercicio.length} series realizadas`}>
                                {ejercicioRealizado ? <><Check size={18} strokeWidth={3} /> Realizado</> : `${cantidadCompletadas}/${seriesEjercicio.length}`}
                              </span>
                            </span>
                            <p><b>Reps:</b> {ejercicio.repeticiones.join("  ·  ")}</p>
                          </button>
                        </div>
                        <div className={styles.actionChips}><button type="button" className={styles.impulsoAction} onClick={() => setPanel("impulso")}><Zap size={14} fill="currentColor" />Impulso VIP</button><button type="button" onClick={() => setPanel("consejo")}><Lightbulb size={14} />Consejo</button><button type="button" onClick={() => setPanel("historial")}><History size={14} />Historial</button><button type="button" onClick={() => setPanel("notas")}><StickyNote size={14} />Notas</button>{personalizacionDisponible && !sesion?.soloLectura && (alternativas[ejercicio.id]?.length ?? 0) > 0 ? <button type="button" onClick={() => { setErrorPersonalizacion(null); setPanel("sustituir"); }}><Shuffle size={14} />Cambiar</button> : null}{personalizacionDisponible && !sesion?.soloLectura ? <button type="button" onClick={() => { setErrorPersonalizacion(null); setPanel("reordenar"); }}><ArrowUp size={14} />Orden</button> : null}</div>
                        {impulsoEjercicio ? (
                          <button type="button" className={styles.impulsoNotice} onClick={() => setPanel("impulso")}>
                            <Zap size={15} fill="currentColor" />
                            <span><strong>Impulso VIP</strong><small>{impulsoEjercicio.instruccion}</small></span>
                            <b>{momentosLogrados[impulsoEjercicio.id] ? "Verificado" : momentosRegistrados[impulsoEjercicio.id] ? "Registrado" : `Serie ${impulsoEjercicio.serieIndice + 1}`}</b>
                          </button>
                        ) : null}
                        {ejercicio.id === ejercicioActivo.id && segmentosTecnicaActiva.length ? <TecnicaActivaCard ejercicio={ejercicio} segmentos={segmentosTecnicaActiva} paso={pasoTecnicaActivo} pausa={pausaTecnica?.clave === claveTecnicaActiva ? pausaTecnica.segundos : null} /> : null}
                        <div className={styles.setTable}>
                          <div className={styles.setHead}><span>Serie</span><span>Reps</span><span>Peso ({unidadPeso})</span><span>Descanso</span><span>Listo</span></div>
                          {registro[ejercicio.id].map((serie, serieIndice) => {
                            const descansoDeEstaSerie = descanso?.ejercicioId === ejercicio.id && descanso.serieIndice === serieIndice;
                            const esSerieActiva = !descansoEnFoco && ejercicio.id === ejercicioActivo.id && serieIndice === serieActivaIndiceSeguro;
                            const esObjetivoImpulso = impulsoEjercicio?.serieIndice === serieIndice;
                            const esUltimaSerieRutina = esUltimaPosicionSerie(
                              ORDEN_EJECUCION,
                              EJERCICIOS.findIndex((item) => item.id === ejercicio.id),
                              serieIndice,
                            );
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
                                  <input type="text" autoComplete="off" enterKeyHint="next" aria-label={`Repeticiones, serie ${serieIndice + 1}`} aria-readonly={sesion?.soloLectura} inputMode="numeric" value={serie.reps} readOnly={sesion?.soloLectura} tabIndex={sesion?.soloLectura ? -1 : 0} onPointerDown={(evento) => evento.stopPropagation()} onClick={(evento) => evento.stopPropagation()} onFocus={activarEstaSerie} onBlur={() => guardarAvanceEjercicio(ejercicio, registro[ejercicio.id])} onChange={(evento) => actualizarSerie(ejercicio, serieIndice, "reps", evento.target.value)} />
                                  <input type="text" autoComplete="off" enterKeyHint={serieIndice === registro[ejercicio.id].length - 1 ? "done" : "next"} aria-label={`Peso en ${unidadPeso}, serie ${serieIndice + 1}`} aria-readonly={sesion?.soloLectura} inputMode="decimal" value={serie.peso} readOnly={sesion?.soloLectura} tabIndex={sesion?.soloLectura ? -1 : 0} placeholder={`— ${unidadPeso}`} onPointerDown={(evento) => evento.stopPropagation()} onClick={(evento) => evento.stopPropagation()} onFocus={activarEstaSerie} onBlur={() => guardarAvanceEjercicio(ejercicio, registro[ejercicio.id])} onChange={(evento) => actualizarSerie(ejercicio, serieIndice, "peso", evento.target.value)} />
                                  <span className={styles.restValue}>{esUltimaSerieRutina ? "Final" : requiereDescansoDespues(EJERCICIOS, ORDEN_EJECUCION, EJERCICIOS.findIndex((item) => item.id === ejercicio.id), serieIndice) ? `${ejercicio.descanso} s` : "Avanza"}</span>
                                  <button type="button" className={styles.checkButton} disabled={sesion?.soloLectura} onClick={(evento) => { evento.stopPropagation(); if (esSerieActiva) alternarSerie(ejercicio, serieIndice); else activarEstaSerie(); }} aria-label={esSerieActiva ? `${serie.completada ? "Desmarcar" : "Registrar"} serie ${serieIndice + 1}` : `Activar serie ${serieIndice + 1}`} aria-pressed={serie.completada}>{serie.completada ? <Check size={16} strokeWidth={3} /> : <CircleCheck size={19} />}</button>
                                </div>
                                {descansoDeEstaSerie ? (
                                  <div className={`${styles.inlineRest} ${descansoEnFoco ? styles.inlineRestActive : ""}`} aria-current={descansoEnFoco ? "step" : undefined} aria-live="polite">
                                    {descanso.tipo === "referencia" ? (
                                      <button type="button" className={styles.inlineRestEnable} onClick={() => cambiarTemporizadorAutomatico(true)}>
                                        Activar cuenta regresiva · {descanso.segundos} s
                                      </button>
                                    ) : (
                                      <>
                                        <button type="button" onClick={() => ajustarDescanso(-15)}>−15 s</button>
                                        <span className={styles.inlineRestTime}>Descanso {descanso.segundos} s</span>
                                        <button type="button" onClick={() => ajustarDescanso(15)}>+15 s</button>
                                      </>
                                    )}
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    );
                  })}
                </BloqueArrastrableEnLinea>
                </div>
              );
            })}
          </DndContextOrden>
        </main>
      )}

      {!fichaEjercicio && vista !== "video" && (sesion?.soloLectura ? (
        <nav className={styles.sessionControls} aria-label="Controles del registro">
          <Link href="/portal-v2/entrenamiento/historial" aria-label="Volver al historial"><History size={20} /></Link>
          <button type="button" aria-label="Serie anterior" onClick={() => moverSerie(-1)} disabled={!puedeIrAtras}><ChevronLeft size={23} strokeWidth={2.8} /></button>
          <button type="button" aria-label={vista === "lista" ? "Vista de video" : "Vista de lista"} onClick={() => setVista(vista === "lista" ? "video" : "lista")}><ListVideo size={20} /></button>
          <button type="button" aria-label="Serie siguiente" onClick={() => moverSerie(1)} disabled={!puedeIrAdelante}><ChevronRight size={23} strokeWidth={2.8} /></button>
          <button type="button" aria-label="Información" onClick={() => setPanel("informacion")}><Info size={20} /></button>
        </nav>
      ) : (
        <nav className={styles.sessionControls} aria-label="Controles de la sesión">
          <button type="button" aria-label="Ajustes" onClick={() => setPanel("ajustes")}><Settings size={20} /></button>
          <button type="button" aria-label={vista === "descanso" ? "Volver a la serie actual" : "Serie anterior"} onClick={retrocederPaso} disabled={vista !== "descanso" && !puedeIrAtras}><ChevronLeft size={23} strokeWidth={2.8} /></button>
          <button type="button" aria-label={pausada ? "Reanudar sesión" : "Pausar sesión"} onClick={alternarPausaSesion}>{pausada ? <Play size={20} fill="currentColor" /> : <Pause size={20} fill="currentColor" />}</button>
          <button type="button" aria-label={vista === "descanso" ? descanso?.tipo === "manual" ? "Finalizar temporizador" : "Ir a la siguiente serie" : "Serie siguiente"} onClick={avanzarPaso} disabled={vista === "lista" && !puedeIrAdelante}><ChevronRight size={23} strokeWidth={2.8} /></button>
          {vista === "lista" ? (
            <button type="button" aria-label="Vista de video" onClick={abrirVistaVideo}><ListVideo size={20} /></button>
          ) : <span aria-hidden="true" />}
        </nav>
      ))}

      {panel !== null ? (
        <PanelAuxiliar
          tipo={panel}
          ejercicio={ejercicioActivo}
          soloLectura={Boolean(sesion?.soloLectura)}
          notaInicial={notas[ejercicioActivo.id] ?? ""}
          temporizadorAutomatico={temporizadorAutomatico}
          sonidoDescansoActivo={sonidoDescansoActivo}
          impulsoAutomaticoActivo={impulsoAutomaticoActivo}
          unidadPeso={unidadPeso}
          escalaVisual={escalaVisual}
          cambiarTemporizadorAutomatico={cambiarTemporizadorAutomatico}
          cambiarSonidoDescanso={cambiarSonidoDescanso}
          cambiarImpulsoAutomatico={cambiarImpulsoAutomatico}
          cambiarUnidadPeso={cambiarUnidadPeso}
          cambiarEscalaVisual={(escala) => {
            setEscalaVisual(escala);
            window.localStorage.setItem(CLAVE_ESCALA_VISUAL_V2, escala);
          }}
          impulsoActual={impulsoActivo}
          preparacionAlejandro={sesion?.preparacionAlejandro}
          cupoImpulso={MOMENTOS_ALEJANDRO.length}
          impulsosLogrados={Object.keys(momentosLogrados).length}
          alternativas={alternativas[ejercicioActivo.id] ?? []}
          ejerciciosSesion={EJERCICIOS}
          personalizando={personalizando}
          errorPersonalizacion={errorPersonalizacion}
          onSustituir={aplicarSustitucion}
          onReordenar={aplicarNuevoOrden}
          guardarNota={(nota) => guardarNotaEjercicio(ejercicioActivo, nota)}
          cerrar={() => setPanel(null)}
        />
      ) : null}
      {videoAmpliado && ejercicioActivo.videoCloudflareListo && ejercicioActivo.bibliotecaEjercicioId ? <ModalVideoCloudflare ejercicioId={ejercicioActivo.bibliotecaEjercicioId} nombre={ejercicioActivo.nombre} onCerrar={() => setVideoAmpliado(false)} /> : null}
      {videoAmpliado && !ejercicioActivo.videoCloudflareListo && ejercicioActivo.videoUrl ? <ModalVideo videoUrl={ejercicioActivo.videoUrl} nombre={ejercicioActivo.nombre} onCerrar={() => setVideoAmpliado(false)} /> : null}
      {momentoPorCalibrar ? (
        <div className={styles.impulsoMomentBackdrop} role="presentation">
          <section className={styles.impulsoCalibracion} role="alertdialog" aria-modal="true" aria-labelledby="calibracion-titulo">
            <p className={styles.impulsoCalibracionEyebrow}>Ale calibra tu última serie</p>
            <h2 id="calibracion-titulo">¿Cuántas repeticiones más podías hacer?</h2>
            <span>Responde sobre la serie anterior. Impulso ajustará la exigencia sin pedirte esto en todas.</span>
            <div className={styles.impulsoCalibracionOpciones}>
              {[
                { valor: 0, etiqueta: "Ninguna" },
                { valor: 1, etiqueta: "Una" },
                { valor: 2, etiqueta: "Dos" },
                { valor: 3, etiqueta: "3 o más" },
              ].map((opcion) => (
                <button
                  type="button"
                  key={opcion.valor}
                  disabled={guardando}
                  onClick={() => calibrarMomento(momentoPorCalibrar, opcion.valor)}
                >
                  {opcion.etiqueta}
                </button>
              ))}
            </div>
            {errorCalibracion ? <p role="alert">{errorCalibracion}</p> : null}
          </section>
        </div>
      ) : null}
      {momentoVisible ? (
        <div className={styles.impulsoMomentBackdrop} role="presentation">
          <section className={styles.impulsoMoment} role="alertdialog" aria-modal="true" aria-labelledby="momento-alejandro-titulo">
            <Zap size={28} fill="currentColor" aria-hidden="true" />
            <p id="momento-alejandro-titulo">{momentoVisible.titulo}</p>
            <h2>{momentoVisible.instruccion}</h2>
            <span>{momentoVisible.apoyo}</span>
            {momentoVisible.intensiva ? (
              <p className={styles.impulsoSupervision}>
                <span><ShieldAlert size={13} strokeWidth={2.8} aria-hidden="true" /> Supervisión obligatoria</span>
                Realiza esta serie con tu entrenador vigilando.
              </p>
            ) : null}
            <button type="button" onClick={() => {
              const id = momentoVisible.id;
              if (sesion?.real && !sesion.soloLectura) {
                iniciarGuardado(async () => {
                  try {
                    await marcarIntervencionMostrada(id);
                  } catch {
                    setErrorGuardado("El reto sigue activo, pero no pudimos confirmar su lectura. Se reintentará al volver a esta serie.");
                  }
                });
              }
              setMomentosVistos((actuales) => ({ ...actuales, [id]: true }));
              setMomentoVisible(null);
            }}>VOY</button>
            <button type="button" className={styles.impulsoSafetyExit} onClick={() => {
              const id = momentoVisible.id;
              iniciarGuardado(async () => {
                const resolucion = await resolverIntervencionAutomaticaV2(id, "omitida_molestia");
                if (resolucion.ok) setMomentosRegistrados((actuales) => ({ ...actuales, [id]: true }));
                else if (resolucion.error) setErrorGuardado(resolucion.error);
              });
              setMomentosVistos((actuales) => ({ ...actuales, [id]: true }));
              cambiarImpulsoAutomatico(false);
              setMomentoVisible(null);
            }}>Tengo una molestia</button>
          </section>
        </div>
      ) : null}
      {momentoParaResultado ? (
        <div className={styles.impulsoMomentBackdrop} role="presentation">
          <section className={styles.impulsoMoment} role="alertdialog" aria-modal="true" aria-labelledby="resultado-impulso-titulo">
            <Zap size={28} fill="currentColor" aria-hidden="true" />
            <p id="resultado-impulso-titulo">Impulso VIP</p>
            <h2>¿Cómo te fue en esa serie?</h2>
            <span>{momentoParaResultado.instruccion}</span>
            <div className={styles.impulsoResultadoOpciones}>
              {OPCIONES_DIFICULTAD_IMPULSO.map((opcion) => (
                <button type="button" key={opcion.valor} onClick={() => responderResultadoImpulso(momentoParaResultado, opcion.valor)}>
                  {opcion.etiqueta}
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : null}
      {confirmarSalida && !sesion?.soloLectura ? (
        <div className={styles.sheetBackdrop} role="presentation" onClick={() => setConfirmarSalida(false)}>
          <section className={styles.finishSheet} role="dialog" aria-modal="true" aria-label="Finalizar entrenamiento" onClick={(evento) => evento.stopPropagation()}>
            <button type="button" className={styles.closeButton} onClick={() => setConfirmarSalida(false)} aria-label="Cerrar"><X size={18} /></button>
            <h2>¿Finalizar y registrar?</h2><p>Registra el entrenamiento para cerrar la sesión y calcular tu progreso. Si continúas después, los datos ya guardados permanecen en borrador.</p>
            <div className={styles.finishMetrics}><span><strong>{formatearTiempo(segundosSesion)}</strong>Tiempo total</span><span><strong>{seriesCompletadas}</strong>Series registradas</span></div>
            <label className={styles.notesField}><span>Nota de la sesión <small>opcional</small></span><textarea value={comentarioSesion} onChange={(evento) => setComentarioSesion(evento.target.value)} maxLength={1000} placeholder="¿Cómo te sentiste? ¿Qué quieres recordar para la próxima?" /></label>
            {errorGuardado ? <p role="alert">{errorGuardado}</p> : null}
            <div className={styles.finishActions}>
              <button type="button" disabled={guardando || sesion?.soloLectura} onClick={registrarEntrenamiento}>{guardando ? "Guardando…" : "Registrar entrenamiento"}</button>
              <button type="button" className={styles.tertiaryAction} disabled={guardando} onClick={salirUnMomento}>Salir un momento</button>
              <form action={cancelarSesionEnCurso} onSubmit={() => {
                if (sesion?.real) window.localStorage.removeItem(claveBorradorSesionV2(sesion.id));
              }}>
                <input type="hidden" name="sesion_id" value={sesion?.id ?? ""} />
                <input type="hidden" name="origen_v2" value="true" />
                <button type="submit" disabled={guardando || !sesion?.real}>Salir y descartar</button>
              </form>
            </div>
          </section>
        </div>
      ) : null}
      {avisoRegresoTardio ? (
        <div className={styles.sheetBackdrop} role="presentation">
          <section className={styles.finishSheet} role="alertdialog" aria-modal="true" aria-label="Volviste después de un rato">
            <h2>¿Seguimos?</h2>
            <p>Pasaron varios minutos desde que saliste. Elige si retomas esta serie, cierras el entrenamiento ahora o lo descartas.</p>
            {errorGuardado ? <p role="alert">{errorGuardado}</p> : null}
            <div className={styles.finishActions}>
              <button type="button" onClick={() => setAvisoRegresoTardio(false)}>Volver a mi ejercicio</button>
              <button type="button" className={styles.tertiaryAction} disabled={guardando || sesion?.soloLectura} onClick={registrarEntrenamiento}>{guardando ? "Guardando…" : "Registrar entrenamiento"}</button>
              <form action={cancelarSesionEnCurso} onSubmit={() => {
                if (sesion?.real) window.localStorage.removeItem(claveBorradorSesionV2(sesion.id));
              }}>
                <input type="hidden" name="sesion_id" value={sesion?.id ?? ""} />
                <input type="hidden" name="origen_v2" value="true" />
                <button type="submit" disabled={guardando || !sesion?.real}>Salir y descartar</button>
              </form>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

const MUSCULOS_FICHA: Array<{ claves: string[]; etiqueta: string; imagen: string }> = [
  { claves: ["pecho", "pectoral"], etiqueta: "Pecho", imagen: "/grupos-musculares/pecho.webp" },
  { claves: ["hombro", "deltoide"], etiqueta: "Hombros", imagen: "/grupos-musculares/hombros.webp" },
  { claves: ["espalda", "dorsal", "trapecio"], etiqueta: "Espalda", imagen: "/grupos-musculares/espalda.webp" },
  { claves: ["biceps", "triceps", "brazo", "antebrazo"], etiqueta: "Brazos", imagen: "/grupos-musculares/brazos.webp" },
  { claves: ["core", "abdomen", "abdominal"], etiqueta: "Core", imagen: "/grupos-musculares/core.webp" },
  { claves: ["femoral", "isqui", "glute", "posterior"], etiqueta: "Cadena posterior", imagen: "/grupos-musculares/piernas-espalda.webp" },
  { claves: ["pierna", "cuadriceps", "pantorrilla", "gemelo", "aductor"], etiqueta: "Piernas", imagen: "/grupos-musculares/piernas-frente.webp" },
];

function normalizarClaveMusculo(valor: string) {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replaceAll("_", " ");
}

function resolverMusculoFicha(valor: string) {
  const clave = normalizarClaveMusculo(valor);
  return MUSCULOS_FICHA.find((musculo) => musculo.claves.some((fragmento) => clave.includes(fragmento)))
    ?? { etiqueta: valor.replaceAll("_", " "), imagen: "/grupos-musculares/core.webp" };
}

function FichaEjercicioActiva({
  ejercicio,
  onCerrar,
  onAmpliarVideo,
}: {
  ejercicio: EjercicioSesionV2;
  onCerrar: () => void;
  onAmpliarVideo: () => void;
}) {
  const objetivos = [ejercicio.grupoClave ?? ejercicio.grupo, ...(ejercicio.gruposSecundarios ?? [])]
    .filter((valor, indice, lista): valor is string => Boolean(valor) && lista.indexOf(valor) === indice)
    .map((valor, indice) => ({ ...resolverMusculoFicha(valor), rol: indice === 0 ? "Principal" : "Secundario" }));
  const preparacion = [
    { icono: <Target size={20} />, etiqueta: "Movimiento", valor: ejercicio.patronMovimiento ?? ejercicio.categoria ?? "Trabajo dirigido" },
    { icono: <Activity size={20} />, etiqueta: "Objetivo", valor: ejercicio.grupo },
    { icono: <Dumbbell size={20} />, etiqueta: "Equipo", valor: ejercicio.equipo },
    { icono: <Gauge size={20} />, etiqueta: "Nivel", valor: ejercicio.nivel ?? "Según programación" },
  ];
  const instrucciones = (ejercicio.instrucciones ?? []).filter(Boolean);
  const tieneVideo = Boolean(ejercicio.videoCloudflareListo || ejercicio.videoUrl);

  return (
    <main className={styles.exerciseDetail} aria-label={`Ficha técnica de ${ejercicio.nombre}`}>
      <button type="button" className={styles.exerciseDetailBack} onClick={onCerrar} aria-label="Volver al entrenamiento">
        <ArrowLeft size={20} /><span>Volver</span>
      </button>
      <section className={styles.exerciseDetailHero}>
        <ImagenV2Segura src={ejercicio.foto} fallbackSrc={ejercicio.fotoRespaldo} alt={`Ejecución de ${ejercicio.nombre}`} fill sizes="(max-width: 460px) 100vw, 460px" loading="eager" />
        {ejercicio.videoCloudflareListo && ejercicio.bibliotecaEjercicioId ? <VideoCloudflareAutomatico ejercicioId={ejercicio.bibliotecaEjercicioId} activo nombre={ejercicio.nombre} /> : null}
        <div className={styles.exerciseDetailShade} />
        {tieneVideo ? <button type="button" className={styles.exerciseDetailPlay} onClick={onAmpliarVideo} aria-label={`Ampliar video de ${ejercicio.nombre}`}><Play size={22} fill="currentColor" /></button> : null}
        <div className={styles.exerciseDetailIdentity}>
          <small>FICHA TÉCNICA · SERIE {ejercicio.codigo}</small>
          <h1>{ejercicio.nombre}</h1>
          {ejercicio.descripcion ? <p>{ejercicio.descripcion}</p> : null}
        </div>
      </section>

      <section className={styles.exerciseDetailSection}>
        <h2>Preparación</h2>
        <div className={styles.exerciseSetupGrid}>
          {preparacion.map((item) => <article key={item.etiqueta}>{item.icono}<strong>{item.etiqueta}</strong><span>{item.valor}</span></article>)}
        </div>
      </section>

      <section className={styles.exerciseDetailSection}>
        <h2>Músculos involucrados</h2>
        <div className={styles.exerciseMuscleGrid}>
          {objetivos.map((objetivo, indice) => (
            <article key={`${objetivo.etiqueta}-${indice}`}>
              <div><ImagenV2Segura src={objetivo.imagen} alt="" fill sizes="86px" /></div>
              <strong>{objetivo.etiqueta}</strong><span>{objetivo.rol}</span>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.exerciseDetailSection}>
        <h2>Instrucciones</h2>
        {instrucciones.length ? (
          <ol className={styles.exerciseInstructions}>{instrucciones.map((instruccion, indice) => <li key={`${indice}-${instruccion}`}>{instruccion}</li>)}</ol>
        ) : (
          <p className={styles.exerciseDetailEmpty}>Tu entrenador todavía no agregó instrucciones específicas para este ejercicio.</p>
        )}
      </section>

      {(ejercicio.erroresComunes?.length ?? 0) > 0 ? (
        <section className={styles.exerciseDetailSection}>
          <h2>Evita estos errores</h2>
          <ul className={styles.exerciseErrors}>{ejercicio.erroresComunes?.map((error) => <li key={error}>{error}</li>)}</ul>
        </section>
      ) : null}
    </main>
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
  soloLectura,
  notaInicial,
  temporizadorAutomatico,
  sonidoDescansoActivo,
  impulsoAutomaticoActivo,
  unidadPeso,
  escalaVisual,
  cambiarTemporizadorAutomatico,
  cambiarSonidoDescanso,
  cambiarImpulsoAutomatico,
  cambiarUnidadPeso,
  cambiarEscalaVisual,
  impulsoActual,
  preparacionAlejandro,
  cupoImpulso,
  impulsosLogrados,
  alternativas,
  ejerciciosSesion,
  personalizando,
  errorPersonalizacion,
  onSustituir,
  onReordenar,
  guardarNota,
  cerrar,
}: {
  tipo: Exclude<PanelSesion, null>;
  ejercicio: EjercicioSesionV2;
  soloLectura: boolean;
  notaInicial: string;
  temporizadorAutomatico: boolean;
  sonidoDescansoActivo: boolean;
  impulsoAutomaticoActivo: boolean;
  unidadPeso: UnidadPeso;
  escalaVisual: EscalaVisualV2;
  cambiarTemporizadorAutomatico: (activo: boolean) => void;
  cambiarSonidoDescanso: (activo: boolean) => void;
  cambiarImpulsoAutomatico: (activo: boolean) => void;
  cambiarUnidadPeso: (unidad: UnidadPeso) => void;
  cambiarEscalaVisual: (escala: EscalaVisualV2) => void;
  impulsoActual: MomentoSesionAlejandro | null;
  preparacionAlejandro?: PreparacionDiariaAlejandro;
  cupoImpulso: number;
  impulsosLogrados: number;
  alternativas: AlternativaEjercicioV2[];
  ejerciciosSesion: EjercicioSesionV2[];
  personalizando: boolean;
  errorPersonalizacion: string | null;
  onSustituir: (alternativa: AlternativaEjercicioV2) => void;
  onReordenar: (siguientes: EjercicioSesionV2[]) => void;
  guardarNota: (nota: string) => void;
  cerrar: () => void;
}) {
  const [notaBorrador, setNotaBorrador] = useState(notaInicial);
  const titulos = { consejo: "Consejo del entrenador", historial: "Último registro", notas: "Notas del ejercicio", ajustes: "Ajustes de la sesión", informacion: "Información del ejercicio", impulso: "Impulso VIP · Ale' Mendoza", sustituir: "Cambiar ejercicio", reordenar: "Orden de la sesión" };
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
              <span><strong>{soloLectura ? "Registro de Impulso VIP" : impulsoAutomaticoActivo ? "Impulso automático activo" : "Impulso automático desactivado"}</strong><small>{soloLectura ? "Revisa cómo fue planificada esta sesión." : impulsoAutomaticoActivo ? "Aparecerá solo cuando realmente haga falta." : "La rutina conserva su programación base."}</small></span>
              {!soloLectura ? <button type="button" role="switch" aria-label="Impulso VIP automático" aria-checked={impulsoAutomaticoActivo} className={styles.settingSwitch} onClick={() => cambiarImpulsoAutomatico(!impulsoAutomaticoActivo)}><i /></button> : null}
            </div>
            <p className={styles.impulsoIntro}>Impulso VIP estudia historial, repeticiones, carga, constancia y esfuerzo. La progresión normal ocurre en silencio; los retos aparecen solos y son escasos.</p>
            {preparacionAlejandro ? <div className={styles.alejandroReadiness} data-state={preparacionAlejandro.estado}><Activity size={17} /><span><strong>{preparacionAlejandro.titulo}</strong><small>{preparacionAlejandro.detalle}</small></span></div> : null}
            <div className={styles.impulsoRule}><Zap size={17} fill="currentColor" /><span><strong>{cupoImpulso === 0 ? "Rutina base, sin retos extra hoy" : `${cupoImpulso} ${cupoImpulso === 1 ? "momento estratégico" : "momentos estratégicos"} en esta sesión`}</strong><small>{cupoImpulso === 0 ? "Impulso VIP sigue observando tu ejecución sin añadir intensidad." : "Últimas series elegidas. Nunca cambia todos tus pesos ni interrumpe cada ejercicio."}</small></span></div>
            {impulsoActual ? (
              <div className={styles.impulsoResult}><Check size={18} strokeWidth={3} /><span><strong>Momento revelado</strong><small>{impulsoActual.instruccion}</small></span><b>Serie {impulsoActual.serieIndice + 1}</b></div>
            ) : null}
            <div className={styles.alejandroConfidence}><span>Estado de hoy</span><b>{impulsosLogrados}/{cupoImpulso} retos logrados</b></div>
            <button type="button" className={styles.impulsoDone} onClick={cerrar}>Listo</button>
          </div>
        ) : null}
        {tipo === "notas" ? <label className={styles.exerciseNotes}><span>{soloLectura ? "Nota registrada" : "Nota personal"}</span><textarea value={notaBorrador} readOnly={soloLectura} onChange={(evento) => setNotaBorrador(evento.target.value)} placeholder={soloLectura ? "No se registró una nota en esta sesión." : "Escribe una observación para este ejercicio…"} />{soloLectura ? <button type="button" onClick={cerrar}>Cerrar</button> : <button type="button" onClick={() => { guardarNota(notaBorrador); cerrar(); }}>Guardar nota</button>}</label> : null}
        {tipo === "ajustes" ? (
          <div className={styles.settingRows}>
            <div className={styles.settingRow}>
              <span><strong>Impulso VIP automático</strong><small>Activa retos escasos en momentos estratégicos</small></span>
              <button type="button" role="switch" aria-label="Impulso VIP automático" aria-checked={impulsoAutomaticoActivo} className={styles.settingSwitch} onClick={() => cambiarImpulsoAutomatico(!impulsoAutomaticoActivo)}><i /></button>
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
            <div className={`${styles.settingRow} ${styles.visualScaleRow}`}>
              <span><strong>Tamaño de visualización</strong><small>Aumenta textos, fotografías y separación</small></span>
              <div className={styles.visualScaleSelector} role="group" aria-label="Tamaño de visualización">
                {ESCALAS_VISUALES_V2.map((escala) => (
                  <button type="button" key={escala} aria-pressed={escalaVisual === escala} onClick={() => cambiarEscalaVisual(escala)}>
                    {ETIQUETAS_ESCALA_VISUAL_V2[escala]}
                  </button>
                ))}
              </div>
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
            <p className={styles.sheetCopy}>Mantén presionado y arrastra. Las biseries, trisets y series gigantes se mueven juntas.</p>
            <OrdenSesionV2 ejercicios={ejerciciosSesion} deshabilitado={personalizando} onReordenar={onReordenar} />
            {errorPersonalizacion ? <p className={styles.personalizationError} role="alert">{errorPersonalizacion}</p> : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
