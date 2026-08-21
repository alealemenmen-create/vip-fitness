"use client";

import Link from "next/link";
import { PencilRuler } from "lucide-react";
import { guardarUltimoAlumnoElegido } from "@/lib/admin/ultimo-alumno-local";

/**
 * El botón "Rutina" de la ficha de Control VIP V2. Antes de entrar a
 * `/control-vip/rutinas` deja a este alumno como "el último elegido" —
 * misma clave compartida que ya leen Armar rutina, Documentos y Rutinas
 * hechas (`src/lib/admin/ultimo-alumno-local.ts`) — así la selección viaja
 * con el entrenador en vez de perderse al cambiar de pantalla (doc §5,
 * principio 2).
 */
export function BotonRutinaFicha({ alumnoId }: { alumnoId: string }) {
  return (
    <Link
      href="/control-vip/rutinas"
      onClick={() => guardarUltimoAlumnoElegido(alumnoId)}
      className="boton-panel-secundario"
    >
      <PencilRuler size={14} /> <span className="hidden sm:inline">Rutina</span>
    </Link>
  );
}
