import Image from "next/image";
import type { Rango } from "@/lib/ranking/puntos";

/**
 * Badge del rango con resplandor de su propio color. El tamaño lo decide la
 * posición en la tabla: el primero se ve grande y llamativo, y va bajando
 * hacia el último — pedido del usuario para que el podio se note de un
 * vistazo.
 */
export function BadgeRango({
  rango,
  size,
  brillo = true,
  destacado = false,
  eager = false,
}: {
  rango: Rango;
  size: number;
  brillo?: boolean;
  destacado?: boolean;
  eager?: boolean;
}) {
  return (
    <span
      className="relative flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      {brillo && (
        <span
          aria-hidden
          className="absolute inset-0 rounded-full"
          style={{
            background: `radial-gradient(circle, ${rango.color}55 0%, transparent 70%)`,
            transform: "scale(1.35)",
          }}
        />
      )}
      <Image
        src={rango.imagen}
        alt={rango.nombre}
        width={size}
        height={size}
        loading={eager ? "eager" : "lazy"}
        className="relative"
        style={{
          // Segundo drop-shadow oscuro y desplazado hacia abajo, además del
          // resplandor de color: da el efecto de medalla "levantada" en vez
          // de una imagen plana pegada al fondo.
          filter: destacado
            ? `drop-shadow(0 0 10px ${rango.color}) drop-shadow(0 6px 6px rgba(0,0,0,0.5)) saturate(1.35) contrast(1.1)`
            : `drop-shadow(0 0 4px ${rango.color}88) drop-shadow(0 3px 4px rgba(0,0,0,0.45)) saturate(1.2)`,
        }}
      />
    </span>
  );
}

/** Tamaño del badge según el puesto: 1º el más grande, el resto decrece. */
export function tamanoPorPosicion(posicion: number, base = 64, minimo = 30): number {
  const size = base - (posicion - 1) * 4;
  return Math.max(minimo, size);
}
