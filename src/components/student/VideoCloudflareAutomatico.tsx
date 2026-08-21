"use client";

import Script from "next/script";
import { Pause, Play } from "lucide-react";
import { startTransition, useEffect, useRef, useState } from "react";
import { obtenerVideoCloudflareEjercicio } from "@/app/alumno/entrenar/video-actions";

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

export function VideoCloudflareAutomatico({
  ejercicioId,
  activo,
  nombre,
  modoInmersivo = false,
  claseControlPausa,
}: {
  ejercicioId: string | null | undefined;
  activo: boolean;
  nombre: string;
  modoInmersivo?: boolean;
  claseControlPausa?: string;
}) {
  const [video, setVideo] = useState<{ ejercicioId: string; url: string; ancho: number | null; alto: number | null } | null>(null);
  const [sdkListo, setSdkListo] = useState(false);
  const [pausado, setPausado] = useState(false);
  const [iframeVisible, setIframeVisible] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const reproductorRef = useRef<ReproductorStream | null>(null);

  useEffect(() => {
    let vigente = true;
    if (!activo || !ejercicioId) {
      return () => { vigente = false; };
    }
    startTransition(() => {
      void obtenerVideoCloudflareEjercicio(ejercicioId).then((resultado) => {
        if (vigente && resultado.ok) {
          setIframeVisible(false);
          setVideo({ ejercicioId, url: resultado.url, ancho: resultado.ancho, alto: resultado.alto });
        }
      });
    });
    return () => { vigente = false; };
  }, [activo, ejercicioId]);

  useEffect(() => {
    if (!modoInmersivo || !sdkListo || !iframeRef.current || !window.Stream) return;
    const reproductor = window.Stream(iframeRef.current);
    const alReproducir = () => setPausado(false);
    const alPausar = () => setPausado(true);
    reproductorRef.current = reproductor;
    setPausado(reproductor.paused);
    reproductor.addEventListener("play", alReproducir);
    reproductor.addEventListener("pause", alPausar);
    return () => {
      reproductor.removeEventListener("play", alReproducir);
      reproductor.removeEventListener("pause", alPausar);
      reproductorRef.current = null;
    };
  }, [modoInmersivo, sdkListo, video?.url]);

  const alternarPausa = () => {
    const reproductor = reproductorRef.current;
    if (!reproductor) return;
    if (reproductor.paused) {
      void reproductor.play();
    } else {
      reproductor.pause();
    }
  };

  if (!activo || !ejercicioId || video?.ejercicioId !== ejercicioId) return null;
  const vertical = video.ancho !== null && video.alto !== null && video.alto > video.ancho;
  const proporcion = vertical ? `${video.ancho} / ${video.alto}` : undefined;
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
        src={video.url}
        title={`Demostración automática de ${nombre}`}
        aria-label={`Demostración automática de ${nombre}`}
        allow="autoplay; encrypted-media; picture-in-picture"
        tabIndex={-1}
        data-encuadre={modoInmersivo ? "inmersivo" : undefined}
        data-orientacion={vertical ? "vertical" : "otra"}
        style={proporcion ? { aspectRatio: proporcion } : undefined}
        onLoad={() => setIframeVisible(true)}
        className={`pointer-events-none absolute inset-0 z-[2] h-full w-full border-0 transition-opacity duration-300 ${iframeVisible ? "opacity-100" : "opacity-0"}`}
      />
      {modoInmersivo && claseControlPausa && sdkListo ? (
        <button
          type="button"
          className={claseControlPausa}
          onClick={alternarPausa}
          aria-label={pausado ? "Reanudar video" : "Pausar video"}
          aria-pressed={pausado}
        >
          {pausado ? <Play size={15} fill="currentColor" /> : <Pause size={15} fill="currentColor" />}
        </button>
      ) : null}
    </>
  );
}
