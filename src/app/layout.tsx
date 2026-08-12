import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

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

// Aplica el tema y el tamaño de texto guardados ANTES del primer paint (evita
// el flash del tema o de la letra chica al cargar). Corre inline porque
// next/font ya bloquea el body.
const THEME_INIT_SCRIPT = `
  try {
    var t = localStorage.getItem("vip-theme");
    if (t === "light") document.documentElement.setAttribute("data-theme", "light");
    var b = localStorage.getItem("vip-tema-boton");
    if (b === "vip" || b === "masculino" || b === "femenino") {
      document.documentElement.setAttribute("data-tema-boton", b);
    } else if (b !== "espejo") {
      // Nadie eligió tema de botón todavía en este dispositivo: el default
      // de la app es "VIP" (dorado), no "Espejo".
      document.documentElement.setAttribute("data-tema-boton", "vip");
      localStorage.setItem("vip-tema-boton", "vip");
    }
    var z = parseFloat(localStorage.getItem("vip-zoom-pantalla"));
    if (!(z >= 0.8 && z <= 1.15)) {
      // Migración de la clave vieja: hasta ahora esto solo agrandaba la LETRA
      // ("vip-escala-texto", 0.75–1.3). Ahora achica/agranda la pantalla
      // entera, así que el valor viejo se traduce al tamaño más cercano en
      // vez de perderse — el alumno mayor que tenía la letra grande no se
      // encuentra la app de vuelta en normal.
      var viejo = parseFloat(localStorage.getItem("vip-escala-texto"));
      z = viejo >= 1.15 ? 1.15 : viejo <= 0.8 ? 0.8 : viejo <= 0.9 ? 0.9 : 1;
      if (!(z >= 0.8 && z <= 1.15)) z = 1;
    }
    document.documentElement.style.setProperty("--zoom-pantalla", String(z));
    document.documentElement.setAttribute("data-zoom-pantalla", String(z));
  } catch (e) {}
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es-CL"
      className={`${inter.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-bg" suppressHydrationWarning>
        <Script id="tema-inicial" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {children}
      </body>
    </html>
  );
}
