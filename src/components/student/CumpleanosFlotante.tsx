"use client";

import { usePathname } from "next/navigation";
import { PartyPopper } from "lucide-react";
import type { CumpleaneroHoy } from "@/lib/noticias/data";
import { hoyISO } from "@/lib/date";
import { BurbujaFlotante } from "./BurbujaFlotante";

/** Burbuja flotante cuando hoy es el cumpleaños de algún alumno — mismo
 * lenguaje visual que el aviso de anuncio importante, pero en dorado VIP en
 * vez de rojo, y siempre lleva a Noticias donde está el mensaje completo.
 * Se puede arrastrar o cerrar a mano (ver BurbujaFlotante) sin que la
 * noticia deje de existir ahí. */
export function CumpleanosFlotante({ cumpleaneros }: { cumpleaneros: CumpleaneroHoy[] }) {
  const pathname = usePathname();
  if (
    pathname === "/alumno/noticias" ||
    pathname.startsWith("/alumno/entrenar/sesion/") ||
    cumpleaneros.length === 0
  ) return null;

  const texto =
    cumpleaneros.length === 1
      ? `Hoy es el cumpleaños de ${cumpleaneros[0].nombre}`
      : `Hoy cumplen años ${cumpleaneros.length} personas`;

  return (
    <BurbujaFlotante
      // Por día: mañana es un cumpleaños distinto, así que cerrar el de hoy
      // no debe esconder el de mañana.
      claveCierre={`vip-burbuja-cumple-${hoyISO()}`}
      href="/alumno/noticias"
      ariaLabel={texto}
      tono="vip"
    >
      <PartyPopper size={16} className="shrink-0" />
      <span className="truncate">{texto}</span>
    </BurbujaFlotante>
  );
}
