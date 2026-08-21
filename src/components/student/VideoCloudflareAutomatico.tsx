"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
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

type ReproductorStream = {
  paused: boolean;
  pause: () => void;
  play: () => Promise<void>;
  addEventListener: (tipo: "play" | "pause", escucha: () => void) => void;
  removeEventListener: (tipo: "play" | "pause", escucha: () => void) => void;
};

declare global {
  interface Window {
    Stream?: (iframe: HTMLIFrameElement) => ReproductorStream;
  }
}

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
  claseSuperficieToque,
}: {
  ejercicioId: string | null | undefined;
  activo: boolean;
  nombre: string;
  modoInmersivo?: boolean;
  claseSuperficieToque?: string;
}) {
  const [video, setVideo] = useState<VideoEjercicio | null>(() => videoEnCache(ejercicioId));
  const [urlIframeCargado, setUrlIframeCargado] = useState<string | null>(null);
  const [urlReproduccionIniciada, setUrlReproduccionIniciada] = useState<string | null>(null);
  const [sdkListo, setSdkListo] = useState(false);
  const [pausado, setPausado] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const reproductorRef = useRef<ReproductorStream | null>(null);

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
        setVideo(siguiente);
      }
    });
    return () => { vigente = false; };
  }, [activo, ejercicioId]);

  const videoActual = video?.ejercicioId === ejercicioId ? video : videoEnCache(ejercicioId);
  const videoActualUrl = videoActual?.url ?? null;

  useEffect(() => {
    if (!modoInmersivo || !sdkListo || !iframeRef.current || !window.Stream || !videoActualUrl || urlIframeCargado !== videoActualUrl) return;
    const reproductor = window.Stream(iframeRef.current);
    const alReproducir = () => {
      setPausado(false);
      setUrlReproduccionIniciada(videoActualUrl);
    };
    const alPausar = () => setPausado(true);
    reproductorRef.current = reproductor;
    setPausado(reproductor.paused);
    if (!reproductor.paused) setUrlReproduccionIniciada(videoActualUrl);
    reproductor.addEventListener("play", alReproducir);
    reproductor.addEventListener("pause", alPausar);
    return () => {
      reproductor.removeEventListener("play", alReproducir);
      reproductor.removeEventListener("pause", alPausar);
      reproductorRef.current = null;
    };
  }, [modoInmersivo, sdkListo, urlIframeCargado, videoActualUrl]);

  const alternarPausa = () => {
    const reproductor = reproductorRef.current;
    if (!reproductor) return;
    if (reproductor.paused) {
      void reproductor.play();
    } else {
      reproductor.pause();
    }
  };

  if (!activo || !ejercicioId || !videoActual) return null;
  const vertical = videoActual.ancho !== null && videoActual.alto !== null && videoActual.alto > videoActual.ancho;
  const proporcion = vertical ? `${videoActual.ancho} / ${videoActual.alto}` : undefined;
  const visible = modoInmersivo
    ? urlReproduccionIniciada === videoActual.url
    : urlIframeCargado === videoActual.url;
  return (
    <>
      {modoInmersivo ? (
        <Script
          id="cloudflare-stream-player-sdk"
          src="https://embed.cloudflarestream.com/embed/sdk.latest.js"
          strategy="afterInteractive"
          onReady={() => setSdkListo(true)}
        />
      ) : null}
      <iframe
        ref={iframeRef}
        src={videoActual.url}
        title={`Demostración automática de ${nombre}`}
        aria-label={`Demostración automática de ${nombre}`}
        allow="autoplay; encrypted-media; picture-in-picture"
        tabIndex={-1}
        data-encuadre={modoInmersivo ? "inmersivo" : undefined}
        data-orientacion={vertical ? "vertical" : "otra"}
        style={proporcion ? { aspectRatio: proporcion } : undefined}
        onLoad={() => setUrlIframeCargado(videoActual.url)}
        className={`pointer-events-none absolute inset-0 z-[2] h-full w-full border-0 transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}
      />
      {modoInmersivo && claseSuperficieToque ? (
        <button
          type="button"
          className={claseSuperficieToque}
          onClick={alternarPausa}
          aria-label={pausado ? "Reanudar video" : "Pausar video"}
          aria-pressed={pausado}
        />
      ) : null}
    </>
  );
}
