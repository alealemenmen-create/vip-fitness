"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { AvisoNotaIA } from "@/app/admin/alumnos/data";
import { nombreAlumnoPublicado } from "@/lib/nombre";

/** Aviso de que la IA le dejó una nota a algún alumno (motivación por peso o
 * refuerzo semanal porque el entrenador no alcanzó a escribirle). Solo
 * informativo — se marca como visto al entrar a la ficha del alumno.
 *
 * Empieza cerrado: es una gaveta, no algo que deba ocupar pantalla mientras
 * el entrenador solo quiere ver la lista de alumnos. */
export function AvisosNotasIA({ avisos }: { avisos: AvisoNotaIA[] }) {
  const [abierto, setAbierto] = useState(false);

  if (avisos.length === 0) return null;

  return (
    <Card padding="p-0" className="overflow-hidden">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-[10px] text-text-tertiary"
      >
        <Sparkles size={11} className="text-vip" />
        <span className="flex-1 text-left">
          LA IA LE DEJÓ NOTA A {avisos.length > 1 ? `(${avisos.length})` : ""}
        </span>
        <ChevronDown
          size={14}
          className={`transition-transform duration-200 ${abierto ? "rotate-180" : ""}`}
        />
      </button>
      {abierto && (
        <div className="space-y-2 border-t border-border p-3">
          {avisos.map((aviso, i) => (
            <Link
              key={`${aviso.alumnoId}-${i}`}
              href={`/admin/alumnos/${aviso.alumnoId}`}
              className="block rounded-xl bg-surface-2 px-3 py-2.5"
            >
              <p className="text-secondary font-medium text-text">
                {nombreAlumnoPublicado(aviso.nombre)}
              </p>
              <p className="truncate text-caption text-text-tertiary">{aviso.texto}</p>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}
