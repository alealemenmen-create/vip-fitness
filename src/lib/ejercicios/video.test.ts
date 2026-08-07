import { describe, expect, it } from "vitest";
import { idDeYoutube, resolverFuenteVideo } from "./video";

describe("idDeYoutube", () => {
  it("extrae el id de distintos formatos de link", () => {
    expect(idDeYoutube("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(idDeYoutube("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(idDeYoutube("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s")).toBe("dQw4w9WgXcQ");
    expect(idDeYoutube("https://youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(idDeYoutube("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("devuelve null para un link que no es de YouTube", () => {
    expect(idDeYoutube("https://misitio.com/video.mp4")).toBeNull();
  });
});

describe("resolverFuenteVideo", () => {
  it("prioriza el iframe de Cloudflare sobre el link externo, aunque los dos existan", () => {
    const fuente = resolverFuenteVideo(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://customer-abc.cloudflarestream.com/uid123/iframe"
    );
    expect(fuente).toEqual({ tipo: "iframe", src: "https://customer-abc.cloudflarestream.com/uid123/iframe" });
  });

  it("un video de Cloudflare todavia procesando (urlEmbedIframe null) cae al link externo", () => {
    const fuente = resolverFuenteVideo("https://www.youtube.com/watch?v=dQw4w9WgXcQ", null);
    expect(fuente).toEqual({
      tipo: "iframe",
      src: "https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&playsinline=1",
    });
  });

  it("un link directo a un archivo se reproduce como archivo, no como iframe", () => {
    const fuente = resolverFuenteVideo("https://misitio.com/video.mp4", null);
    expect(fuente).toEqual({ tipo: "archivo", src: "https://misitio.com/video.mp4" });
  });

  it("devuelve null cuando no hay ningún video", () => {
    expect(resolverFuenteVideo(null, null)).toBeNull();
  });
});
