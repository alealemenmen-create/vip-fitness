"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, RefreshCw } from "lucide-react";
import { refrescarCatalogo } from "@/app/admin/ejercicios/actions";

/** Para cuando el catálogo se edita fuera de la app.
 *
 * La biblioteca de ejercicios y las técnicas se cachean una hora. Si el cambio
 * pasa por la app (crear un ejercicio, subirle una foto), el caché se limpia
 * solo. Si se edita la tabla directo en Supabase —que es como se cargan las
 * máquinas nuevas o se desactivan las que el gimnasio no tiene— nada avisa, y
 * el generador seguiría ofreciendo lo viejo. Esto lo fuerza. */
export function BotonRefrescarCatalogo() {
  const [pendiente, startTransition] = useTransition();
  const [listo, setListo] = useState(false);
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={pendiente}
      onClick={() =>
        startTransition(async () => {
          await refrescarCatalogo();
          router.refresh();
          setListo(true);
          setTimeout(() => setListo(false), 3000);
        })
      }
      className="radius-control flex items-center justify-center gap-2 border border-border bg-surface py-2 text-caption text-text-secondary disabled:opacity-50"
    >
      {listo ? <Check size={15} className="text-success" /> : <RefreshCw size={15} className={pendiente ? "animate-spin" : ""} />}
      {listo ? "Catálogo al día" : pendiente ? "Actualizando…" : "Actualizar catálogo"}
    </button>
  );
}
