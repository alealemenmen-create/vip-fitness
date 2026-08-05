"use client";

import { forwardRef, useActionState, useEffect, useImperativeHandle, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Play,
  Layers,
  Repeat,
  Timer,
  Gauge,
  ImageIcon,
  NotebookPen,
  Maximize2,
  X,
  Info,
  TrendingUp,
  ShieldAlert,
  HeartCrack,
} from "lucide-react";
import Image from "next/image";
import { Card } from "@/components/ui/Card";
import { guardarSeries, penalizarExcesoDescanso, type GuardarSeriesState } from "@/app/alumno/entrenar/actions";
import { reportarDolor, type ReportarDolorState } from "@/app/alumno/entrenar/impulso-actions";
import type { EjercicioSesion } from "@/app/alumno/entrenar/data";
import { IlustracionEjercicio } from "@/components/student/IlustracionEjercicio";
import { resolverIlustracion, resolverFotoCompleta } from "@/lib/ejercicios/ilustracion";
import { ETIQUETAS_GRUPO_MUSCULAR } from "@/components/student/GrupoMuscularIcon";
import { repsObjetivo, esEjercicioDeTiempo } from "@/lib/entrenamiento/reps";
import { avisarFinDescanso, cortarAviso, prepararAviso } from "@/lib/entrenamiento/aviso";
import { guardarDescanso, leerDescanso, limpiarDescanso } from "@/lib/entrenamiento/descanso";
import { resolverGrupoTecnica } from "@/lib/entrenamiento/tecnica-grupo";
import { PUNTOS_VIP } from "@/lib/ranking/reglas";
import {
  guardarBorrador,
  leerBorrador,
  limpiarBorrador,
  type BorradorEjercicio,
} from "@/lib/entrenamiento/borrador";

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

/** "01:15" en vez de "75s" — mismo dato, formato reloj como en la referencia. */
function formatoRestante(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatUltimo(u: EjercicioSesion["ultimoRegistro"], esTiempo: boolean) {
  if (!u) return null;
  const pesoTxto = u.esPesoCorporal ? "Peso corporal" : u.pesoKg != null ? `${u.pesoKg} kg` : "—";
  const repsTxto = u.reps != null ? `${u.reps} ${esTiempo ? "seg" : "reps"}` : "";
  return `${pesoTxto}${repsTxto ? ` × ${repsTxto}` : ""}`;
}

/**
 * La foto de referencia del ejercicio, tomada en el gimnasio VIP.
 *
 * Deliberadamente NO usa el fallback a la foto de grupo muscular (a
 * diferencia de <IlustracionEjercicio>): ese fallback vive en el ícono chico
 * de al lado del nombre. Acá, mientras no exista la foto propia del
 * ejercicio, se muestra el cuadro vacío en gris — mezclar los dos fallbacks
 * en el mismo lugar los volvía indistinguibles.
 */
function CuadroFotoReferencia({
  ilustracionSlug,
  fotoMiniaturaUrl,
  fotoCompletaUrl,
  nombre,
}: {
  ilustracionSlug: string | null;
  /** Fotos subidas desde /admin/ejercicios — mandan sobre la ilustración
   * estática cuando existen (ver migración 0042). */
  fotoMiniaturaUrl: string | null;
  fotoCompletaUrl: string | null;
  nombre: string;
}) {
  const { src: srcEstatico, origen } = resolverIlustracion(ilustracionSlug, null);
  const src = fotoMiniaturaUrl ?? (origen === "ilustracion" ? srcEstatico : null);
  const tamano = { width: 116, minHeight: 96 };

  if (!src) {
    return (
      <div
        // `self-stretch`: el borde de ABAJO queda a la misma altura que la línea
        // inferior del recuadro de series/reps/descanso, porque los dos terminan
        // donde termina la columna de la izquierda.
        // Los márgenes negativos son solo arriba y a la derecha: el cuadro se
        // estira en diagonal hacia esa esquina comiéndose casi todo el padding de
        // la tarjeta (queda ~4 px de aire para que se siga viendo el margen).
        className="-mr-2 -mt-2 flex shrink-0 items-center justify-center self-stretch overflow-hidden rounded-[14px] border border-dashed border-border bg-surface-2 text-text-tertiary"
        style={tamano}
        // Para un lector de pantalla esto es decoración vacía, no una imagen que
        // falta: no aporta nada leerlo en voz alta.
        aria-hidden="true"
        title={`Foto de referencia de ${nombre} (pendiente)`}
      >
        <ImageIcon size={22} />
      </div>
    );
  }

  return (
    <FotoReferenciaAmpliable
      src={src}
      srcCompleta={fotoCompletaUrl ?? resolverFotoCompleta(ilustracionSlug)}
      nombre={nombre}
      tamano={tamano}
    />
  );
}

/**
 * Mientras el recorte automático de cada foto no queda perfecto (algunas
 * llegan un poco chicas o descentradas dentro del cuadrito), tocarla la
 * agranda a pantalla completa para que el alumno igual pueda verla bien —
 * volver a tocar en cualquier parte la cierra. Es el atajo rápido para tener
 * la app lista ya; el recorte prolijo de cada foto es un trabajo aparte que
 * se sigue haciendo de a poco desde /admin/ejercicios.
 */
function FotoReferenciaAmpliable({
  src,
  srcCompleta,
  nombre,
  tamano,
}: {
  src: string;
  /** La foto ORIGINAL sin recortar, si ya se identificó cuál es (ver
   * `resolverFotoCompleta`) — el visor la usa en vez de `src` (que es la
   * versión recortada de la miniatura) para que el alumno vea el ejercicio
   * completo, tal como se tomó en el gimnasio. */
  srcCompleta: string | null;
  nombre: string;
  tamano: { width: number; minHeight: number };
}) {
  const [ampliada, setAmpliada] = useState(false);
  const srcAmpliada = srcCompleta ?? src;

  return (
    <>
      <button
        type="button"
        onClick={() => setAmpliada(true)}
        aria-label={`Ver foto de referencia de ${nombre} en grande`}
        className="-mr-2 -mt-2 relative flex shrink-0 self-stretch overflow-hidden rounded-[14px] border border-border bg-surface-2"
        style={tamano}
      >
        <Image
          src={src}
          alt={`Foto de referencia de ${nombre}`}
          fill
          sizes="116px"
          // object-center y no object-top: a diferencia de la foto de grupo
          // muscular (que se recorta desde arriba), estas fotos ya vienen
          // recortadas y centradas en el servidor. Anclarlas arriba cortaba la
          // mitad de abajo de la persona en cuadros más anchos que altos.
          className="object-cover object-center"
        />
        {/* Botón de expandir, chico y en la esquina (referencia de diseño):
            un ícono basta como pista de que hay más para ver, sin tapar la
            foto con una franja de texto. */}
        <span className="absolute bottom-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm">
          <Maximize2 size={12} strokeWidth={2.5} />
        </span>
      </button>

      {ampliada &&
        createPortal(
          <div
            role="dialog"
            aria-label={`Foto de referencia de ${nombre}`}
            onClick={() => setAmpliada(false)}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/90 p-4 animate-visor-fondo"
          >
            {/* Sin aspect-square: la foto se muestra tal cual está guardada,
                con su proporción real (la mayoría son de cuerpo entero, más
                altas que anchas), acotada por el alto y ancho de la pantalla
                — no un cuadrado que la deja flotando con bordes vacíos. */}
            <div
              className="relative h-[75vh] w-full max-w-md animate-visor-foto"
              onClick={(e) => e.stopPropagation()}
            >
              <Image
                src={srcAmpliada}
                alt={`Foto de referencia de ${nombre}`}
                fill
                sizes="90vw"
                className="rounded-xl object-contain"
              />
            </div>
            <p className="text-caption text-white/70">{nombre}</p>
            <button
              type="button"
              onClick={() => setAmpliada(false)}
              aria-label="Cerrar vista ampliada"
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white"
            >
              <X size={20} />
            </button>
          </div>,
          document.body
        )}
    </>
  );
}

/** Una de las celdas de la fila de datos del ejercicio. */
function Dato({
  icono,
  valor,
  etiqueta,
}: {
  icono: React.ReactNode;
  valor: string;
  etiqueta: string;
}) {
  return (
    // El borde izquierdo va en todas menos la primera: separa las celdas sin
    // meter un elemento extra entre medio.
    // `min-w-0`: sin esto las celdas no bajan de su ancho de contenido y la
    // fila entera se desbordaba por debajo de la foto de referencia.
    <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5 px-0.5 py-0.5 [&+&]:border-l [&+&]:border-border">
      {/* Ícono y valor en la MISMA línea, no apilados: apilados, la fila medía
          65 px de alto en cada uno de los siete ejercicios. Así baja a ~44 sin
          achicar el número, que es lo que se mira de reojo entre serie y serie. */}
      <span className="flex items-center gap-1">
        <span className="text-vip">{icono}</span>
        <span className="text-caption whitespace-nowrap font-semibold leading-none text-text">{valor}</span>
      </span>
      <span className="text-micro leading-none text-text-tertiary">{etiqueta}</span>
    </div>
  );
}

/**
 * La meta de Impulso VIP para este ejercicio — ya calculada y congelada al
 * empezar la sesión (ver `generarYGuardarRecomendacion`), nunca recalculada
 * acá. Se muestra antes de "Último registro": es la versión accionable de
 * ese mismo dato histórico.
 *
 * `estado === 'bloqueada'` (Regla E) es la única que cambia de lenguaje por
 * completo: no es una meta, es una pausa de seguridad — nunca dice "meta del
 * día" ni sugiere peso o repeticiones.
 */
function TarjetaImpulsoVip({ recomendacion }: { recomendacion: EjercicioSesion["recomendacionImpulso"] }) {
  if (!recomendacion) return null;

  if (recomendacion.estado === "bloqueada") {
    return (
      <div className="tarjeta-impulso-vip tarjeta-impulso-vip-alerta mb-1.5 flex items-start gap-2">
        <ShieldAlert size={13} className="mt-0.5 shrink-0 text-warning" strokeWidth={2.5} />
        <p className="text-micro leading-snug text-text-secondary">
          <span className="font-semibold text-warning">Revisión requerida: </span>
          {recomendacion.justificacion}
        </p>
      </div>
    );
  }

  const pendiente = recomendacion.estado === "propuesta";

  return (
    <div className={`tarjeta-impulso-vip mb-1.5 flex items-start gap-2 ${pendiente ? "tarjeta-impulso-vip-pendiente" : ""}`}>
      <TrendingUp size={13} className="mt-0.5 shrink-0 text-vip" strokeWidth={2.5} />
      <p className="text-micro leading-snug text-text-secondary">
        <span className="font-semibold text-vip">
          {pendiente ? "Impulso VIP (pendiente de aprobación): " : "Impulso VIP: "}
        </span>
        {recomendacion.justificacion}
      </p>
    </div>
  );
}

const OPCIONES_DIFICULTAD: { valor: string; etiqueta: string }[] = [
  { valor: "muy_facil", etiqueta: "Me quedaron varias" },
  { valor: "facil", etiqueta: "Exigente y controlada" },
  { valor: "justo", etiqueta: "Casi al límite" },
  { valor: "dificil", etiqueta: "Muy difícil" },
  { valor: "fallo", etiqueta: "No pude completar" },
];

/**
 * "¿Cómo sentiste este ejercicio?" — se pregunta UNA vez por ejercicio al
 * terminarlo, no por serie (ver decisión en AGENTS del proyecto): pedirlo
 * serie por serie hubiera vuelto más lenta cada sesión. Viaja como un campo
 * más del mismo formulario de `guardarSeries`, vía el input oculto — no hace
 * falta una Server Action aparte.
 */
function SelectorDificultad({
  valorInicial,
  disabled,
  onGuardar,
}: {
  valorInicial: string | null;
  disabled: boolean;
  /** Elegir una opción guarda al toque — sin esto, la respuesta se quedaba
   * solo en estado de React hasta que otra cosa disparara un guardado
   * (marcar una serie, editar la nota), y muchas veces no pasaba nada más
   * después de elegirla: quedaba sin persistir. */
  onGuardar: () => void;
}) {
  const [valor, setValor] = useState(valorInicial ?? "");

  if (disabled) return null;

  return (
    <div className="mt-1.5">
      <input type="hidden" name="dificultad_ejercicio" value={valor} />
      <p className="text-micro mb-1 font-bold tracking-wide text-vip">¿CÓMO SENTISTE ESTE EJERCICIO?</p>
      <div className="flex flex-wrap gap-1.5">
        {OPCIONES_DIFICULTAD.map((op) => (
          <button
            key={op.valor}
            type="button"
            onClick={() => {
              // flushSync: igual que en FilaSerie — sin forzar el re-render
              // acá, el <input hidden> todavía tendría el valor viejo cuando
              // `onGuardar` arma el FormData un instante después.
              flushSync(() => setValor(op.valor));
              onGuardar();
            }}
            data-activo={valor === op.valor ? "true" : "false"}
            className="pill-dificultad"
          >
            {op.etiqueta}
          </button>
        ))}
      </div>
    </div>
  );
}

const initialReportarDolorState: ReportarDolorState = { error: null, ok: false };

/**
 * Reportar una molestia es una acción explícita y separada del guardado de
 * series: propio formulario, propia Server Action (`reportarDolor` en
 * impulso-actions.ts) — no viaja mezclado con el resto de los datos del
 * ejercicio.
 */
function ReportarDolorPanel({
  sesionId,
  sesionEjercicioId,
  diaEjercicioId,
}: {
  sesionId: string;
  sesionEjercicioId: string;
  diaEjercicioId: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [state, formAction, pending] = useActionState(reportarDolor, initialReportarDolorState);

  if (state.ok) {
    return (
      <p className="text-micro mt-1.5 flex items-center gap-1.5 text-text-tertiary">
        <HeartCrack size={13} strokeWidth={2.5} /> Molestia registrada — tu entrenador la va a revisar.
      </p>
    );
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="text-micro mt-1.5 flex items-center gap-1.5 text-text-tertiary underline decoration-dotted"
      >
        <HeartCrack size={13} strokeWidth={2.5} /> Sentí una molestia en este ejercicio
      </button>
    );
  }

  return (
    <form action={formAction} className="tarjeta-impulso-vip tarjeta-impulso-vip-alerta mt-1.5 space-y-2">
      <input type="hidden" name="sesion_id" value={sesionId} />
      <input type="hidden" name="sesion_ejercicio_id" value={sesionEjercicioId} />
      <input type="hidden" name="dia_ejercicio_id" value={diaEjercicioId} />
      <p className="text-micro font-semibold text-warning">Contale a tu entrenador qué sentiste</p>
      <label className="block">
        <span className="text-micro text-text-tertiary">Zona (opcional)</span>
        <input
          name="zona"
          type="text"
          placeholder="Ej: hombro derecho"
          className="text-caption mt-0.5 w-full rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-text outline-none placeholder:text-text-tertiary"
        />
      </label>
      <div>
        <span className="text-micro text-text-tertiary">Intensidad (opcional)</span>
        <div className="mt-1 flex gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="pill-dificultad">
              <input type="radio" name="intensidad" value={n} className="sr-only" />
              {n}
            </label>
          ))}
        </div>
      </div>
      <label className="flex items-center gap-2">
        <input type="checkbox" name="detuvo_ejercicio" value="true" className="h-4 w-4" />
        <span className="text-micro text-text-secondary">Tuve que parar el ejercicio</span>
      </label>
      {state.error && <p className="text-caption text-error">{state.error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="h-9 flex-1 rounded-full bg-warning text-caption font-semibold text-black disabled:opacity-60"
        >
          {pending ? "Enviando…" : "Enviar"}
        </button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="h-9 rounded-full border border-border px-3 text-caption text-text-secondary"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

/**
 * Se llama al terminar el descanso: vibra ~4 segundos y suena una vez.
 *
 * La tanda de vibración va en pulsos y no pareja: el teléfono está apoyado en
 * el banco o en el bolsillo, y una vibración continua se confunde con una
 * notificación cualquiera, mientras que este tamborileo se reconoce.
 *
 * El aviso se corta solo apenas el alumno toca la pantalla o vuelve a la app
 * (ver el efecto de abajo): si ya se dio cuenta, seguir sonando solo molesta.
 */

/** Cuánto se queda el botón mostrando las flechas hacia el ejercicio de abajo
 * antes de asentarse en "Listo". */
const MS_AVISO_SIGUIENTE = 4000;

/**
 * Qué técnica mostrar y si es una orden o una sugerencia.
 *
 * Orden de prioridad: lo que el entrenador escribió en la rutina para ESTE
 * ejercicio gana siempre. Recién si no escribió nada se ofrece la técnica de la
 * biblioteca del gimnasio, y ahí se avisa que es sugerida — no es lo mismo "el
 * entrenador te pidió esto" que "así se hace en general".
 *
 * Reemplaza a la observación, que era un campo cajón de sastre: a veces traía
 * la técnica, a veces un recordatorio, a veces el tempo repetido.
 */
function resolverTecnica(
  ejercicio: EjercicioSesion
): { texto: string; sugerida: boolean } | null {
  const dePlan = [ejercicio.tecnicaInstruccion, ejercicio.tecnicaTipo, ejercicio.observacion]
    .map((v) => v?.trim())
    .find((v) => v);
  if (dePlan) return { texto: dePlan, sugerida: false };

  const deBiblioteca = ejercicio.tecnicaSugerida?.trim();
  return deBiblioteca ? { texto: deBiblioteca, sugerida: true } : null;
}

const FilaSerie = forwardRef<
  FilaSerieHandle,
  {
    numero: number;
    inicial: EjercicioSesion["series"][number] | undefined;
    /** Repeticiones a precargar: la meta de Impulso VIP si hay una
     * aprobada, si no el techo del rango que escribió el entrenador. */
    repsObjetivo: number | null;
    /** Peso a precargar — solo cuando hay una recomendación de Impulso VIP
     * aprobada (nunca para 'propuesta' ni 'bloqueada'). Null mantiene el
     * comportamiento de siempre: el campo arranca vacío. */
    pesoSugerido: number | null;
    /** Ejercicios por tiempo (plancha, isométricos): mismo campo, pero pide
     * segundos en vez de repeticiones — ver `esEjercicioDeTiempo`. */
    esTiempo: boolean;
    descansoSegundos: number | null;
    soloLectura: boolean;
    /** Para anclar el descanso a una hora real en localStorage — ver
     * `lib/entrenamiento/descanso.ts`. */
    sesionId: string;
    sesionEjercicioId: string;
    /** Se llama apenas cambia algo, para guardar sin esperar a que el alumno
     * termine todo el ejercicio. */
    onGuardar: () => void;
    /** Solo el temporizador "activo" de todo el ejercicio corre — arrancar el
     * de otra serie pausa este solo. */
    activo: boolean;
    /** Es la primera serie sin hacer del ejercicio en curso: la que lleva el
     * barrido de luz que dice "seguí por acá". */
    esLaQueToca: boolean;
    onCicloCompleto: (numero: number) => void;
    /** Se canceló un descanso que ya había contado como completado: la serie
     * vuelve a estar pendiente y el barrido tiene que volver a ella. */
    onCicloDeshecho: (numero: number) => void;
    onIniciar: (numero: number) => void;
    /** Color de la familia de técnica encadenada (superserie/biserie/...),
     * si el ejercicio pertenece a una — el botón de la serie que toca ahora
     * se ilumina con este color además del ámbar de siempre. */
    colorGrupoTecnica?: string | null;
  }
>(function FilaSerie(
  {
    numero,
    inicial,
    repsObjetivo,
    pesoSugerido,
    esTiempo,
    descansoSegundos,
    soloLectura,
    sesionId,
    sesionEjercicioId,
    activo,
    esLaQueToca,
    onCicloCompleto,
    onCicloDeshecho,
    onIniciar,
    onGuardar,
    colorGrupoTecnica,
  },
  ref
) {
  const esPesoCorporal = inicial?.esPesoCorporal ?? false;
  const [realizada, setRealizada] = useState(inicial?.realizada ?? false);
  const [restante, setRestante] = useState<number | null>(null);
  const avisadoRef = useRef(inicial?.realizada ?? false);
  /** Ventana corta, apenas termina el descanso, en la que el botón muestra las
   * flechas hacia abajo en vez de "Listo": es el empujón para seguir con lo que
   * viene sin tener que buscarlo en la pantalla. */
  const [avisandoSiguiente, setAvisandoSiguiente] = useState(false);
  /** Semibloqueo de series fuera de turno: tocar la serie que SÍ toca
   * (`esLaQueToca`) completa con un toque, como siempre. Cualquier otra
   * necesita 3 toques seguidos — el dedo puede rozar la fila equivocada
   * mientras se busca la que corresponde, y antes eso la daba por hecha
   * igual. Se reinicia si pasan más de 2s entre toques, para que no sea un
   * contador que se acumula en toques sueltos a lo largo de la sesión. */
  const [tocandoConfirmacion, setTocandoConfirmacion] = useState(0);
  const confirmacionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const TOQUES_CONFIRMACION = 3;

  /** Semibloqueo para deshacer una serie ya marcada: un solo toque por error
   * sobre el check no la desmarca — hacen falta 2 toques seguidos. Mismo
   * mecanismo que el de arriba (fuera de turno), con su propio contador
   * porque son dos gestos distintos que pueden pasar en momentos distintos. */
  const [tocandoDeshacer, setTocandoDeshacer] = useState(0);
  const deshacerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const TOQUES_DESHACER = 2;

  useEffect(() => {
    return () => {
      if (confirmacionTimeoutRef.current) clearTimeout(confirmacionTimeoutRef.current);
      if (deshacerTimeoutRef.current) clearTimeout(deshacerTimeoutRef.current);
    };
  }, []);

  useImperativeHandle(ref, () => ({
    completarYa: () => {
      // Fuerza la serie como hecha ya mismo, corte el descanso si estaba
      // corriendo — lo usa el botón "Ejercicio listo" para saltar todo.
      limpiarDescanso(sesionId, sesionEjercicioId, numero);
      flushSync(() => {
        setRealizada(true);
        setRestante(null);
      });
      if (!avisadoRef.current) {
        avisadoRef.current = true;
        onCicloCompleto(numero);
      }
      onGuardar();
    },
  }));

  const descansando = restante !== null;
  /** Un solo atributo con el estado del botón, para que el CSS no tenga que
   * combinar tres data-* sueltos para decidir cómo pintarlo. */
  const estadoBoton = descansando
    ? activo
      ? "corriendo"
      : "pausado"
    : avisandoSiguiente
      ? "avisando"
      : realizada
        ? tocandoDeshacer > 0
          ? "confirmar-deshacer"
          : "hecha"
        : tocandoConfirmacion > 0
          ? "confirmar"
          // Fuera de turno se pinta como "pausado" (gris, apagado) en vez del
          // ámbar de "tocá acá" — es el semibloqueo visual: se ve que no es
          // esta la fila que corresponde, sin que deje de poder tocarse.
          : !esLaQueToca
            ? "pausado"
            : "pendiente";

  // Al montar, si quedó un descanso corriendo de antes de cambiar de pestaña
  // (ver lib/entrenamiento/descanso.ts), se retoma contra la hora real: ni
  // se reinicia ni queda congelado. Si ya venció mientras el alumno andaba en
  // otra pantalla, se asienta directo en "hecha" sin repetir la vibración —
  // volver y que el teléfono vibre solo por abrir la app sería más molesto
  // que útil.
  useEffect(() => {
    if (soloLectura) return;
    const finEn = leerDescanso(sesionId, sesionEjercicioId, numero);
    if (finEn === null) return;

    const restanteReal = Math.round((finEn - Date.now()) / 1000);
    if (restanteReal > 0) {
      setRestante(restanteReal);
      onIniciar(numero);
    } else {
      limpiarDescanso(sesionId, sesionEjercicioId, numero);
      setRestante(null);
      if (!avisadoRef.current) {
        avisadoRef.current = true;
        onCicloCompleto(numero);
      }
    }
    // Solo al montar: una vez restaurado, el resto del ciclo de vida de este
    // descanso lo maneja el efecto de la cuenta regresiva de abajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // El navegador pausa o enlentece los timers de JS mientras la pestaña está
  // en background (llamada entrante, cambiar a WhatsApp, apagar pantalla):
  // el setInterval de abajo puede atrasarse o directamente no tickear. Al
  // volver a estar visible, se recalcula "restante" contra el fin real
  // guardado en vez de confiar en cuántas veces alcanzó a tickear el interval.
  useEffect(() => {
    if (soloLectura) return;
    const alVolver = () => {
      if (document.hidden) return;
      const finEn = leerDescanso(sesionId, sesionEjercicioId, numero);
      if (finEn === null) return;

      const restanteReal = Math.round((finEn - Date.now()) / 1000);
      if (restanteReal > 0) {
        setRestante(restanteReal);
      } else {
        limpiarDescanso(sesionId, sesionEjercicioId, numero);
        setRestante(null);
        avisarFinDescanso();
        setAvisandoSiguiente(true);
        if (!avisadoRef.current) {
          avisadoRef.current = true;
          onCicloCompleto(numero);
        }
      }
    };
    document.addEventListener("visibilitychange", alVolver);
    return () => document.removeEventListener("visibilitychange", alVolver);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cuenta regresiva controlada por efecto: solo corre si esta serie es la
  // "activa" del ejercicio — al arrancar el descanso de otra serie, esta
  // queda pausada sola (restante se congela donde iba).
  useEffect(() => {
    if (!descansando || !activo) return;
    const id = setInterval(() => {
      setRestante((prev) => {
        if (prev === null || prev <= 1) {
          limpiarDescanso(sesionId, sesionEjercicioId, numero);
          avisarFinDescanso();
          setAvisandoSiguiente(true);
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

  /** Cuánto se pasó del descanso indicado, en tramos de
   * `PUNTOS_VIP.descansoSegundosPorTramo` — cada tramo completo resta puntos
   * (ver `penalizarExcesoDescanso`). Corre mientras esta serie sigue "activa"
   * (nadie arrancó la siguiente todavía) pero su propio descanso ya terminó
   * DE VERDAD (avisadoRef true descarta el caso de "arrepentimiento": tocar
   * Listo por error y cancelar no debe penalizar). Se resetea apenas se
   * arranca la siguiente serie o el descanso de esta se reinicia. */
  const [tramosExcedidos, setTramosExcedidos] = useState(0);
  const excesoDesdeRef = useRef<number | null>(null);
  useEffect(() => {
    if (soloLectura || !activo || descansando || !avisadoRef.current || !descansoSegundos) {
      excesoDesdeRef.current = null;
      setTramosExcedidos(0);
      return;
    }
    excesoDesdeRef.current ??= Date.now();
    const tramoMs = PUNTOS_VIP.descansoSegundosPorTramo * 1000;
    const id = setInterval(() => {
      const transcurrido = Date.now() - (excesoDesdeRef.current ?? Date.now());
      const tramos = Math.floor(transcurrido / tramoMs);
      if (tramos > 0) {
        setTramosExcedidos(tramos);
        void penalizarExcesoDescanso(sesionEjercicioId, numero, tramos);
      }
    }, 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activo, descansando, soloLectura]);

  // Las flechas se apagan solas: son un empujón, no un estado en el que la fila
  // se quede. Después el botón se asienta en "Listo".
  //
  // Mientras están encendidas, cualquier señal de que el alumno ya se enteró
  // —tocar la pantalla, volver a la app— corta la vibración y el pitido. Las
  // flechas siguen su curso: son visuales y no molestan a nadie.
  useEffect(() => {
    if (!avisandoSiguiente) return;
    const id = setTimeout(() => setAvisandoSiguiente(false), MS_AVISO_SIGUIENTE);
    const alVolver = () => {
      if (!document.hidden) cortarAviso();
    };
    window.addEventListener("pointerdown", cortarAviso);
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      clearTimeout(id);
      window.removeEventListener("pointerdown", cortarAviso);
      document.removeEventListener("visibilitychange", alVolver);
      // Al desmontar (cambio de pantalla, revalidación) nada debe seguir sonando.
      cortarAviso();
    };
  }, [avisandoSiguiente]);

  function presionarListo() {
    if (soloLectura) return;

    if (descansando) {
      // Tocarlo mientras corre CANCELA el descanso y deshace la serie: es el
      // arrepentimiento de haberlo apretado sin querer, que es lo único que uno
      // quiere hacer con un cronómetro que no debería haber arrancado.
      // Antes lo reiniciaba, y un toque accidental no tenía vuelta atrás salvo
      // esperar los 150 segundos completos.
      limpiarDescanso(sesionId, sesionEjercicioId, numero);
      // flushSync: `onGuardar` lee el <input hidden> de "realizada" del DOM
      // (vía FormData) apenas termina esta función. Sin forzar el
      // re-render acá, React todavía no había pintado el "false" nuevo y el
      // guardado mandaba el valor viejo ("true") — la serie quedaba marcada
      // como hecha en el servidor aunque en pantalla se viera deshecha.
      flushSync(() => {
        setRestante(null);
        setRealizada(false);
        setAvisandoSiguiente(false);
      });
      avisadoRef.current = false;
      onCicloDeshecho(numero);
      onGuardar();
      return;
    }

    if (realizada) {
      // El check queda a mano del pulgar al lado de los campos: un toque de
      // más ahí lo desmarcaba sin querer. Mismo semibloqueo que las series
      // fuera de turno, pero con 2 toques (acá el error es más fácil de
      // cometer sin querer, no hace falta pedir 3).
      const siguiente = tocandoDeshacer + 1;
      if (siguiente < TOQUES_DESHACER) {
        setTocandoDeshacer(siguiente);
        if (deshacerTimeoutRef.current) clearTimeout(deshacerTimeoutRef.current);
        deshacerTimeoutRef.current = setTimeout(() => setTocandoDeshacer(0), 2000);
        return;
      }
      setTocandoDeshacer(0);
      if (deshacerTimeoutRef.current) {
        clearTimeout(deshacerTimeoutRef.current);
        deshacerTimeoutRef.current = null;
      }

      flushSync(() => {
        setRealizada(false);
        setAvisandoSiguiente(false);
      });
      avisadoRef.current = false;
      onCicloDeshecho(numero);
      onGuardar();
      return;
    }

    if (!esLaQueToca) {
      const siguiente = tocandoConfirmacion + 1;
      if (siguiente < TOQUES_CONFIRMACION) {
        setTocandoConfirmacion(siguiente);
        if (confirmacionTimeoutRef.current) clearTimeout(confirmacionTimeoutRef.current);
        confirmacionTimeoutRef.current = setTimeout(() => setTocandoConfirmacion(0), 2000);
        return;
      }
      // Toque número TOQUES_CONFIRMACION: confirma, sigue el flujo normal de
      // abajo como si fuera la serie en turno.
      setTocandoConfirmacion(0);
      if (confirmacionTimeoutRef.current) {
        clearTimeout(confirmacionTimeoutRef.current);
        confirmacionTimeoutRef.current = null;
      }
    }

    flushSync(() => setRealizada(true));
    if (descansoSegundos && descansoSegundos > 0) {
      // Este toque es el gesto del usuario que habilita el audio: el pitido va a
      // sonar dentro de un temporizador, y para entonces ya no hay gesto que
      // valga. Ver `prepararAviso`.
      prepararAviso();
      onIniciar(numero);
      setRestante(descansoSegundos);
      guardarDescanso(sesionId, sesionEjercicioId, numero, Date.now() + descansoSegundos * 1000);
    } else if (!avisadoRef.current) {
      avisadoRef.current = true;
      onCicloCompleto(numero);
    }

    // Guardar ACÁ y no al terminar el ejercicio: si el alumno bloquea el
    // teléfono o cambia de app durante el descanso, la serie ya está a salvo.
    onGuardar();
  }

  return (
    // p-1.5 y no p-2: con tres series, la tarjeta del ejercicio en curso y la
    // cabecera del siguiente tienen que entrar juntas en una pantalla de
    // celular — que es como se usa esto, apoyado en el banco.
    <div
      className="fila-serie p-2"
      data-hecha={realizada ? "true" : "false"}
      data-activa={esLaQueToca ? "true" : "false"}
      data-descansando={descansando ? "true" : "false"}
    >
      <input type="hidden" name={`peso_corporal_${numero}`} value={esPesoCorporal ? "true" : "false"} />
      <input type="hidden" name={`realizada_${numero}`} value={realizada ? "true" : "false"} />

      <div className="flex items-center gap-1.5">
        {/* Número en disco y no "#1": con el celular apoyado y de reojo, la
            forma se distingue antes que el texto, y marca dónde arranca la fila. */}
        <span className="numero-serie" data-hecha={realizada ? "true" : "false"}>
          {numero}
        </span>
        {/* Campos planos, sin caja propia — la referencia no encierra cada
            número en su propio recuadro, es un solo renglón con un separador
            vertical entre carga y repeticiones. */}
        <label className="campo-serie-plano flex-1">
          <input
            name={`peso_${numero}`}
            type="number"
            step="0.5"
            min="0"
            inputMode="decimal"
            placeholder="—"
            disabled={esPesoCorporal}
            // Lo ya cargado (guardado o borrador) manda siempre; si no hay
            // nada todavía, la meta de Impulso VIP precarga el peso a
            // intentar (solo si hay una recomendación aprobada — ver
            // `pesoSugeridoEfectivo` en el componente padre).
            defaultValue={inicial?.pesoKg ?? pesoSugerido ?? ""}
          />
          <span className="campo-serie-etiqueta">kg</span>
        </label>
        <span className="separador-serie" aria-hidden />
        {/* La etiqueta va dentro del campo, a la izquierda del número: sin ella
            "8" al lado de la carga se leía como otro peso. */}
        <label className="campo-serie-plano w-[64px] shrink-0">
          <input
            name={`reps_${numero}`}
            type="number"
            min="0"
            inputMode="numeric"
            placeholder={esTiempo ? "Seg" : undefined}
            // Viene precargado con las repeticiones objetivo de la rutina para
            // que el alumno solo lo corrija si hizo otra cosa; sigue siendo
            // editable. Lo ya registrado manda por sobre el objetivo. Mismo
            // campo para ejercicios por tiempo (ver `esEjercicioDeTiempo`):
            // ahí no hay objetivo numérico que precargar, el alumno carga los
            // segundos que aguantó.
            defaultValue={inicial?.repsRealizadas ?? repsObjetivo ?? ""}
          />
          <span className="campo-serie-etiqueta">{esTiempo ? "seg" : "reps"}</span>
        </label>
        {!soloLectura && (
          <button
            type="button"
            onClick={presionarListo}
            data-estado={estadoBoton}
            data-grupo-tecnica={colorGrupoTecnica && esLaQueToca ? "true" : "false"}
            className="boton-descanso"
            style={
              colorGrupoTecnica
                ? ({ "--color-glow-tecnica": colorGrupoTecnica } as React.CSSProperties)
                : undefined
            }
            aria-label={
              descansando
                ? activo
                  ? `Descanso, ${restante}s — tocar para reiniciar`
                  : `En pausa, ${restante}s — arrancó el descanso de otra serie`
                : realizada
                  ? avisandoSiguiente
                    ? "Descanso terminado — seguí con lo que viene"
                    : tocandoDeshacer > 0
                      ? "Tocá de nuevo para deshacer esta serie"
                      : "Serie lista"
                  : tocandoConfirmacion > 0
                    ? `Esta no es la serie en turno — tocá ${TOQUES_CONFIRMACION - tocandoConfirmacion} vez más para confirmar`
                    : esLaQueToca
                      ? "Empezar descanso"
                      : "Serie fuera de turno — tocar 3 veces para confirmar"
            }
          >
            {/* La barra que se vacía con la cuenta regresiva: el número dice
                cuánto falta, pero esto se entiende sin leer, que es de lo que se
                trata cuando uno está sin aire a mitad de serie. */}
            {descansando && (
              <span
                className="boton-descanso-relleno"
                style={{
                  width: descansoSegundos ? `${((restante ?? 0) / descansoSegundos) * 100}%` : "0%",
                }}
              />
            )}
            <span className="boton-descanso-contenido">
              {descansando ? (
                activo ? (
                  // Reloj + etiqueta + cuenta en formato mm:ss, como la
                  // referencia — mismo dato que antes (segundos crudos),
                  // solo el formato de lectura cambia.
                  <span className="flex items-center gap-1.5">
                    <Timer size={14} strokeWidth={2.5} />
                    <span className="flex flex-col items-start leading-tight">
                      <span className="boton-descanso-etiqueta">Descanso</span>
                      <span className="boton-descanso-cuenta">{formatoRestante(restante ?? 0)}</span>
                    </span>
                  </span>
                ) : (
                  <>
                    <Play size={13} strokeWidth={3} />
                    <span>Seguir</span>
                  </>
                )
              ) : avisandoSiguiente ? (
                /* Las tres flechas apuntando a lo que sigue más abajo. Duran
                   unos segundos y después el botón se asienta en "Listo". */
                <span className="flechas-seguir" aria-hidden>
                  {[0, 1, 2].map((indice) => (
                    <ChevronDown
                      key={indice}
                      size={15}
                      strokeWidth={3}
                      style={{ animationDelay: `${indice * 130}ms` }}
                    />
                  ))}
                </span>
              ) : realizada ? (
                // Casillero tipo checkbox, como la referencia — mismo estado
                // "hecha" de siempre, solo cambia de píldora con texto a
                // cuadrito con tilde. Al primer toque para deshacer, el tilde
                // pulsa en vez de desaparecer — recién al segundo se deshace.
                <Check size={16} strokeWidth={3} />
              ) : tocandoConfirmacion > 0 ? (
                // Semibloqueo de serie fuera de turno: el toque cuenta pero
                // todavía no completa nada — avisa cuántos más faltan.
                <span className="flex flex-col items-center leading-tight">
                  <span>
                    Tocá {TOQUES_CONFIRMACION - tocandoConfirmacion}{" "}
                    {TOQUES_CONFIRMACION - tocandoConfirmacion === 1 ? "vez" : "veces"} más
                  </span>
                </span>
              ) : esLaQueToca ? (
                <span className="flex flex-col items-center leading-tight">
                  <span>Descanso</span>
                  {descansoSegundos ? (
                    <span className="boton-descanso-segundos">{descansoSegundos}s</span>
                  ) : null}
                </span>
              ) : (
                // Fuera de turno y todavía sin tocar: píldora neutra, como
                // la referencia — el semibloqueo de 3 toques sigue igual,
                // solo cambia de "Recupérate" apagado a esta etiqueta.
                <span>Pendiente</span>
              )}
            </span>
          </button>
        )}
      </div>
      {tramosExcedidos > 0 && (
        // Aviso chico y en rojo: nada intrusivo, solo que quede claro por qué
        // bajaron los puntos — se resetea solo apenas arranca la siguiente serie.
        <p className="mt-1 text-micro text-error">
          Te pasaste del descanso: -
          {Math.min(PUNTOS_VIP.descansoPenalizacionMaxima, tramosExcedidos * PUNTOS_VIP.descansoPenalizacionPorTramo)}{" "}
          pts
        </p>
      )}
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
  // Abierto de entrada el que está en curso y los ya terminados (para poder
  // revisar lo que se levantó); en modo lectura, todos.
  const [expandido, setExpandido] = useState(activo || soloLectura || ejercicio.completado);
  const esTiempo = esEjercicioDeTiempo(ejercicio.repsProgramadas);
  const ultimoTexto = formatUltimo(ejercicio.ultimoRegistro, esTiempo);
  const tecnica = resolverTecnica(ejercicio);
  const recomendacionImpulso = ejercicio.recomendacionImpulso;
  // Solo una recomendación APROBADA precarga algo — 'propuesta' (esperando
  // al entrenador) y 'bloqueada' (Regla E) nunca sugieren peso ni reps.
  const recomendacionAprobada =
    recomendacionImpulso && (recomendacionImpulso.estado === "aprobada" || recomendacionImpulso.estado === "modificada")
      ? recomendacionImpulso
      : null;
  const pesoSugeridoEfectivo =
    recomendacionAprobada && !recomendacionAprobada.esPesoCorporal ? recomendacionAprobada.pesoSugeridoKg : null;
  const grupoTecnica = resolverGrupoTecnica(ejercicio.tecnicaTipo);
  const cardRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const enviadoRef = useRef(false);
  const completadasRef = useRef(
    new Set(ejercicio.series.filter((s) => s.realizada).map((s) => s.numeroSerie))
  );
  /* Las mismas series completadas, pero como estado y no como ref: el ref sirve
     para contar sin re-renderizar, y esto para MOSTRAR cuál es la que toca. */
  const [seriesHechas, setSeriesHechas] = useState<ReadonlySet<number>>(
    () => new Set(ejercicio.series.filter((s) => s.realizada).map((s) => s.numeroSerie))
  );
  // Solo el descanso de esta serie corre — arrancar el de otra la pausa sola.
  const [serieActivaNumero, setSerieActivaNumero] = useState<number | null>(null);
  const [mostrandoSiguiente, setMostrandoSiguiente] = useState(false);
  const filasRef = useRef(new Map<number, FilaSerieHandle>());
  /** Nodo DOM de cada fila de serie, para centrarla en pantalla al terminar
   * la anterior — no confundir con `filasRef` (el handle imperativo de cada
   * fila). */
  const filaNodoRef = useRef(new Map<number, HTMLDivElement>());

  const filas = Array.from({ length: ejercicio.seriesProgramadas }, (_, i) => i + 1);
  // La meta de reps de Impulso VIP (si hay una aprobada) manda por sobre el
  // techo del rango del PDF — mismo criterio que el peso: sin recomendación
  // aprobada, el comportamiento de precarga queda igual que siempre.
  const objetivoReps = recomendacionAprobada?.repsObjetivoMax ?? repsObjetivo(ejercicio.repsProgramadas);

  /**
   * La serie que toca ahora: la primera sin hacer, y solo dentro del ejercicio
   * en curso. Es la que lleva el barrido de luz.
   *
   * Al terminar un descanso la serie pasa a "hecha" y el barrido se corre solo
   * a la de abajo; cuando se completa el ejercicio entero no queda ninguna, y
   * como el siguiente ejercicio pasa a ser el activo, el barrido reaparece en
   * su primera serie. Nunca hay dos encendidas a la vez en toda la sesión.
   */
  const serieQueToca =
    activo && !soloLectura && !ejercicio.completado
      ? (filas.find((n) => !seriesHechas.has(n)) ?? null)
      : null;

  // Respaldo local: se lee DESPUÉS de montar (localStorage no existe en el
  // servidor, leerlo durante el render rompería la hidratación).
  const [borrador, setBorrador] = useState<BorradorEjercicio | null>(null);
  const [borradorLeido, setBorradorLeido] = useState(false);
  // Distingue "todavía no se mandó nada" de "se mandó y el servidor ya
  // contestó": sin esto, el efecto de abajo veía `pending === false` apenas
  // se montaba (antes de mandar nada) y borraba el respaldo del teléfono al
  // toque — justo el caso que existe para proteger: si el teléfono descarta
  // la pestaña por memoria o se corta la conexión ANTES de tocar "Listo" de
  // nuevo, no quedaba ninguna copia de la que recuperarse.
  const seEnvioRef = useRef(false);

  useEffect(() => {
    setBorrador(leerBorrador(sesionId, ejercicio.sesionEjercicioId));
    setBorradorLeido(true);
  }, [sesionId, ejercicio.sesionEjercicioId]);

  /**
   * Copia al teléfono lo que hay ahora en el formulario.
   *
   * Va enganchada al `onChange` del <form>, aprovechando que los eventos de los
   * inputs burbujean: cualquier peso o repetición que se escriba queda
   * respaldada al instante. Al servidor se manda solo al tocar "Listo", para no
   * disparar una petición por cada tecla.
   */
  const respaldarLocal = () => {
    const form = formRef.current;
    if (!form) return;
    const datos = new FormData(form);
    guardarBorrador(sesionId, ejercicio.sesionEjercicioId, {
      series: filas.map((n) => ({
        numero: n,
        peso: String(datos.get(`peso_${n}`) ?? ""),
        reps: String(datos.get(`reps_${n}`) ?? ""),
        realizada: datos.get(`realizada_${n}`) === "true",
        esPesoCorporal: datos.get(`peso_corporal_${n}`) === "true",
      })),
      nota: String(datos.get("nota_ejercicio") ?? ""),
    });
  };

  /**
   * Guarda ya mismo, sin esperar a que el alumno termine el ejercicio.
   *
   * Antes solo se enviaba al completar TODAS las series, así que salir de la
   * app en el medio perdía todo lo cargado. Primero se deja la copia local
   * (instantánea, no puede fallar por red) y después se manda al servidor.
   * Los duplicados no son un problema: `guardarSeries` hace upsert sobre
   * (sesion_ejercicio_id, numero_serie).
   */
  const guardarAhora = () => {
    respaldarLocal();
    seEnvioRef.current = true;
    formRef.current?.requestSubmit();
  };

  // Cuando el servidor confirma, la copia local ya no hace falta: dejarla
  // haría que un borrador viejo se restaure encima de datos más nuevos.
  // `seEnvioRef` es la guarda: sin ella, `pending === false` también es
  // cierto apenas se monta el componente, ANTES de mandar nada — y borraba el
  // respaldo recién restaurado sin que el servidor hubiera confirmado nada.
  useEffect(() => {
    if (seEnvioRef.current && !pending && !state.error && borradorLeido) {
      limpiarBorrador(sesionId, ejercicio.sesionEjercicioId);
    }
  }, [pending, state.error, borradorLeido, sesionId, ejercicio.sesionEjercicioId]);

  /** Lo guardado en la base, o el respaldo local si quedó sin sincronizar. */
  const serieInicial = (numero: number): EjercicioSesion["series"][number] | undefined => {
    const delBorrador = borrador?.series.find((s) => s.numero === numero);
    if (delBorrador) {
      return {
        numeroSerie: numero,
        pesoKg: delBorrador.peso ? Number(delBorrador.peso) : null,
        esPesoCorporal: delBorrador.esPesoCorporal,
        repsRealizadas: delBorrador.reps ? Number(delBorrador.reps) : null,
        realizada: delBorrador.realizada,
      };
    }
    return ejercicio.series.find((s) => s.numeroSerie === numero);
  };

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
      // "start" y no "center": centrada, la mitad de arriba de la tarjeta
      // (foto, nombre, técnica) quedaba tapada arriba del todo de la
      // pantalla — así entra completa, empezando justo debajo de la
      // cabecera fija.
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [activo, soloLectura]);

  // Al terminar un ejercicio, el siguiente pasa a ser el activo tras revalidar:
  // se abre solo, sin que el alumno tenga que tocar nada con las manos ocupadas.
  // Solo abre — nunca cierra lo que el alumno abrió a mano.
  useEffect(() => {
    if (activo) setExpandido(true);
  }, [activo]);

  /** Se canceló o deshizo una serie: vuelve a estar pendiente y el barrido
   * regresa a ella. */
  function alDeshacerCicloSerie(numero: number) {
    completadasRef.current.delete(numero);
    // `enviadoRef` se resetea también: si el alumno deshace y vuelve a
    // completar, el aviso de "siguiente ejercicio" tiene que salir de nuevo.
    enviadoRef.current = false;
    setSeriesHechas((prev) => {
      const proximo = new Set(prev);
      proximo.delete(numero);
      return proximo;
    });
  }

  function alCompletarCicloSerie(numero: number) {
    completadasRef.current.add(numero);
    setSeriesHechas((prev) => new Set(prev).add(numero));
    if (!enviadoRef.current && completadasRef.current.size === ejercicio.seriesProgramadas) {
      enviadoRef.current = true;
      // El aviso visual aparece antes de guardar; al revalidar, el siguiente
      // ejercicio pasa a ser el activo y recibe el destello sutil. 400ms y no
      // 1200: alcanza para que se note el aviso sin sentirse trabado — se
      // pidió que pasar al siguiente ejercicio fuera más inmediato.
      setMostrandoSiguiente(true);
      window.setTimeout(() => {
        formRef.current?.requestSubmit();
        setMostrandoSiguiente(false);
      }, 400);
    } else {
      // Todavía queda otra serie de ESTE ejercicio: la centra en pantalla,
      // donde sea más cómodo verla, en vez de dejar que quede tapada arriba
      // o abajo del recuadro visible (cuando el ejercicio termina del todo,
      // el centrado de la tarjeta siguiente ya lo hace el efecto de `activo`
      // más abajo).
      const siguiente = filas.find((n) => n > numero && !completadasRef.current.has(n));
      if (siguiente) {
        window.requestAnimationFrame(() => {
          filaNodoRef.current.get(siguiente)?.scrollIntoView({ behavior: "smooth", block: "center" });
        });
      }
    }
  }

  return (
    <div
      ref={cardRef}
      // El scroll automático al siguiente ejercicio para justo acá abajo:
      // sin esto, `scrollIntoView({block:"start"})` alinea la tarjeta con el
      // borde de arriba de la pantalla, que queda TAPADO por la cabecera fija
      // (título + barra de puntos, position sticky) — la tarjeta entraba
      // por debajo de esa barra en vez de después.
      style={{ scrollMarginTop: "calc(var(--alto-cabecera-alumno) + 130px)" }}
    >
      {/* `tarjeta-modelo-oscura`: negro real en los dos temas, como la
          referencia — antes usaba el gris de `bg-surface`, que al lado del
          resto de la pantalla se veía deslavado. */}
      <Card
        className={`tarjeta-modelo-oscura tarjeta-ejercicio-oscura p-3 ${activo && !soloLectura ? "panel-ejercicio-activo" : ""}`}
        style={
          grupoTecnica
            ? { borderLeft: `3px solid ${grupoTecnica.color}` }
            : undefined
        }
      >

        {/* Cabecera en dos columnas: a la izquierda lo que se lee (qué
            ejercicio es y con qué números), a la derecha la foto de referencia.
            La fila de datos vive DENTRO de la columna izquierda —antes cruzaba
            la tarjeta entera debajo de la foto— y eso es lo que deja lugar para
            que la foto sea grande sin estirar la tarjeta hacia abajo. */}
        <div className="mb-2 flex items-start gap-2">
          <div className="flex min-w-0 flex-1 flex-col">
            {/* El muñeco del grupo muscular es una columna propia y no un
                iconito metido en la línea de arriba: así la etiqueta y el
                nombre del ejercicio arrancan en la MISMA vertical (la P de
                "Press" debajo de la E de "EJERCICIO") en vez de escalonados, y
                el muñeco puede ser grande sin empujar nada. */}
            <div className="flex items-start gap-2">
              {/* Anillo ámbar sutil alrededor del muñeco/foto de grupo
                  muscular — mismo lenguaje "premium" que el resto de la
                  identidad VIP, sin agrandar el ícono en sí. */}
              <div className="anillo-vip-suave shrink-0 rounded-full">
                <IlustracionEjercicio
                  // Siempre el "modelo" del grupo muscular acá: la foto real del
                  // ejercicio (si existe) va en el cuadro grande de la derecha,
                  // no en este ícono. Por eso ilustracionSlug va fijo en null.
                  ilustracionSlug={null}
                  grupoMuscular={ejercicio.grupoMuscular}
                  nombre={ejercicio.nombre}
                  tamano={48}
                />
              </div>
              <div className="min-w-0 flex-1">
                {/* Sin "EJERCICIO" ni truncate: ese prefijo era lo que hacía
                    que el grupo muscular ("PIERNAS", "ESPALDA") se cortara en
                    la columna angosta que deja la foto de referencia al lado.
                    Con el número solo, el texto entero entra o como mucho
                    pasa a una segunda línea — nunca queda escondido. */}
                <p className="text-micro font-semibold leading-tight tracking-wide text-vip">
                  {ejercicio.orden}
                  {ejercicio.grupoMuscular
                    ? ` · ${ETIQUETAS_GRUPO_MUSCULAR[ejercicio.grupoMuscular].toUpperCase()}`
                    : ""}
                </p>
                {/* Jerarquía más marcada: el nombre del ejercicio es lo primero
                    que hay que leer de la tarjeta, así que sube de tamaño
                    (antes 14px, igual que cualquier texto secundario). Sigue
                    sin truncate ni tamaño fijo por longitud: si no entra en una
                    línea, pasa a la siguiente. */}
                <p className="text-card-title mt-0.5 leading-tight text-text">
                  {ejercicio.nombre}
                </p>
                {ejercicio.tecnicaTipo && (
                  <span
                    className="pill-tecnica mt-1 inline-block"
                    // Coloreada por familia cuando es una técnica encadenada
                    // (superserie, biserie...): el alumno ve de un vistazo
                    // que este ejercicio va pegado a otro, sin tener que leer
                    // el texto completo.
                    style={
                      grupoTecnica
                        ? {
                            color: grupoTecnica.color,
                            borderColor: grupoTecnica.color,
                            background: `color-mix(in srgb, ${grupoTecnica.color} 16%, transparent)`,
                          }
                        : undefined
                    }
                  >
                    {ejercicio.tecnicaTipo}
                  </span>
                )}
              </div>
            </div>
          </div>
          <CuadroFotoReferencia
            ilustracionSlug={ejercicio.ilustracionSlug}
            fotoMiniaturaUrl={ejercicio.fotoMiniaturaUrl}
            fotoCompletaUrl={ejercicio.fotoCompletaUrl}
            nombre={ejercicio.nombre}
          />
        </div>

        {/* Los números que se consultan de reojo entre serie y serie, ahora a
            todo el ancho de la tarjeta (antes vivía en la columna angosta que
            dejaba la foto al lado, y el tempo no entraba como 4ta columna —
            afuera de esa columna ya no hay ese límite, como en la
            referencia). */}
        <div className="radius-control mb-1.5 flex items-stretch overflow-hidden border border-border bg-surface-2">
          <Dato
            icono={<Layers size={13} />}
            valor={String(ejercicio.seriesProgramadas)}
            etiqueta="Series"
          />
          <Dato
            icono={esTiempo ? <Timer size={13} /> : <Repeat size={13} />}
            valor={ejercicio.repsProgramadas}
            etiqueta={esTiempo ? "Tiempo" : "Reps"}
          />
          <Dato
            icono={<Timer size={13} />}
            valor={ejercicio.descansoSegundos ? `${ejercicio.descansoSegundos}s` : "—"}
            etiqueta="Desc."
          />
          {ejercicio.tempo && (
            <Dato icono={<Gauge size={13} />} valor={ejercicio.tempo.valor} etiqueta="Tempo" />
          )}
        </div>

        {/* Plegado: el ejercicio que no toca todavía muestra solo la cabecera de
            arriba. Con siete ejercicios abiertos a la vez había que scrollear a
            ciegas para encontrar en cuál iba uno; así la sesión entera se ve de
            una y el que está en curso es el único abierto. */}
        {!expandido ? (
          // Vista plegada: mismo resumen que se ve en la referencia para el
          // "siguiente ejercicio" (series · reps · descanso), no solo un
          // link de texto — pero el toque sigue haciendo exactamente lo
          // mismo, expandir esta misma tarjeta.
          <button
            type="button"
            onClick={() => setExpandido(true)}
            aria-expanded={false}
            className="flex w-full items-center justify-between gap-2 text-left"
          >
            <span className="text-caption text-text-secondary">
              {ejercicio.seriesProgramadas} series · {ejercicio.repsProgramadas}
              {esTiempo ? " seg" : " reps"}
              {ejercicio.descansoSegundos ? ` · ${ejercicio.descansoSegundos}s descanso` : ""}
            </span>
            <ChevronRight size={16} className="shrink-0 text-vip" />
          </button>
        ) : (
          <>
      {/* El tempo ya se muestra arriba, como 4ta columna de la fila de datos
          (junto a Series/Reps/Descanso) — acá no se repite. */}

      {/* Técnica, en lugar de la observación que había antes: lo que se lee
          acá tiene que ser CÓMO se hace el ejercicio, no un comentario suelto.
          Manda lo que pidió la rutina; si el entrenador no pidió nada, entra la
          de la biblioteca del gimnasio, marcada como sugerencia para que no se
          confunda con una orden. Ver `resolverTecnica` arriba. */}
      {tecnica && (
        <div className="tarjeta-tecnica mb-1.5 flex items-start gap-2">
          <Info size={13} className="mt-0.5 shrink-0 text-vip" strokeWidth={2.5} />
          <p className="text-micro leading-snug text-text-secondary">
            <span className="font-semibold text-vip">
              {tecnica.sugerida ? "Técnica sugerida: " : "Técnica: "}
            </span>
            {tecnica.texto}
          </p>
        </div>
      )}

      <TarjetaImpulsoVip recomendacion={recomendacionImpulso} />

      {ultimoTexto && (
        <p className="text-micro mb-1.5 text-text-tertiary">
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
                {s.repsRealizadas != null ? ` × ${s.repsRealizadas} ${esTiempo ? "seg" : "reps"}` : ""}
              </span>
            </div>
          ))}
          {ejercicio.notaEjercicio && (
            <p className="text-caption text-text-tertiary">Nota: {ejercicio.notaEjercicio}</p>
          )}
        </div>
      ) : (
        <form
          ref={formRef}
          action={formAction}
          onChange={respaldarLocal}
          className="space-y-1"
        >
          <input type="hidden" name="sesion_ejercicio_id" value={ejercicio.sesionEjercicioId} />
          <input type="hidden" name="sesion_id" value={sesionId} />
          <input type="hidden" name="cantidad_series" value={ejercicio.seriesProgramadas} />

          <p className="text-micro mb-1 font-bold tracking-wide text-vip">SERIES</p>

          {filas.map((n) => (
            <div
              key={`${n}-${borradorLeido}`}
              ref={(nodo) => {
                if (nodo) filaNodoRef.current.set(n, nodo);
                else filaNodoRef.current.delete(n);
              }}
            >
              <FilaSerie
                // La clave incluye si ya se leyó el respaldo local: al llegar un
                // borrador, la fila se vuelve a montar con esos valores. Los
                // campos son no controlados, así que es la forma de refrescar
                // sus `defaultValue` sin romper la hidratación.
                ref={(handle) => {
                  if (handle) filasRef.current.set(n, handle);
                  else filasRef.current.delete(n);
                }}
                numero={n}
                inicial={serieInicial(n)}
                repsObjetivo={objetivoReps}
                pesoSugerido={pesoSugeridoEfectivo}
                esTiempo={esTiempo}
                descansoSegundos={ejercicio.descansoSegundos}
                soloLectura={soloLectura}
                sesionId={sesionId}
                sesionEjercicioId={ejercicio.sesionEjercicioId}
                activo={serieActivaNumero === n}
                esLaQueToca={serieQueToca === n}
                onIniciar={setSerieActivaNumero}
                onCicloCompleto={alCompletarCicloSerie}
                onCicloDeshecho={alDeshacerCicloSerie}
                onGuardar={guardarAhora}
                colorGrupoTecnica={grupoTecnica?.color}
              />
            </div>
          ))}

          {!ejercicio.completado && (
            <button
              type="button"
              onClick={marcarEjercicioListo}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-vip/50 bg-transparent text-secondary font-semibold text-vip"
            >
              <Check size={14} strokeWidth={3} /> Marcar ejercicio como completado
            </button>
          )}

          {/* Se pregunta una sola vez, cuando ya se hicieron todas las
              series de este ejercicio — no antes, para no interrumpir el
              ritmo mientras el alumno todavía está entrenando. */}
          <SelectorDificultad
            valorInicial={ejercicio.dificultadPercibida}
            disabled={seriesHechas.size < ejercicio.seriesProgramadas}
            onGuardar={guardarAhora}
          />

          {/* El ícono va dentro del campo, a la izquierda: sin él, el recuadro
              vacío se confundía con otro campo de carga más. */}
          <label className="radius-control mt-1 flex items-center gap-2 border border-border bg-surface-2 px-2.5 py-1.5">
            <NotebookPen size={14} className="shrink-0 text-text-tertiary" />
            <input
              name="nota_ejercicio"
              type="text"
              placeholder="Nota de este ejercicio (opcional)"
              defaultValue={ejercicio.notaEjercicio ?? ""}
              className="text-caption w-full min-w-0 bg-transparent text-text outline-none placeholder:text-text-tertiary"
            />
          </label>
          {state.error && <p className="text-caption text-error">{state.error}</p>}
          {/* El instructivo largo ("marca cada serie al terminarla…") se sacó:
              ocupaba tres líneas debajo de CADA ejercicio para explicar algo
              que se entiende al primer toque, y era lo que empujaba fuera de
              pantalla la cabecera del ejercicio siguiente. */}
          {(pending || ejercicio.completado) && (
            <p className="text-micro text-center text-text-tertiary">
              {pending ? "Guardando…" : "Ejercicio finalizado ✓"}
            </p>
          )}
        </form>
      )}
      {/* Fuera del <form> de arriba a propósito: HTML no permite forms
          anidados, y reportar dolor es una acción separada (propia Server
          Action) del guardado de series. */}
      {!soloLectura && (
        <ReportarDolorPanel
          sesionId={sesionId}
          sesionEjercicioId={ejercicio.sesionEjercicioId}
          diaEjercicioId={ejercicio.diaEjercicioId}
        />
      )}
          </>
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
