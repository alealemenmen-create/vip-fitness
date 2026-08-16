"use client";

import { useActionState, useState } from "react";
import { usePathname } from "next/navigation";
import { Star, Check } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { enviarResenaApp, type EnviarResenaState } from "@/app/alumno/perfil/resena-actions";

const ESTADO_INICIAL: EnviarResenaState = { error: null, ok: false };

/** Reseña de la app: estrellas + sugerencia libre, siempre accesible desde
 * el perfil — sin popups que interrumpan mitad de un entrenamiento. */
export function ResenaApp() {
  const [state, formAction, pending] = useActionState(enviarResenaApp, ESTADO_INICIAL);
  const [estrellas, setEstrellas] = useState(0);
  const [hover, setHover] = useState(0);
  const pathname = usePathname();

  if (state.ok) {
    return (
      <Card padding="p-4" className="text-center">
        <span className="mx-auto grid size-10 place-items-center rounded-full bg-success/15 text-success">
          <Check size={20} strokeWidth={3} />
        </span>
        <p className="text-body mt-2 font-bold text-text">¡Gracias por tu opinión!</p>
        <p className="text-caption mt-1 text-text-secondary">La leemos todas.</p>
      </Card>
    );
  }

  const mostrada = hover || estrellas;

  return (
    <Card padding="p-4">
      <p className="text-body font-bold text-text">¿Cómo te va con VIP Fitness?</p>
      <p className="text-caption mt-0.5 text-text-secondary">Tu opinión y tus ideas llegan directo al entrenador.</p>
      <form action={formAction} className="mt-3 space-y-3">
        <input type="hidden" name="estrellas" value={estrellas} />
        <input type="hidden" name="ruta" value={pathname ?? "/alumno/perfil"} />
        <div className="flex items-center justify-center gap-1.5" role="radiogroup" aria-label="Puntuación de 1 a 5 estrellas">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={estrellas === n}
              aria-label={`${n} ${n === 1 ? "estrella" : "estrellas"}`}
              onClick={() => setEstrellas(n)}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              className="p-1"
            >
              <Star
                size={30}
                className={n <= mostrada ? "fill-vip text-vip" : "text-text-tertiary"}
                strokeWidth={1.5}
              />
            </button>
          ))}
        </div>
        <Textarea
          name="sugerencia"
          placeholder="¿Algo que podamos mejorar? (opcional)"
          rows={3}
          maxLength={2000}
        />
        {state.error && <p className="text-caption text-error">{state.error}</p>}
        <Button type="submit" loading={pending} disabled={estrellas === 0} className="w-full">
          Enviar
        </Button>
      </form>
    </Card>
  );
}
