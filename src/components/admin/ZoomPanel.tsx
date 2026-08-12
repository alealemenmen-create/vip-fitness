"use client";

import { useEffect, useState } from "react";
import { ZoomOut } from "lucide-react";

/**
 * Tres tamaños de pantalla para el panel del entrenador: normal, más chico y
 * más chico ×2. Pedido textual: "zoom de pantalla, tres tamaños, con el
 * control arriba, al lado del toggle claro/oscuro".
 *
 * Escribe `--zoom-pantalla`, la misma variable que usa el menú del alumno (ver
 * MenuAlumno.tsx y globals.css). Antes escribía `--escala-texto`, que solo
 * multiplicaba la escala tipográfica: la letra se achicaba pero las tarjetas
 * quedaban del mismo porte, así que no entraba más rutina en pantalla, que era
 * justamente el pedido. Ahora achica el layout completo.
 *
 * Un solo botón que cicla, no tres: el espacio de la cabecera es el mismo que
 * pelea la barra de navegación, y el porcentaje que muestra ya dice en cuál
 * de los tres está.
 */

const ESCALAS = [1, 0.9, 0.8] as const;
type Escala = (typeof ESCALAS)[number];

export function ZoomPanel({ className = "" }: { className?: string }) {
  // Valor real de `--zoom-pantalla`, no acotado a los tres tamaños de este
  // panel: el menú del alumno (MenuAlumno.tsx) escribe la misma variable y la
  // misma clave de localStorage con su propio rango, que llega hasta 115%.
  // Forzar acá cualquier valor ajeno a 100% hacía que este botón dijera
  // "100%" mintiendo sobre el tamaño real (bug encontrado en revisión).
  const [escala, setEscala] = useState(1);

  // Igual que ThemeToggle: el valor real lo dejó el script inline de
  // layout.tsx sobre <html> antes del primer paint. Leerlo en el render daría
  // desajuste de hidratación, así que se lee después de montar.
  useEffect(() => {
    const id = window.setTimeout(() => {
      const actual = parseFloat(
        document.documentElement.style.getPropertyValue("--zoom-pantalla") || "1"
      );
      setEscala(actual || 1);
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  const ciclar = () => {
    // Si el valor actual no es uno de los tres de este panel (por ejemplo,
    // quedó en 115%/130% por el tamaño de letra del alumno), el primer toque
    // lo trae de vuelta a "Normal" en vez de partir de un punto que no existe
    // en esta lista.
    const indiceActual = ESCALAS.indexOf(escala as Escala);
    const siguiente = indiceActual === -1 ? ESCALAS[0] : ESCALAS[(indiceActual + 1) % ESCALAS.length];
    setEscala(siguiente);
    document.documentElement.style.setProperty("--zoom-pantalla", String(siguiente));
    document.documentElement.setAttribute("data-zoom-pantalla", String(siguiente));
    try {
      localStorage.setItem("vip-zoom-pantalla", String(siguiente));
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
