import type { Metadata, Viewport } from "next";
import { ThemeInitializer } from "@/components/ThemeInitializer";
import "./globals.css";

export const metadata: Metadata = {
  title: "VIP Fitness",
  description: "Portal del alumno y panel de entrenador de VIP Fitness",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-icon-180.png", sizes: "180x180", type: "image/png" }],
  },
  // Sin esto, "Agregar a pantalla de inicio" en iOS crea un simple atajo de
  // Safari (con la barra de navegación visible), no una app standalone real
  // — y las notificaciones del sistema (`avisarFinDescanso` en
  // `lib/entrenamiento/aviso.ts`) solo las habilita iOS para apps agregadas
  // en modo standalone de verdad. Quien ya la había agregado antes de este
  // cambio tiene que borrar el ícono viejo y agregarla de nuevo.
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "VIP Fitness",
  },
};

// Se bloquea el zoom en celular y tablet: la app está pensada para usarse con
// una mano en el gimnasio y el pellizco accidental descuadraba la pantalla.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  /*
    Qué pasa cuando sube el teclado. Es la diferencia de fondo entre iPhone y
    Android, y la causa de que Nutrición se viera bien en uno y roto en el otro:

    - iOS achica solo el viewport VISUAL. El de layout queda del alto de la
      pantalla completa, así que `position: fixed` no se mueve y el teclado
      simplemente tapa lo de abajo.
    - Android achica además el de LAYOUT. Todo lo `fixed` salta hacia arriba,
      `window.innerHeight` cambia y se dispara `resize`.

    El panel de agregar comida está posicionado a mano con `visualViewport`
    (ver `useAreaVisible` en HojaAgregarComida): da por hecho que lo `fixed`
    NO se mueve. En Android ese supuesto no valía y las dos correcciones se
    sumaban — el panel y su fondo negro cambiaban de alto varias veces
    mientras el teclado subía, que es el temblor que se veía.

    `resizes-visual` le pide a Android el mismo comportamiento que iOS, así hay
    una sola forma de la que ocuparse en vez de dos.
  */
  interactiveWidget: "resizes-visual",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es-CL"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-bg" suppressHydrationWarning>
        <ThemeInitializer />
        {children}
      </body>
    </html>
  );
}
