"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell } from "lucide-react";

function Contador({ sinLeer }: { sinLeer: number }) {
  if (sinLeer <= 0) return null;
  return (
    <span
      className="absolute -right-1.5 -top-1.5 flex min-w-[17px] items-center justify-center rounded-full border-2 border-bg bg-error px-1 text-[10px] font-bold leading-none text-white tabular-nums"
      style={{ height: 17 }}
    >
      {sinLeer > 99 ? "99+" : sinLeer}
    </span>
  );
}

/** Campanita de notificaciones del entrenador — mismo patrón que
 * `CampanaNoticias` del lado alumno: toggle a una página completa, no un
 * dropdown. Separada a propósito de "Pendientes" (que es cola de trabajo
 * administrativo, no avisos puntuales). */
export function CampanaNotificaciones({ sinLeer = 0 }: { sinLeer?: number }) {
  const pathname = usePathname();
  const router = useRouter();
  const label = sinLeer > 0 ? `Notificaciones: ${sinLeer} sin ver` : "Notificaciones";
  const clases =
    "radius-control relative flex h-9 w-9 shrink-0 items-center justify-center border border-border bg-surface text-text-secondary active:scale-95";

  if (pathname === "/admin/notificaciones") {
    return (
      <button type="button" aria-label="Cerrar notificaciones" onClick={() => router.back()} className={clases}>
        <Bell size={16} />
        <Contador sinLeer={sinLeer} />
      </button>
    );
  }

  return (
    <Link href="/admin/notificaciones" aria-label={label} className={clases}>
      <Bell size={16} />
      <Contador sinLeer={sinLeer} />
    </Link>
  );
}
