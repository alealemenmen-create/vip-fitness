"use client";

import { startTransition, useEffect, useState } from "react";
import { obtenerVideoCloudflareEjercicio } from "@/app/alumno/entrenar/video-actions";

/** El cuadro de referencia es 16:9 (ver `CuadroFotoReferencia`, `destacado`). */
const ASPECTO_CUADRO = 16 / 9;

/**
 * Cuánto hay que agrandar el iframe (desde su centro) para que el video
 * llene el cuadro 16:9 sin franjas — mismo objetivo que `object-fit: cover`
 * en una foto, pero el reproductor de Cloudflare corre en un iframe de otro
 * origen: no se le puede aplicar `object-fit` desde afuera, así que en vez de
 * eso se agranda el iframe entero y el contenedor (`overflow-hidden`) recorta
 * lo que sobra arriba/abajo o a los costados.
 */
function calcularEscalaDeCobertura(ancho: number | null, alto: number | null): number {
  if (!ancho || !alto) return 1;
  const aspectoVideo = ancho / alto;
  return Math.max(ASPECTO_CUADRO / aspectoVideo, aspectoVideo / ASPECTO_CUADRO);
}

export function VideoCloudflareAutomatico({
  ejercicioId,
  activo,
  nombre,
}: {
  ejercicioId: string | null | undefined;
  activo: boolean;
  nombre: string;
}) {
  const [video, setVideo] = useState<{ ejercicioId: string; url: string; ancho: number | null; alto: number | null } | null>(null);

  useEffect(() => {
    let vigente = true;
    if (!activo || !ejercicioId) {
      return () => { vigente = false; };
    }
    startTransition(() => {
      void obtenerVideoCloudflareEjercicio(ejercicioId).then((resultado) => {
        if (vigente && resultado.ok) {
          setVideo({ ejercicioId, url: resultado.url, ancho: resultado.ancho, alto: resultado.alto });
        }
      });
    });
    return () => { vigente = false; };
  }, [activo, ejercicioId]);

  if (!activo || !ejercicioId || video?.ejercicioId !== ejercicioId) return null;
  const escala = calcularEscalaDeCobertura(video.ancho, video.alto);
  return (
    <iframe
      src={video.url}
      title={`Demostración automática de ${nombre}`}
      aria-label={`Demostración automática de ${nombre}`}
      allow="autoplay; encrypted-media; picture-in-picture"
      tabIndex={-1}
      className="pointer-events-none absolute inset-0 z-[2] h-full w-full border-0"
      style={escala !== 1 ? { transform: `scale(${escala})`, transformOrigin: "center" } : undefined}
    />
  );
}
