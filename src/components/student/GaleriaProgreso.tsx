"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { subirFotoProgreso, eliminarFotoProgreso, type FormState } from "@/app/alumno/progreso/actions";
import type { FotoProgreso } from "@/app/alumno/progreso/data";
import { hoyISO } from "@/lib/date";
import { comprimirImagen } from "@/lib/comprimirImagen";

const initialState: FormState = { error: null, ok: false };

function formatoKB(bytes: number) {
  return `${Math.round(bytes / 1024)} KB`;
}

function BotonSubir({ deshabilitado }: { deshabilitado: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || deshabilitado}
      className="radius-control text-secondary w-full bg-vip py-2.5 font-medium text-black disabled:opacity-40"
    >
      {pending ? "Subiendo…" : "Subir foto"}
    </button>
  );
}

function EspacioVacio({ id, etiqueta }: { id: string; etiqueta: string }) {
  const [state, formAction] = useActionState(subirFotoProgreso, initialState);
  const [archivoListo, setArchivoListo] = useState<File | null>(null);
  const [comprimiendo, setComprimiendo] = useState(false);
  const [tamanos, setTamanos] = useState<{ original: number; final: number } | null>(null);
  const [esHeicSinComprimir, setEsHeicSinComprimir] = useState(false);

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
      <p className="text-caption text-center text-text-tertiary">{etiqueta.toUpperCase()}</p>
      <form action={enviar} className="radius-card space-y-2 border border-dashed border-border p-3">
        <label
          htmlFor={id}
          className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg"
        >
          <Plus size={22} className="text-text-secondary" />
          <span className="text-caption px-1 text-center text-text-tertiary">
            {archivoListo ? archivoListo.name : "Elige una foto"}
          </span>
          <input
            id={id}
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
        {/* Rotulado a propósito: sin la pregunta, el campo parecía decoración
            y las fotos "de antes" quedaban todas con la fecha de subida. */}
        <label className="block">
          <span className="text-caption text-text-tertiary">¿Qué día te sacaste esta foto?</span>
          <input
            name="fecha_foto"
            type="date"
            defaultValue={hoyISO()}
            max={hoyISO()}
            className="radius-control mt-1 w-full border border-border bg-surface-2 px-2 py-2 text-caption text-text outline-none focus:border-vip"
          />
        </label>
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

function EspacioConFoto({
  etiqueta,
  foto,
  soloLectura,
}: {
  etiqueta: string;
  foto: FotoProgreso;
  soloLectura: boolean;
}) {
  return (
    <div className="space-y-2">
      <p className="text-caption text-center text-text-tertiary">{etiqueta.toUpperCase()}</p>
      <div className="radius-card relative aspect-square overflow-hidden">
        {foto.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={foto.url} alt={etiqueta} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-surface-2">
            <p className="text-caption text-text-tertiary">Sin vista previa</p>
          </div>
        )}
        {!soloLectura && (
          <button
            onClick={() => eliminarFotoProgreso(foto.id, foto.storagePath)}
            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full"
            style={{ background: "rgba(0,0,0,0.7)" }}
          >
            <Trash2 size={14} className="text-error" />
          </button>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-black/70 p-2">
          <p className="text-caption text-center text-text">{foto.fechaFoto}</p>
        </div>
      </div>
    </div>
  );
}

function EspacioSinFoto({ etiqueta }: { etiqueta: string }) {
  return (
    <div className="space-y-2">
      <p className="text-caption text-center text-text-tertiary">{etiqueta.toUpperCase()}</p>
      <div className="radius-card flex aspect-square items-center justify-center border border-dashed border-border">
        <p className="text-caption text-center text-text-tertiary">Sin foto</p>
      </div>
    </div>
  );
}

export function GaleriaProgreso({
  fotos,
  soloLectura = false,
}: {
  fotos: FotoProgreso[];
  soloLectura?: boolean;
}) {
  const primera = fotos[0];
  const actual = fotos.length > 1 ? fotos[fotos.length - 1] : undefined;

  return (
    <Card className="efecto-3d">
      <p className="text-caption mb-3 text-text-tertiary">GALERÍA PRIVADA</p>
      <div className="grid grid-cols-2 gap-3">
        {primera ? (
          <EspacioConFoto etiqueta="Primera foto" foto={primera} soloLectura={soloLectura} />
        ) : soloLectura ? (
          <EspacioSinFoto etiqueta="Primera foto" />
        ) : (
          <EspacioVacio id="foto-primera" etiqueta="Primera foto" />
        )}
        {actual ? (
          <EspacioConFoto etiqueta="Foto actual" foto={actual} soloLectura={soloLectura} />
        ) : soloLectura ? (
          <EspacioSinFoto etiqueta="Foto actual" />
        ) : (
          <EspacioVacio id="foto-actual" etiqueta="Foto actual" />
        )}
      </div>
      {primera && !actual && (
        <p className="text-caption mt-3 text-center text-text-tertiary">
          Cuando quieras comparar tu progreso, sube tu foto actual en el segundo espacio.
        </p>
      )}
    </Card>
  );
}
