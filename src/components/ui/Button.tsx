"use client";

import { Loader2 } from "lucide-react";

const VARIANTS = {
  primary: "bg-vip text-black",
  /** Botón de acción principal del alumno — ver `.btn-accion` en globals.css.
   * El brillo corre una sola vez al presionar (:active), no en loop. */
  accion: "btn-accion",
  secondary: "bg-surface-2 text-text border border-border",
  outline: "bg-surface-2 text-vip border border-border",
  success: "bg-success text-black",
  ghost: "bg-transparent text-text-secondary",
  destructive: "bg-transparent text-error border border-border",
} as const;

const SIZES = {
  lg: "h-14 w-full px-6 text-body",
  sm: "h-10 w-auto px-4 text-secondary",
  /** Compactas: mismo trato que `sm`/`lg` pero más bajas. Una talla propia
   * en vez de pisar `lg`/`sm` desde `className` — dos utilidades `h-*` para
   * la misma propiedad compiten en el CSS que genera Tailwind y no siempre
   * gana la que aparece después en el string de clases (ver Card.tsx). */
  xs: "h-9 w-full px-4 text-caption",
  xsAuto: "h-9 w-auto px-3 text-caption",
} as const;

export type ButtonVariant = keyof typeof VARIANTS;
export type ButtonSize = keyof typeof SIZES;

export function Button({
  children,
  variant = "primary",
  size = "lg",
  loading = false,
  disabled = false,
  type = "button",
  className = "",
  onClick,
  onPointerDown,
}: {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
  onClick?: () => void;
  /** Para botones que se tocan con el teclado del celular abierto: ahí el
   * `click` puede perderse (ver HojaAgregarComida). Con esto la acción se
   * dispara al apoyar el dedo, antes de que el teclado se cierre y mueva todo. */
  onPointerDown?: (e: React.PointerEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      onPointerDown={onPointerDown}
      disabled={disabled || loading}
      className={`radius-control flex items-center justify-center gap-2 font-medium transition-all duration-200 ease-in-out active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    >
      {loading && <Loader2 size={18} className="animate-spin" />}
      {children}
    </button>
  );
}

/** Botón cuadrado solo-ícono, para acciones secundarias dentro de una fila
 * (eliminar, editar, mover) — el Button grande no aplica ahí. */
export function IconButton({
  children,
  onClick,
  type = "button",
  disabled = false,
  className = "",
  ariaLabel,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-secondary transition-all duration-200 ease-in-out active:scale-[0.94] disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}
