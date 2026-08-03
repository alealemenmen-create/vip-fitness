"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell } from "lucide-react";

const CLASES =
  "radius-control relative flex h-9 w-9 shrink-0 items-center justify-center border border-border bg-surface text-text-secondary active:scale-95";

function Contador({ sinVer }: { sinVer: number }) {
  if (sinVer <= 0) return null;
  // A partir de 100 muestra "99+" para no deformar el círculo.
  return (
    <span
      className="absolute -right-1.5 -top-1.5 flex min-w-[17px] items-center justify-center rounded-full border-2 border-bg bg-error px-1 text-[10px] font-bold leading-none text-white tabular-nums"
      style={{ height: 17 }}
    >
      {sinVer > 99 ? "99+" : sinVer}
    </span>
  );
}

/**
 * Campanita de notificaciones — el ÚNICO acceso a las novedades.
 *
 * Antes el contador vivía pegado a las tres rayitas y las noticias eran una
 * entrada más del menú, escondidas detrás de dos toques. Va en el encabezado
 * compartido para que esté en todas las pantallas del alumno, no solo en una.
 *
 * Es un toggle, no solo un link de ida: parada en Noticias, la campanita
 * vuelve a Inicio en vez de no hacer nada — antes, tocarla de nuevo estando
 * ya en Noticias se sentía "trabada" (parecía que debía cerrar la pantalla y
 * no pasaba nada, un mismo `<Link>` a la misma ruta no tiene adónde ir).
 */
export function CampanaNoticias({ sinVer = 0 }: { sinVer?: number }) {
  const pathname = usePathname();
  const router = useRouter();
  const label = sinVer > 0 ? `Notificaciones: ${sinVer} sin ver` : "Notificaciones";

  if (pathname === "/alumno/noticias") {
    return (
      <button type="button" aria-label="Cerrar notificaciones" onClick={() => router.push("/alumno/inicio")} className={CLASES}>
        <Bell size={17} />
        <Contador sinVer={sinVer} />
      </button>
    );
  }

  return (
    <Link href="/alumno/noticias" aria-label={label} className={CLASES}>
      <Bell size={17} />
      <Contador sinVer={sinVer} />
    </Link>
  );
}
