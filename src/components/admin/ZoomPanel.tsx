"use client";

import { useEffect, useState } from "react";
import { ZoomOut } from "lucide-react";

/**
 * Tres tamaños de pantalla para el panel del entrenador: normal, más chico y
 * más chico ×2. Pedido textual: "zoom de pantalla, tres tamaños, con el
 * control arriba, al lado del toggle claro/oscuro".
 *
 * No es un zoom del navegador ni una hoja de estilos aparte: reusa la misma
 * variable `--escala-texto` que el alumno usa para AGRANDAR la letra (ver
 * MenuAlumno.tsx y globals.css). Toda la escala tipográfica de la app ya está
 * escrita multiplicada por esa variable, así que achicar acá achica todo de
 * forma pareja en vez de romper el calce de una pantalla puntual.
 *
 * Un solo botón que cicla, no tres: el espacio de la cabecera es el mismo que
 * pelea la barra de navegación, y el porcentaje que muestra ya dice en cuál
 * de los tres está.
 */

const ESCALAS = [1, 0.85, 0.75] as const;
type Escala = (typeof ESCALAS)[number];

function normalizar(valor: number): Escala {
  return (ESCALAS.find((escala) => escala === valor) ?? 1) as Escala;
}

export function ZoomPanel({ className = "" }: { className?: string }) {
  const [escala, setEscala] = useState<Escala>(1);

  // Igual que ThemeToggle: el valor real lo dejó el script inline de
  // layout.tsx sobre <html> antes del primer paint. Leerlo en el render daría
  // desajuste de hidratación, así que se lee después de montar.
  useEffect(() => {
    const id = window.setTimeout(() => {
      const actual = parseFloat(
        document.documentElement.style.getPropertyValue("--escala-texto") || "1"
      );
      setEscala(normalizar(actual));
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  const ciclar = () => {
    const siguiente = ESCALAS[(ESCALAS.indexOf(escala) + 1) % ESCALAS.length];
    setEscala(siguiente);
    document.documentElement.style.setProperty("--escala-texto", String(siguiente));
    document.documentElement.setAttribute("data-escala-texto", String(siguiente));
    try {
      localStorage.setItem("vip-escala-texto", String(siguiente));
    } catch {
      // Modo privado: el tamaño igual se aplica, solo no sobrevive al cierre.
    }
  };

  return (
    <button
      onClick={ciclar}
      aria-label={`Tamaño de pantalla ${Math.round(escala * 100)}%. Tocar para cambiar.`}
      title="Achicar la pantalla para que entre más"
      className={`flex h-9 shrink-0 items-center gap-1 rounded-full bg-surface-2 px-2.5 text-text-secondary transition-colors duration-200 ease-in-out ${className}`}
    >
      <ZoomOut size={16} />
      <span className="text-[10px] font-semibold tabular-nums">{Math.round(escala * 100)}%</span>
    </button>
  );
}
