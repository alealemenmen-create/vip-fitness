"use client";

import { forwardRef, useActionState, useEffect, useImperativeHandle, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Play,
  Layers,
  Repeat,
  Timer,
  Gauge,
  ImageIcon,
  NotebookPen,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { guardarSeries, type GuardarSeriesState } from "@/app/alumno/entrenar/actions";
import type { EjercicioSesion } from "@/app/alumno/entrenar/data";
import { IlustracionEjercicio } from "@/components/student/IlustracionEjercicio";
import { ETIQUETAS_GRUPO_MUSCULAR } from "@/components/student/GrupoMuscularIcon";
import { explicarTempo } from "@/lib/ejercicios/tempo";
import { repsObjetivo } from "@/lib/entrenamiento/reps";
import { avisarFinDescanso, cortarAviso, prepararAviso } from "@/lib/entrenamiento/aviso";
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

function formatUltimo(u: EjercicioSesion["ultimoRegistro"]) {
  if (!u) return null;
  const pesoTxto = u.esPesoCorporal ? "Peso corporal" : u.pesoKg != null ? `${u.pesoKg} kg` : "—";
  const repsTxto = u.reps != null ? `${u.reps} reps` : "";
  return `${pesoTxto}${repsTxto ? ` × ${repsTxto}` : ""}`;
}

/**
 * El hueco donde va a ir la foto de referencia del ejercicio, tomada en el
 * gimnasio VIP.
 *
 * Se deja a la vista y en gris, vacío, a propósito: el diseño se aprobó con
 * esa foto y el espacio tiene que estar reservado desde ahora, para que al
 * llegar las fotos entren sin mover nada de lo que ya está alrededor.
 *
 * Cuando existan, esto pasa a ser un <IlustracionEjercicio> apuntando a la
 * foto real (ver src/lib/ejercicios/ilustracion.ts, que ya resuelve la ruta
 * por ejercicio y acepta .webp/.jpg).
 */
function HuecoFotoReferencia({ nombre }: { nombre: string }) {
  return (
    <div
      // `self-stretch`: el borde de ABAJO queda a la misma altura que la línea
      // inferior del recuadro de series/reps/descanso, porque los dos terminan
      // donde termina la columna de la izquierda.
      // Los márgenes negativos son solo arriba y a la derecha: el cuadro se
      // estira en diagonal hacia esa esquina comiéndose casi todo el padding de
      // la tarjeta (queda ~4 px de aire para que se siga viendo el margen).
      className="-mr-2 -mt-2 flex shrink-0 items-center justify-center self-stretch overflow-hidden rounded-[14px] border border-dashed border-border bg-surface-2 text-text-tertiary"
      style={{ width: 116, minHeight: 96 }}
      // Para un lector de pantalla esto es decoración vacía, no una imagen que
      // falta: no aporta nada leerlo en voz alta.
      aria-hidden="true"
      title={`Foto de referencia de ${nombre} (pendiente)`}
    >
      <ImageIcon size={22} />
    </div>
  );
}

/** Una de las celdas de la fila de datos del ejercicio. */
function Dato({
  icono,
  valor,
  etiqueta,
  compacto = false,
}: {
  icono: React.ReactNode;
  valor: string;
  etiqueta: string;
  /** Para valores largos como el tempo ("1-2s / 1s / 2-3s"), que en la cuarta
   * columna de un celular angosto se partían en dos líneas y descuadraban. */
  compacto?: boolean;
}) {
  return (
    // El borde izquierdo va en todas menos la primera: separa las celdas sin
    // meter un elemento extra entre medio.
    // `min-w-0`: sin esto las celdas no bajan de su ancho de contenido y la
    // fila entera se desbordaba por debajo de la foto de referencia.
    <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5 px-0.5 py-1 [&+&]:border-l [&+&]:border-border">
      {/* Ícono y valor en la MISMA línea, no apilados: apilados, la fila medía
          65 px de alto en cada uno de los siete ejercicios. Así baja a ~44 sin
          achicar el número, que es lo que se mira de reojo entre serie y serie. */}
      <span className="flex items-center gap-1">
        <span className="text-vip">{icono}</span>
        <span
          className={`${compacto ? "text-micro" : "text-secondary"} whitespace-nowrap font-semibold leading-none text-text`}
        >
          {valor}
        </span>
      </span>
      <span className="text-micro leading-none text-text-tertiary">{etiqueta}</span>
    </div>
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
    /** Repeticiones programadas de la rutina, para precargar el campo. */
    repsObjetivo: number | null;
    descansoSegundos: number | null;
    soloLectura: boolean;
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
  }
>(function FilaSerie(
  {
    numero,
    inicial,
    repsObjetivo,
    descansoSegundos,
    soloLectura,
    activo,
    esLaQueToca,
    onCicloCompleto,
    onCicloDeshecho,
    onIniciar,
    onGuardar,
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
        ? "hecha"
        : "pendiente";

  // Cuenta regresiva controlada por efecto: solo corre si esta serie es la
  // "activa" del ejercicio — al arrancar el descanso de otra serie, esta
  // queda pausada sola (restante se congela donde iba).
  useEffect(() => {
    if (!descansando || !activo) return;
    const id = setInterval(() => {
      setRestante((prev) => {
        if (prev === null || prev <= 1) {
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
      setRestante(null);
      setRealizada(false);
      setAvisandoSiguiente(false);
      avisadoRef.current = false;
      onCicloDeshecho(numero);
      onGuardar();
      return;
    }

    if (realizada) {
      // Ya terminó el descanso: permite deshacer un toque accidental.
      setRealizada(false);
      setAvisandoSiguiente(false);
      avisadoRef.current = false;
      onCicloDeshecho(numero);
      onGuardar();
      return;
    }

    setRealizada(true);
    if (descansoSegundos && descansoSegundos > 0) {
      // Este toque es el gesto del usuario que habilita el audio: el pitido va a
      // sonar dentro de un temporizador, y para entonces ya no hay gesto que
      // valga. Ver `prepararAviso`.
      prepararAviso();
      onIniciar(numero);
      setRestante(descansoSegundos);
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
      className="fila-serie p-1.5"
      data-hecha={realizada ? "true" : "false"}
      data-activa={esLaQueToca ? "true" : "false"}
    >
      <input type="hidden" name={`peso_corporal_${numero}`} value={esPesoCorporal ? "true" : "false"} />
      <input type="hidden" name={`realizada_${numero}`} value={realizada ? "true" : "false"} />

      <div className="flex items-center gap-1.5">
        {/* Número en disco y no "#1": con el celular apoyado y de reojo, la
            forma se distingue antes que el texto, y marca dónde arranca la fila. */}
        <span className="numero-serie" data-hecha={realizada ? "true" : "false"}>
          {numero}
        </span>
        {/* La unidad va DESPUÉS del número, como se dice: "25 kg", no "kg 25". */}
        <label className="campo-serie flex-1">
          <input
            name={`peso_${numero}`}
            type="number"
            step="0.5"
            min="0"
            inputMode="decimal"
            placeholder="Carga"
            disabled={esPesoCorporal}
            defaultValue={inicial?.pesoKg ?? ""}
          />
          <span className="campo-serie-etiqueta">kg</span>
        </label>
        {/* La etiqueta va dentro del campo, a la izquierda del número: sin ella
            "8" al lado de la carga se leía como otro peso. */}
        <label className="campo-serie w-[68px] shrink-0">
          <input
            name={`reps_${numero}`}
            type="number"
            min="0"
            inputMode="numeric"
            // Viene precargado con las repeticiones objetivo de la rutina para
            // que el alumno solo lo corrija si hizo otra cosa; sigue siendo
            // editable. Lo ya registrado manda por sobre el objetivo.
            defaultValue={inicial?.repsRealizadas ?? repsObjetivo ?? ""}
          />
          <span className="campo-serie-etiqueta">reps</span>
        </label>
        {!soloLectura && (
          <button
            type="button"
            onClick={presionarListo}
            data-estado={estadoBoton}
            className="boton-descanso"
            aria-label={
              descansando
                ? activo
                  ? `Descanso, ${restante}s — tocar para reiniciar`
                  : `En pausa, ${restante}s — arrancó el descanso de otra serie`
                : realizada
                  ? avisandoSiguiente
                    ? "Descanso terminado — seguí con lo que viene"
                    : "Serie lista"
                  : "Empezar a recuperar"
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
                  <span className="boton-descanso-cuenta">{restante}s</span>
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
                <>
                  <Check size={14} strokeWidth={3} />
                  <span>Listo</span>
                </>
              ) : (
                /* "Recupérate" y no "Descanso": el ejercicio ya dice arriba
                   cuánto se descansa; acá lo que hace falta es la orden de qué
                   hacer ahora. Sin ícono: el reloj de arena no agregaba nada que
                   la palabra no dijera y descentraba el texto. */
                <span className="flex flex-col items-center leading-tight">
                  <span>Recupérate</span>
                  {descansoSegundos ? (
                    <span className="boton-descanso-segundos">{descansoSegundos}s</span>
                  ) : null}
                </span>
              )}
            </span>
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
  // Abierto de entrada el que está en curso y los ya terminados (para poder
  // revisar lo que se levantó); en modo lectura, todos.
  const [expandido, setExpandido] = useState(activo || soloLectura || ejercicio.completado);
  const ultimoTexto = formatUltimo(ejercicio.ultimoRegistro);
  const tecnica = resolverTecnica(ejercicio);
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

  const filas = Array.from({ length: ejercicio.seriesProgramadas }, (_, i) => i + 1);
  const objetivoReps = repsObjetivo(ejercicio.repsProgramadas);

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
    formRef.current?.requestSubmit();
  };

  // Cuando el servidor confirma, la copia local ya no hace falta: dejarla
  // haría que un borrador viejo se restaure encima de datos más nuevos.
  useEffect(() => {
    if (!pending && !state.error && borradorLeido) {
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
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
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
      <Card className={`p-3 ${activo && !soloLectura ? "panel-ejercicio-activo" : ""}`}>
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
              <IlustracionEjercicio
                ilustracionSlug={ejercicio.ilustracionSlug}
                grupoMuscular={ejercicio.grupoMuscular}
                nombre={ejercicio.nombre}
                tamano={48}
                className="shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-micro truncate font-semibold tracking-wide text-vip">
                  EJERCICIO {ejercicio.orden}
                  {ejercicio.grupoMuscular
                    ? ` · ${ETIQUETAS_GRUPO_MUSCULAR[ejercicio.grupoMuscular].toUpperCase()}`
                    : ""}
                </p>
                {/* 14 px y no 18: al lado de la foto de referencia quedan ~190 px
                    de ancho, y a 18 px un nombre normal como "Press inclinado con
                    barra" se partía en dos líneas y empujaba toda la tarjeta. */}
                <p className="text-secondary mt-0.5 font-semibold leading-tight text-text">
                  {ejercicio.nombre}
                </p>
                {ejercicio.tecnicaTipo && (
                  <p className="text-micro mt-0.5 text-text-tertiary">{ejercicio.tecnicaTipo}</p>
                )}
              </div>
            </div>

            {/* Los números que se consultan de reojo entre serie y serie. Las
                etiquetas van abreviadas ("Reps", no "Repeticiones") porque en
                esta media tarjeta cada columna tiene ~55 px: la palabra entera
                se partía en dos renglones y volvía a estirar la fila. */}
            <div className="radius-control mt-1.5 flex items-stretch overflow-hidden border border-border bg-surface-2">
              <Dato
                icono={<Layers size={13} />}
                valor={String(ejercicio.seriesProgramadas)}
                etiqueta="Series"
              />
              <Dato
                icono={<Repeat size={13} />}
                valor={ejercicio.repsProgramadas}
                etiqueta="Reps"
              />
              <Dato
                icono={<Timer size={13} />}
                valor={ejercicio.descansoSegundos ? `${ejercicio.descansoSegundos}s` : "—"}
                etiqueta="Desc."
              />
              {/* El tempo NO va acá. Como cuarta columna, en la media tarjeta
                  que deja la foto, quedaban ~55 px para "3-1-2-0" y el valor se
                  cortaba. Va en su propia línea abajo, a todo el ancho y junto
                  a la explicación, que es donde se vuelve entendible. */}
            </div>
          </div>
          <HuecoFotoReferencia nombre={ejercicio.nombre} />
        </div>

        {/* Plegado: el ejercicio que no toca todavía muestra solo la cabecera de
            arriba. Con siete ejercicios abiertos a la vez había que scrollear a
            ciegas para encontrar en cuál iba uno; así la sesión entera se ve de
            una y el que está en curso es el único abierto. */}
        {!expandido ? (
          <button
            type="button"
            onClick={() => setExpandido(true)}
            aria-expanded={false}
            className="text-caption flex w-full items-center gap-1 text-left text-vip"
          >
            Ver detalles del ejercicio <ChevronDown size={14} />
          </button>
        ) : (
          <>
        {/* Tempo: el valor y su traducción en la misma línea, a todo el ancho.
            Los cuatro números solos no le dicen nada a quien no conoce la
            notación, y esta es la línea que los convierte en algo ejecutable.
            La explicación se agrega solo si el tempo lo dedujo la app: cuando
            vino escrito en la rutina, ya está contada en la observación del
            entrenador dos líneas más abajo. */}
        {ejercicio.tempo && (
          <p className="text-micro mb-2 flex items-start gap-1 leading-snug text-text-tertiary">
            <Gauge size={12} className="mt-px shrink-0 text-vip" />
            <span className="min-w-0">
              <span className="font-semibold text-text-secondary">
                Tempo {ejercicio.tempo.valor}
              </span>
              {ejercicio.tempo.origen === "biblioteca"
                ? ` · ${explicarTempo(ejercicio.tempo.valor)}${
                    ejercicio.tempo.nota ? ` · ${ejercicio.tempo.nota}` : ""
                  }`
                : ""}
            </span>
          </p>
        )}

      {/* Técnica, en lugar de la observación que había antes: lo que se lee
          acá tiene que ser CÓMO se hace el ejercicio, no un comentario suelto.
          Manda lo que pidió la rutina; si el entrenador no pidió nada, entra la
          de la biblioteca del gimnasio, marcada como sugerencia para que no se
          confunda con una orden. Ver `resolverTecnica` arriba. */}
      {tecnica && (
        <p className="text-micro mb-2 leading-snug text-text-secondary">
          <span className="font-semibold text-vip">
            {tecnica.sugerida ? "Técnica sugerida: " : "Técnica: "}
          </span>
          {tecnica.texto}
        </p>
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
        <form
          ref={formRef}
          action={formAction}
          onChange={respaldarLocal}
          className="space-y-1.5"
        >
          <input type="hidden" name="sesion_ejercicio_id" value={ejercicio.sesionEjercicioId} />
          <input type="hidden" name="sesion_id" value={sesionId} />
          <input type="hidden" name="cantidad_series" value={ejercicio.seriesProgramadas} />

          {filas.map((n) => (
            <FilaSerie
              // La clave incluye si ya se leyó el respaldo local: al llegar un
              // borrador, la fila se vuelve a montar con esos valores. Los
              // campos son no controlados, así que es la forma de refrescar
              // sus `defaultValue` sin romper la hidratación.
              key={`${n}-${borradorLeido}`}
              ref={(handle) => {
                if (handle) filasRef.current.set(n, handle);
                else filasRef.current.delete(n);
              }}
              numero={n}
              inicial={serieInicial(n)}
              repsObjetivo={objetivoReps}
              descansoSegundos={ejercicio.descansoSegundos}
              soloLectura={soloLectura}
              activo={serieActivaNumero === n}
              esLaQueToca={serieQueToca === n}
              onIniciar={setSerieActivaNumero}
              onCicloCompleto={alCompletarCicloSerie}
              onCicloDeshecho={alDeshacerCicloSerie}
              onGuardar={guardarAhora}
            />
          ))}

          {!ejercicio.completado && (
            <button
              type="button"
              onClick={marcarEjercicioListo}
              className="radius-control flex h-9 w-full items-center justify-center gap-2 border border-vip/40 bg-transparent text-caption font-semibold text-vip"
            >
              <Check size={14} strokeWidth={3} /> Marcar ejercicio como completado
            </button>
          )}

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
