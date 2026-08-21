"use client";

import { startTransition, useEffect, useState } from "react";
import { obtenerVideoCloudflareEjercicio } from "@/app/alumno/entrenar/video-actions";

export function VideoCloudflareAutomatico({
  ejercicioId,
  activo,
  nombre,
}: {
  ejercicioId: string | null | undefined;
  activo: boolean;
  nombre: string;
}) {
  const [video, setVideo] = useState<{ ejercicioId: string; url: string } | null>(null);

  useEffect(() => {
    let vigente = true;
    if (!activo || !ejercicioId) {
      return () => { vigente = false; };
    }
    startTransition(() => {
      void obtenerVideoCloudflareEjercicio(ejercicioId).then((resultado) => {
        if (vigente && resultado.ok) {
          setVideo({ ejercicioId, url: resultado.url });
        }
      });
    });
    return () => { vigente = false; };
  }, [activo, ejercicioId]);

  if (!activo || !ejercicioId || video?.ejercicioId !== ejercicioId) return null;
  return (
    <iframe
      src={video.url}
      title={`Demostración automática de ${nombre}`}
      aria-label={`Demostración automática de ${nombre}`}
      allow="autoplay; encrypted-media; picture-in-picture"
      tabIndex={-1}
      className="pointer-events-none absolute inset-0 z-[2] h-full w-full border-0"
    />
  );
}
