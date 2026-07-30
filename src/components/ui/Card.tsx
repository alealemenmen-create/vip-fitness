export function Card({
  children,
  className = "",
  variant = "default",
}: {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "highlight";
}) {
  const base = "radius-card p-6";
  const tone =
    variant === "highlight" ? "bg-surface-highlight text-black" : "bg-surface text-text";
  return <div className={`${base} ${tone} ${className}`}>{children}</div>;
}
