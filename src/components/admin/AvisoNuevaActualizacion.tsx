"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BellRing, X } from "lucide-react";
import type { Novedad } from "@/lib/novedades";
import { leerNovedadesVistasHasta } from "@/lib/novedades-vistas-local";

const PREFIJO_OCULTA = "vip:novedad-oculta-sesion:";
const suscribirSinEventos = () => () => undefined;
type NovedadAviso = Pick<Novedad, "id" | "titulo" | "creadoEn">;

export function AvisoNuevaActualizacion({ novedad }: { novedad: NovedadAviso | null }) {
  const pathname = usePathname();
  const [idOcultaAhora, setIdOcultaAhora] = useState<string | null>(null);
  const sinLeer = useSyncExternalStore(
    suscribirSinEventos,
    () => {
      if (!novedad) return false;
      const vistaHasta = leerNovedadesVistasHasta();
      let ocultada = false;
      try {
        ocultada = sessionStorage.getItem(`${PREFIJO_OCULTA}${novedad.id}`) === "1";
      } catch {
        // En modo privado puede no haber sessionStorage; el aviso sigue útil.
      }
      return !ocultada && (!vistaHasta || novedad.creadoEn > vistaHasta);
    },
    () => false,
  );

  if (!novedad || pathname === "/admin/novedades" || !sinLeer || idOcultaAhora === novedad.id) return null;
  const novedadActual = novedad;

  function ocultarPorEstaSesion() {
    try {
      sessionStorage.setItem(`${PREFIJO_OCULTA}${novedadActual.id}`, "1");
    } catch {
      // El estado React alcanza para ocultarla hasta la próxima navegación.
    }
    setIdOcultaAhora(novedadActual.id);
  }

  return (
    <aside
      role="status"
      aria-live="polite"
      /* En celular el aviso vivía en `top-16`, justo encima del encabezado
         pegajoso de cada pantalla: tapaba el `h1` y la descripción hasta que
         el entrenador lo cerraba a mano, en TODAS las rutas del panel. Ahora
         se apoya arriba de la barra inferior, donde no compite con nada. En
         escritorio se queda arriba a la derecha, que ahí sí está libre. */
      className="fixed inset-x-3 bottom-[calc(var(--alto-nav-alumno,86px)+14px)] z-50 rounded-2xl border border-vip/30 bg-surface p-3 shadow-xl md:bottom-auto md:left-auto md:right-5 md:top-16 md:w-[360px]"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-vip/15 text-vip">
          <BellRing size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-micro font-semibold uppercase tracking-[0.12em] text-vip">Nueva actualización</p>
          <p className="text-secondary mt-0.5 font-semibold text-text">{novedadActual.titulo}</p>
          <Link href="/admin/novedades" className="text-caption mt-2 inline-block font-semibold text-vip hover:underline">
            Ver qué cambió
          </Link>
        </div>
        <button
          type="button"
          onClick={ocultarPorEstaSesion}
          aria-label="Ocultar esta notificación por ahora"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-tertiary hover:bg-surface-2 hover:text-text"
        >
          <X size={16} />
        </button>
      </div>
    </aside>
  );
}
