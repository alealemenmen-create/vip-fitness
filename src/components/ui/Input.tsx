import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

/** Estilo compartido de todos los campos. Se exporta para los campos que
 * necesitan su propio armado (por ejemplo el de fecha con calendario) y deben
 * verse idénticos al resto. */
export const FIELD_BASE =
  "radius-control w-full border border-border bg-surface-2 px-4 py-3 text-body text-text outline-none placeholder:text-text-tertiary focus:border-vip transition-colors duration-200 ease-in-out disabled:opacity-40";

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${FIELD_BASE} ${className}`} {...props} />;
}

export function Select({
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${FIELD_BASE} ${className}`} {...props}>
      {children}
    </select>
  );
}

export function Textarea({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${FIELD_BASE} ${className}`} {...props} />;
}
