export function Card({
  children,
  className = "",
  variant = "default",
  padding = "p-6",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "highlight";
  /** Tailwind padding utility (p-*). Se pasa aparte de `className` porque dos
   * clases `p-*` compiten por la misma propiedad CSS y Tailwind no respeta el
   * orden en que aparecen en el string — la del valor más alto en su escala
   * gana sin importar cuál va después. Pasar el padding por su propio prop
   * evita esa colisión en vez de intentar "ganarle" a p-6 desde className. */
  padding?: string;
  /** Escape hatch para fondos/bordes que necesitan un valor dinámico
   * (gradientes con color-mix, etc.) que no se puede expresar como clase de
   * Tailwind. Opcional — la gran mayoría de las tarjetas no lo necesita. */
  style?: React.CSSProperties;
}) {
  const base = `radius-card ${padding}`;
  const tone =
    variant === "highlight" ? "bg-surface-highlight text-black" : "bg-surface text-text";
  return (
    <div className={`${base} ${tone} ${className}`} style={style}>
      {children}
    </div>
  );
}
