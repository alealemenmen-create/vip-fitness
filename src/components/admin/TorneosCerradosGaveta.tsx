"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Archive } from "lucide-react";
import { TorneoAdminCard } from "@/components/admin/TorneoAdminCard";
import type { TorneoAdmin } from "@/lib/torneos/types";

/**
 * Los torneos cerrados van a una gaveta, no sueltos en la pantalla: cada
 * competencia que se completa y se cierra queda archivada acá, y con el
 * tiempo la lista solo crece. Mostrarlas todas abiertas de una hacía la
 * página cada vez más larga. Arranca CERRADA a propósito — para verlas hay
 * que pedirlo, no cargarlas de entrada.
 */
export function TorneosCerradosGaveta({ torneos }: { torneos: TorneoAdmin[] }) {
  const [abierta, setAbierta] = useState(false);

  if (torneos.length === 0) return null;

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setAbierta((v) => !v)}
        className="radius-control flex w-full items-center justify-between border border-border bg-surface px-3 py-2.5"
      >
        <span className="flex items-center gap-2 text-caption font-medium text-text-tertiary">
          <Archive size={14} />
          CERRADOS ({torneos.length})
        </span>
        {abierta ? (
          <ChevronUp size={16} className="text-text-secondary" />
        ) : (
          <ChevronDown size={16} className="text-text-secondary" />
        )}
      </button>

      {abierta && (
        <div className="space-y-3">
          {torneos.map((t) => (
            <TorneoAdminCard key={t.id} torneo={t} />
          ))}
        </div>
      )}
    </div>
  );
}
