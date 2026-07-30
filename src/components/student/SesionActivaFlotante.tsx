"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dumbbell } from "lucide-react";

/**
 * Burbuja flotante visible en cualquier pestaña (Inicio, Comer, Progreso…)
 * mientras haya una sesión de entrenamiento en progreso — lleva directo de
 * vuelta al ejercicio donde iba. Dentro de la sección Entrenar se oculta:
 * allí ya existe un botón explícito para continuar y no debe interferir con
 * el regreso a la pantalla general.
 */
export function SesionActivaFlotante({ sesionId }: { sesionId: string }) {
  const pathname = usePathname();
  const dentroDeEntrenar = pathname.startsWith("/alumno/entrenar");

  if (dentroDeEntrenar) return null;

  return (
    <Link
      href={`/alumno/entrenar/sesion/${sesionId}`}
      aria-label="Volver al entrenamiento en curso"
      className="panel-vip-espejo fixed bottom-24 right-4 z-40 flex h-12 items-center justify-center gap-2 rounded-full px-4 text-secondary font-semibold text-text shadow-lg"
      style={{ borderWidth: 1.5 }}
    >
      <Dumbbell size={19} className="shrink-0 text-vip" />
      <span>Volver a rutina</span>
    </Link>
  );
}
