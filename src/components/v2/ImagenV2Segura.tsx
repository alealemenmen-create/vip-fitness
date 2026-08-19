"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";

const RESPALDO_FINAL = "/v2/piernas.webp";

export function fuentesImagenV2(
  principal: string,
  respaldo?: string | null,
): string[] {
  return [...new Set([principal, respaldo, RESPALDO_FINAL].filter((fuente): fuente is string => Boolean(fuente?.trim())))];
}

/**
 * Imagen con recuperación local para recursos históricos eliminados,
 * respuestas que ya no son imágenes y enlaces temporales vencidos.
 *
 * Las URLs remotas se sirven directamente: si pasaran por el optimizador de
 * Next, cada miniatura rota produciría un error 500 del servidor antes de que
 * el navegador pudiera activar el respaldo.
 */
export function ImagenV2Segura({
  src,
  fallbackSrc,
  alt,
  ...props
}: Omit<ImageProps, "src" | "onError"> & {
  src: string;
  fallbackSrc?: string | null;
}) {
  const fuentes = fuentesImagenV2(src, fallbackSrc);
  const firma = `${src}\u0000${fallbackSrc ?? ""}`;
  const [estado, setEstado] = useState({ firma, indice: 0 });
  const indice = estado.firma === firma ? estado.indice : 0;
  const actual = fuentes[Math.min(indice, fuentes.length - 1)] ?? RESPALDO_FINAL;
  const remota = /^https?:\/\//i.test(actual);

  return (
    <Image
      {...props}
      src={actual}
      alt={alt}
      unoptimized={props.unoptimized ?? remota}
      onError={() => setEstado((previo) => ({
        firma,
        indice: Math.min((previo.firma === firma ? previo.indice : 0) + 1, fuentes.length - 1),
      }))}
    />
  );
}
