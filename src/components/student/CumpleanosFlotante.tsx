"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PartyPopper } from "lucide-react";
import type { CumpleaneroHoy } from "@/lib/noticias/data";

/** Burbuja flotante cuando hoy es el cumpleaños de algún alumno — mismo
 * lenguaje visual que el aviso de anuncio importante, pero en dorado VIP en
 * vez de rojo, y siempre lleva a Noticias donde está el mensaje completo. */
export function CumpleanosFlotante({ cumpleaneros }: { cumpleaneros: CumpleaneroHoy[] }) {
  const pathname = usePathname();
  if (pathname === "/alumno/noticias" || cumpleaneros.length === 0) return null;

  const texto =
    cumpleaneros.length === 1
      ? `Hoy es el cumpleaños de ${cumpleaneros[0].nombre}`
      : `Hoy cumplen años ${cumpleaneros.length} personas`;

  return (
    <Link
      href="/alumno/noticias"
      aria-label={texto}
      className="fixed bottom-24 left-4 z-40 flex max-w-[75%] items-center gap-2 rounded-full border border-vip bg-vip/15 px-3 py-2 text-caption font-semibold text-vip shadow-lg backdrop-blur-sm"
    >
      <PartyPopper size={16} className="shrink-0" />
      <span className="truncate">{texto}</span>
    </Link>
  );
}
