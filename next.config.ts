import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Temporal (medición de rendimiento): permite compilar a una carpeta aparte
  // para no chocar con el servidor de desarrollo que tiene tomado .next.
  ...(process.env.VIP_DIST_DIR ? { distDir: process.env.VIP_DIST_DIR } : {}),
  // Permite abrir el servidor de desarrollo desde el celular por IP local
  // (ej. http://192.168.1.87:3000) para probar la app en un dispositivo real.
  // Next.js bloquea por defecto cualquier origen que no sea localhost.
  allowedDevOrigins: ["192.168.1.*"],
  experimental: {
    serverActions: {
      // Sube fotos de progreso (comprimidas en el navegador) y PDFs de rutina.
      // Sirve de respaldo cuando el navegador no logra comprimir la imagen
      // (por ejemplo, algunos HEIC de iPhone que no se pueden decodificar).
      bodySizeLimit: "15mb",
    },
  },
};

export default nextConfig;
