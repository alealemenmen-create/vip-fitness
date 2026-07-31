import Link from "next/link";
import { Bell } from "lucide-react";

/**
 * Campanita de notificaciones — el ÚNICO acceso a las novedades.
 *
 * Antes el contador vivía pegado a las tres rayitas y las noticias eran una
 * entrada más del menú, escondidas detrás de dos toques. Va en el encabezado
 * compartido para que esté en todas las pantallas del alumno, no solo en una.
 */
export function CampanaNoticias({ sinVer = 0 }: { sinVer?: number }) {
  return (
    <Link
      href="/alumno/noticias"
      aria-label={sinVer > 0 ? `Notificaciones: ${sinVer} sin ver` : "Notificaciones"}
      className="radius-control relative flex h-9 w-9 shrink-0 items-center justify-center border border-border bg-surface text-text-secondary active:scale-95"
    >
      <Bell size={17} />
      {sinVer > 0 && (
        // A partir de 100 muestra "99+" para no deformar el círculo.
        <span
          className="absolute -right-1.5 -top-1.5 flex min-w-[17px] items-center justify-center rounded-full border-2 border-bg bg-error px-1 text-[10px] font-bold leading-none text-white tabular-nums"
          style={{ height: 17 }}
        >
          {sinVer > 99 ? "99+" : sinVer}
        </span>
      )}
    </Link>
  );
}
