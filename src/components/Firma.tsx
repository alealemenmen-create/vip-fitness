/** Crédito del desarrollador. Antes iba en cursiva manuscrita (Caveat) y
 * repetía "VIP FITNESS"; ahora usa la tipografía de la app en itálica fina,
 * para que se lea como un crédito y no compita con el logo. */
export function Firma({ className = "" }: { className?: string }) {
  return (
    <p
      className={`text-center italic text-text-tertiary ${className}`}
      style={{ fontSize: 12, letterSpacing: "0.08em" }}
    >
      by Alejandro Mendoza
    </p>
  );
}
