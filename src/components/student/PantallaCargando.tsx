/** Esqueleto genérico para `loading.tsx` de las pantallas de alumno. Al
 * existir un `loading.tsx` en la carpeta de la ruta, Next.js la prefetchea
 * parcialmente (layout + este esqueleto) apenas el link de BottomNav entra en
 * pantalla, así que tocar una pestaña se siente instantáneo en vez de quedar
 * en blanco esperando la respuesta del servidor. */
export function PantallaCargando({ bloques = 3 }: { bloques?: number }) {
  return (
    <div className="space-y-6 pb-8" aria-hidden>
      <div className="h-7 w-40 animate-pulse rounded-md bg-surface-2" />
      {Array.from({ length: bloques }).map((_, i) => (
        <div key={i} className="h-28 animate-pulse rounded-xl bg-surface-2" />
      ))}
    </div>
  );
}
