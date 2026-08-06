import type { MetadataRoute } from "next";

/** Instala VIP Fitness como app en Android ("Agregar a pantalla de inicio"):
 * ícono cuadrado + maskable (Android recorta según la forma del sistema),
 * negro sólido detrás del glifo V⚡P, mismo look premium del tema Espejo. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "VIP Fitness Center",
    short_name: "VIP Fitness",
    description: "Portal del alumno y panel de entrenador de VIP Fitness",
    start_url: "/",
    display: "standalone",
    // Respetado por Android; iOS lo ignora (por eso el bloqueo real vive en
    // globals.css, con CSS puro). No hace daño dejarlo igual.
    orientation: "portrait",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
