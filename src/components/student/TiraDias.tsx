"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { sumarDiasISO } from "@/lib/date";
import type { EstadoDia } from "@/app/alumno/comer/tipos";

const COLOR_ESTADO: Record<EstadoDia, string> = {
  vacio: "transparent",
  parcial: "var(--macro-cal)",
  completo: "var(--color-text-secondary)",
};

const LETRAS = ["D", "L", "M", "X", "J", "V", "S"]; // getDay(): 0 = domingo

/** Cuántos días se ven a cada lado del elegido. 3 + 1 + 3 = 7 en pantalla. */
const A_CADA_LADO = 3;

/**
 * Tira de días con flechas, mismo patrón que el selector de semanas de
 * Entrenar: los días se ven completos y repartidos en el ancho, sin scroll
 * horizontal.
 *
 * El día elegido queda SIEMPRE en el centro — las flechas corren la ventana
 * de a un día, así que el recuadro no se mueve nunca de su lugar.
 *
 * Cambiar de día no navega: el padre ya tiene cargados los datos de toda la
 * ventana, así que es instantáneo (ver `obtenerRegistrosRango`).
 */
export function TiraDias({
  seleccionada,
  onSeleccionar,
  estados,
  hoy,
}: {
  seleccionada: string;
  onSeleccionar: (fecha: string) => void;
  estados: Record<string, EstadoDia>;
  hoy: string;
}) {
  const dias = Array.from({ length: A_CADA_LADO * 2 + 1 }, (_, i) => {
    const fecha = sumarDiasISO(seleccionada, i - A_CADA_LADO);
    // El día del mes sale del propio texto ISO: construir un Date acá haría
    // que el número cambie según la zona horaria del teléfono.
    return {
      fecha,
      dia: Number(fecha.slice(-2)),
      letra: LETRAS[new Date(`${fecha}T12:00:00Z`).getUTCDay()],
      esHoy: fecha === hoy,
    };
  });

  // Hoy pintado en verde, incluso sin estar elegido: es la referencia para no
  // perderse al mirar otros días. Y si hoy quedó fuera de los 7 visibles, la
  // flecha que lleva hacia él también se pinta, para saber para qué lado
  // queda.
  const hoyALaIzquierda = hoy < dias[0].fecha;
  const hoyALaDerecha = hoy > dias[dias.length - 1].fecha;

  return (
    /*
      El `pt-1` no es separación decorativa: le hace lugar al `scale-105` del
      día elegido.

      La tira arranca pegada al borde de abajo de la cabecera del alumno (ver
      alumno/layout.tsx), que es opaca y va en z-30 mientras que esto no lleva
      z-index. Al agrandarse un 5%, el recuadro ámbar crece desde el centro y
      su borde superior se mete ~1,35 px por debajo de esa cabecera, que lo
      tapa: se veía como si el borde estuviera cortado justo arriba.
    */
    <div className="flex items-center gap-1 pt-1">
      <button
        type="button"
        aria-label={hoyALaIzquierda ? "Día anterior (hoy es hacia aquí)" : "Día anterior"}
        onClick={() => onSeleccionar(sumarDiasISO(seleccionada, -1))}
        className="flex h-11 w-7 shrink-0 items-center justify-center transition-[transform,color] duration-150 active:scale-90"
        style={{
          color: hoyALaIzquierda ? "var(--color-success)" : "var(--color-text-tertiary)",
        }}
      >
        <ChevronLeft size={20} />
      </button>

      <div className="flex min-w-0 flex-1 gap-1">
        {dias.map((d) => {
          const activa = d.fecha === seleccionada;
          const estado = estados[d.fecha] ?? "vacio";
          return (
            <button
              key={d.fecha}
              type="button"
              aria-current={activa ? "date" : undefined}
              aria-label={`${d.dia}${d.esHoy ? ", hoy" : ""}`}
              onClick={() => onSeleccionar(d.fecha)}
              className={`radius-control flex min-w-0 flex-1 flex-col items-center gap-1 border py-2 transition-[transform,border-color,background-color,opacity] duration-200 ease-out active:scale-95 ${
                activa
                  ? "scale-105 border-vip bg-surface-2"
                  : "border-transparent bg-transparent opacity-70"
              }`}
            >
              <span className="text-[10px] font-semibold uppercase text-text-tertiary">
                {d.letra}
              </span>
              <span
                className={`text-secondary leading-none ${
                  d.esHoy ? "font-bold" : activa ? "font-bold text-text" : "text-text-secondary"
                }`}
                style={d.esHoy ? { color: "var(--color-success)" } : undefined}
              >
                {d.dia}
              </span>
              {/* El puntito vuelve a decir SOLO cómo viene la comida de ese
                  día: marcar "hoy" acá era redundante ahora que el número ya
                  va en verde, y tapaba el estado real. */}
              <span
                className="h-1 w-1 shrink-0 rounded-full transition-colors duration-200"
                style={{ background: COLOR_ESTADO[estado] }}
              />
            </button>
          );
        })}
      </div>

      <button
        type="button"
        aria-label={hoyALaDerecha ? "Día siguiente (hoy es hacia aquí)" : "Día siguiente"}
        onClick={() => onSeleccionar(sumarDiasISO(seleccionada, 1))}
        className="flex h-11 w-7 shrink-0 items-center justify-center transition-[transform,color] duration-150 active:scale-90"
        style={{
          color: hoyALaDerecha ? "var(--color-success)" : "var(--color-text-tertiary)",
        }}
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
}
