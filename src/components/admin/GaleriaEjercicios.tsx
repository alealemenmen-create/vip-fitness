"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { Search, Camera, Plus, X, Check, ImageIcon, Play } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { resolverIlustracion } from "@/lib/ejercicios/ilustracion";
import {
  subirFotoEjercicio,
  crearEjercicioNuevo,
  actualizarNombreEjercicio,
  desactivarEjercicio,
  guardarVideoEjercicio,
  quitarVideoEjercicio,
} from "@/app/admin/ejercicios/actions";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import type { Ejercicio } from "@/lib/ejercicios/tipos";

const ETIQUETAS_GRUPO: Record<string, string> = {
  pecho: "Pecho",
  espalda: "Espalda",
  piernas: "Piernas",
  hombros: "Hombros",
  brazos: "Brazos",
  core: "Core",
  cardio: "Cardio",
};

/** La miniatura a mostrar: la foto subida desde acá si existe, si no la
 * ilustración estática de siempre (public/ejercicios/<slug>). Mismo criterio
 * que usa la app del alumno (ver SesionEjercicioCard). */
function fotoDe(ej: Ejercicio): string | null {
  if (ej.fotoMiniaturaUrl) return ej.fotoMiniaturaUrl;
  const { src, origen } = resolverIlustracion(ej.ilustracionSlug, null);
  return origen === "ilustracion" ? src : null;
}

export function GaleriaEjercicios({ ejercicios }: { ejercicios: Ejercicio[] }) {
  const [busqueda, setBusqueda] = useState("");
  const [editando, setEditando] = useState<Ejercicio | null>(null);
  const [creando, setCreando] = useState(false);
  // Justo después de subir una foto nueva, a veces el CDN de Storage todavía
  // no terminó de propagarla y la primera carga falla (el archivo ya está
  // subido de verdad, es solo una demora de segundos). Antes, ese primer
  // fallo quedaba marcado para siempre y solo se arreglaba recargando la
  // página a mano — confuso justo después de ver "Foto actualizada". Ahora
  // se reintenta una vez, con una pequeña demora, antes de darse por
  // vencido y caer al placeholder neutro.
  //
  // El "cache-buster" del reintento tiene que ser realmente único
  // (Date.now(), no un contador chico tipo 1, 2, 3...): Safari puede guardar
  // en caché esa primera respuesta fallida, y una recarga de página nueva
  // vuelve a pedir exactamente la misma URL sin el "?r=" (el estado del
  // reintento se resetea) — con un contador chico, el reintento de ESA
  // sesión nueva puede terminar pidiendo un "?r=1" que ya se había intentado
  // y fallado en una sesión anterior, chocando con esa misma caché vieja.
  // Un timestamp nunca se repite entre sesiones.
  const [erroresFoto, setErroresFoto] = useState<ReadonlySet<string>>(new Set());
  // Solo se lee dentro de su propio updater funcional (más abajo) — no hace
  // falta la variable de lectura acá afuera.
  const [, setYaReintentado] = useState<ReadonlySet<string>>(new Set());
  const [cacheBuster, setCacheBuster] = useState<Readonly<Record<string, number>>>({});

  function onErrorFoto(id: string) {
    setYaReintentado((prev) => {
      if (prev.has(id)) {
        setErroresFoto((s) => new Set(s).add(id));
        return prev;
      }
      setTimeout(() => setCacheBuster((c) => ({ ...c, [id]: Date.now() })), 1500);
      return new Set(prev).add(id);
    });
  }

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return ejercicios;
    return ejercicios.filter((e) => e.nombre.toLowerCase().includes(q));
  }, [ejercicios, busqueda]);

  const sinFoto = ejercicios.filter((e) => !fotoDe(e)).length;

  return (
    <div className="space-y-3">
      {sinFoto > 0 && (
        <Card padding="p-2.5" className="flex items-center gap-2">
          <ImageIcon size={16} className="shrink-0 text-text-tertiary" />
          <p className="text-caption text-text-secondary">
            {sinFoto} ejercicio{sinFoto === 1 ? "" : "s"} todavía sin foto propia.
          </p>
        </Card>
      )}

      <div className="relative">
        <Search
          size={14}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary"
        />
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar ejercicio..."
          className="radius-control text-caption w-full border border-border bg-surface py-2 pl-8 pr-3 text-text"
        />
      </div>

      <button
        type="button"
        onClick={() => setCreando(true)}
        className="radius-control flex w-full items-center justify-center gap-2 border border-dashed border-vip/50 py-3 text-secondary font-semibold text-vip"
      >
        <Plus size={16} /> Ejercicio nuevo, con foto
      </button>

      <div className="grid grid-cols-2 gap-2.5">
        {filtrados.map((ej) => {
          const fotoBase = erroresFoto.has(ej.id) ? null : fotoDe(ej);
          const buster = cacheBuster[ej.id];
          // El "?r=<timestamp>" fuerza a next/image a pedirla de nuevo en vez
          // de repetir el mismo fallo cacheado — solo se agrega a partir del
          // reintento, y con un valor que nunca choca con uno de antes.
          const foto = fotoBase && buster ? `${fotoBase}?r=${buster}` : fotoBase;
          return (
            <button
              key={ej.id}
              type="button"
              onClick={() => setEditando(ej)}
              className="group text-left"
            >
              <Card padding="p-0" className="overflow-hidden">
                <div className="relative aspect-square w-full bg-surface-2">
                  {foto ? (
                    <Image
                      src={foto}
                      alt={ej.nombre}
                      fill
                      sizes="200px"
                      className="object-cover"
                      onError={() => onErrorFoto(ej.id)}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-text-tertiary">
                      <ImageIcon size={26} />
                    </div>
                  )}
                  <span className="absolute bottom-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm">
                    <Camera size={13} />
                  </span>
                  {ej.videoUrl && (
                    <span
                      title="Tiene video de referencia"
                      className="absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-vip backdrop-blur-sm"
                    >
                      <Play size={11} fill="currentColor" />
                    </span>
                  )}
                </div>
                <div className="p-2">
                  <p className="text-caption line-clamp-2 font-semibold leading-tight text-text">
                    {ej.nombre}
                  </p>
                  <p className="text-[10px] mt-0.5 text-text-tertiary">
                    {ETIQUETAS_GRUPO[ej.grupoMuscular] ?? ej.grupoMuscular}
                  </p>
                </div>
              </Card>
            </button>
          );
        })}
      </div>

      {filtrados.length === 0 && (
        <Card>
          <p className="text-body text-text-secondary">Ningún ejercicio coincide con la búsqueda.</p>
        </Card>
      )}

      {editando && (
        <ModalSubirFoto ejercicio={editando} fotoActual={fotoDe(editando)} onCerrar={() => setEditando(null)} />
      )}
      {creando && <ModalEjercicioNuevo onCerrar={() => setCreando(false)} />}
    </div>
  );
}

// Alcanza de sobra para una vista previa en un cuadro chico — no hace falta
// la resolución completa de la foto (puede ser 12+ megapíxeles en un iPhone
// moderno). El procesamiento final de verdad lo hace el servidor con sharp.
const LADO_MAXIMO_PREVIA = 800;

/**
 * Genera la vista previa de la foto elegida/tomada.
 *
 * Primer intento (el que de verdad soluciona el problema en iPhone):
 * decodificar el archivo con `createImageBitmap` y dibujarlo en un
 * `<canvas>` YA ACHICADO, exportando el resultado como JPEG. Una foto HEIC
 * tomada con la cámara del iPhone es justamente el caso que fallaba: un
 * `<img>` alimentado con `blob:` o `data:` URL del archivo original depende
 * de que el propio `<img>` sepa decodificar ese formato ahí mismo, y esa vía
 * tiene fallas conocidas de WebKit con HEIC — mientras que `createImageBitmap`
 * usa el decodificador de imágenes del sistema operativo (el mismo que abre
 * Fotos), mucho más confiable.
 *
 * Achicar ANTES de dibujar en el canvas no es opcional: la primera versión
 * de esto dibujaba a la resolución completa de la foto y exportaba ese
 * canvas gigante a base64 — con una foto de 12 megapíxeles eso podía
 * consumir tanta memoria que Safari cerraba la pestaña entera ("This page
 * couldn't load"), un bug peor que el que se estaba arreglando.
 *
 * Si el navegador no soporta `createImageBitmap` (poco probable, pero por las
 * dudas), cae a leer el archivo como data URL directamente — a resolución
 * completa, porque ahí no hay forma de achicar sin decodificar primero, pero
 * es solo el respaldo del respaldo.
 */
async function generarPreview(archivo: File): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(archivo, { imageOrientation: "from-image" });
    const escala = Math.min(1, LADO_MAXIMO_PREVIA / Math.max(bitmap.width, bitmap.height));
    const ancho = Math.round(bitmap.width * escala);
    const alto = Math.round(bitmap.height * escala);

    const canvas = document.createElement("canvas");
    canvas.width = ancho;
    canvas.height = alto;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("sin contexto 2d");
    ctx.drawImage(bitmap, 0, 0, ancho, alto);
    bitmap.close();
    return canvas.toDataURL("image/jpeg", 0.85);
  } catch {
    return new Promise((resolve) => {
      const lector = new FileReader();
      lector.onload = () => resolve(typeof lector.result === "string" ? lector.result : null);
      lector.onerror = () => resolve(null);
      lector.readAsDataURL(archivo);
    });
  }
}

function Overlay({ children, onCerrar }: { children: React.ReactNode; onCerrar: () => void }) {
  // `createPortal` a `document.body`: es el único modal de esta pantalla que
  // NO lo hacía (todos los demás de la app sí, ver AbandonarSesionBoton,
  // ReiniciarRutinaBoton, etc.). Al quedar montado adentro del contenedor con
  // scroll de la página (`.pantalla-scroll`) en vez de directo en el body,
  // cuando el alumno... el entrenador volvía de elegir la foto (cámara o
  // galería), Safari intentaba llevarlo al elemento que había quedado
  // enfocado y terminaba scrolleando esa columna entera hasta arriba del
  // todo — el modal seguía viéndose bien (es `fixed`), pero por detrás la
  // página había saltado, y al cerrarlo aparecía arriba de todo en vez de
  // donde estaba.
  return createPortal(
    <div
      role="dialog"
      onClick={onCerrar}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="radius-card max-h-[85vh] w-full max-w-md overflow-y-auto bg-surface p-4"
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

const ESTADO_INICIAL_FOTO = { error: null, ok: false };
const ESTADO_INICIAL_NOMBRE = { error: null, ok: false };
const ESTADO_INICIAL_ELIMINAR = { error: null, ok: false };

/** Eliminar un ejercicio de la galería, con confirmación en dos pasos. En
 * realidad lo desactiva (`activo = false`, ver `desactivarEjercicio` en
 * actions.ts) — las rutinas que ya lo usan lo siguen mostrando igual, solo
 * deja de listarse y de ofrecerse para rutinas nuevas. */
function BotonEliminar({ ejercicio, onEliminado }: { ejercicio: Ejercicio; onEliminado: () => void }) {
  const [confirmando, setConfirmando] = useState(false);
  const [state, formAction, pending] = useActionState(desactivarEjercicio, ESTADO_INICIAL_ELIMINAR);

  useEffect(() => {
    if (state.ok) {
      const id = setTimeout(onEliminado, 500);
      return () => clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok]);

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="text-caption font-medium text-error"
      >
        Eliminar de la galería
      </button>
    );
  }

  return (
    <div className="radius-control space-y-1.5 border border-error/40 bg-error/5 p-2">
      <p className="text-caption text-text">
        Deja de aparecer en la galería y de ofrecerse para rutinas nuevas. Las rutinas que ya usan esta
        foto no se rompen — la siguen mostrando igual.
      </p>
      {state.error && <p className="text-caption text-error">{state.error}</p>}
      <form action={formAction} className="flex gap-2">
        <input type="hidden" name="ejercicio_id" value={ejercicio.id} />
        <Button type="submit" variant="destructive" size="xsAuto" loading={pending}>
          Sí, eliminar
        </Button>
        <Button type="button" variant="ghost" size="xsAuto" onClick={() => setConfirmando(false)}>
          Cancelar
        </Button>
      </form>
    </div>
  );
}

/** Todas las formas conocidas de nombrar el ejercicio, en el formato que
 * escribe el entrenador: "Press de pecho / Bench press / Press banca". La
 * primera es el nombre que se ve en la galería; el resto son los alias que
 * usa `emparejarEjercicio` para reconocer el mismo movimiento en una rutina
 * nueva, sin importar cómo lo haya escrito. */
function nombresComoTexto(ejercicio: Ejercicio): string {
  return [ejercicio.nombre, ...ejercicio.aliases].join(" / ");
}

function EditorNombre({ ejercicio }: { ejercicio: Ejercicio }) {
  const [state, formAction, pending] = useActionState(actualizarNombreEjercicio, ESTADO_INICIAL_NOMBRE);

  return (
    <form action={formAction} className="space-y-1.5">
      <input type="hidden" name="ejercicio_id" value={ejercicio.id} />
      <span className="text-caption block text-text-tertiary">
        Nombre — separá variantes con &quot;/&quot; para que cualquiera muestre esta misma foto
      </span>
      <Textarea
        name="nombres"
        required
        rows={2}
        defaultValue={nombresComoTexto(ejercicio)}
        placeholder="Ej: Press de pecho / Bench press / Press banca"
        className="!py-2 text-caption"
      />
      {state.error && <p className="text-caption text-error">{state.error}</p>}
      {state.ok && (
        <p className="text-caption flex items-center gap-1 text-success">
          <Check size={12} /> Nombre guardado.
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="radius-control flex h-9 w-full items-center justify-center gap-2 border border-border text-caption font-medium text-text disabled:opacity-60"
      >
        {pending ? "Guardando..." : "Guardar nombre"}
      </button>
    </form>
  );
}

const ESTADO_INICIAL_VIDEO = { error: null, ok: false };
const ESTADO_INICIAL_QUITAR_VIDEO = { error: null, ok: false };

/**
 * Video de referencia — SOLO por link (YouTube o un archivo de video
 * directo), nunca subiendo el archivo desde el celular. Un video pesa mucho
 * más que cualquier foto, y decodificarlo del lado del navegador es
 * exactamente el problema que costó resolver con las fotos — las apps que
 * manejan video de verdad tampoco lo hacen así, mandan el archivo pesado
 * directo a un servidor especializado sin tocarlo en el celular.
 */
function EditorVideo({ ejercicio }: { ejercicio: Ejercicio }) {
  const [state, formAction, pending] = useActionState(guardarVideoEjercicio, ESTADO_INICIAL_VIDEO);
  const [estadoQuitar, accionQuitar, pendingQuitar] = useActionState(
    quitarVideoEjercicio,
    ESTADO_INICIAL_QUITAR_VIDEO
  );

  return (
    <div className="space-y-1.5">
      <form action={formAction} className="space-y-1.5">
        <input type="hidden" name="ejercicio_id" value={ejercicio.id} />
        <span className="text-caption block text-text-tertiary">
          Video de referencia — link de YouTube o link directo a un archivo (mp4, mov, webm)
        </span>
        <Input
          type="url"
          name="video_url"
          defaultValue={ejercicio.videoUrl ?? ""}
          placeholder="https://youtube.com/watch?v=…"
          className="!py-2 text-caption"
        />
        {state.error && <p className="text-caption text-error">{state.error}</p>}
        {state.ok && (
          <p className="text-caption flex items-center gap-1 text-success">
            <Check size={12} /> Video guardado.
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="radius-control flex h-9 w-full items-center justify-center gap-2 border border-border text-caption font-medium text-text disabled:opacity-60"
        >
          {pending ? "Guardando..." : "Guardar video"}
        </button>
      </form>

      {ejercicio.videoUrl && (
        <form action={accionQuitar}>
          <input type="hidden" name="ejercicio_id" value={ejercicio.id} />
          {estadoQuitar.error && <p className="text-caption mb-1 text-error">{estadoQuitar.error}</p>}
          <button
            type="submit"
            disabled={pendingQuitar}
            className="text-caption font-medium text-text-tertiary disabled:opacity-60"
          >
            {pendingQuitar ? "Quitando..." : "Quitar video"}
          </button>
        </form>
      )}
    </div>
  );
}

function ModalSubirFoto({
  ejercicio,
  fotoActual,
  onCerrar,
}: {
  ejercicio: Ejercicio;
  fotoActual: string | null;
  onCerrar: () => void;
}) {
  const [state, formAction, pending] = useActionState(subirFotoEjercicio, ESTADO_INICIAL_FOTO);
  const [previa, setPrevia] = useState<string | null>(null);
  const [previaRota, setPreviaRota] = useState(false);
  // El archivo elegido se guarda en estado apenas se selecciona, en vez de
  // releerlo del <input> recién al tocar "Guardar foto": en Safari de iPhone
  // esa relectura a veces llegaba vacía (el input ya no tenía el archivo, sin
  // ningún cambio visible de por medio) y el servidor rechazaba el envío con
  // "Elegí una foto" aunque la vista previa ya lo mostrara elegido.
  const [archivoElegido, setArchivoElegido] = useState<File | null>(null);

  useEffect(() => {
    if (state.ok) {
      const id = setTimeout(onCerrar, 900);
      return () => clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok]);

  const imagenAMostrar = previa ?? fotoActual;

  return (
    <Overlay onCerrar={onCerrar}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-card-title min-w-0 truncate text-text">{ejercicio.nombre}</p>
        <button type="button" onClick={onCerrar} aria-label="Cerrar" className="shrink-0 text-text-tertiary">
          <X size={20} />
        </button>
      </div>

      {/* aspect-square y no aspect-video: tiene que coincidir con el recorte
          que hace el servidor (500x500, ver subirFotoEjercicio en actions.ts)
          y con la tarjetita de la galería (también aspect-square) — si no,
          lo que encuadrás acá no es lo que termina guardado. */}
      <label className="radius-card relative flex aspect-square w-full cursor-pointer items-center justify-center overflow-hidden border border-dashed border-border bg-surface-2">
        {imagenAMostrar && !previaRota ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imagenAMostrar}
            alt=""
            className="h-full w-full object-cover"
            onError={() => setPreviaRota(true)}
          />
        ) : (
          <span className="flex flex-col items-center gap-1 px-4 text-center text-text-tertiary">
            <Camera size={26} />
            <span className="text-caption">
              {previaRota
                ? "No se pudo mostrar la vista previa — igual se guarda bien al tocar \"Guardar foto\""
                : "Toca para elegir una foto"}
            </span>
          </span>
        )}
        <input
          type="file"
          name="foto"
          accept="image/*"
          // Sin "capture": con ese atributo, varios navegadores de celular
          // abren la cámara directo y nunca ofrecen elegir de la galería —
          // sacándolo, el selector nativo siempre deja elegir entre sacar
          // una foto nueva o subir una que ya existe.
          className="absolute inset-0 h-full w-full opacity-0"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setArchivoElegido(f);
            setPreviaRota(false);
            setPrevia(await generarPreview(f));
          }}
        />
      </label>

      <form
        action={(fd) => {
          if (archivoElegido) fd.set("foto", archivoElegido);
          fd.set("ejercicio_id", ejercicio.id);
          formAction(fd);
        }}
        className="mt-3 space-y-2"
      >
        {/* Alternativa a elegir un archivo, para cuando el selector del
            celular da problemas (ver el comentario largo en generarPreview):
            si la foto ya está en otro lado (Drive, otra app), pegar el link
            se salta el archivo del celular por completo. Si se cargan las
            dos cosas, gana el archivo — el link solo se usa si no hay
            archivo elegido (ver subirFotoEjercicio en actions.ts). */}
        <div className="flex items-center gap-2 text-[10px] text-text-tertiary">
          <div className="h-px flex-1 bg-border" /> o pegá el link de una imagen{" "}
          <div className="h-px flex-1 bg-border" />
        </div>
        <Input type="url" name="foto_url" placeholder="https://…" className="!py-2 text-caption" />

        {state.error && <p className="text-caption text-error">{state.error}</p>}
        {state.ok && (
          <p className="text-caption flex items-center gap-1 text-success">
            <Check size={14} /> Foto actualizada — ya la ven los alumnos.
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="btn-accion radius-control flex h-11 w-full items-center justify-center gap-2 text-secondary font-semibold disabled:opacity-60"
        >
          {pending ? "Subiendo..." : "Guardar foto"}
        </button>
      </form>

      <div className="mt-4 border-t border-border pt-3">
        <EditorNombre ejercicio={ejercicio} />
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <EditorVideo ejercicio={ejercicio} />
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <BotonEliminar ejercicio={ejercicio} onEliminado={onCerrar} />
      </div>
    </Overlay>
  );
}

const ESTADO_INICIAL_CREAR = { error: null, ok: false };

const GRUPOS: { valor: string; etiqueta: string }[] = [
  { valor: "pecho", etiqueta: "Pecho" },
  { valor: "espalda", etiqueta: "Espalda" },
  { valor: "piernas", etiqueta: "Piernas" },
  { valor: "hombros", etiqueta: "Hombros" },
  { valor: "brazos", etiqueta: "Brazos" },
  { valor: "core", etiqueta: "Core" },
  { valor: "cardio", etiqueta: "Cardio" },
];
const CATEGORIAS: { valor: string; etiqueta: string }[] = [
  { valor: "empuje", etiqueta: "Empuje" },
  { valor: "traccion", etiqueta: "Tracción" },
  { valor: "pierna", etiqueta: "Pierna" },
  { valor: "core", etiqueta: "Core" },
  { valor: "cardio", etiqueta: "Cardio" },
  { valor: "aislamiento", etiqueta: "Aislamiento" },
  { valor: "full_body", etiqueta: "Full body" },
];
const EQUIPOS: { valor: string; etiqueta: string }[] = [
  { valor: "barra", etiqueta: "Barra" },
  { valor: "mancuerna", etiqueta: "Mancuerna" },
  { valor: "polea", etiqueta: "Polea" },
  { valor: "maquina", etiqueta: "Máquina" },
  { valor: "smith", etiqueta: "Smith" },
  { valor: "peso_corporal", etiqueta: "Peso corporal" },
  { valor: "kettlebell", etiqueta: "Kettlebell" },
  { valor: "banda", etiqueta: "Banda" },
  { valor: "banco", etiqueta: "Banco" },
  { valor: "otro", etiqueta: "Otro" },
];

function ModalEjercicioNuevo({ onCerrar }: { onCerrar: () => void }) {
  const [state, formAction, pending] = useActionState(crearEjercicioNuevo, ESTADO_INICIAL_CREAR);
  const [previa, setPrevia] = useState<string | null>(null);
  const [previaRota, setPreviaRota] = useState(false);
  // Ver el mismo estado en ModalSubirFoto: se guarda el archivo apenas se
  // elige, no se relee del <input> recién al enviar.
  const [archivoElegido, setArchivoElegido] = useState<File | null>(null);

  useEffect(() => {
    if (state.ok) {
      const id = setTimeout(onCerrar, 900);
      return () => clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok]);

  return (
    <Overlay onCerrar={onCerrar}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-card-title text-text">Ejercicio nuevo</p>
        <button type="button" onClick={onCerrar} aria-label="Cerrar" className="text-text-tertiary">
          <X size={20} />
        </button>
      </div>

      <form
        action={(fd) => {
          if (archivoElegido) fd.set("foto", archivoElegido);
          formAction(fd);
        }}
        className="space-y-3"
      >
        {/* aspect-square y no aspect-video: tiene que coincidir con el recorte
          que hace el servidor (500x500, ver subirFotoEjercicio en actions.ts)
          y con la tarjetita de la galería (también aspect-square) — si no,
          lo que encuadrás acá no es lo que termina guardado. */}
      <label className="radius-card relative flex aspect-square w-full cursor-pointer items-center justify-center overflow-hidden border border-dashed border-border bg-surface-2">
          {previa && !previaRota ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previa}
              alt=""
              className="h-full w-full object-cover"
              onError={() => setPreviaRota(true)}
            />
          ) : (
            <span className="flex flex-col items-center gap-1 px-4 text-center text-text-tertiary">
              <Camera size={26} />
              <span className="text-caption">
                {previaRota
                  ? "No se pudo mostrar la vista previa — igual se guarda bien"
                  : "Foto (opcional, se puede subir después)"}
              </span>
            </span>
          )}
          <input
            type="file"
            name="foto"
            accept="image/*"
            // Ver comentario del mismo input en el modal de editar: sin
            // "capture" deja elegir entre cámara y galería.
            className="absolute inset-0 h-full w-full opacity-0"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setArchivoElegido(f);
              setPreviaRota(false);
              setPrevia(await generarPreview(f));
            }}
          />
        </label>

        <div className="flex items-center gap-2 text-[10px] text-text-tertiary">
          <div className="h-px flex-1 bg-border" /> o pegá el link de una imagen{" "}
          <div className="h-px flex-1 bg-border" />
        </div>
        <Input type="url" name="foto_url" placeholder="https://…" className="!py-2 text-caption" />

        <label className="block">
          <span className="text-caption mb-1 block text-text-tertiary">
            Nombre — separá variantes con &quot;/&quot; si se lo dicen distinto
          </span>
          <input
            name="nombre"
            type="text"
            required
            placeholder="Ej: Press de pecho / Bench press / Press banca"
            className="radius-control w-full border border-border bg-surface-2 px-3 py-2.5 text-secondary text-text"
          />
        </label>

        <label className="block">
          <span className="text-caption mb-1 block text-text-tertiary">Grupo muscular</span>
          <select
            name="grupo_muscular"
            required
            defaultValue=""
            className="radius-control w-full border border-border bg-surface-2 px-3 py-2.5 text-secondary text-text"
          >
            <option value="" disabled>
              Elegir...
            </option>
            {GRUPOS.map((g) => (
              <option key={g.valor} value={g.valor}>
                {g.etiqueta}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-caption mb-1 block text-text-tertiary">Categoría</span>
          <select
            name="categoria"
            required
            defaultValue=""
            className="radius-control w-full border border-border bg-surface-2 px-3 py-2.5 text-secondary text-text"
          >
            <option value="" disabled>
              Elegir...
            </option>
            {CATEGORIAS.map((c) => (
              <option key={c.valor} value={c.valor}>
                {c.etiqueta}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-caption mb-1 block text-text-tertiary">Equipo</span>
          <select
            name="equipo"
            required
            defaultValue=""
            className="radius-control w-full border border-border bg-surface-2 px-3 py-2.5 text-secondary text-text"
          >
            <option value="" disabled>
              Elegir...
            </option>
            {EQUIPOS.map((e) => (
              <option key={e.valor} value={e.valor}>
                {e.etiqueta}
              </option>
            ))}
          </select>
        </label>

        {state.error && <p className="text-caption text-error">{state.error}</p>}
        {state.ok && (
          <p className="text-caption flex items-center gap-1 text-success">
            <Check size={14} /> Ejercicio creado.
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="btn-accion radius-control flex h-11 w-full items-center justify-center gap-2 text-secondary font-semibold disabled:opacity-60"
        >
          {pending ? "Creando..." : "Crear ejercicio"}
        </button>
      </form>
    </Overlay>
  );
}
