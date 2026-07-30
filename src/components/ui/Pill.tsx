const TONES = {
  neutral: "bg-surface-2 text-text-secondary",
  vip: "bg-vip/15 text-vip",
  success: "bg-success/15 text-success",
  error: "bg-error/15 text-error",
} as const;

export function Pill({
  children,
  tone = "neutral",
  className = "",
}: {
  children: React.ReactNode;
  tone?: keyof typeof TONES;
  /** Para ajustar tamaño en columnas angostas (ej. la tarjeta de identidad
   * de Inicio, que ahora comparte fila con el RANKING VIP). */
  className?: string;
}) {
  return (
    <span
      className={`text-caption inline-block rounded-full px-3 py-1 ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
