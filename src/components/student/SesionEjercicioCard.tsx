"use client";

import { forwardRef, useActionState, useEffect, useImperativeHandle, useRef, useState, useSyncExternalStore } from "react";
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
  AlertCircle,
  TrendingUp,
  ShieldAlert,
  HeartCrack,
} from "lucide-react";
import Image from "next/image";
import { Card } from "@/components/ui/Card";
import { guardarSeries, penalizarExcesoDescanso, type GuardarSeriesState } from "@/app/alumno/entrenar/actions";
import { programarAvisoDescanso } from "@/app/alumno/entrenar/push-actions";
import { reportarDolor, type ReportarDolorState } from "@/app/alumno/entrenar/impulso-actions";
import { reportarFotoIncorrecta, type ReportarFotoState } from "@/app/alumno/entrenar/foto-actions";
import type { EjercicioSesion } from "@/app/alumno/entrenar/data";
import { IlustracionEjercicio } from "@/components/student/IlustracionEjercicio";
import { ModalVideo } from "@/components/student/ModalVideo";
import { VideoCloudflareAutomatico } from "@/components/student/VideoCloudflareAutomatico";
import { resolverIlustracion, resolverFotoCompleta } from "@/lib/ejercicios/ilustracion";
import { ETIQUETAS_GRUPO_MUSCULAR } from "@/components/student/GrupoMuscularIcon";
import { repsObjetivo, esEjercicioDeTiempo } from "@/lib/entrenamiento/reps";
import { avisarFinDescanso, cortarAviso, prepararAviso } from "@/lib/entrenamiento/aviso";
import { guardarDescanso, leerDescanso, limpiarDescanso } from "@/lib/entrenamiento/descanso";
import { resolverGrupoTecnica } from "@/lib/entrenamiento/tecnica-grupo";
import { explicacionTecnica } from "@/lib/entrenamiento/glosario-tecnicas";
import { PUNTOS_VIP } from "@/lib/ranking/reglas";
import {
  guardarBorrador,
  leerBorrador,
  limpiarBorrador,
  type BorradorEjercicio,
} from "@/lib/entrenamiento/borrador";

const suscribirSinCambios = () => () => {};

/** Lo que expone cada tarjeta de ejercicio al botón general "Guardar
 * progreso" de la sesión (ver SesionEjercicios.tsx). */
export type SesionEjercicioCardHandle = {
  guardar: () => void;
};

/** Lo que expone cada fila de serie al botón "Ejercicio listo" del
 * ejercicio, que fuerza todas las series como hechas de una sola vez.
 * Exportado: `SesionGrupoCard` lo usa para el mismo botón, por ejercicio. */
export type FilaSerieHandle = {
  completarYa: (guardar?: boolean) => void;
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
export function CuadroFotoReferencia({
  ilustracionSlug,
  fotoMiniaturaUrl,
  fotoCompletaUrl,
  videoUrl,
  videoCloudflareUid,
  videoCloudflareEstado,
  videoCloudflareMiniaturaUrl,
  nombre,
  sesionEjercicioId,
  ejercicioId,
  fotoPanoramaX = 50,
  fotoPanoramaY = 50,
  fotoCuadradaX = 50,
  fotoCuadradaY = 50,
  compacto = false,
  destacado = false,
  reproducirAutomaticamente = false,
}: {
  ilustracionSlug: string | null;
  /** Fotos subidas desde /admin/ejercicios — mandan sobre la ilustración
   * estática cuando existen (ver migración 0042). */
  fotoMiniaturaUrl: string | null;
  fotoCompletaUrl: string | null;
  /** Link de YouTube o a un video directo (ver /admin/ejercicios). Cuando
   * existe, tocar el cuadro reproduce el video en vez de solo ampliar la
   * foto — la referencia en movimiento gana porque enseña más. */
  videoUrl: string | null;
  videoCloudflareUid?: string | null;
  videoCloudflareEstado?: "subiendo" | "procesando" | "listo" | "error" | null;
  videoCloudflareMiniaturaUrl?: string | null;
  nombre: string;
  sesionEjercicioId?: string;
  ejercicioId?: string | null;
  fotoPanoramaX?: number;
  fotoPanoramaY?: number;
  fotoCuadradaX?: number;
  fotoCuadradaY?: number;
  /** El tamaño y las sangrías negativas de siempre están pensados para la
   * esquina de una tarjeta suelta a todo el ancho. Dentro de un encabezado
   * de dos columnas (ver SesionGrupoCard, biseries) ese mismo tamaño fijo
   * se desbordaba de su columna y se amontonaba con la de al lado — acá
   * pasa a un cuadrado chico, sin sangría. */
  compacto?: boolean;
  /** En el modo enfocado la referencia es el elemento principal de la
   * pantalla, no una miniatura arrinconada junto al título. */
  destacado?: boolean;
  reproducirAutomaticamente?: boolean;
}) {
  const { src: srcEstatico, origen } = resolverIlustracion(ilustracionSlug, null);
  const src = fotoMiniaturaUrl ?? videoCloudflareMiniaturaUrl ?? (origen === "ilustracion" ? srcEstatico : null);
  const tamano: React.CSSProperties = destacado
    ? { width: "100%", minHeight: 180, height: "auto", aspectRatio: "16 / 9" }
    : compacto
    ? { width: 44, minHeight: 44, height: 44 }
    : { width: 116, minHeight: 116, height: 116 };

  if (!src) {
    // Sin foto pero CON video: el cuadro vacío pasa a ser un botón que
    // reproduce el video directo — no tiene sentido dejarlo en gris sabiendo
    // que sí hay una referencia para mostrar.
    if (videoUrl) return <CuadroSoloVideo videoUrl={videoUrl} nombre={nombre} tamano={tamano} compacto={compacto} destacado={destacado} />;

    return (
      <CuadroSolicitarFoto
        // `self-stretch`: el borde de ABAJO queda a la misma altura que la línea
        // inferior del recuadro de series/reps/descanso, porque los dos terminan
        // donde termina la columna de la izquierda.
        // Los márgenes negativos son solo arriba y a la derecha: el cuadro se
        // estira en diagonal hacia esa esquina comiéndose casi todo el padding de
        // la tarjeta (queda ~4 px de aire para que se siga viendo el margen).
        // En modo compacto no hay sangría ni estiramiento: es un cuadrado
        // chico más, no la esquina de toda la tarjeta.
        nombre={nombre}
        sesionEjercicioId={sesionEjercicioId}
        ejercicioId={ejercicioId}
        compacto={compacto}
        destacado={destacado}
        // Para un lector de pantalla esto es decoración vacía, no una imagen que
        // falta: no aporta nada leerlo en voz alta.
        tamano={tamano}
      />
    );
  }

  return (
    <FotoReferenciaAmpliable
      src={src}
      srcCompleta={fotoCompletaUrl ?? resolverFotoCompleta(ilustracionSlug)}
      videoUrl={videoUrl}
      videoCloudflareListo={!!videoCloudflareUid && videoCloudflareEstado === "listo"}
      nombre={nombre}
      sesionEjercicioId={sesionEjercicioId}
      ejercicioId={ejercicioId}
      posicionX={destacado ? fotoPanoramaX : fotoCuadradaX}
      posicionY={destacado ? fotoPanoramaY : fotoCuadradaY}
      tamano={tamano}
      compacto={compacto}
      destacado={destacado}
      reproducirAutomaticamente={reproducirAutomaticamente}
    />
  );
}

/** El cuadro de referencia cuando hay video pero todavía no hay foto propia
 * (un video de un link directo, sin miniatura de YouTube). Mismo tamaño y
 * bordes que el cuadro "pendiente", pero tocarlo reproduce el video. */
function CuadroSolicitarFoto({
  nombre,
  sesionEjercicioId,
  ejercicioId,
  tamano,
  compacto,
  destacado,
}: {
  nombre: string;
  sesionEjercicioId?: string;
  ejercicioId?: string | null;
  tamano: React.CSSProperties;
  compacto: boolean;
  destacado: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [solicitud, accionSolicitud, enviando] = useActionState<ReportarFotoState, FormData>(
    reportarFotoIncorrecta,
    { error: null, ok: false }
  );
  const clase = destacado
    ? "flex w-full flex-col items-center justify-center gap-1 overflow-hidden rounded-[22px] border border-dashed border-vip/45 bg-vip/5 text-vip"
    : compacto
      ? "flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-vip/45 bg-vip/5 text-vip"
      : "-mr-2 -mt-2 flex shrink-0 flex-col items-center justify-center gap-1 self-stretch overflow-hidden rounded-[14px] border border-dashed border-vip/45 bg-vip/5 text-vip";

  return (
    <>
      <button
        type="button"
        onClick={() => sesionEjercicioId && setAbierto(true)}
        disabled={!sesionEjercicioId}
        className={clase}
        style={tamano}
        aria-label={`Solicitar foto de ${nombre}`}
      >
        <ImageIcon size={compacto ? 16 : 21} />
        {!compacto && <span className="text-micro font-bold">Solicitar foto</span>}
      </button>
      {abierto && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setAbierto(false)}>
          <div role="dialog" aria-label={`Solicitar foto de ${nombre}`} onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-[22px] border border-white/10 bg-[#141416] p-4 text-center shadow-2xl">
            {solicitud.ok ? (
              <>
                <span className="mx-auto grid size-11 place-items-center rounded-full bg-success/15 text-success"><Check size={22} /></span>
                <p className="text-card-title mt-3 text-white">Solicitud enviada</p>
                <p className="text-caption mt-1 text-white/60">El entrenador ya sabe que falta la foto de {nombre}.</p>
                <button type="button" onClick={() => setAbierto(false)} className="radius-control mt-4 h-10 w-full bg-success font-bold text-white">Listo</button>
              </>
            ) : (
              <>
                <span className="mx-auto grid size-11 place-items-center rounded-full bg-vip/15 text-vip"><ImageIcon size={22} /></span>
                <p className="text-card-title mt-3 text-white">{"\u00bfSolicitar esta foto?"}</p>
                <p className="text-caption mt-1 text-white/60">Avisaremos al entrenador que falta la referencia de {nombre}.</p>
                {solicitud.error && <p className="text-caption mt-2 text-error">{solicitud.error}</p>}
                <form action={accionSolicitud} className="mt-4 grid grid-cols-2 gap-2">
                  <input type="hidden" name="sesion_ejercicio_id" value={sesionEjercicioId ?? ""} />
                  <input type="hidden" name="ejercicio_id" value={ejercicioId ?? ""} />
                  <button type="button" onClick={() => setAbierto(false)} className="h-10 rounded-xl border border-white/15 text-caption font-semibold text-white/70">Volver</button>
                  <button type="submit" disabled={enviando} className="h-10 rounded-xl bg-vip text-caption font-bold text-black disabled:opacity-60">{enviando ? "Enviando..." : "Confirmar solicitud"}</button>
                </form>
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

function CuadroSoloVideo({
  videoUrl,
  nombre,
  tamano,
  compacto,
  destacado,
}: {
  videoUrl: string;
  nombre: string;
  tamano: React.CSSProperties;
  compacto: boolean;
  destacado: boolean;
}) {
  const [reproduciendo, setReproduciendo] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setReproduciendo(true)}
        aria-label={`Ver video de referencia de ${nombre}`}
        className={
          destacado
            ? "flex w-full items-center justify-center overflow-hidden rounded-[22px] border border-vip/40 bg-surface-2 text-vip"
            : compacto
            ? "flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-vip/40 bg-surface-2 text-vip"
            : "-mr-2 -mt-2 flex shrink-0 items-center justify-center self-stretch overflow-hidden rounded-[14px] border border-vip/40 bg-surface-2 text-vip"
        }
        style={tamano}
      >
        <Play size={compacto ? 16 : 22} fill="currentColor" />
      </button>
      {reproduciendo && (
        <ModalVideo videoUrl={videoUrl} nombre={nombre} onCerrar={() => setReproduciendo(false)} />
      )}
    </>
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
  videoUrl,
  videoCloudflareListo,
  nombre,
  sesionEjercicioId,
  ejercicioId,
  posicionX,
  posicionY,
  tamano,
  compacto = false,
  destacado = false,
  reproducirAutomaticamente = false,
}: {
  src: string;
  /** La foto ORIGINAL sin recortar, si ya se identificó cuál es (ver
   * `resolverFotoCompleta`) — el visor la usa en vez de `src` (que es la
   * versión recortada de la miniatura) para que el alumno vea el ejercicio
   * completo, tal como se tomó en el gimnasio. */
  srcCompleta: string | null;
  /** Si existe, tocar el cuadro reproduce el video en vez de ampliar la
   * foto — cuando ya se cargó un video (aunque su miniatura sea la misma
   * foto que se ve acá, ej. la de YouTube), la referencia en movimiento es
   * siempre mejor guía que una imagen fija ampliada. */
  videoUrl: string | null;
  videoCloudflareListo: boolean;
  nombre: string;
  sesionEjercicioId?: string;
  ejercicioId?: string | null;
  posicionX: number;
  posicionY: number;
  tamano: React.CSSProperties;
  compacto?: boolean;
  destacado?: boolean;
  reproducirAutomaticamente?: boolean;
}) {
  const [ampliada, setAmpliada] = useState(false);
  const [confirmandoReporte, setConfirmandoReporte] = useState(false);
  const [reporte, accionReporte, enviandoReporte] = useActionState<ReportarFotoState, FormData>(
    reportarFotoIncorrecta,
    { error: null, ok: false }
  );
  const srcAmpliada = srcCompleta ?? src;
  /**
   * La foto grande de la tarjeta va con la ORIGINAL, no con la miniatura.
   *
   * `src` es el recorte cuadrado que genera el servidor, y ese recorte ya
   * viene con la persona cortada (cabeza o piernas, según la foto). Mostrarlo
   * con `object-contain` la deja entera dentro del recuadro… pero entera
   * dentro de un recorte que ya estaba mal: se veía la persona cortada Y con
   * franjas a los costados. La original no tiene ese problema.
   *
   * Las miniaturas chicas (la de la fila y la de 44px) siguen usando el
   * recorte: ahí sí conviene, pesa menos y se ve a ese tamaño.
   */
  const srcPrincipal = destacado ? srcAmpliada : src;

  return (
    <>
      <button
        type="button"
        onClick={() => setAmpliada(true)}
        aria-label={
          videoUrl ? `Ver video de referencia de ${nombre}` : `Ver foto de referencia de ${nombre} en grande`
        }
        className={
          destacado
            ? "relative flex w-full overflow-hidden rounded-[22px] border border-border bg-surface-2"
            : compacto
            ? "relative flex shrink-0 overflow-hidden rounded-xl border border-border bg-surface-2"
            : "-mr-2 -mt-2 relative flex shrink-0 self-stretch overflow-hidden rounded-[14px] border border-border bg-surface-2"
        }
        style={tamano}
      >
        {/* Relleno borroso detrás de la foto: la misma imagen ampliada y
            desenfocada, tapando lo que sobra a los costados. Sin esto quedaban
            dos franjas grises que se leían como un error de la foto. Va con
            opacidad alta a propósito — tiene que parecer una continuación del
            fondo del gimnasio, no un borde. */}
        <Image
          src={srcPrincipal}
          alt=""
          aria-hidden
          fill
          sizes={destacado ? "(max-width: 640px) calc(100vw - 56px), 520px" : compacto ? "44px" : "116px"}
          className="scale-125 object-cover opacity-80 blur-2xl"
          style={{ objectPosition: `${posicionX}% ${posicionY}%` }}
        />
        <Image
          src={srcPrincipal}
          alt={`Foto de referencia de ${nombre}`}
          fill
          sizes={destacado ? "(max-width: 640px) calc(100vw - 56px), 520px" : compacto ? "44px" : "116px"}
          // Siempre `object-contain`: la persona del instructivo tiene que
          // entrar ENTERA en el cuadro. Con `object-cover` (lo que hacían las
          // fotos con miniatura recortada) el recorte automático le cortaba la
          // cabeza o los pies según la proporción del cuadro, y se veía mal.
          // Lo que sobra a los costados lo tapa el relleno borroso de atrás,
          // así que el cuadro sigue viéndose lleno.
          className="z-[1] object-contain object-center"
        />
        {destacado && videoCloudflareListo && (
          <VideoCloudflareAutomatico
            ejercicioId={ejercicioId}
            activo={reproducirAutomaticamente}
            nombre={nombre}
          />
        )}
        {/* Botón de expandir/reproducir, chico y en la esquina (referencia de
            diseño): un ícono basta como pista de que hay más para ver, sin
            tapar la foto con una franja de texto. En modo compacto (44px) se
            saca del todo: no entraba sin tapar casi toda la foto. */}
        {!compacto && (
          <span className="absolute bottom-1.5 right-1.5 z-[3] flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm">
            {videoUrl || videoCloudflareListo ? <Play size={11} fill="currentColor" /> : <Maximize2 size={12} strokeWidth={2.5} />}
          </span>
        )}
      </button>

      {ampliada && videoUrl && (
        <ModalVideo videoUrl={videoUrl} nombre={nombre} onCerrar={() => setAmpliada(false)} />
      )}

      {ampliada &&
        !videoUrl &&
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
            {sesionEjercicioId && !reporte.ok && !confirmandoReporte && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmandoReporte(true);
                }}
                className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-caption font-semibold text-white"
              >
                No es el ejercicio
              </button>
            )}
            {sesionEjercicioId && confirmandoReporte && !reporte.ok && (
              <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl border border-error/35 bg-[#141416] p-3 text-center">
                <p className="text-body font-bold text-white">¿Confirmas que no es el ejercicio?</p>
                <p className="text-caption mt-1 text-white/60">Avisaremos al entrenador para que cambie esta referencia para todos.</p>
                {reporte.error && <p className="text-caption mt-2 text-error">{reporte.error}</p>}
                <form action={accionReporte} className="mt-3 grid grid-cols-2 gap-2">
                  <input type="hidden" name="sesion_ejercicio_id" value={sesionEjercicioId} />
                  <input type="hidden" name="ejercicio_id" value={ejercicioId ?? ""} />
                  <button type="button" onClick={() => setConfirmandoReporte(false)} className="h-10 rounded-xl border border-white/15 text-caption font-semibold text-white/70">
                    Volver
                  </button>
                  <button type="submit" disabled={enviandoReporte} className="h-10 rounded-xl bg-error text-caption font-bold text-white disabled:opacity-60">
                    {enviandoReporte ? "Enviando…" : "Sí, reportar"}
                  </button>
                </form>
              </div>
            )}
            {reporte.ok && (
              <p onClick={(e) => e.stopPropagation()} className="rounded-full bg-success/15 px-4 py-2 text-caption font-semibold text-success">
                Reporte enviado al entrenador ✓
              </p>
            )}
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
export function Dato({
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
      <span className="flex min-w-0 items-center gap-1">
        <span className="shrink-0 text-vip">{icono}</span>
        {/* truncate y no whitespace-nowrap a secas: un ejercicio con técnica
            compleja puede traer un valor largo en "reps" (texto en vez de un
            rango cortito) y sin recortar se desbordaba encima de la celda de
            al lado en vez de cortarse con puntos suspensivos. */}
        <span className="text-caption truncate font-semibold leading-none text-text">{valor}</span>
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
export function TarjetaImpulsoVip({ recomendacion }: { recomendacion: EjercicioSesion["recomendacionImpulso"] }) {
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
  { valor: "muy_facil", etiqueta: "Estuvo fácil" },
  { valor: "facil", etiqueta: "Podía hacer más" },
  { valor: "justo", etiqueta: "Estuvo justo" },
  { valor: "dificil", etiqueta: "Estuvo muy difícil" },
  { valor: "fallo", etiqueta: "No pude completarlo" },
];

/**
 * "¿Cómo sentiste este ejercicio?" — se pregunta UNA vez por ejercicio al
 * terminarlo, no por serie (ver decisión en AGENTS del proyecto): pedirlo
 * serie por serie hubiera vuelto más lenta cada sesión. Viaja como un campo
 * más del mismo formulario de `guardarSeries`, vía el input oculto — no hace
 * falta una Server Action aparte.
 */
/** Exportado para SesionGrupoCard (biseries) — dos ejercicios en un mismo
 * <form> necesitan su propio campo namespaceado, ver `nombreCampo`. */
export function SelectorDificultad({
  valorInicial,
  disabled,
  onGuardar,
  forzarModal = false,
  onResponder,
  nombreCampo = "dificultad_ejercicio",
}: {
  valorInicial: string | null;
  disabled: boolean;
  /** Elegir una opción guarda al toque — sin esto, la respuesta se quedaba
   * solo en estado de React hasta que otra cosa disparara un guardado
   * (marcar una serie, editar la nota), y muchas veces no pasaba nada más
   * después de elegirla: quedaba sin persistir. */
  onGuardar: () => void;
  forzarModal?: boolean;
  onResponder?: () => void;
  nombreCampo?: string;
}) {
  const [valor, setValor] = useState(valorInicial ?? "");
  // "Ahora no" cierra la encuesta sin responder. Sin esta salida el modal era
  // una trampa: ocupaba la pantalla entera, no tenía ningún botón de cerrar y
  // el alumno que solo quería mirar el ejercicio quedaba obligado a inventar
  // una respuesta para poder seguir.
  const [omitido, setOmitido] = useState(false);
  /** La volvió a abrir a mano desde el botoncito de abajo. */
  const [reabierto, setReabierto] = useState(false);
  const montado = useSyncExternalStore(suscribirSinCambios, () => true, () => false);

  if (disabled) return null;

  return (
    <>
      <input type="hidden" name={nombreCampo} value={valor} />
      {/* Saltear la encuesta no la pierde para siempre: mientras el ejercicio
          esté terminado y sin responder queda este acceso chico, con el disco
          VIP parpadeando, para volver a abrirla cuando el alumno quiera. Es
          también la única forma de responderla de un ejercicio que se terminó
          en otro momento. */}
      {!valor && (
        <button
          type="button"
          onClick={() => {
            setOmitido(false);
            setReabierto(true);
          }}
          className="boton-encuesta-pendiente flex w-full items-center justify-center gap-1.5"
        >
          <span className="disco-impulso-parpadeo">VIP</span>
          ¿Cómo te fue en este ejercicio?
        </button>
      )}
      {montado && (forzarModal || reabierto) && !valor && !omitido
        ? createPortal(
            <div className="fixed inset-0 z-[70] grid place-items-center bg-black/80 px-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="titulo-impulso-vip">
              <div className="w-full max-w-sm overflow-hidden rounded-[28px] border border-vip/30 bg-[#0b0c0e] shadow-[0_24px_80px_rgba(0,0,0,.72)]">
                <div className="bg-gradient-to-br from-vip/25 via-vip/5 to-transparent px-5 pb-4 pt-5 text-center">
                  <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-vip text-base font-black text-black shadow-[0_0_30px_rgba(190,242,50,.35)]">VIP</div>
                  <p className="text-micro font-bold uppercase tracking-[0.2em] text-vip">Impulso VIP</p>
                  <h2 id="titulo-impulso-vip" className="mt-1 text-xl font-bold text-white">¿Cómo sentiste este ejercicio?</h2>
                  <p className="mt-1 text-caption leading-snug text-text-secondary">Tu respuesta ayuda a preparar mejor el peso de tu próxima rutina.</p>
                </div>
                <div className="grid gap-2 px-4 pb-5">
                  {OPCIONES_DIFICULTAD.map((op) => (
                    <button
                      key={op.valor}
                      type="button"
                      onClick={() => {
                        flushSync(() => setValor(op.valor));
                        onGuardar();
                        onResponder?.();
                      }}
                      className="min-h-12 rounded-2xl border border-white/10 bg-white/[0.055] px-4 text-left text-sm font-semibold text-white transition active:scale-[0.98] active:border-vip active:text-vip"
                    >
                      {op.etiqueta}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setOmitido(true)}
                    className="min-h-11 rounded-2xl text-sm font-semibold text-text-tertiary underline"
                  >
                    Ahora no
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
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
      <p className="text-micro col-span-2 flex items-center gap-1.5 text-text-tertiary">
        <HeartCrack size={13} strokeWidth={2.5} /> Molestia registrada — tu entrenador la va a revisar.
      </p>
    );
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="accion-secundaria-ejercicio flex min-w-0 items-center justify-center gap-1.5"
      >
        <HeartCrack size={13} strokeWidth={2.5} /> Alguna molestia
      </button>
    );
  }

  return (
    <form action={formAction} className="tarjeta-impulso-vip tarjeta-impulso-vip-alerta col-span-2 space-y-2">
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
export function resolverTecnica(
  ejercicio: EjercicioSesion
): { texto: string; sugerida: boolean } | null {
  const dePlan = [ejercicio.tecnicaInstruccion, ejercicio.tecnicaTipo, ejercicio.observacion]
    .map((v) => v?.trim())
    .find((v) => v);
  if (dePlan) return { texto: dePlan, sugerida: false };

  const deBiblioteca = ejercicio.tecnicaSugerida?.trim();
  return deBiblioteca ? { texto: deBiblioteca, sugerida: true } : null;
}

/** Exportado: es la pieza que reutiliza `SesionGrupoCard` para renderizar
 * las filas de una biserie/triserie intercaladas (1A, 1B, 2A, 2B...) dentro
 * de un único formulario — ver `guardarSeriesGrupo` en actions.ts y el
 * prop `sufijoNombre` de acá abajo. */
export const FilaSerie = forwardRef<
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
    /** Namespacea los `name` de los campos ("" por defecto, para un
     * ejercicio suelto). SesionGrupoCard pasa "_b" para el segundo ejercicio
     * de una biserie, así los dos comparten un único <form> (y por lo tanto
     * un único guardado) sin que `peso_1` de uno pise el `peso_1` del
     * otro — ver `guardarSeriesGrupo` en actions.ts. */
    sufijoNombre?: string;
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
    sufijoNombre = "",
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
    completarYa: (guardar = true) => {
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
      if (guardar) onGuardar();
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
      // react-hooks/set-state-in-effect: falso positivo. La regla apunta a
      // estado DERIVADO de props; acá se está leyendo un sistema externo
      // (localStorage) que no existe en el servidor, que es exactamente el uso
      // para el que la propia documentación recomienda un efecto. No se puede
      // resolver en el render sin romper la hidratación.
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  /** Segundos que pasaron desde que terminó el descanso indicado y todavía
   * nadie arrancó la siguiente serie. Tickea cada segundo para que se vea un
   * contador en vivo desde el segundo 1 (antes solo aparecía recién al
   * primer tramo penalizado, y hasta entonces no se veía nada). Corre
   * mientras esta serie sigue "activa" (ver comentario de `activo` más
   * arriba) y su descanso terminó DE VERDAD (avisadoRef true descarta el
   * caso de "arrepentimiento": tocar Listo por error y cancelar no debe
   * penalizar). Se resetea apenas se arranca la siguiente serie o el
   * descanso de esta se reinicia.
   *
   * Se puede frenar tocando el aviso mismo (`excesoPausado`): antes la única
   * forma de que parara de sumar era arrancar la serie siguiente de verdad,
   * sin margen para decir "ya me di cuenta, dejá de penalizar" sin
   * comprometerse a seguir. Tocarlo congela el contador donde está — lo ya
   * penalizado queda, pero no sigue creciendo. */
  const [segundosExceso, setSegundosExceso] = useState(0);
  const [excesoPausado, setExcesoPausado] = useState(false);
  const excesoDesdeRef = useRef<number | null>(null);
  const tramosNotificadosRef = useRef(0);
  useEffect(() => {
    const pausarAlOcultarse = () => {
      if (document.hidden && avisadoRef.current) setExcesoPausado(true);
    };
    document.addEventListener("visibilitychange", pausarAlOcultarse);
    return () => document.removeEventListener("visibilitychange", pausarAlOcultarse);
  }, []);

  function alternarPausaExceso() {
    if (excesoPausado) {
      // Reconstruye el origen solo con el tiempo visible ya contabilizado;
      // nunca incorpora los minutos que el navegador estuvo oculto/dormido.
      excesoDesdeRef.current = Date.now() - segundosExceso * 1000;
      setExcesoPausado(false);
    } else {
      setExcesoPausado(true);
    }
  }
  useEffect(() => {
    if (soloLectura || !activo || descansando || !avisadoRef.current || !descansoSegundos) {
      excesoDesdeRef.current = null;
      tramosNotificadosRef.current = 0;
      setSegundosExceso(0);
      setExcesoPausado(false);
      return;
    }
    if (excesoPausado) return;
    excesoDesdeRef.current ??= Date.now();
    const id = setInterval(() => {
      const transcurridoS = Math.floor((Date.now() - (excesoDesdeRef.current ?? Date.now())) / 1000);
      setSegundosExceso(transcurridoS);
      const tramos = Math.floor(transcurridoS / PUNTOS_VIP.descansoSegundosPorTramo);
      // Solo se manda al servidor cuando se cruza un tramo nuevo, no cada
      // segundo — el indicador visual sí se actualiza cada segundo.
      if (tramos > tramosNotificadosRef.current) {
        tramosNotificadosRef.current = tramos;
        void penalizarExcesoDescanso(sesionEjercicioId, numero, tramos);
      }
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activo, descansando, soloLectura, excesoPausado]);
  const tramosExcedidos = Math.floor(segundosExceso / PUNTOS_VIP.descansoSegundosPorTramo);

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
      // El aviso "real" (llega con pantalla bloqueada) lo manda el servidor
      // — ver `programarAvisoDescanso`. Si cancelás el descanso antes de
      // tiempo, este push programado no se puede des-agendar (limitación
      // conocida): en el peor caso llega uno de más, ya vencido.
      void programarAvisoDescanso(descansoSegundos);
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
      <input type="hidden" name={`peso_corporal_${numero}${sufijoNombre}`} value={esPesoCorporal ? "true" : "false"} />
      <input type="hidden" name={`realizada_${numero}${sufijoNombre}`} value={realizada ? "true" : "false"} />

      <div className="fila-serie-contenido flex items-center gap-1.5">
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
            name={`peso_${numero}${sufijoNombre}`}
            // type="text" y no "number": en varios celulares (Android con
            // teclado en español, sobre todo) el separador decimal que
            // ofrece el teclado numérico es una coma, y un input type=number
            // descarta en silencio cualquier valor con coma (el HTML solo
            // acepta punto ahí) — el campo se veía escrito en pantalla pero
            // llegaba vacío al guardar. El servidor ya convierte coma a
            // punto (ver `guardarSeries` en actions.ts); con texto plano ese
            // valor SÍ le llega.
            type="text"
            inputMode="decimal"
            // El truco de compatibilidad de siempre: en algunas versiones de
            // iOS, inputMode solo no alcanza para que aparezca el teclado
            // numérico en un input de texto — hace falta este pattern
            // también, aunque no se use para validar (el campo no es
            // required, y el servidor ya tolera coma o punto).
            pattern="[0-9]*[.,]?[0-9]*"
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
            name={`reps_${numero}${sufijoNombre}`}
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
                    ? "Descanso terminado — sigue con lo que viene"
                    : tocandoDeshacer > 0
                      ? "Toca de nuevo para deshacer esta serie"
                      : "Serie lista"
                  : tocandoConfirmacion > 0
                    ? `Esta no es la serie en turno — toca ${TOQUES_CONFIRMACION - tocandoConfirmacion} vez más para confirmar`
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
                    Toca {TOQUES_CONFIRMACION - tocandoConfirmacion}{" "}
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
      {segundosExceso > 0 && (
        // Aviso chico y en rojo, en vivo desde el segundo 1: primero avisa
        // que el reloj corre, y recién cuando se cruza el primer tramo (ver
        // PUNTOS_VIP.descansoSegundosPorTramo) muestra los puntos perdidos.
        // Tocable: frena el contador donde está sin obligar a arrancar la
        // siguiente serie (lo ya penalizado no se revierte).
        <button
          type="button"
          onClick={alternarPausaExceso}
          className="mt-1 text-left text-micro text-error underline decoration-dotted"
        >
          {excesoPausado
            ? tramosExcedidos > 0
              ? `Detenido — perdiste ${Math.min(
                  PUNTOS_VIP.descansoPenalizacionMaxima,
                  tramosExcedidos * PUNTOS_VIP.descansoPenalizacionPorTramo
                )} pts · toca para reanudar`
              : "Detenido · toca para reanudar"
            : tramosExcedidos > 0
              ? `Te pasaste del descanso: -${Math.min(
                  PUNTOS_VIP.descansoPenalizacionMaxima,
                  tramosExcedidos * PUNTOS_VIP.descansoPenalizacionPorTramo
                )} pts · toca para frenar`
              : `Descansaste ${segundosExceso}s de más · toca para frenar`}
        </button>
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
    modoEnfocado?: boolean;
    onDificultadRespondida?: () => void;
  }
>(function SesionEjercicioCard({ ejercicio, sesionId, soloLectura, activo = false, modoEnfocado = false, onDificultadRespondida }, ref) {
  const [state, formAction, pending] = useActionState(guardarSeries, initialState);
  // Abierto de entrada el que está en curso y los ya terminados (para poder
  // revisar lo que se levantó); en modo lectura, todos.
  const [expandido, setExpandido] = useState(activo || soloLectura || ejercicio.completado);
  const esTiempo = esEjercicioDeTiempo(ejercicio.repsProgramadas);
  const ultimoTexto = formatUltimo(ejercicio.ultimoRegistro, esTiempo);
  const tecnica = resolverTecnica(ejercicio);
  // Busca la técnica conocida tanto en el texto libre como en la etiqueta
  // ("Biserie (1/2)"): a veces la palabra clave está en una y no en la otra.
  const explicacion = explicacionTecnica(`${tecnica?.texto ?? ""} ${ejercicio.tecnicaTipo ?? ""}`);
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
  // Pantalla "cargada", pedido de Alejandro: la técnica ya no vive siempre
  // abierta. Un botoncito de info la muestra/esconde a pedido — pero la
  // primera vez que este ejercicio pasa a ser el activo (le toca ahora) se
  // abre sola, para que el alumno la vea sí o sí antes de poder cerrarla.
  // `avisoAutomaticoRef` evita que se vuelva a abrir sola en cada render
  // mientras sigue activo, o si el alumno ya la cerró a mano.
  const [mostrarTecnica, setMostrarTecnica] = useState(false);
  const avisoAutomaticoRef = useRef(false);
  useEffect(() => {
    if (activo && tecnica && !avisoAutomaticoRef.current) {
      avisoAutomaticoRef.current = true;
      setMostrarTecnica(true);
    }
    // `tecnica` es un objeto nuevo en cada render (lo arma `resolverTecnica`
    // sin memo): depender de él directo dispararía el efecto todo el tiempo.
    // `tecnica?.texto` es el valor real que importa y sí es estable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activo, tecnica?.texto]);
  const cardRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const formId = `series-${ejercicio.sesionEjercicioId}`;
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
  /**
   * ¿Se terminó este ejercicio recién, acá, en esta pantalla? Solo entonces se
   * abre sola la encuesta de dificultad.
   *
   * Antes bastaba con que el ejercicio estuviera completo y sin responder para
   * que el modal se plantara encima: al navegar con Anterior/Siguiente para
   * repasar lo hecho, cada ejercicio terminado en otro momento (o respondido
   * con "Ahora no") volvía a tapar la pantalla. Arranca en `false` en cada
   * montaje, que es exactamente lo que se quiere: navegar nunca la dispara.
   */
  const [recienCompletado, setRecienCompletado] = useState(false);
  /** Pidió cerrar el ejercicio con series sin hacer: se le muestra qué implica
   * antes de hacerlo. */
  const [confirmandoIncompleto, setConfirmandoIncompleto] = useState(false);
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

  // react-hooks/set-state-in-effect: falso positivo, misma razón que arriba —
  // el respaldo vive en localStorage, que no existe durante el render del
  // servidor. Leerlo en el render (o en el inicializador de useState) daría
  // desajuste de hidratación, que es justo lo que el comentario de arriba
  // explica que hay que evitar.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
    const siguienteBorrador = {
      series: filas.map((n) => ({
        numero: n,
        peso: String(datos.get(`peso_${n}`) ?? ""),
        reps: String(datos.get(`reps_${n}`) ?? ""),
        realizada: datos.get(`realizada_${n}`) === "true",
        esPesoCorporal: datos.get(`peso_corporal_${n}`) === "true",
      })),
      nota: String(datos.get("nota_ejercicio") ?? ""),
    };
    guardarBorrador(sesionId, ejercicio.sesionEjercicioId, siguienteBorrador);
    setBorrador({ ...siguienteBorrador, guardadoEn: 0 });
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
  // `seEnvioRef` es la guarda: sin ella, `pending === false` también es
  // cierto apenas se monta el componente, ANTES de mandar nada — y borraba el
  // respaldo recién restaurado sin que el servidor hubiera confirmado nada.
  useEffect(() => {
    if (ejercicio.completado && !pending && !state.error && borradorLeido) {
      limpiarBorrador(sesionId, ejercicio.sesionEjercicioId);
    }
  }, [ejercicio.completado, pending, state.error, borradorLeido, sesionId, ejercicio.sesionEjercicioId]);

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
    // Cerrar un ejercicio al que le faltan series NO es gratis: `completarYa`
    // marca las pendientes como hechas, así que el ejercicio cuenta entero
    // para los puntos y esas series quedan sin kilos ni repeticiones. Se
    // avisa antes, con el número exacto, y se deja seguir igual: es un aviso,
    // no un candado.
    const faltan = ejercicio.seriesProgramadas - seriesHechas.size;
    if (faltan > 0 && !confirmandoIncompleto) {
      setConfirmandoIncompleto(true);
      return;
    }
    setConfirmandoIncompleto(false);
    cerrarEjercicio();
  }

  function cerrarEjercicio() {
    // Fuerza todas las series pendientes como hechas y salta al siguiente
    // ejercicio, sin esperar los descansos — el botón cuadrado de "listo".
    // Antes cada fila enviaba el formulario por separado. En un ejercicio de
    // cuatro series eso disparaba cuatro guardados simultáneos con estados
    // distintos; una respuesta antigua podía llegar última y hacer que kilos
    // y checks desaparecieran hasta recargar la app. Se actualizan todas las
    // filas primero y se envía una única fotografía coherente del formulario.
    filasRef.current.forEach((handle) => handle.completarYa(false));
    setRecienCompletado(true);
    guardarAhora();
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
  //
  // Ajuste durante el render y no un efecto: es el patrón que documenta React
  // para derivar estado de un cambio de prop. Con el efecto, la tarjeta se
  // alcanzaba a pintar cerrada y recién en el segundo render se abría — un
  // parpadeo justo en el momento en que el alumno tiene las manos ocupadas.
  const [activoPrevio, setActivoPrevio] = useState(activo);
  if (activo !== activoPrevio) {
    setActivoPrevio(activo);
    if (activo) setExpandido(true);
  }

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
      setRecienCompletado(true);
      // Nadie va a arrancar una serie más de este ejercicio — sin esto, la
      // última fila se quedaba "activa" para siempre (nada vuelve a llamar
      // onIniciar), y si el alumno se quedaba parado en la pantalla sin
      // tocar "Finalizar", el contador de exceso de descanso seguía
      // corriendo sobre una serie que ya terminó de verdad.
      setSerieActivaNumero(null);
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
      {/* Ya NO fuerza negro plano (`tarjeta-modelo-oscura`/`-ejercicio-oscura`
          quitadas): pedido de Alejandro — con los temas VIP/Steel Fit/Lady
          Fit, el negro fijo se veía "trabado" al lado del resto de la
          pantalla, que sí sigue el tema. `bg-surface` normal ya alcanza:
          la única razón real del negro era el recorte transparente del
          modelo en el ícono de respaldo (IlustracionEjercicio → 48px), que
          tiene su PROPIO fondo negro fijo (`FONDO_FOTO_GRUPO`) inline, sin
          depender de esta tarjeta. La foto de referencia grande tampoco lo
          necesita: rellena los bordes con la misma foto desenfocada, no con
          negro. */}
      <Card
        className={`p-3 ${modoEnfocado ? "tarjeta-ejercicio-enfocada" : ""} ${activo && !soloLectura ? "panel-ejercicio-activo" : ""}`}
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
        <div className="cabecera-ejercicio mb-2 flex items-start gap-2">
          <div className={modoEnfocado ? "hidden" : "flex min-w-0 flex-1 flex-col"}>
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
                {/* De un vistazo, junto al nombre: cuánto hay que hacer y con
                    qué técnica — sin la descripción, que vive en el botón "!"
                    sobrepuesto en la foto (ver más abajo), no acá. Pedido de
                    Alejandro: la pantalla de entrenar se sentía cargada. */}
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className="text-micro font-semibold text-text-secondary">
                    {ejercicio.seriesProgramadas} series · {ejercicio.repsProgramadas}
                    {esTiempo ? " seg" : " reps"}
                  </span>
                  {ejercicio.tecnicaTipo && (
                    <span
                      className="pill-tecnica inline-block"
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
          </div>
          {/* `relative`: contenedor del botón "!" sobrepuesto (ver abajo) —
              no de la foto en sí, que sigue midiéndose sola por su `tamano`. */}
          <div className="relative shrink-0">
          <CuadroFotoReferencia
            ilustracionSlug={ejercicio.ilustracionSlug}
            fotoMiniaturaUrl={ejercicio.fotoMiniaturaUrl}
            fotoCompletaUrl={ejercicio.fotoCompletaUrl}
            videoUrl={ejercicio.videoUrl}
            videoCloudflareUid={ejercicio.videoCloudflareUid}
            videoCloudflareEstado={ejercicio.videoCloudflareEstado}
            videoCloudflareMiniaturaUrl={ejercicio.videoCloudflareMiniaturaUrl}
            nombre={ejercicio.nombre}
            sesionEjercicioId={ejercicio.sesionEjercicioId}
            ejercicioId={ejercicio.ejercicioId}
            fotoPanoramaX={ejercicio.fotoPanoramaX}
            fotoPanoramaY={ejercicio.fotoPanoramaY}
            fotoCuadradaX={ejercicio.fotoCuadradaX}
            fotoCuadradaY={ejercicio.fotoCuadradaY}
            destacado={modoEnfocado}
            reproducirAutomaticamente={modoEnfocado && activo && !soloLectura}
          />
          {/* El botón de técnica: SOBRE la foto (esquina inferior izquierda —
              la derecha ya la usa el ícono de ampliar) y no en el texto, para
              que no empuje nada hacia abajo. Funciona igual en modo normal y
              en modo enfocado, a diferencia del botón que tenía antes en la
              cabecera (que quedaba oculto en modo enfocado y no había forma
              de reabrir la técnica una vez cerrada). Abre el modal completo,
              nunca cierra desde acá — cerrar es cosa del modal mismo. */}
          {tecnica && (
            <button
              type="button"
              onClick={() => setMostrarTecnica(true)}
              aria-haspopup="dialog"
              aria-label="Ver técnica sugerida"
              className="absolute bottom-1.5 left-1.5 z-[4] flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-vip backdrop-blur-sm active:scale-95"
            >
              <AlertCircle size={16} strokeWidth={2.5} />
            </button>
          )}
        </div>
        </div>

        {/* Técnica, en lugar de la observación que había antes: lo que se lee
            acá tiene que ser CÓMO se hace el ejercicio, no un comentario
            suelto. Manda lo que pidió la rutina; si el entrenador no pidió
            nada, entra la de la biblioteca del gimnasio, marcada como
            sugerencia para que no se confunda con una orden. Ver
            `resolverTecnica` arriba.

            Ya no vive siempre abierta (pantalla cargada, pedido de
            Alejandro): el botón "!" sobrepuesto en la foto la abre a pedido,
            y se abre sola una vez cuando el ejercicio pasa a activo (ver el
            efecto más arriba) — que la vea sí o sí antes de poder cerrarla.
            Modal completo y no una cajita en la tarjeta: así el texto nunca
            queda cortado ni apretado, entre en la pantalla que entre.

            A propósito FUERA del `{!expandido ? ... : ...}` de más abajo: el
            botón "!" que la abre vive en la foto, que se ve tanto plegada
            como expandida — si el modal quedara adentro de la rama expandida,
            abrir la técnica de un ejercicio plegado no mostraba nada (bug
            encontrado al verificar en el navegador). */}
        {tecnica && mostrarTecnica &&
          createPortal(
            <div
              role="dialog"
              aria-label="Técnica sugerida"
              onClick={() => setMostrarTecnica(false)}
              className="fondo-burbuja-tecnica fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              {/* `explicacion` manda el tratamiento de RETO (rayos, onda,
                  golpe de entrada): solo las técnicas que exigen de verdad
                  —drop set, rest-pause, al fallo…— se anuncian así. Si TODA
                  técnica entrara con rayos, los rayos dejarían de significar
                  algo, igual que pasó con el aviso de sesión sin cerrar.

                  Los rayos van ACÁ, hermanos de la burbuja y no adentro:
                  adentro se dibujaban por delante del texto (ver el comentario
                  de `.rayos-reto` en globals.css). Las ondas sí van adentro,
                  porque son un anillo pegado al borde de la burbuja. */}
              {explicacion && <span aria-hidden className="rayos-reto" />}
              <div
                onClick={(e) => e.stopPropagation()}
                className={`burbuja-tecnica ${explicacion ? "burbuja-tecnica-reto" : ""} max-h-[80vh] w-full max-w-sm overflow-y-auto rounded-[22px] border border-vip/30 bg-surface p-4 shadow-2xl`}
              >
                {explicacion && (
                  <>
                    <span aria-hidden className="onda-reto" />
                    <span aria-hidden className="onda-reto onda-reto-2" />
                  </>
                )}
                <div className="relative flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-vip/15 text-vip">
                    <AlertCircle size={18} strokeWidth={2.5} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-card-title text-text ${explicacion ? "titulo-reto" : ""}`}>
                      {explicacion?.etiqueta ?? (tecnica.sugerida ? "Técnica sugerida" : "Técnica")}
                    </p>
                    <p className="text-caption mt-0.5 text-text-secondary">{ejercicio.nombre}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMostrarTecnica(false)}
                    aria-label="Cerrar"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-text-secondary"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="mt-3 space-y-3 border-t border-border pt-3">
                  <p className="text-secondary leading-relaxed text-text">
                    <span className="font-semibold text-vip">
                      {tecnica.sugerida ? "Lo que pide tu rutina: " : "Instrucción: "}
                    </span>
                    {tecnica.texto}
                  </p>
                  {/* Explicación general de la técnica (drop set, biserie...),
                      detectada por palabra clave en lo que ya escribió el
                      entrenador o la IA — ver glosario-tecnicas.ts. Complementa
                      el texto de arriba, no lo reemplaza: los números exactos
                      (si los hay) siguen siendo los del entrenador. */}
                  {explicacion && (
                    <p className="text-secondary leading-relaxed text-text-secondary">
                      <span className="font-semibold text-text">Cómo se hace: </span>
                      {explicacion.explicacion}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setMostrarTecnica(false)}
                  className="radius-control mt-4 flex h-11 w-full items-center justify-center bg-vip text-caption font-bold text-black"
                >
                  Entendido
                </button>
              </div>
            </div>,
            document.body
          )}

        {/* Los números que se consultan de reojo entre serie y serie, ahora a
            todo el ancho de la tarjeta (antes vivía en la columna angosta que
            dejaba la foto al lado, y el tempo no entraba como 4ta columna —
            afuera de esa columna ya no hay ese límite, como en la
            referencia). */}
        {!modoEnfocado && <div className="datos-ejercicio radius-control mb-1.5 flex items-stretch overflow-hidden border border-border bg-surface-2">
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
        </div>}

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
          id={formId}
          ref={formRef}
          action={formAction}
          onChange={respaldarLocal}
          className="space-y-1"
        >
          <input type="hidden" name="sesion_ejercicio_id" value={ejercicio.sesionEjercicioId} />
          <input type="hidden" name="sesion_id" value={sesionId} />
          <input type="hidden" name="cantidad_series" value={ejercicio.seriesProgramadas} />

          {/* La etiqueta "SERIES" que iba acá se sacó: la fila de números
              (1, 2, 3...) ya deja claro qué es sin hacer falta el rótulo —
              pedido de Alejandro para que la pantalla se sienta menos cargada. */}
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

          {/* Con TODAS las series marcadas el ejercicio ya se cierra solo: el
              guardado automático manda `seriesRealizadas === cantidad` y el
              servidor pone `completado` (ver guardarSeries). Dejar el botón
              ahí daba a entender lo contrario — que faltaba un paso a mano —
              así que desaparece apenas deja de tener sentido. Sigue estando
              mientras falten series, que es su uso real: saltarse los
              descansos y dar el ejercicio por terminado. */}
          {!ejercicio.completado && seriesHechas.size < ejercicio.seriesProgramadas && (
            confirmandoIncompleto ? (
              <div className="panel-cerrar-incompleto space-y-2">
                <p className="text-caption font-semibold text-warning">
                  Te faltan {ejercicio.seriesProgramadas - seriesHechas.size} de{" "}
                  {ejercicio.seriesProgramadas} series
                </p>
                <p className="text-micro text-text-secondary">
                  Si cierras el ejercicio ahora, esas series quedan marcadas como hechas y sin kilos
                  ni repeticiones registradas. Tu entrenador lo va a ver así.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmandoIncompleto(false)}
                    className="text-caption h-10 flex-1 rounded-[12px] border border-vip/60 font-bold text-vip"
                  >
                    Sigo entrenando
                  </button>
                  <button
                    type="button"
                    onClick={marcarEjercicioListo}
                    className="text-caption h-10 flex-1 rounded-[12px] border border-border font-semibold text-text-secondary"
                  >
                    Cerrar igual
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={marcarEjercicioListo}
                className="boton-completar-ejercicio flex h-11 w-full items-center justify-center gap-2 rounded-[14px] font-bold"
              >
                <Check size={14} strokeWidth={3.5} /> Completar y guardar
              </button>
            )
          )}

          {/* Se pregunta una sola vez, cuando ya se hicieron todas las
              series de este ejercicio — no antes, para no interrumpir el
              ritmo mientras el alumno todavía está entrenando. */}
          <SelectorDificultad
            valorInicial={ejercicio.dificultadPercibida}
            disabled={seriesHechas.size < ejercicio.seriesProgramadas}
            onGuardar={guardarAhora}
            forzarModal={modoEnfocado && recienCompletado}
            onResponder={onDificultadRespondida}
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
      {!soloLectura && (
        <div className="acciones-secundarias-ejercicio mt-1.5 grid grid-cols-2 gap-2">
          <label className="accion-secundaria-ejercicio flex min-w-0 items-center gap-1.5 px-2">
            <NotebookPen size={13} className="shrink-0 text-text-tertiary" />
            <input
              form={formId}
              name="nota_ejercicio"
              type="text"
              placeholder="Nota"
              aria-label="Nota del ejercicio"
              defaultValue={ejercicio.notaEjercicio ?? ""}
              onChange={respaldarLocal}
              className="text-caption w-full min-w-0 bg-transparent text-text outline-none placeholder:text-text-tertiary"
            />
          </label>
          <ReportarDolorPanel
            sesionId={sesionId}
            sesionEjercicioId={ejercicio.sesionEjercicioId}
            diaEjercicioId={ejercicio.diaEjercicioId}
          />
        </div>
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
