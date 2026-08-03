import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Temporal (medición de rendimiento): permite compilar a una carpeta aparte
  // para no chocar con el servidor de desarrollo que tiene tomado .next.
  ...(process.env.VIP_DIST_DIR ? { distDir: process.env.VIP_DIST_DIR } : {}),
  // `sharp` tiene un binario nativo (.node) por sistema operativo. Ahora se
  // usa desde dos Server Actions distintas (fotos de progreso y fotos de
  // ejercicios) — sin esto, Turbopack lo empaqueta por separado para cada
  // una, y cargar el mismo binario nativo dos veces desde bundles distintos
  // hacía crashear el proceso entero con ERR_DLOPEN_FAILED en Windows. Con
  // esto, Next lo deja afuera del bundle y lo carga una sola vez con el
  // require normal de Node.
  serverExternalPackages: ["sharp"],
  // Permite abrir el servidor de desarrollo desde el celular por IP local
  // (ej. http://192.168.1.87:3000) para probar la app en un dispositivo real.
  // Next.js bloquea por defecto cualquier origen que no sea localhost.
  allowedDevOrigins: ["localhost", "127.0.0.1", "192.168.1.*"],
  experimental: {
    // Caché de navegación del cliente. Desde Next 15 el valor por defecto de
    // `dynamic` es 0 s (apagado), así que volver a una pestaña de la barra
    // inferior pedía la pantalla al servidor de nuevo aunque la hubieras visto
    // hace un segundo: medido, ~300 ms cada vez.
    // Con 30 s, moverse entre pestañas dentro de ese lapso no toca la red y es
    // instantáneo. No hay riesgo de ver datos viejos tras guardar algo: las
    // Server Actions llaman a `revalidatePath`, que vacía esta caché.
    staleTimes: {
      dynamic: 30,
    },
    serverActions: {
      // Sube fotos de progreso (comprimidas en el navegador) y PDFs de rutina.
      // Sirve de respaldo cuando el navegador no logra comprimir la imagen
      // (por ejemplo, algunos HEIC de iPhone que no se pueden decodificar).
      bodySizeLimit: "15mb",
    },
  },
  async headers() {
    return [
      {
        // Las fotos de referencia de ejercicios se reemplazan en el mismo
        // nombre de archivo (mismo slug) cuando el entrenador las corrige
        // desde /admin/ejercicios. Sin este header, el navegador podía seguir
        // mostrando la foto vieja desde su caché durante días. `must-revalidate`
        // obliga a preguntarle siempre al servidor si cambió (ETag/Last-Modified
        // de Next), así que sigue siendo instantáneo cuando no cambió nada.
        source: "/ejercicios/:path*",
        headers: [{ key: "Cache-Control", value: "no-cache, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
