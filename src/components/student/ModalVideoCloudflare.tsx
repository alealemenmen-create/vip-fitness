"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { obtenerVideoCloudflareEjercicio } from "@/app/alumno/entrenar/video-actions";

/**
 * Reproductor a pantalla completa para un video de Cloudflare Stream — se
 * pide en modo "completo" (con controles, con sonido, sin bucle): el
 * Tanto la reproducción automática como este visor priorizan que se vea el
 * movimiento completo — cabeza y pies incluidos — sobre llenar el cuadro.
 * Este modal agrega controles y sonido para una revisión detenida.
 */
export function ModalVideoCloudflare({
  ejercicioId,
  nombre,
  onCerrar,
}: {
  ejercicioId: string;
  nombre: string;
  onCerrar: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    void obtenerVideoCloudflareEjercicio(ejercicioId, "completo").then((resultado) => {
      if (!vigente) return;
      if (resultado.ok) setUrl(resultado.url);
      else setError(resultado.error);
    });
    return () => {
      vigente = false;
    };
  }, [ejercicioId]);

  return createPortal(
    <div
      role="dialog"
      aria-label={`Video de referencia de ${nombre}`}
      onClick={onCerrar}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/90 p-4 animate-visor-fondo"
    >
      <div className="relative aspect-video w-full max-w-md animate-visor-foto" onClick={(e) => e.stopPropagation()}>
        {url ? (
          <iframe
            src={url}
            title={`Video de referencia de ${nombre}`}
            className="h-full w-full rounded-xl"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        ) : error ? (
          <p className="flex h-full items-center justify-center px-4 text-center text-caption text-white/70">{error}</p>
        ) : (
          <p className="flex h-full items-center justify-center text-caption text-white/50">Cargando…</p>
        )}
      </div>
      <p className="text-caption text-white/70">{nombre}</p>
      <button
        type="button"
        onClick={onCerrar}
        aria-label="Cerrar video"
        className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white"
      >
        <X size={20} />
      </button>
    </div>,
    document.body
  );
}
