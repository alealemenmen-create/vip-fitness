"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { subirFotoProgreso, eliminarFotoProgreso, type FormState } from "@/app/alumno/progreso/actions";
import type { SemanaGaleria } from "@/lib/progreso/galeria-semanal";
import { formatFechaCorta, hoyISO } from "@/lib/date";
import { comprimirImagen } from "@/lib/comprimirImagen";

const initialState: FormState = { error: null, ok: false };

function formatoKB(bytes: number) {
  return `${Math.round(bytes / 1024)} KB`;
}

function rangoSemana(semana: SemanaGaleria) {
  return `${formatFechaCorta(semana.lunes)} – ${formatFechaCorta(semana.domingo)}`;
}

/**
 * Galería semanal de fotos de progreso (pedido de Alejandro, 2026-08-16):
 * una foto por semana en vez de "primera/actual" — el alumno sube su foto
 * de la semana en curso; si no la sube, esa semana queda sin foto para
 * siempre y arranca la siguiente. Solo la semana actual se puede
 * subir/borrar; las anteriores quedan fijas.
 *
 * Tres piezas, de arriba abajo:
 * 1. Antes/Después: comparación con las dos fotos más lejanas en el
 *    tiempo. "Antes" se puede cambiar a cualquier semana con foto;
 *    "después" siempre es la más reciente.
 * 2. Historial: álbum horizontal con TODAS las semanas anteriores, con
 *    foto o marcadas "sin foto" — nunca se ocultan los huecos.
 * 3. Esta semana: la única semana editable, con su propia acción grande.
 */
export function GaleriaProgreso({
  semanas,
  soloLectura = false,
}: {
  semanas: SemanaGaleria[];
  soloLectura?: boolean;
}) {
  const actual = semanas[semanas.length - 1];
  const anteriores = semanas.slice(0, -1);

  return (
    <div className="space-y-3">
      <AntesDespues semanas={semanas} />
      {anteriores.length > 0 && <HistorialSemanal semanas={anteriores} />}
      <EstaSemana semana={actual} soloLectura={soloLectura} />
    </div>
  );
}

function AntesDespues({ semanas }: { semanas: SemanaGaleria[] }) {
  const conFoto = semanas.filter((s): s is SemanaGaleria & { foto: NonNullable<SemanaGaleria["foto"]> } => s.foto !== null);
  const [antesLunes, setAntesLunes] = useState<string | null>(null);
  const [selectorAbierto, setSelectorAbierto] = useState(false);

  // Menos de dos fotos: no hay nada que comparar todavía.
  if (conFoto.length < 2) return null;

  const despues = conFoto[conFoto.length - 1];
  const antes = conFoto.find((s) => s.lunes === antesLunes) ?? conFoto[0];

  return (
    <div className="galeria-antes-despues">
      <div className="galeria-antes-despues-cabecera">
        <p className="text-caption font-semibold text-text">Antes y después</p>
        <div className="relative">
          <button
            type="button"
            onClick={() => setSelectorAbierto((v) => !v)}
            className="boton-cambiar-antes"
          >
            Cambiar «antes» <ChevronDown size={12} className={selectorAbierto ? "rotate-180" : ""} />
          </button>
          {selectorAbierto && (
            <div className="selector-semana-antes">
              {conFoto.slice(0, -1).map((s) => (
                <button
                  key={s.lunes}
                  type="button"
                  onClick={() => {
                    setAntesLunes(s.lunes);
                    setSelectorAbierto(false);
                  }}
                  data-elegida={s.lunes === antes.lunes ? "true" : undefined}
                >
                  {rangoSemana(s)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <FotoComparacion etiqueta="Antes" texto={rangoSemana(antes)} url={antes.foto.url} />
        <FotoComparacion etiqueta="Después" texto={rangoSemana(despues)} url={despues.foto.url} />
      </div>
    </div>
  );
}

function FotoComparacion({ etiqueta, texto, url }: { etiqueta: string; texto: string; url: string | null }) {
  return (
    <div className="tarjeta-comparacion-semana radius-card relative aspect-square overflow-hidden">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={etiqueta} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-surface-2">
          <p className="text-caption text-text-tertiary">Sin vista previa</p>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-black/70 p-2">
        <p className="text-micro font-semibold uppercase tracking-wide text-text">{etiqueta}</p>
        <p className="text-micro text-text-secondary">{texto}</p>
      </div>
    </div>
  );
}

/** Álbum horizontal: se desliza con el dedo, arranca mostrando la semana
 * más reciente (la que está justo antes de la actual) para no obligar a
 * arrastrar desde el principio de la historia cada vez que se abre. */
function HistorialSemanal({ semanas }: { semanas: SemanaGaleria[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const nodo = scrollRef.current;
    if (nodo) nodo.scrollLeft = nodo.scrollWidth;
  }, []);

  return (
    <div className="space-y-1.5">
      <p className="text-caption font-semibold text-text-tertiary">Historial semanal</p>
      <div ref={scrollRef} className="historial-semanal-scroll">
        {semanas.map((semana) => (
          <TarjetaSemanaHistorial key={semana.lunes} semana={semana} />
        ))}
      </div>
    </div>
  );
}

function TarjetaSemanaHistorial({ semana }: { semana: SemanaGaleria }) {
  return (
    <div className="tarjeta-semana-historial" data-vacia={semana.foto ? undefined : "true"}>
      {semana.foto?.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={semana.foto.url} alt={`Semana del ${rangoSemana(semana)}`} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-2 text-center">
          <p className="text-micro text-text-tertiary">Sin foto</p>
        </div>
      )}
      <div className="tarjeta-semana-historial-etiqueta">{rangoSemana(semana)}</div>
    </div>
  );
}

function BotonSubir({ deshabilitado }: { deshabilitado: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || deshabilitado}
      className="boton-entrenar-tarjeta radius-control text-secondary w-full py-2.5 font-medium disabled:opacity-40"
    >
      {pending ? "Subiendo…" : "Subir foto de esta semana"}
    </button>
  );
}

/** La única semana con acción: subir si está vacía, o ver + borrar si ya
 * tiene foto. Reemplaza a las viejas "Primera foto"/"Foto actual". */
function EstaSemana({ semana, soloLectura }: { semana: SemanaGaleria; soloLectura: boolean }) {
  if (soloLectura) {
    return (
      <div className="space-y-2">
        <p className="text-caption text-center text-text-tertiary">ESTA SEMANA · {rangoSemana(semana)}</p>
        {semana.foto?.url ? (
          <div className="radius-card relative mx-auto aspect-square w-full max-w-[220px] overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={semana.foto.url} alt="Foto de esta semana" className="h-full w-full object-cover" />
          </div>
        ) : (
          <div className="radius-card mx-auto flex aspect-square w-full max-w-[220px] items-center justify-center border border-dashed border-white/[0.12]">
            <p className="text-caption text-center text-text-tertiary">Sin foto</p>
          </div>
        )}
      </div>
    );
  }

  return semana.foto ? (
    <EstaSemanaConFoto semana={semana} />
  ) : (
    <EstaSemanaVacia semana={semana} />
  );
}

function EstaSemanaConFoto({ semana }: { semana: SemanaGaleria }) {
  const foto = semana.foto!;
  return (
    <div className="space-y-2">
      <p className="text-caption text-center text-text-tertiary">ESTA SEMANA · {rangoSemana(semana)}</p>
      <div className="radius-card relative mx-auto aspect-square w-full max-w-[220px] overflow-hidden">
        {foto.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={foto.url} alt="Foto de esta semana" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-surface-2">
            <p className="text-caption text-text-tertiary">Sin vista previa</p>
          </div>
        )}
        <button
          onClick={() => eliminarFotoProgreso(foto.id, foto.storagePath)}
          aria-label="Borrar foto de esta semana"
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full"
          style={{ background: "rgba(0,0,0,0.7)" }}
        >
          <Trash2 size={14} className="text-error" />
        </button>
      </div>
      <p className="text-micro text-center text-text-tertiary">
        Puedes borrarla y subir otra mientras la semana siga abierta.
      </p>
    </div>
  );
}

function EstaSemanaVacia({ semana }: { semana: SemanaGaleria }) {
  const [state, formAction] = useActionState(subirFotoProgreso, initialState);
  const [archivoListo, setArchivoListo] = useState<File | null>(null);
  const [comprimiendo, setComprimiendo] = useState(false);
  const [tamanos, setTamanos] = useState<{ original: number; final: number } | null>(null);
  const [esHeicSinComprimir, setEsHeicSinComprimir] = useState(false);
  const hoy = hoyISO();

  const elegirArchivo = async (file: File | undefined) => {
    if (!file) {
      setArchivoListo(null);
      setTamanos(null);
      setEsHeicSinComprimir(false);
      return;
    }
    setComprimiendo(true);
    const comprimido = await comprimirImagen(file);
    const extension = file.name.split(".").pop()?.toLowerCase();
    const esHeic = extension === "heic" || extension === "heif";
    setArchivoListo(comprimido);
    setTamanos({ original: file.size, final: comprimido.size });
    setEsHeicSinComprimir(esHeic && comprimido.size === file.size);
    setComprimiendo(false);
  };

  const enviar = (formData: FormData) => {
    if (archivoListo) formData.set("archivo", archivoListo);
    formAction(formData);
    setArchivoListo(null);
    setTamanos(null);
    setEsHeicSinComprimir(false);
  };

  return (
    <div className="space-y-2">
      <p className="text-caption text-center text-text-tertiary">ESTA SEMANA · {rangoSemana(semana)}</p>
      <form action={enviar} className="radius-card mx-auto w-full max-w-[220px] space-y-2 border border-dashed border-white/[0.14] p-3">
        <label
          htmlFor="foto-semana-actual"
          className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg"
        >
          <Plus size={22} className="text-text-secondary" />
          <span className="text-caption px-1 text-center text-text-tertiary">
            {archivoListo ? archivoListo.name : "Elige tu foto de esta semana"}
          </span>
          <input
            id="foto-semana-actual"
            name="archivo-input"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            className="hidden"
            onChange={(e) => elegirArchivo(e.target.files?.[0])}
          />
        </label>
        {comprimiendo && <p className="text-caption text-center text-text-tertiary">Comprimiendo…</p>}
        {tamanos && !comprimiendo && esHeicSinComprimir && (
          <p className="text-caption text-center text-text-tertiary">
            HEIC ({formatoKB(tamanos.original)}) — se optimizará al subirla.
          </p>
        )}
        {tamanos && !comprimiendo && !esHeicSinComprimir && (
          <p className="text-caption text-center text-success">
            {formatoKB(tamanos.original)} → {formatoKB(tamanos.final)}
          </p>
        )}
        {/* Sin selector de fecha: la única fecha válida es hoy — cualquier
            otra dentro de esta semana también pasaría la validación del
            servidor, pero exponer el campo solo invitaba a confundirse con
            el viejo flujo de "foto de antes", que ya no existe acá. */}
        <input type="hidden" name="fecha_foto" value={hoy} />
        {state.error && <p className="text-caption text-error">{state.error}</p>}
        {state.ok && state.aviso && (
          <p className="text-caption text-center text-text-secondary">{state.aviso}</p>
        )}
        {state.ok && state.puntos ? (
          <p className="text-caption text-center font-semibold text-vip">+{state.puntos} Puntos VIP</p>
        ) : null}
        <BotonSubir deshabilitado={comprimiendo || !archivoListo} />
      </form>
    </div>
  );
}
