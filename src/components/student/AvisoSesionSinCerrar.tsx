"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertCircle, ChevronRight } from "lucide-react";

/**
 * Franja de "tienes un entrenamiento sin cerrar", en TODAS las pantallas del
 * alumno.
 *
 * El caso real que cubre: termina de entrenar, se va a Ranked a mirar su
 * puesto, y no vuelve nunca. La pestaña Entrenar ya lleva a la sesión en
 * curso, pero es un ícono más entre cinco — no dice que haya algo pendiente.
 *
 * NO es una burbuja flotante. Esa ya se probó y se sacó: quedaba encima del
 * buscador de Nutrición y era un segundo botón para lo mismo. Esto va en el
 * flujo, arriba del contenido, ocupa una línea y no tapa nada.
 *
 * Se esconde sola dentro de la propia sesión (ahí ya se está viendo) y en el
 * calendario de Entrenar, que tiene su propio aviso.
 */
export function AvisoSesionSinCerrar({ sesionId }: { sesionId: string }) {
  const pathname = usePathname();
  if (pathname.startsWith("/alumno/entrenar")) return null;

  return (
    <Link
      href={`/alumno/entrenar/sesion/${sesionId}`}
      className="franja-sesion-sin-cerrar mb-2.5 flex items-center gap-2"
    >
      <AlertCircle size={15} className="shrink-0 text-warning" />
      <span className="min-w-0 flex-1">
        <span className="text-caption block font-semibold text-warning">
          Tienes un entrenamiento sin cerrar
        </span>
        <span className="text-micro block text-text-secondary">
          Hasta que lo cierres no suma Puntos VIP.
        </span>
      </span>
      <ChevronRight size={16} className="shrink-0 text-text-tertiary" />
    </Link>
  );
}
