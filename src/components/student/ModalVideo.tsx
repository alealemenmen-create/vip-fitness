"use client";

import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { FuenteVideo } from "@/lib/ejercicios/video";

/**
 * Reproductor de video de referencia. La decisión de QUÉ mostrar (Cloudflare
 * Stream, YouTube embebido, o un archivo directo) ya viene resuelta desde
 * `resolverFuenteVideo` (lib/ejercicios/video.ts) — este componente solo
 * sabe pintar un `FuenteVideo`, no conoce las prioridades entre orígenes.
 *
 * Mismo look que el visor de foto ampliada (`FotoReferenciaAmpliable` en
 * SesionEjercicioCard.tsx): fondo oscuro a toda pantalla, tocar afuera
 * cierra.
 */
export function ModalVideo({
  fuente,
  nombre,
  onCerrar,
}: {
  fuente: FuenteVideo;
  nombre: string;
  onCerrar: () => void;
}) {
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
        {fuente.tipo === "iframe" ? (
          <iframe
            src={fuente.src}
            title={`Video de referencia de ${nombre}`}
            className="h-full w-full rounded-xl"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <video
            src={fuente.src}
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
