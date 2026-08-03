"use client";

import { usePathname } from "next/navigation";
import { AlertCircle } from "lucide-react";
import type { Anuncio } from "@/lib/noticias/data";
import { BurbujaFlotante } from "./BurbujaFlotante";

/**
 * Burbuja flotante visible en cualquier pestaña cuando el entrenador publica
 * un anuncio marcado como "importante" — más agresiva que el punto rojo del
 * menú, para avisos que de verdad hay que leer. Se esconde sola en Noticias
 * (esa página ya lo muestra y marca la visita), y se puede arrastrar o
 * cerrar a mano (ver BurbujaFlotante) sin que la noticia deje de existir ahí.
 */
export function AnuncioImportanteFlotante({ anuncio }: { anuncio: Anuncio }) {
  const pathname = usePathname();
  if (pathname === "/alumno/noticias") return null;

  return (
    <BurbujaFlotante
      // Por id: cerrar ESTE anuncio no debe esconder el próximo importante
      // que publique el entrenador.
      claveCierre={`vip-burbuja-anuncio-${anuncio.id}`}
      href="/alumno/noticias"
      ariaLabel={`Anuncio importante: ${anuncio.titulo}`}
      tono="error"
    >
      <AlertCircle size={16} className="shrink-0 animate-pulse" />
      <span className="truncate">{anuncio.titulo}</span>
    </BurbujaFlotante>
  );
}
