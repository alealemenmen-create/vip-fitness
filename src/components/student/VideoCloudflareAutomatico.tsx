"use client";

import { useEffect, useState } from "react";
import { obtenerVideoCloudflareEjercicio } from "@/app/alumno/entrenar/video-actions";

type VideoEjercicio = {
  ejercicioId: string;
  url: string;
  ancho: number | null;
  alto: number | null;
};

type ResultadoVideo = Awaited<ReturnType<typeof obtenerVideoCloudflareEjercicio>>;

const TRES_HORAS_MS = 3 * 60 * 60 * 1000;
const cacheVideos = new Map<string, { video: VideoEjercicio; venceEn: number }>();
const solicitudesVideos = new Map<string, Promise<ResultadoVideo>>();

function videoEnCache(ejercicioId: string | null | undefined) {
  if (!ejercicioId) return null;
  const entrada = cacheVideos.get(ejercicioId);
  if (!entrada || entrada.venceEn <= Date.now()) {
    cacheVideos.delete(ejercicioId);
    return null;
  }
  return entrada.video;
}

function solicitarVideo(ejercicioId: string) {
  const existente = solicitudesVideos.get(ejercicioId);
  if (existente) return existente;
  const solicitud = obtenerVideoCloudflareEjercicio(ejercicioId).finally(() => {
    solicitudesVideos.delete(ejercicioId);
  });
  solicitudesVideos.set(ejercicioId, solicitud);
  return solicitud;
}

export function VideoCloudflareAutomatico({
  ejercicioId,
  activo,
  nombre,
  modoInmersivo = false,
}: {
  ejercicioId: string | null | undefined;
  activo: boolean;
  nombre: string;
  modoInmersivo?: boolean;
}) {
  const [video, setVideo] = useState<VideoEjercicio | null>(() => videoEnCache(ejercicioId));
  const [iframeVisible, setIframeVisible] = useState(false);

  useEffect(() => {
    let vigente = true;
    if (!activo || !ejercicioId) {
      return () => { vigente = false; };
    }
    const almacenado = videoEnCache(ejercicioId);
    if (almacenado) {
      return () => { vigente = false; };
    }
    void solicitarVideo(ejercicioId).then((resultado) => {
      if (!resultado.ok) return;
      const siguiente = { ejercicioId, url: resultado.url, ancho: resultado.ancho, alto: resultado.alto };
      cacheVideos.set(ejercicioId, { video: siguiente, venceEn: Date.now() + TRES_HORAS_MS });
      if (vigente) {
        setIframeVisible(false);
        setVideo(siguiente);
      }
    });
    return () => { vigente = false; };
  }, [activo, ejercicioId]);

  const videoActual = video?.ejercicioId === ejercicioId ? video : videoEnCache(ejercicioId);
  if (!activo || !ejercicioId || !videoActual) return null;
  const vertical = videoActual.ancho !== null && videoActual.alto !== null && videoActual.alto > videoActual.ancho;
  const proporcion = vertical ? `${videoActual.ancho} / ${videoActual.alto}` : undefined;
  return (
    <iframe
      src={videoActual.url}
      title={`Demostración automática de ${nombre}`}
      aria-label={`Demostración automática de ${nombre}`}
      allow="autoplay; encrypted-media; picture-in-picture"
      tabIndex={-1}
      data-encuadre={modoInmersivo ? "inmersivo" : undefined}
      data-orientacion={vertical ? "vertical" : "otra"}
      style={proporcion ? { aspectRatio: proporcion } : undefined}
      onLoad={() => setIframeVisible(true)}
      className={`${modoInmersivo ? "pointer-events-auto" : "pointer-events-none"} absolute inset-0 z-[2] h-full w-full border-0 transition-opacity duration-300 ${iframeVisible ? "opacity-100" : "opacity-0"}`}
    />
  );
}
