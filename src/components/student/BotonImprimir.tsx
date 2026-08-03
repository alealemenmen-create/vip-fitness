"use client";

import { Printer } from "lucide-react";

export function BotonImprimir() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="radius-control flex items-center gap-1.5 border border-border bg-surface px-3 py-1.5 text-caption font-medium text-text-secondary"
    >
      <Printer size={14} /> Imprimir
    </button>
  );
}
