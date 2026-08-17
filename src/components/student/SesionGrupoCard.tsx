"use client";

import { forwardRef, useActionState, useEffect, useImperativeHandle, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, ChevronRight, Info, Menu, NotebookPen, Repeat, Timer, Zap } from "lucide-react";
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
import { esEjercicioDeTiempo } from "@/lib/entrenamiento/reps";
import { objetivoSerie } from "@/lib/entrenamiento/objetivo-serie";
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
function etiquetaPaso(pos: number): string {
  return LETRAS[pos] ?? String(pos + 1);
}

/** Sufijo de campo por posición dentro del grupo: "" para el primero,
 * "_1", "_2"... para el resto (ver `guardarSeriesGrupo` en actions.ts, que
 * lee `cantidad_ejercicios_grupo` para saber cuántos namespaces recorrer). */
function sufijoDe(pos: number): string {
  return pos === 0 ? "" : `_${pos}`;
}

type Paso = { pos: number; numero: number };
type RegistroRonda = {
  peso: string;
  reps: string;
  rir: string;
  esPesoCorporal: boolean;
  realizada: boolean;
};
function clavePaso(paso: Paso): string {
  return `${paso.pos}:${paso.numero}`;
}

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
    onDificultadRespondida?: () => void;
    onGrupoCompletado?: () => void;
    /** Si este bloque es el último de la rutina, su último paso cierra la
     * sesión en vez de iniciar un descanso sin siguiente ejercicio. */
    esUltimoGrupoDeRutina?: boolean;
    /** Mapa de toda la rutina. Debe existir tambiÃ©n en biseries, triseries
     * y series gigantes; no solo en ejercicios individuales. */
    onVerRutina?: () => void;
  }
>(function SesionGrupoCard({ ejercicios, sesionId, soloLectura, activo = false, modoEnfocado = false, onDificultadRespondida, onGrupoCompletado, esUltimoGrupoDeRutina = false, onVerRutina }, ref) {
  const [state, formAction, pending] = useActionState(guardarSeriesGrupo, initialState);
  const n = ejercicios.length;
  const completoTodo = ejercicios.every((e) => e.completado);
  // En entrenamiento enfocado el bloque encadenado siempre se presenta
  // completo. Al llegar a una biserie con las flechas antes de que le toque,
  // `activo` es false; si dependiéramos de él, se escondían sus fotos y la
  // ronda detrás de un resumen plegado.
  const [expandido, setExpandido] = useState(modoEnfocado || activo || soloLectura || completoTodo);

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
  /* Las tarjetas enfocadas muestran solo la ronda actual para ahorrar alto.
     Este respaldo mantiene los campos de rondas ya hechas dentro del <form>:
     si se desmontan sin esto, el guardado de la ronda 3 mandaba A1/A2 como
     vacÃ­as y el servidor volvÃ­a a dejar la superserie incompleta. */
  const [registrosRondas, setRegistrosRondas] = useState<Map<string, RegistroRonda>>(() => {
    const iniciales = new Map<string, RegistroRonda>();
    ejercicios.forEach((ejercicio, pos) => ejercicio.series.forEach((serie) => {
      iniciales.set(clavePaso({ pos, numero: serie.numeroSerie }), {
        peso: serie.pesoKg == null ? "" : String(serie.pesoKg),
        reps: serie.repsRealizadas == null ? "" : String(serie.repsRealizadas),
        rir: serie.rirEstimado == null ? "" : String(serie.rirEstimado),
        esPesoCorporal: serie.esPesoCorporal,
        realizada: serie.realizada,
      });
    }));
    return iniciales;
  });
  const [encuestasRespondidas, setEncuestasRespondidas] = useState<ReadonlySet<number>>(
    () => new Set(ejercicios.flatMap((ej, pos) => (ej.dificultadPercibida ? [pos] : [])))
  );
  const [serieActiva, setSerieActiva] = useState<{ pos: number; numero: number } | null>(null);
  const [mostrandoSiguiente, setMostrandoSiguiente] = useState(false);
  /** Igual que en `SesionEjercicioCard`: la encuesta se abre sola solamente si
   * el grupo se terminó recién acá. Navegar con Anterior/Siguiente hasta una
   * biserie ya hecha no la vuelve a disparar. */
  const [recienCompletado, setRecienCompletado] = useState(false);
  const grupoCompletadoNotificadoRef = useRef(false);
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
  // El grupo tiene una secuencia real (1A → 1B → 2A...). Un paso solo puede
  // reabrirse si no existe otro registrado después de él; de lo contrario se
  // rompería el orden de la ronda al desmarcar una serie antigua.
  const puedeDeshacerPaso = (paso: Paso) => {
    const indice = pasos.findIndex((item) => item.pos === paso.pos && item.numero === paso.numero);
    return indice < 0 || !pasos.slice(indice + 1).some((item) => seriesHechas[item.pos].has(item.numero));
  };
  const [indicePasoVisible, setIndicePasoVisible] = useState(
    () => Math.max(0, pasos.findIndex((paso) => !ejercicios[paso.pos].series.some(
      (serie) => serie.numeroSerie === paso.numero && serie.realizada
    )))
  );
  const [rondaVista, setRondaVista] = useState<number | null>(null);
  /** Igual que las cÃ¡psulas de series: una ronda terminada se consulta con un
   * toque, pero tres toques intencionales permiten corregir LA ÃšLTIMA ronda
   * hecha. Nunca se abre una antigua debajo de una ronda posterior, porque
   * eso dejarÃ­a la secuencia A â†’ B â†’ C en un estado imposible. */
  const [rondaPendienteReinicio, setRondaPendienteReinicio] = useState<{ numero: number; toques: number } | null>(null);
  const reinicioRondaTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pasoExtraPendiente = pasos.find(
    (paso) => paso.numero > ejercicios[paso.pos].seriesProgramadas && !seriesHechas[paso.pos].has(paso.numero)
  ) ?? null;
  const pasoQueToca =
    activo && !soloLectura && !completoTodo
      ? (pasos.find((paso) => paso.numero <= ejercicios[paso.pos].seriesProgramadas && !seriesHechas[paso.pos].has(paso.numero)) ?? pasoExtraPendiente)
      : pasoExtraPendiente;
  // Si se está mirando un grupo bloqueado o ya hecho, no existe un paso que
  // "toque" registrar. Igual destacamos una fila para anclar las flechas de
  // sesión en la misma posición del RIR que en un ejercicio individual.
  const pasoResaltado = pasoQueToca
    ?? pasos.find((paso) => !seriesHechas[paso.pos].has(paso.numero))
    ?? pasos.at(-1)
    ?? null;
  const programadasGrupoHechas = ejercicios.every((ejercicio, pos) =>
    Array.from({ length: ejercicio.seriesProgramadas }, (_, indice) => indice + 1)
      .every((numero) => seriesHechas[pos].has(numero))
  );

  // Recupera de forma segura una superserie que tiene todas sus filas hechas
  // pero cuya cabecera llegó desactualizada (`completado=false`). Así un
  // guardado anterior no puede dejar al siguiente ejercicio inaccesible.
  useEffect(() => {
    if (!modoEnfocado || soloLectura || completoTodo || !programadasGrupoHechas || recienCompletado) return;
    setRecienCompletado(true);
    if (!grupoCompletadoNotificadoRef.current) {
      grupoCompletadoNotificadoRef.current = true;
      onGrupoCompletado?.();
    }
    const frame = window.requestAnimationFrame(() => guardarAhora());
    return () => window.cancelAnimationFrame(frame);
  }, [modoEnfocado, soloLectura, completoTodo, programadasGrupoHechas, recienCompletado, onGrupoCompletado]);

  // Rediseño en tarjetas apiladas (modo enfocado): en vez de mostrar los
  // pasos intercalados de a uno, se ve toda la ronda actual junta — un
  // ejercicio por tarjeta. `rondaActualNumero` es la ronda del paso que
  // toca ahora (o la última si el grupo ya se completó).
  const rondaActualNumero = rondaVista ?? pasoResaltado?.numero ?? maxRondas;
  const pasosDeRondaActual = pasos.filter((paso) => paso.numero === rondaActualNumero);
  const rondas = Array.from({ length: maxRondas }, (_, indice) => {
    const numero = indice + 1;
    const pasosDeRonda = pasos.filter((paso) => paso.numero === numero);
    const hechas = pasosDeRonda.filter((paso) => seriesHechas[paso.pos].has(paso.numero)).length;
    const completa = pasosDeRonda.length > 0 && hechas === pasosDeRonda.length;
    return {
      numero,
      estado: completa ? "completa" : numero === rondaActualNumero ? "actual" : "pendiente",
      progreso: pasosDeRonda.length > 0 ? (hechas / pasosDeRonda.length) * 100 : 0,
    } as const;
  });
  const impulsoPantallaActivo = modoEnfocado
    && !soloLectura
    && pasoResaltado !== null
    && !seriesHechas[pasoResaltado.pos].has(pasoResaltado.numero)
    && ejercicios[pasoResaltado.pos].intervencionesImpulso.some(
      (intervencion) => intervencion.serieObjetivo === pasoResaltado.numero && intervencion.estado !== "cancelada"
    );
  /** Tarjetas ya hechas que el alumno cerró a mano para no ver sus números
   * todo el tiempo — arranca abierto por defecto (como en la referencia). */
  const [colapsadosManual, setColapsadosManual] = useState<Set<number>>(() => new Set());
  const [notasAbiertas, setNotasAbiertas] = useState<Set<number>>(() => new Set());

  useEffect(() => () => {
    if (reinicioRondaTimeoutRef.current) clearTimeout(reinicioRondaTimeoutRef.current);
  }, []);

  function seleccionarRonda(numero: number, completa: boolean) {
    setRondaVista(numero);
    if (!completa) {
      setRondaPendienteReinicio(null);
      if (reinicioRondaTimeoutRef.current) clearTimeout(reinicioRondaTimeoutRef.current);
      return;
    }

    // Solo se puede corregir la Ãºltima ronda que tenga registros: igual que
    // una serie individual, las anteriores quedan consultables como historial.
    const hayPosteriorHecha = pasos.some((paso) =>
      paso.numero > numero && seriesHechas[paso.pos].has(paso.numero)
    );
    if (hayPosteriorHecha) {
      setRondaPendienteReinicio(null);
      if (reinicioRondaTimeoutRef.current) clearTimeout(reinicioRondaTimeoutRef.current);
      return;
    }

    if (rondaPendienteReinicio?.numero === numero && rondaPendienteReinicio.toques === 2) {
      if (reinicioRondaTimeoutRef.current) clearTimeout(reinicioRondaTimeoutRef.current);
      reinicioRondaTimeoutRef.current = null;
      setRondaPendienteReinicio(null);
      const pasosDeRonda = pasos.filter((paso) => paso.numero === numero);
      // La regla de orden ya se verificÃ³ para la ronda completa. Por eso se
      // fuerza el deshacer de A/B/C como una sola acciÃ³n y se guarda una vez.
      pasosDeRonda.forEach((paso) => filasRef.current[paso.pos].get(paso.numero)?.deshacerYa(true, false));
      enviadoRef.current = false;
      setRecienCompletado(false);
      setMostrandoSiguiente(false);
      setSerieActiva(null);
      guardarAhora();
      return;
    }

    setRondaPendienteReinicio({
      numero,
      toques: rondaPendienteReinicio?.numero === numero ? 2 : 1,
    });
    if (reinicioRondaTimeoutRef.current) clearTimeout(reinicioRondaTimeoutRef.current);
    reinicioRondaTimeoutRef.current = setTimeout(() => {
      setRondaPendienteReinicio(null);
      reinicioRondaTimeoutRef.current = null;
    }, 2400);
  }

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
    formRef.current?.requestSubmit();
  }

  function registrarRondaEnFormulario(pos: number, numero: number, realizada: boolean) {
    const datos = formRef.current ? new FormData(formRef.current) : null;
    const sufijo = sufijoDe(pos);
    const registro: RegistroRonda = {
      peso: String(datos?.get(`peso_${numero}${sufijo}`) ?? ""),
      reps: String(datos?.get(`reps_${numero}${sufijo}`) ?? ""),
      rir: String(datos?.get(`rir_${numero}${sufijo}`) ?? ""),
      esPesoCorporal: datos?.get(`peso_corporal_${numero}${sufijo}`) === "true",
      realizada,
    };
    setRegistrosRondas((actuales) => {
      const copia = new Map(actuales);
      copia.set(clavePaso({ pos, numero }), registro);
      return copia;
    });
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
    return (numero: number) => {
      // Si se estaba consultando una ronda anterior, al tocar un control
      // volvemos al flujo real: la tarjeta que se ejecuta manda en pantalla.
      setRondaVista(null);
      setSerieActiva({ pos, numero });
    };
  }

  function alDeshacerCiclo(pos: number) {
    return (numero: number) => {
      registrarRondaEnFormulario(pos, numero, false);
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
      registrarRondaEnFormulario(pos, numero, true);
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
        // El siguiente bloque no debe esperar la revalidación del servidor
        // para habilitarse: todas las series locales ya quedaron completas.
        if (!grupoCompletadoNotificadoRef.current) {
          grupoCompletadoNotificadoRef.current = true;
          onGrupoCompletado?.();
        }
        if (esUltimoGrupoDeRutina && modoEnfocado) {
          window.setTimeout(() => window.dispatchEvent(new Event("vip:celebrar-final-rutina")), 420);
        }
        // Ver el mismo fix en SesionEjercicioCard: sin esto, la última fila
        // se quedaba "activa" para siempre y el contador de exceso de
        // descanso seguía corriendo sobre una serie ya terminada.
        setSerieActiva(null);
        // Igual que en el ejercicio individual: primero se muestra la
        // encuesta y recién al responderla (o al omitirla) se guarda y se
        // avanza. Si se revalida antes, el modal puede desmontarse y el
        // alumno queda en el bloque ya terminado.
        setMostrandoSiguiente(true);
      } else {
        const idxActual = pasos.findIndex((p) => p.pos === pos && p.numero === numero);
        const siguiente = pasos.slice(idxActual + 1).find((p) => !completadasRef.current[p.pos].has(p.numero));
        if (siguiente) {
          const indiceSiguiente = pasos.findIndex((paso) => paso.pos === siguiente.pos && paso.numero === siguiente.numero);
          if (indiceSiguiente >= 0) setIndicePasoVisible(indiceSiguiente);
          setRondaVista(null);
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

  // El paso activo se centra DESPUÉS de que React abre su tarjeta. Hacerlo
  // dentro del callback de completar corría antes de pintar el siguiente paso
  // y por eso en iPhone a veces no se movía nada.
  /** Centra dentro de `.pantalla-scroll`, no en el documento. iOS puede
   * interpretar `scrollIntoView` como un scroll general y dejar la ficha
   * detrÃ¡s de la cabecera fija; este cÃ¡lculo mueve solo el contenedor real. */
  function centrarPasoActivo(paso: Paso, behavior: ScrollBehavior = "smooth") {
    const nodo = filaNodoRef.current[paso.pos].get(paso.numero);
    const scroll = nodo?.closest<HTMLElement>(".pantalla-scroll");
    if (!nodo || !scroll) return;
    const marco = scroll.getBoundingClientRect();
    const ficha = nodo.getBoundingClientRect();
    const margen = 16;
    const desfaseIdeal = Math.max(margen, (scroll.clientHeight - ficha.height) / 2);
    const siguienteTop = scroll.scrollTop + ficha.top - marco.top - desfaseIdeal;
    scroll.scrollTo({ top: Math.max(0, siguienteTop), behavior });
  }

  // Esperamos al render que abre la fila nueva. Una ronda consultada a mano
  // no se interrumpe; al tocar para continuar, `alIniciar` vuelve al paso
  // efectivo y esta misma regla lo centra de nuevo.
  useEffect(() => {
    if (!modoEnfocado || !pasoResaltado || rondaVista !== null) return;
    const frame = window.requestAnimationFrame(() => centrarPasoActivo(pasoResaltado));
    return () => window.cancelAnimationFrame(frame);
  }, [modoEnfocado, pasoResaltado?.pos, pasoResaltado?.numero, rondaVista, serieActiva?.pos, serieActiva?.numero]);

  const esTiempoPorPos = ejercicios.map((e) => esEjercicioDeTiempo(e.repsProgramadas));

  // Antes esta pantalla reimplementaba su propia versión de "¿hay una
  // recomendación de Impulso VIP aprobada?" en vez de compartir la de
  // SesionEjercicioCard.tsx — mismo cálculo, dos lugares que podían
  // desalinearse. `objetivoSerie` (lib/entrenamiento/objetivo-serie.ts) es
  // ahora la única fuente, y de paso trae el texto de "Última vez /
  // Objetivo" que a esta pantalla le faltaba mostrar por completo (ver
  // resumen-serie-foco más abajo — pedido de Alejandro, 2026-08-17).
  const objetivoPorPos = ejercicios.map((ej, i) => objetivoSerie(ej, esTiempoPorPos[i]));
  const objetivoRepsPorPos = objetivoPorPos.map((o) => o.objetivoReps);
  const pesoSugeridoPorPos = objetivoPorPos.map((o) => o.pesoSugeridoEfectivo);

  // El descanso "real" de la ronda es el del ÚLTIMO ejercicio del grupo —
  // en la práctica es el único que suele tener un descanso propio (los
  // anteriores encadenan directo), y es el que se muestra en la fila de
  // datos como resumen. Cada fila sigue usando el descanso de SU PROPIO
  // ejercicio, esto es solo el resumen de arriba.
  const descansoEfectivo = (ejercicio: EjercicioSesion) =>
    ejercicio.descansoPersonalizadoSegundos ?? ejercicio.descansoSegundos;
  const descansoRonda = ejercicios[n - 1] ? descansoEfectivo(ejercicios[n - 1]) : null;
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
      {montado && impulsoPantallaActivo && createPortal(
        <div className="halo-pantalla-impulso-vip" aria-hidden="true" />,
        document.body
      )}
      {/* Cabecera única para el grupo: la etiqueta de técnica (coloreada por
          familia, ver tecnica-grupo.ts) y los ejercicios lado a lado — antes
          cada uno tenía su propia cabecera completa y había que scrollear
          una entera para encontrar la siguiente. */}
      {grupoTecnica && !modoEnfocado && (
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
              <p className="text-micro font-bold leading-tight text-vip">{etiquetaPaso(pos)}</p>
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

      {/* La biserie/triserie se lee primero como un bloque: A + B (o A + B +
          C), con referencias grandes y el programa de cada movimiento. Así
          se puede reconocer qué sigue antes de entrar a registrar la ronda. */}
      {modoEnfocado && (
        <div className="cabecera-grupo-enfocado" data-cantidad={n}>
          {ejercicios.map((ej, pos) => {
            // Cuál de los dos (o tres) nombres se lee más grande — el que
            // corresponde hacer ahora, no el que ya se completó (pedido de
            // Alejandro, 2026-08-16: "que el alumno sepa más lo que está
            // haciendo en el momento"). `pasoResaltado` ya es la señal que
            // usa el resto de la tarjeta para "cuál sigue", así que es
            // consistente con el resaltado que ya se ve más abajo.
            const esActivo = pasoResaltado?.pos === pos;
            return (
            <article key={ej.sesionEjercicioId} className="ejercicio-cabecera-grupo-foco" data-activo={esActivo ? "true" : "false"}>
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
                tamanoCompacto={n === 2 ? 132 : n === 3 ? 92 : n <= 6 ? 70 : 58}
              />
              <div className="texto-cabecera-grupo-foco">
                <p><span>{etiquetaPaso(pos)}</span>{ej.nombre}</p>
                {!modoEnfocado && <small>{ej.seriesProgramadas} series · {ej.repsProgramadas} repeticiones</small>}
              </div>
            </article>
            );
          })}
          <button
            type="button"
            className="boton-ver-rutina-grupo"
            onClick={onVerRutina}
            disabled={!onVerRutina}
            aria-label="Ver ejercicios de la rutina"
            title="Ver ejercicios de la rutina"
          >
            <Menu size={23} strokeWidth={1.45} />
          </button>
        </div>
      )}

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
              tecnica && !modoEnfocado && (
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
                    {etiquetaPaso(pos)} · {ej.nombre}
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

              {/* En foco solo se pinta la ronda visible. Los inputs de las
                  demÃ¡s quedan ocultos pero siguen en el formulario: el
                  servidor recibe la fotografÃ­a completa A1/B1/A2/B2... y no
                  puede convertir una superserie ya terminada en incompleta. */}
              {modoEnfocado && pasos
                .filter((paso) => paso.numero !== rondaActualNumero)
                .map((paso) => {
                  const sufijo = sufijoDe(paso.pos);
                  const inicial = serieInicial(paso.pos, paso.numero);
                  const registro = registrosRondas.get(clavePaso(paso)) ?? {
                    peso: inicial?.pesoKg == null ? "" : String(inicial.pesoKg),
                    reps: inicial?.repsRealizadas == null ? "" : String(inicial.repsRealizadas),
                    rir: inicial?.rirEstimado == null ? "" : String(inicial.rirEstimado),
                    esPesoCorporal: inicial?.esPesoCorporal ?? false,
                    realizada: inicial?.realizada ?? false,
                  };
                  return (
                    <span key={`respaldo-${clavePaso(paso)}`} aria-hidden>
                      <input type="hidden" name={`peso_${paso.numero}${sufijo}`} value={registro.peso} />
                      <input type="hidden" name={`reps_${paso.numero}${sufijo}`} value={registro.reps} />
                      <input type="hidden" name={`rir_${paso.numero}${sufijo}`} value={registro.rir} />
                      <input type="hidden" name={`peso_corporal_${paso.numero}${sufijo}`} value={registro.esPesoCorporal ? "true" : "false"} />
                      <input type="hidden" name={`realizada_${paso.numero}${sufijo}`} value={registro.realizada ? "true" : "false"} />
                    </span>
                  );
                })}

              {!modoEnfocado && (
                <div className="encabezado-pasos-grupo mb-1 flex items-center justify-between gap-2">
                  <p className="text-micro font-bold tracking-wide text-vip">SERIES INTERCALADAS</p>
                  {pasoQueToca && (
                    <p className="text-micro text-text-secondary">
                      Ahora: {etiquetaPaso(pasoQueToca.pos)} · serie {pasoQueToca.numero}
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
                      aria-label={`Ver ${etiquetaPaso(paso.pos)}, serie ${paso.numero}`}
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
                  <div className="ronda-grupo-control">
                    <ol className="selector-rondas-grupo" aria-label={`Rondas: ${rondaActualNumero} de ${maxRondas}`}>
                          {rondas.map((ronda) => (
                            <li key={ronda.numero} data-estado={ronda.estado} aria-current={ronda.estado === "actual" ? "step" : undefined}>
                              <button
                                type="button"
                                onClick={() => seleccionarRonda(ronda.numero, ronda.estado === "completa")}
                                aria-label={`Ver ronda ${ronda.numero}${ronda.estado === "completa" ? ", completada; toca tres veces para corregir la Ãºltima ronda" : ""}`}
                              >
                                <span aria-hidden><i style={{ width: `${ronda.progreso}%` }} /></span>
                                <b>
                                  {ronda.numero}
                                  {ronda.estado === "completa" && <Check size={9} strokeWidth={3} aria-label="Completada" />}
                                </b>
                              </button>
                            </li>
                          ))}
                    </ol>
                  </div>

                  {pasosDeRondaActual.map((paso) => {
                    const ej = ejercicios[paso.pos];
                    const hecho = seriesHechas[paso.pos].has(paso.numero);
                    const inicialPaso = serieInicial(paso.pos, paso.numero);
                    const registroPaso = registrosRondas.get(clavePaso(paso)) ?? {
                      peso: inicialPaso?.pesoKg == null ? "" : String(inicialPaso.pesoKg),
                      reps: inicialPaso?.repsRealizadas == null ? "" : String(inicialPaso.repsRealizadas),
                      rir: inicialPaso?.rirEstimado == null ? "" : String(inicialPaso.rirEstimado),
                      esPesoCorporal: inicialPaso?.esPesoCorporal ?? false,
                      realizada: inicialPaso?.realizada ?? false,
                    };
                    const esActual = pasoResaltado?.pos === paso.pos && pasoResaltado?.numero === paso.numero;
                    const colapsadoManual = colapsadosManual.has(paso.pos);
                    /* Al terminar A, su registro deja de competir con el paso
                       activo: queda como resumen compacto con check y se puede
                       desplegar con su chevron si el alumno quiere revisarlo. */
                    const abierto = esActual || (hecho && (colapsadoManual || rondaVista === paso.numero));
                    // Impulso VIP en biserie/triserie: mismo rayo que en el
                    // ejercicio suelto, sobre el número del paso — antes esta
                    // pantalla no avisaba nada, aunque la recomendación sí se
                    // aplicaba silenciosa al peso/reps precargados (encontrado
                    // en auditoría contra `main`).
                    const esImpulso = ej.intervencionesImpulso.some(
                      (intervencion) => intervencion.serieObjetivo === paso.numero && intervencion.estado !== "cancelada"
                    );
                    return (
                      <div
                        key={`${paso.pos}-${paso.numero}-${montado ? "local" : "server"}`}
                        className="tarjeta-paso-grupo-foco"
                        data-estado={hecho ? "completa" : esActual ? "actual" : "pendiente"}
                      >
                        <div className="cabecera-tarjeta-paso-grupo">
                          <span className="numero-paso-grupo" data-impulso={esImpulso && !hecho ? "true" : "false"}>
                            {esImpulso && !hecho && (
                              <Zap size={12} fill="currentColor" className="rayo-impulso-paso-grupo" aria-hidden />
                            )}
                            {hecho ? <Check size={15} strokeWidth={3} /> : etiquetaPaso(paso.pos)}
                          </span>
                          <span className="info-paso-grupo">
                            <strong>{ej.nombre}</strong>
                            <small>
                              {ej.seriesProgramadas}× {ej.repsProgramadas}
                              {hecho && (registroPaso.esPesoCorporal || registroPaso.peso) && (
                                <> · {registroPaso.esPesoCorporal ? "Peso corporal" : `${registroPaso.peso} kg`}</>
                              )}
                              {hecho && registroPaso.rir && <> · RIR {registroPaso.rir}</>}
                            </small>
                          </span>
                          <button
                            type="button"
                            className="boton-nota-paso-grupo"
                            onClick={() => {
                              setNotasAbiertas((actuales) => {
                                const copia = new Set(actuales);
                                if (copia.has(paso.pos)) copia.delete(paso.pos);
                                else copia.add(paso.pos);
                                return copia;
                              });
                            }}
                            aria-expanded={notasAbiertas.has(paso.pos)}
                            aria-label={notasAbiertas.has(paso.pos) ? `Ocultar nota de ${etiquetaPaso(paso.pos)}` : `Añadir nota a ${etiquetaPaso(paso.pos)}`}
                            data-con-nota={borradoresLocales[paso.pos]?.nota || ej.notaEjercicio ? "true" : undefined}
                          >
                            <NotebookPen size={14} aria-hidden />
                          </button>
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
                        {/* Referencia de peso que antes le faltaba por completo a esta
                            pantalla: el ejercicio suelto SÍ muestra última vez/objetivo
                            (`resumen-serie-foco` en SesionEjercicioCard.tsx), acá no había
                            nada — el alumno llegaba a cargar el peso de una biserie sin
                            ninguna pista de cuánto pedía la rutina ni cuánto levantó la
                            vez pasada. Solo en el paso que toca ahora, no en los ya
                            hechos (esos ya muestran su propio registro arriba) ni en los
                            que faltan (todavía no es su turno). */}
                        {esActual && !hecho && (
                          <div className="resumen-serie-foco">
                            <p className="registro-anterior-foco">
                              <span>Última vez</span>
                              <i>—</i>
                              <strong>{formatUltimo(ej.ultimoRegistro, esTiempoPorPos[paso.pos]) ?? ""}</strong>
                            </p>
                            <p className="objetivo-serie-foco">
                              <span>Objetivo</span>
                              <i>{objetivoPorPos[paso.pos].pesoObjetivoTexto === "— kg" ? "" : "—"}</i>
                              <strong>
                                {objetivoPorPos[paso.pos].pesoObjetivoTexto} × {objetivoPorPos[paso.pos].repsObjetivoTexto}
                              </strong>
                            </p>
                          </div>
                        )}
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
                              pesoObjetivoPlaceholder={objetivoPorPos[paso.pos].pesoObjetivoKg}
                              esTiempo={esTiempoPorPos[paso.pos]}
                              descansoSegundos={descansoEfectivo(ej)}
                              temporizadorDescanso={ej.temporizadorDescanso}
                              soloLectura={soloLectura}
                              sesionId={sesionId}
                              sesionEjercicioId={ej.sesionEjercicioId}
                              activo={serieActiva?.pos === paso.pos && serieActiva?.numero === paso.numero}
                              esLaQueToca={esActual}
                              onIniciar={alIniciar(paso.pos)}
                              onCicloCompleto={alCompletarCiclo(paso.pos)}
                              onCicloDeshecho={alDeshacerCiclo(paso.pos)}
                              puedeDeshacer={puedeDeshacerPaso(paso)}
                              onGuardar={guardarAhora}
                              colorGrupoTecnica={grupoTecnica?.color}
                              modoDestacado={esActual}
                              // Solo el ÚLTIMO ejercicio del grupo descansa de verdad — A y B
                              // (o A y B de una triserie) encadenan directo al siguiente, sin
                              // cronómetro, sea cual sea la ronda. Pedido de Alejandro: "primer
                              // ejercicio avanza, segundo avanza, tercero descansa".
                              saltaDescanso={paso.pos !== n - 1 || esUltimoGrupoDeRutina}
                              textoAlSaltarDescanso={
                                paso.pos !== n - 1
                                  ? "Avanza"
                                  : esUltimoGrupoDeRutina
                                    ? "Guardar y finalizar tu rutina"
                                    : "Avanza"
                              }
                              // El botón ya está ubicado EN el último paso de
                              // la ronda; "después de B" quedaba ambiguo y
                              // parecía una instrucción cortada. Esta acción
                              // dice exactamente qué ocurrirá al tocarla.
                              textoDescansoPendiente={paso.pos === n - 1 ? "Terminar ronda y descansar" : undefined}
                            />
                          </div>
                        )}
                        {(notasAbiertas.has(paso.pos) || Boolean(borradoresLocales[paso.pos]?.nota ?? ej.notaEjercicio)) && (
                          <label className="nota-paso-grupo-foco">
                            <NotebookPen size={12} aria-hidden />
                            <input
                              name={`nota_ejercicio${sufijoDe(paso.pos)}`}
                              type="text"
                              placeholder="Añadir nota"
                              defaultValue={borradoresLocales[paso.pos]?.nota ?? ej.notaEjercicio ?? ""}
                              className="text-caption w-full min-w-0 bg-transparent text-text outline-none placeholder:text-text-tertiary"
                            />
                          </label>
                        )}
                        {!notasAbiertas.has(paso.pos) && !borradoresLocales[paso.pos]?.nota && !ej.notaEjercicio && (
                          <input type="hidden" name={`nota_ejercicio${sufijoDe(paso.pos)}`} value="" />
                        )}
                        {hecho && (
                          <div className="encuesta-paso-grupo-foco">
                            <SelectorDificultad
                              valorInicial={ej.dificultadPercibida}
                              disabled={false}
                              onGuardar={guardarAhora}
                              forzarModal={recienCompletado && !esUltimoGrupoDeRutina && paso.pos === encuestaPendiente}
                              onResponder={() => {
                                setMostrandoSiguiente(false);
                                alResponderEncuesta(paso.pos);
                              }}
                              nombreCampo={`dificultad_ejercicio${sufijoDe(paso.pos)}`}
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
                      <span className="text-micro font-bold text-vip">{etiquetaPaso(paso.pos)}</span>
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
                        pesoObjetivoPlaceholder={objetivoPorPos[paso.pos].pesoObjetivoKg}
                        esTiempo={esTiempoPorPos[paso.pos]}
                        descansoSegundos={descansoEfectivo(ej)}
                        temporizadorDescanso={ej.temporizadorDescanso}
                        soloLectura={soloLectura}
                        sesionId={sesionId}
                        sesionEjercicioId={ej.sesionEjercicioId}
                        activo={serieActiva?.pos === paso.pos && serieActiva?.numero === paso.numero}
                        esLaQueToca={pasoQueToca?.pos === paso.pos && pasoQueToca?.numero === paso.numero}
                        onIniciar={alIniciar(paso.pos)}
                        onCicloCompleto={alCompletarCiclo(paso.pos)}
                        onCicloDeshecho={alDeshacerCiclo(paso.pos)}
                        puedeDeshacer={puedeDeshacerPaso(paso)}
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
                ) : modoEnfocado ? (
                  // Mismo caso que en SesionEjercicioCard.tsx: sin esto no hay
                  // forma de cerrar la biserie/triserie con series pendientes
                  // en el diseño en tarjetas apiladas.
                  <button
                    type="button"
                    onClick={marcarGrupoListo}
                    className="text-micro block w-full text-center text-text-tertiary underline decoration-dotted underline-offset-2"
                  >
                    Cerrar {etiquetaGrupo.toLowerCase()} con series pendientes
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={marcarGrupoListo}
                    className="boton-completar-ejercicio flex h-11 w-full items-center justify-center gap-2 rounded-[14px] font-bold"
                  >
                    <Check size={14} strokeWidth={3.5} /> Completar y guardar {etiquetaGrupo.toLowerCase()}
                  </button>
                ))}

              {!modoEnfocado && ejercicios.map((ej, pos) => (
                <SelectorDificultad
                  key={ej.sesionEjercicioId}
                  valorInicial={ej.dificultadPercibida}
                  disabled={seriesHechas[pos].size < ej.seriesProgramadas}
                  onGuardar={guardarAhora}
                  forzarModal={pos === encuestaPendiente}
                  onResponder={() => {
                    setMostrandoSiguiente(false);
                    alResponderEncuesta(pos);
                  }}
                  nombreCampo={`dificultad_ejercicio${sufijoDe(pos)}`}
                />
              ))}
              {!modoEnfocado && ejercicios.map((ej, pos) => (
                <label key={`nota-${ej.sesionEjercicioId}`} className="radius-control mt-1 flex items-center gap-2 border border-border bg-surface-2 px-2.5 py-1.5">
                  <NotebookPen size={14} className="shrink-0 text-text-tertiary" />
                  <input
                    name={`nota_ejercicio${sufijoDe(pos)}`}
                    type="text"
                    placeholder={`Nota de ${etiquetaPaso(pos)} (opcional)`}
                    defaultValue={borradoresLocales[pos]?.nota ?? ej.notaEjercicio ?? ""}
                    className="text-caption w-full min-w-0 bg-transparent text-text outline-none placeholder:text-text-tertiary"
                  />
                </label>
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
