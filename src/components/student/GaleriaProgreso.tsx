"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { subirFotoProgreso, eliminarFotoProgreso, type FormState } from "@/app/alumno/progreso/actions";
import type { QuincenaGaleria } from "@/lib/progreso/galeria-quincenal";
import { formatFechaCorta, hoyISO } from "@/lib/date";
import { comprimirImagen } from "@/lib/comprimirImagen";

const initialState: FormState = { error: null, ok: false };

function formatoKB(bytes: number) {
  return `${Math.round(bytes / 1024)} KB`;
}

function rangoQuincena(quincena: QuincenaGaleria) {
  return `${formatFechaCorta(quincena.inicio)} – ${formatFechaCorta(quincena.fin)}`;
}

/**
 * Galería quincenal de fotos de progreso (pedido de Alejandro,
 * 2026-08-16: "semanal es muy pronto para ver resultados" — el físico
 * cambia más despacio que el peso, que se queda semanal). Una foto cada 15
 * días en vez de "primera/actual": el alumno sube su foto de la quincena en
 * curso; si no la sube, esa quincena queda sin foto para siempre y arranca
 * la siguiente. Solo la quincena actual se puede subir/borrar; las
 * anteriores quedan fijas.
 *
 * Tres piezas, de arriba abajo:
 * 1. Antes/Después: comparación con las dos fotos más lejanas en el
 *    tiempo. "Antes" se puede cambiar a cualquier quincena con foto;
 *    "después" siempre es la más reciente.
 * 2. Historial: álbum horizontal con TODAS las quincenas anteriores, con
 *    foto o marcadas "sin foto" — nunca se ocultan los huecos.
 * 3. Esta quincena: la única editable, con su propia acción grande.
 */
export function GaleriaProgreso({
  quincenas,
  soloLectura = false,
}: {
  quincenas: QuincenaGaleria[];
  soloLectura?: boolean;
}) {
  const actual = quincenas[quincenas.length - 1];
  const anteriores = quincenas.slice(0, -1);

  return (
    <div className="space-y-3">
      <AntesDespues quincenas={quincenas} />
      {anteriores.length > 0 && <HistorialQuincenal quincenas={anteriores} />}
      <EstaQuincena quincena={actual} soloLectura={soloLectura} />
    </div>
  );
}

function AntesDespues({ quincenas }: { quincenas: QuincenaGaleria[] }) {
  const conFoto = quincenas.filter(
    (q): q is QuincenaGaleria & { foto: NonNullable<QuincenaGaleria["foto"]> } => q.foto !== null
  );
  const [antesInicio, setAntesInicio] = useState<string | null>(null);
  const [selectorAbierto, setSelectorAbierto] = useState(false);

  // Menos de dos fotos: no hay nada que comparar todavía.
  if (conFoto.length < 2) return null;

  const despues = conFoto[conFoto.length - 1];
  const antes = conFoto.find((q) => q.inicio === antesInicio) ?? conFoto[0];

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
            <div className="selector-periodo-antes">
              {conFoto.slice(0, -1).map((q) => (
                <button
                  key={q.inicio}
                  type="button"
                  onClick={() => {
                    setAntesInicio(q.inicio);
                    setSelectorAbierto(false);
                  }}
                  data-elegida={q.inicio === antes.inicio ? "true" : undefined}
                >
                  {rangoQuincena(q)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <FotoComparacion etiqueta="Antes" texto={rangoQuincena(antes)} url={antes.foto.url} />
        <FotoComparacion etiqueta="Después" texto={rangoQuincena(despues)} url={despues.foto.url} />
      </div>
    </div>
  );
}

function FotoComparacion({ etiqueta, texto, url }: { etiqueta: string; texto: string; url: string | null }) {
  return (
    <div className="tarjeta-comparacion-periodo radius-card relative aspect-square overflow-hidden">
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

/** Álbum horizontal: se desliza con el dedo, arranca mostrando la quincena
 * más reciente (la que está justo antes de la actual) para no obligar a
 * arrastrar desde el principio de la historia cada vez que se abre. */
function HistorialQuincenal({ quincenas }: { quincenas: QuincenaGaleria[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const nodo = scrollRef.current;
    if (nodo) nodo.scrollLeft = nodo.scrollWidth;
  }, []);

  return (
    <div className="space-y-1.5">
      <p className="text-caption font-semibold text-text-tertiary">Historial quincenal</p>
      <div ref={scrollRef} className="historial-quincenal-scroll">
        {quincenas.map((quincena) => (
          <TarjetaQuincenaHistorial key={quincena.inicio} quincena={quincena} />
        ))}
      </div>
    </div>
  );
}

function TarjetaQuincenaHistorial({ quincena }: { quincena: QuincenaGaleria }) {
  return (
    <div className="tarjeta-quincena-historial" data-vacia={quincena.foto ? undefined : "true"}>
      {quincena.foto?.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={quincena.foto.url} alt={`Quincena del ${rangoQuincena(quincena)}`} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-2 text-center">
          <p className="text-micro text-text-tertiary">Sin foto</p>
        </div>
      )}
      <div className="tarjeta-quincena-historial-etiqueta">{rangoQuincena(quincena)}</div>
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
      {pending ? "Subiendo…" : "Subir foto de esta quincena"}
    </button>
  );
}

/** La única quincena con acción: subir si está vacía, o ver + borrar si ya
 * tiene foto. Reemplaza a las viejas "Primera foto"/"Foto actual". */
function EstaQuincena({ quincena, soloLectura }: { quincena: QuincenaGaleria; soloLectura: boolean }) {
  if (soloLectura) {
    return (
      <div className="space-y-2">
        <p className="text-caption text-center text-text-tertiary">ESTA QUINCENA · {rangoQuincena(quincena)}</p>
        {quincena.foto?.url ? (
          <div className="radius-card relative mx-auto aspect-square w-full max-w-[220px] overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={quincena.foto.url} alt="Foto de esta quincena" className="h-full w-full object-cover" />
          </div>
        ) : (
          <div className="radius-card mx-auto flex aspect-square w-full max-w-[220px] items-center justify-center border border-dashed border-white/[0.12]">
            <p className="text-caption text-center text-text-tertiary">Sin foto</p>
          </div>
        )}
      </div>
    );
  }

  return quincena.foto ? (
    <EstaQuincenaConFoto quincena={quincena} />
  ) : (
    <EstaQuincenaVacia quincena={quincena} />
  );
}

function EstaQuincenaConFoto({ quincena }: { quincena: QuincenaGaleria }) {
  const foto = quincena.foto!;
  return (
    <div className="space-y-2">
      <p className="text-caption text-center text-text-tertiary">ESTA QUINCENA · {rangoQuincena(quincena)}</p>
      <div className="radius-card relative mx-auto aspect-square w-full max-w-[220px] overflow-hidden">
        {foto.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={foto.url} alt="Foto de esta quincena" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-surface-2">
            <p className="text-caption text-text-tertiary">Sin vista previa</p>
          </div>
        )}
        <button
          onClick={() => void eliminarFotoProgreso(foto.id)}
          aria-label="Borrar foto de esta quincena"
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full"
          style={{ background: "rgba(0,0,0,0.7)" }}
        >
          <Trash2 size={14} className="text-error" />
        </button>
      </div>
      <p className="text-micro text-center text-text-tertiary">
        Puedes borrarla y subir otra mientras la quincena siga abierta.
      </p>
    </div>
  );
}

function EstaQuincenaVacia({ quincena }: { quincena: QuincenaGaleria }) {
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
      <p className="text-caption text-center text-text-tertiary">ESTA QUINCENA · {rangoQuincena(quincena)}</p>
      <form action={enviar} className="radius-card mx-auto w-full max-w-[220px] space-y-2 border border-dashed border-white/[0.14] p-3">
        <label
          htmlFor="foto-quincena-actual"
          className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg"
        >
          <Plus size={22} className="text-text-secondary" />
          <span className="text-caption px-1 text-center text-text-tertiary">
            {archivoListo ? archivoListo.name : "Elige tu foto de esta quincena"}
          </span>
          <input
            id="foto-quincena-actual"
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
            otra dentro de esta quincena también pasaría la validación del
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
