"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertCircle } from "lucide-react";
import type { Anuncio } from "@/lib/noticias/data";

/**
 * Burbuja flotante visible en cualquier pestaña cuando el entrenador publica
 * un anuncio marcado como "importante" — más agresiva que el punto rojo del
 * menú, para avisos que de verdad hay que leer. Se esconde sola en Noticias
 * (esa página ya lo muestra y marca la visita).
 */
export function AnuncioImportanteFlotante({ anuncio }: { anuncio: Anuncio }) {
  const pathname = usePathname();
  if (pathname === "/alumno/noticias") return null;

  return (
    <Link
      href="/alumno/noticias"
      aria-label={`Anuncio importante: ${anuncio.titulo}`}
      className="fixed bottom-24 left-4 z-40 flex max-w-[75%] items-center gap-2 rounded-full border border-error bg-error/15 px-3 py-2 text-caption font-semibold text-error shadow-lg backdrop-blur-sm"
    >
      <AlertCircle size={16} className="shrink-0 animate-pulse" />
      <span className="truncate">{anuncio.titulo}</span>
    </Link>
  );
}
