"use client";

import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { idDeYoutube } from "@/lib/ejercicios/video";

/**
 * Reproductor de video de referencia — YouTube (embebido) o un archivo de
 * video directo (`<video>` nativo). Mismo look que el visor de foto ampliada
 * (`FotoReferenciaAmpliable` en SesionEjercicioCard.tsx): fondo oscuro a toda
 * pantalla, tocar afuera cierra.
 */
export function ModalVideo({
  videoUrl,
  nombre,
  onCerrar,
}: {
  videoUrl: string;
  nombre: string;
  onCerrar: () => void;
}) {
  const idYoutube = idDeYoutube(videoUrl);

  return createPortal(
    <div
      role="dialog"
      aria-label={`Video de referencia de ${nombre}`}
      onClick={onCerrar}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/90 p-4 animate-visor-fondo"
    >
      <div
        className="relative aspect-video w-full max-w-md animate-visor-foto"
        onClick={(e) => e.stopPropagation()}
      >
        {idYoutube ? (
          <iframe
            src={`https://www.youtube.com/embed/${idYoutube}?autoplay=1&playsinline=1`}
            title={`Video de referencia de ${nombre}`}
            className="h-full w-full rounded-xl"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <video
            src={videoUrl}
            controls
            autoPlay
            playsInline
            className="h-full w-full rounded-xl bg-black object-contain"
          />
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
