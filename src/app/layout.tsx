import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "VIP Fitness",
  description: "Portal del alumno y panel de entrenador de VIP Fitness",
};

// Se bloquea el zoom en celular y tablet: la app está pensada para usarse con
// una mano en el gimnasio y el pellizco accidental descuadraba la pantalla.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

// Aplica el tema guardado ANTES del primer paint (evita el flash del tema
// incorrecto al cargar). Corre inline porque next/font ya bloquea el body.
const THEME_INIT_SCRIPT = `
  try {
    var t = localStorage.getItem("vip-theme");
    if (t === "light") document.documentElement.setAttribute("data-theme", "light");
    var b = localStorage.getItem("vip-tema-boton");
    if (b === "vip" || b === "femenino") document.documentElement.setAttribute("data-tema-boton", b);
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
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-bg" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
