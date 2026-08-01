"use client";

import { forwardRef, useActionState, useEffect, useImperativeHandle, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Play,
  Hourglass,
  Layers,
  Repeat,
  Timer,
  Gauge,
  ImageIcon,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Input } from "@/components/ui/Input";
import { guardarSeries, type GuardarSeriesState } from "@/app/alumno/entrenar/actions";
import type { EjercicioSesion } from "@/app/alumno/entrenar/data";
import { IlustracionEjercicio } from "@/components/student/IlustracionEjercicio";
import { ETIQUETAS_GRUPO_MUSCULAR } from "@/components/student/GrupoMuscularIcon";
import { explicarTempo } from "@/lib/ejercicios/tempo";
import { repsObjetivo } from "@/lib/entrenamiento/reps";
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
      className="radius-control flex shrink-0 items-center justify-center border border-dashed border-border bg-surface-2 text-text-tertiary"
      style={{ width: 52, height: 52 }}
      // Para un lector de pantalla esto es decoración vacía, no una imagen que
      // falta: no aporta nada leerlo en voz alta.
      aria-hidden="true"
      title={`Foto de referencia de ${nombre} (pendiente)`}
    >
      <ImageIcon size={18} />
    </div>
  );
}

/** Una de las tres celdas de la fila de datos del ejercicio. */
function Dato({
  icono,
  valor,
  etiqueta,
  compacto = false,
}: {
  icono: React.ReactNode;
  valor: string;
  etiqueta: string;
  /** Para valores largos como el tempo ("3-1-2-0"), que en la cuarta columna
   * de un celular angosto se partían en dos líneas y descuadraban la fila. */
  compacto?: boolean;
}) {
  return (
    // El borde izquierdo va en todas menos la primera: separa las celdas sin
    // meter un elemento extra entre medio.
    <div className="flex flex-1 flex-col items-center gap-0.5 px-1 py-1.5 [&+&]:border-l [&+&]:border-border">
      <span className="text-vip">{icono}</span>
      <span
        className={`${compacto ? "text-secondary" : "text-card-title"} whitespace-nowrap leading-none text-text`}
      >
        {valor}
      </span>
      <span className="text-micro text-text-tertiary">{etiqueta}</span>
    </div>
  );
}

/** Avisa sin sonido (el usuario pidió que la app nunca suene en el gimnasio). */
function vibrarAviso() {
  try {
    navigator.vibrate?.([180, 90, 180]);
  } catch {
    // Si el navegador no permite vibrar, no pasa nada.
  }
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
    onCicloCompleto: (numero: number) => void;
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
    onCicloCompleto,
    onIniciar,
    onGuardar,
  },
  ref
) {
  const esPesoCorporal = inicial?.esPesoCorporal ?? false;
  const [realizada, setRealizada] = useState(inicial?.realizada ?? false);
  const [restante, setRestante] = useState<number | null>(null);
  const avisadoRef = useRef(inicial?.realizada ?? false);

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

  // Cuenta regresiva controlada por efecto: solo corre si esta serie es la
  // "activa" del ejercicio — al arrancar el descanso de otra serie, esta
  // queda pausada sola (restante se congela donde iba).
  useEffect(() => {
    if (!descansando || !activo) return;
    const id = setInterval(() => {
      setRestante((prev) => {
        if (prev === null || prev <= 1) {
          vibrarAviso();
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

  function presionarListo() {
    if (soloLectura) return;

    if (descansando) {
      // Tocarlo mientras corre lo reinicia (no lo pausa).
      onIniciar(numero);
      setRestante(descansoSegundos);
      return;
    }

    if (realizada) {
      // Ya terminó el descanso: permite deshacer un toque accidental.
      setRealizada(false);
      avisadoRef.current = false;
      onGuardar();
      return;
    }

    setRealizada(true);
    if (descansoSegundos && descansoSegundos > 0) {
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
    <div className="radius-control border border-border bg-surface-2 p-1.5">
      <input type="hidden" name={`peso_corporal_${numero}`} value={esPesoCorporal ? "true" : "false"} />
      <input type="hidden" name={`realizada_${numero}`} value={realizada ? "true" : "false"} />

      <div className="flex items-center gap-1.5">
        <span className="text-caption w-4 shrink-0 text-text-tertiary">#{numero}</span>
        <div className="min-w-0 flex-1">
          <Input
            name={`peso_${numero}`}
            type="number"
            step="0.5"
            min="0"
            inputMode="decimal"
            placeholder="KG"
            disabled={esPesoCorporal}
            defaultValue={inicial?.pesoKg ?? ""}
            className="py-1 text-caption uppercase"
          />
        </div>
        <div className="w-12 shrink-0">
          <Input
            name={`reps_${numero}`}
            type="number"
            min="0"
            inputMode="numeric"
            placeholder="RP"
            // Viene precargado con las repeticiones objetivo de la rutina para
            // que el alumno solo lo corrija si hizo otra cosa; sigue siendo
            // editable. Lo ya registrado manda por sobre el objetivo.
            defaultValue={inicial?.repsRealizadas ?? repsObjetivo ?? ""}
            className="py-1 text-caption"
          />
        </div>
        {!soloLectura && (
          <button
            type="button"
            onClick={presionarListo}
            data-descansando={descansando ? "true" : "false"}
            data-realizada={realizada ? "true" : "false"}
            data-pausado={descansando && !activo ? "true" : "false"}
            className="boton-listo-serie"
            aria-label={
              descansando
                ? activo
                  ? `Descanso, ${restante}s — tocar para reiniciar`
                  : `En pausa, ${restante}s — arrancó el descanso de otra serie`
                : realizada
                  ? "Serie lista"
                  : "Iniciar descanso"
            }
          >
            {descansando ? (
              activo ? (
                <span>{restante}s</span>
              ) : (
                <>
                  <Play size={14} strokeWidth={3} />
                  <span>Seguir</span>
                </>
              )
            ) : realizada ? (
              <>
                <Check size={15} strokeWidth={3} />
                <span>Listo</span>
              </>
            ) : (
              <>
                <Hourglass size={14} strokeWidth={2.5} />
                <span>Descanso</span>
              </>
            )}
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
  const cardRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const enviadoRef = useRef(false);
  const completadasRef = useRef(
    new Set(ejercicio.series.filter((s) => s.realizada).map((s) => s.numeroSerie))
  );
  // Solo el descanso de esta serie corre — arrancar el de otra la pausa sola.
  const [serieActivaNumero, setSerieActivaNumero] = useState<number | null>(null);
  const [mostrandoSiguiente, setMostrandoSiguiente] = useState(false);
  const filasRef = useRef(new Map<number, FilaSerieHandle>());

  const filas = Array.from({ length: ejercicio.seriesProgramadas }, (_, i) => i + 1);
  const objetivoReps = repsObjetivo(ejercicio.repsProgramadas);

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

  function alCompletarCicloSerie(numero: number) {
    completadasRef.current.add(numero);
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
        {/* El nombre del ejercicio es lo primero que hay que ver desde lejos,
            con el celular apoyado y las manos ocupadas. */}
        <div className="mb-2 flex items-start gap-2">
          <IlustracionEjercicio
            ilustracionSlug={ejercicio.ilustracionSlug}
            grupoMuscular={ejercicio.grupoMuscular}
            nombre={ejercicio.nombre}
            tamano={44}
            className="mt-0.5"
          />
          <div className="min-w-0 flex-1">
            <p className="text-caption font-semibold tracking-wide text-vip">
              EJERCICIO {ejercicio.orden}
              {ejercicio.grupoMuscular
                ? ` · ${ETIQUETAS_GRUPO_MUSCULAR[ejercicio.grupoMuscular].toUpperCase()}`
                : ""}
            </p>
            <p className="text-card-title leading-tight text-text">{ejercicio.nombre}</p>
            {ejercicio.tecnicaTipo && (
              <p className="text-caption mt-0.5 text-text-tertiary">{ejercicio.tecnicaTipo}</p>
            )}
          </div>
          <HuecoFotoReferencia nombre={ejercicio.nombre} />
        </div>

        {/* Plegado: el ejercicio que no toca todavía se resume en una línea.
            Con siete ejercicios abiertos a la vez había que scrollear a ciegas
            para encontrar en cuál iba uno; así la sesión entera se ve de una y
            el que está en curso es el único abierto. */}
        {!expandido ? (
          <button
            type="button"
            onClick={() => setExpandido(true)}
            aria-expanded={false}
            className="w-full text-left"
          >
            <p className="text-caption text-text-tertiary">
              {ejercicio.seriesProgramadas} series · {ejercicio.repsProgramadas} reps
              {ejercicio.descansoSegundos ? ` · descanso ${ejercicio.descansoSegundos}s` : ""}
            </p>
            <span className="text-caption mt-1.5 flex items-center gap-1 text-vip">
              Ver detalles del ejercicio <ChevronDown size={14} />
            </span>
          </button>
        ) : (
          <>
        {/* Los tres números que se consultan de reojo entre serie y serie.
            Antes iban en una línea de texto corrida bajo el nombre, donde
            había que leerla entera para sacar uno solo. */}
        <div className="radius-control mb-2 flex items-stretch bg-surface-2">
          <Dato
            icono={<Layers size={15} />}
            valor={String(ejercicio.seriesProgramadas)}
            etiqueta="Series"
          />
          <Dato
            icono={<Repeat size={15} />}
            valor={ejercicio.repsProgramadas}
            etiqueta="Repeticiones"
          />
          <Dato
            icono={<Timer size={15} />}
            valor={ejercicio.descansoSegundos ? `${ejercicio.descansoSegundos}s` : "—"}
            etiqueta="Descanso"
          />
          {/* El tempo es la cuarta columna solo cuando se sabe: mostrarlo
              vacío ocuparía un cuarto del ancho para decir "—". */}
          {ejercicio.tempo && (
            <Dato
              icono={<Gauge size={15} />}
              valor={ejercicio.tempo.valor}
              etiqueta="Tempo"
              compacto
            />
          )}
        </div>

        {/* La nota del tempo va aparte y en texto corrido: los cuatro números
            no le dicen nada a quien no conoce la notación, y esta es la línea
            que convierte el dato en algo que el alumno puede ejecutar. */}
        {/* Solo cuando el tempo lo dedujo la app. Si vino escrito en la rutina,
            la explicación ya está en la observación del entrenador dos líneas
            más abajo, y repetirla costaba una línea entera de pantalla. */}
        {ejercicio.tempo && ejercicio.tempo.origen === "biblioteca" && (
          <p className="text-micro mb-2 text-text-tertiary">
            {explicarTempo(ejercicio.tempo.valor)}
            {ejercicio.tempo.nota ? ` · ${ejercicio.tempo.nota}` : ""}
          </p>
        )}

      {/* El tipo de técnica ya va bajo el nombre; acá queda solo cuando trae
          instrucción, que es lo que hay que leer entero. */}
      {ejercicio.tecnicaInstruccion && (
        <div className="radius-control mb-2 bg-surface-2 p-2.5">
          <Pill tone="error">{ejercicio.tecnicaTipo ?? "Técnica"}</Pill>
          <p className="text-secondary mt-1 text-text-secondary">{ejercicio.tecnicaInstruccion}</p>
        </div>
      )}

      {/* La observación va en el escalón chico: es contexto que se lee una vez
          al empezar el ejercicio, no un dato que se consulte entre series. */}
      {ejercicio.observacion && (
        <p className="text-caption mb-2 text-text-secondary">{ejercicio.observacion}</p>
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
              onIniciar={setSerieActivaNumero}
              onCicloCompleto={alCompletarCicloSerie}
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

          <Input
            name="nota_ejercicio"
            type="text"
            placeholder="Nota de este ejercicio (opcional)"
            defaultValue={ejercicio.notaEjercicio ?? ""}
            className="mt-1 py-1.5 text-caption"
          />
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
