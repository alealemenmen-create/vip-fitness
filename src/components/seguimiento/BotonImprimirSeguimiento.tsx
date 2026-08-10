"use client";

import { Printer } from "lucide-react";

export function BotonImprimirSeguimiento() {
  return <button type="button" onClick={() => window.print()} className="imprimir-oculto radius-control flex items-center gap-2 bg-vip px-4 py-2.5 text-sm font-bold text-black"><Printer size={17} /> Guardar como PDF / Imprimir</button>;
}
