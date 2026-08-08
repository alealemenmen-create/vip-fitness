"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
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
  obtenerUsosRutina,
  reasignarEntradaRutina,
  type UsoRutina,
} from "@/app/admin/ejercicios/actions";
import { normalizar } from "@/lib/alimentos/emparejar";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import type { Ejercicio } from "@/lib/ejercicios/tipos";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";

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
        <ModalSubirFoto
          ejercicio={editando}
          fotoActual={fotoDe(editando)}
          todosLosEjercicios={ejercicios}
          onCerrar={() => setEditando(null)}
        />
      )}
      {creando && <ModalEjercicioNuevo onCerrar={() => setCreando(false)} />}
    </div>
  );
}

const LADO_MAXIMO_FOTO = 1600;

/** Produce el único archivo que usa la app: suficientemente nítido al
 * ampliarlo y liviano para descargarlo como miniatura. Todo ocurre en el
 * teléfono; los bytes nunca pasan por Vercel. */
async function optimizarFotoEnNavegador(archivo: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(archivo, { imageOrientation: "from-image" });
    const escala = Math.min(1, LADO_MAXIMO_FOTO / Math.max(bitmap.width, bitmap.height));
    const ancho = Math.max(1, Math.round(bitmap.width * escala));
    const alto = Math.max(1, Math.round(bitmap.height * escala));
    const canvas = document.createElement("canvas");
    canvas.width = ancho;
    canvas.height = alto;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo preparar la imagen.");
    ctx.drawImage(bitmap, 0, 0, ancho, alto);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.86)
    );
    if (!blob) throw new Error("No se pudo preparar la imagen.");
    return blob;
  } catch {
    // JPEG/PNG/WebP ya son mostrables por todos los navegadores de la app.
    // Si el canvas puntual del dispositivo falla, subir el archivo original
    // sigue siendo mejor que volver al servidor que corrompía sus bytes.
    if (["image/jpeg", "image/png", "image/webp"].includes(archivo.type)) return archivo;
    throw new Error("El teléfono no pudo convertir esa foto. Elige una imagen JPG o PNG.");
  }
}

type FotoSubidaCliente = { miniaturaUrl: string; completaUrl: string };

/**
 * Vista previa inmediata y subida directa navegador → Supabase. El servidor
 * recibe solamente la URL final, nunca el archivo binario.
 */
function useFotoInmediata() {
  const [archivoElegido, setArchivoElegido] = useState<File | null>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  const [previaRota, setPreviaRota] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [fotoSubida, setFotoSubida] = useState<FotoSubidaCliente | null>(null);
  const [errorFoto, setErrorFoto] = useState<string | null>(null);
  const urlPrevia = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (urlPrevia.current) URL.revokeObjectURL(urlPrevia.current);
    };
  }, []);

  function mostrarPrevia(blob: Blob) {
    if (urlPrevia.current) URL.revokeObjectURL(urlPrevia.current);
    urlPrevia.current = URL.createObjectURL(blob);
    setPrevia(urlPrevia.current);
    setPreviaRota(false);
  }

  async function subir(archivo: File) {
    setSubiendoFoto(true);
    setErrorFoto(null);
    setFotoSubida(null);
    try {
      const fotoLista = await optimizarFotoEnNavegador(archivo);
      mostrarPrevia(fotoLista);

      const supabase = createBrowserSupabaseClient();
      const ruta = `sueltas/${crypto.randomUUID()}/foto.jpg`;
      const { error } = await supabase.storage.from("ejercicios-fotos").upload(ruta, fotoLista, {
        contentType: fotoLista.type || "image/jpeg",
        cacheControl: "31536000",
      });
      if (error) throw error;

      const url = supabase.storage.from("ejercicios-fotos").getPublicUrl(ruta).data.publicUrl;
      setFotoSubida({ miniaturaUrl: url, completaUrl: url });
    } catch (error) {
      setErrorFoto(
        error instanceof Error
          ? error.message
          : "No se pudo subir la foto. Revisa tu conexión e intenta de nuevo."
      );
    } finally {
      setSubiendoFoto(false);
    }
  }

  async function elegirArchivo(archivo: File) {
    setArchivoElegido(archivo);
    // Visible de inmediato, antes incluso de comprimir o tocar la red.
    mostrarPrevia(archivo);
    await subir(archivo);
  }

  function reintentar() {
    if (archivoElegido) void subir(archivoElegido);
  }

  return {
    archivoElegido,
    previa,
    previaRota,
    setPreviaRota,
    subiendoFoto,
    fotoSubida,
    errorFoto,
    elegirArchivo,
    reintentar,
  };
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
  todosLosEjercicios,
  onCerrar,
}: {
  ejercicio: Ejercicio;
  fotoActual: string | null;
  todosLosEjercicios: Ejercicio[];
  onCerrar: () => void;
}) {
  const [state, formAction, pending] = useActionState(subirFotoEjercicio, ESTADO_INICIAL_FOTO);
  const {
    archivoElegido,
    previa,
    previaRota,
    setPreviaRota,
    subiendoFoto,
    fotoSubida,
    errorFoto,
    elegirArchivo,
    reintentar,
  } = useFotoInmediata();

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

      {/* La tarjeta usa recorte visual cuadrado, pero el archivo conserva su
          encuadre completo para poder abrirlo ampliado. */}
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
                ? "No se pudo mostrar esta imagen. Elige una foto JPG o PNG."
                : "Toca para elegir una foto"}
            </span>
          </span>
        )}
        {/* Estado de la preparación y subida directa a Storage. */}
        {(subiendoFoto || fotoSubida || errorFoto) && (
          <span
            className={`absolute bottom-1.5 left-1.5 rounded-full px-2 py-1 text-[10px] font-medium backdrop-blur-sm ${
              errorFoto ? "bg-error/80 text-white" : "bg-black/60 text-white"
            }`}
          >
            {subiendoFoto ? "Preparando foto..." : errorFoto ? "No se pudo subir" : "✓ Lista para guardar"}
          </span>
        )}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          // Sin "capture": con ese atributo, varios navegadores de celular
          // abren la cámara directo y nunca ofrecen elegir de la galería —
          // sacándolo, el selector nativo siempre deja elegir entre sacar
          // una foto nueva o subir una que ya existe.
          className="absolute inset-0 h-full w-full opacity-0"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void elegirArchivo(f);
          }}
        />
      </label>
      {errorFoto && (
        <button
          type="button"
          onClick={reintentar}
          className="text-caption mt-1 font-medium text-vip"
        >
          Reintentar subir la foto
        </button>
      )}

      <form
        action={(fd) => {
          if (fotoSubida) {
            fd.set("foto_miniatura_url_subida", fotoSubida.miniaturaUrl);
            fd.set("foto_completa_url_subida", fotoSubida.completaUrl);
          }
          fd.set("ejercicio_id", ejercicio.id);
          formAction(fd);
        }}
        className="mt-3 space-y-2"
      >
        {/* Alternativa para una imagen que ya está publicada en otro sitio. */}
        <div className="flex items-center gap-2 text-[10px] text-text-tertiary">
          <div className="h-px flex-1 bg-border" /> o pegá el link de una imagen{" "}
          <div className="h-px flex-1 bg-border" />
        </div>
        <Input type="url" name="foto_url" placeholder="https://…" className="!py-2 text-caption" />

        {/* Corrección global explícita: esto reemplaza la foto para TODOS
            los alumnos que tengan este ejercicio bien vinculado, no solo
            para quien lo esté editando ahora — hay que dejarlo claro antes
            de guardar, no después. */}
        <p className="text-caption text-text-tertiary">
          Se va a actualizar la foto de{" "}
          <span className="font-semibold text-text">{ejercicio.nombre}</span> para todos los alumnos
          que lo tengan bien vinculado.
        </p>

        {state.error && <p className="text-caption text-error">{state.error}</p>}
        {state.ok && (
          <p className="text-caption flex items-center gap-1 text-success">
            <Check size={14} /> Foto actualizada — ya la ven los alumnos.
          </p>
        )}
        <button
          type="submit"
          disabled={pending || subiendoFoto || (!!archivoElegido && !fotoSubida)}
          className="btn-accion radius-control flex h-11 w-full items-center justify-center gap-2 text-secondary font-semibold disabled:opacity-60"
        >
          {pending ? "Guardando..." : subiendoFoto ? "Preparando la foto..." : "Guardar foto"}
        </button>
      </form>

      <div className="mt-4 border-t border-border pt-3">
        <EditorNombre ejercicio={ejercicio} />
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <EditorVideo ejercicio={ejercicio} />
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <UsosRutinaEditor ejercicio={ejercicio} todosLosEjercicios={todosLosEjercicios} />
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <BotonEliminar ejercicio={ejercicio} onEliminado={onCerrar} />
      </div>
    </Overlay>
  );
}

type ElegidoReasignar = { id: string; nombre: string };

const ESTADO_INICIAL_REASIGNAR = { error: null, ok: false };

/**
 * Para ESTE ejercicio de la biblioteca: todas las variantes de texto que hoy
 * usan su enlace en rutinas de alumnos (ver `obtenerUsosRutina`) — y deja
 * corregir un enlace mal hecho SIN tocar la foto de nadie (ver
 * `reasignarEntradaRutina` en actions.ts).
 *
 * Caso real que resuelve: "Press de hombro" quedó vinculado por error al
 * registro de "Press de banca" — acá aparece listado bajo Press de banca, y
 * se puede reasignar hacia el ejercicio correcto sin arriesgar la foto de
 * los alumnos que sí tienen el press de banca bien vinculado.
 */
function UsosRutinaEditor({
  ejercicio,
  todosLosEjercicios,
}: {
  ejercicio: Ejercicio;
  todosLosEjercicios: Ejercicio[];
}) {
  const [usos, setUsos] = useState<UsoRutina[] | null>(null);

  useEffect(() => {
    let cancelado = false;
    obtenerUsosRutina(ejercicio.id).then((resultado) => {
      if (!cancelado) setUsos(resultado);
    });
    return () => {
      cancelado = true;
    };
  }, [ejercicio.id]);

  if (usos === null) {
    return <p className="text-caption text-text-tertiary">Revisando entradas de rutina...</p>;
  }
  if (usos.length === 0) return null;

  return (
    <div className="space-y-2">
      <span className="text-caption block text-text-tertiary">
        Entradas de rutina que usan esta ficha — si alguna en realidad es OTRO ejercicio, reasignala sin
        tocar esta foto
      </span>
      <div className="space-y-1.5">
        {usos.map((uso) => (
          <UsoRutinaFila
            key={uso.nombre}
            ejercicio={ejercicio}
            uso={uso}
            todosLosEjercicios={todosLosEjercicios}
            onReasignado={() => setUsos((prev) => (prev ? prev.filter((u) => u.nombre !== uso.nombre) : prev))}
          />
        ))}
      </div>
    </div>
  );
}

function UsoRutinaFila({
  ejercicio,
  uso,
  todosLosEjercicios,
  onReasignado,
}: {
  ejercicio: Ejercicio;
  uso: UsoRutina;
  todosLosEjercicios: Ejercicio[];
  onReasignado: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [elegido, setElegido] = useState<ElegidoReasignar | null>(null);
  const [state, formAction, pending] = useActionState(reasignarEntradaRutina, ESTADO_INICIAL_REASIGNAR);

  useEffect(() => {
    if (state.ok) onReasignado();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok]);

  const resultados = useMemo(() => {
    const q = normalizar(busqueda);
    if (!q) return [];
    return todosLosEjercicios
      .filter((e) => e.id !== ejercicio.id)
      .filter((e) => normalizar(e.nombre).includes(q) || e.aliases.some((a) => normalizar(a).includes(q)))
      .slice(0, 6);
  }, [busqueda, todosLosEjercicios, ejercicio.id]);

  return (
    <div className="radius-control border border-border p-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-caption text-text">
          <span className="font-semibold">«{uso.nombre}»</span> — {uso.cantidad}{" "}
          {uso.cantidad === 1 ? "vez" : "veces"} en rutinas
        </p>
        {!abierto && (
          <button
            type="button"
            onClick={() => setAbierto(true)}
            className="shrink-0 text-[10px] font-medium text-vip"
          >
            ¿No es este?
          </button>
        )}
      </div>

      {abierto && !elegido && (
        <div className="mt-2 space-y-1.5">
          <input
            type="text"
            autoFocus
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar el ejercicio correcto..."
            className="radius-control w-full border border-border bg-surface px-2 py-1.5 text-caption text-text"
          />
          {resultados.length > 0 && (
            <div className="max-h-40 space-y-0.5 overflow-y-auto">
              {resultados.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setElegido({ id: r.id, nombre: r.nombre })}
                  className="block w-full rounded px-2 py-1.5 text-left text-caption text-text hover:bg-surface-2"
                >
                  {r.nombre}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setElegido({ id: "", nombre: "sin vincular todavía" })}
              className="text-[10px] text-text-tertiary underline"
            >
              No existe todavía — desvincular sin foto por ahora
            </button>
            <button
              type="button"
              onClick={() => {
                setAbierto(false);
                setBusqueda("");
              }}
              className="text-[10px] text-text-tertiary"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {elegido && (
        <form action={formAction} className="radius-control mt-2 space-y-1.5 border border-vip/40 bg-vip/5 p-2">
          <input type="hidden" name="ejercicio_id_actual" value={ejercicio.id} />
          <input type="hidden" name="nombre_exacto" value={uso.nombre} />
          <input type="hidden" name="ejercicio_id_nuevo" value={elegido.id} />
          <p className="text-caption text-text">
            Se van a mover las {uso.cantidad} entrada{uso.cantidad === 1 ? "" : "s"} «{uso.nombre}» de{" "}
            <span className="font-semibold">{ejercicio.nombre}</span> hacia{" "}
            <span className="font-semibold">{elegido.nombre}</span>. No se toca ninguna foto.
          </p>
          {state.error && <p className="text-caption text-error">{state.error}</p>}
          <div className="flex gap-2">
            <Button type="submit" size="xsAuto" loading={pending}>
              Confirmar
            </Button>
            <Button type="button" variant="ghost" size="xsAuto" onClick={() => setElegido(null)}>
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </div>
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
  const {
    archivoElegido,
    previa,
    previaRota,
    setPreviaRota,
    subiendoFoto,
    fotoSubida,
    errorFoto,
    elegirArchivo,
    reintentar,
  } = useFotoInmediata();

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
          if (fotoSubida) {
            fd.set("foto_miniatura_url_subida", fotoSubida.miniaturaUrl);
            fd.set("foto_completa_url_subida", fotoSubida.completaUrl);
          }
          formAction(fd);
        }}
        className="space-y-3"
      >
        {/* La misma foto sirve como tarjeta cuadrada y vista ampliada. */}
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
                  ? "No se pudo mostrar esta imagen. Elige una foto JPG o PNG."
                  : "Foto (opcional, se puede subir después)"}
              </span>
            </span>
          )}
          {(subiendoFoto || fotoSubida || errorFoto) && (
            <span
              className={`absolute bottom-1.5 left-1.5 rounded-full px-2 py-1 text-[10px] font-medium backdrop-blur-sm ${
                errorFoto ? "bg-error/80 text-white" : "bg-black/60 text-white"
              }`}
            >
              {subiendoFoto ? "Preparando foto..." : errorFoto ? "No se pudo subir" : "✓ Lista para guardar"}
            </span>
          )}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            // Ver comentario del mismo input en el modal de editar: sin
            // "capture" deja elegir entre cámara y galería.
            className="absolute inset-0 h-full w-full opacity-0"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void elegirArchivo(f);
            }}
          />
        </label>
        {errorFoto && (
          <button type="button" onClick={reintentar} className="text-caption font-medium text-vip">
            Reintentar subir la foto
          </button>
        )}

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
          disabled={pending || subiendoFoto || (!!archivoElegido && !fotoSubida)}
          className="btn-accion radius-control flex h-11 w-full items-center justify-center gap-2 text-secondary font-semibold disabled:opacity-60"
        >
          {pending ? "Creando..." : subiendoFoto ? "Esperando la foto..." : "Crear ejercicio"}
        </button>
      </form>
    </Overlay>
  );
}
