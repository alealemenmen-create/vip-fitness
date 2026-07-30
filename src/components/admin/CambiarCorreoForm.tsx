"use client";

import { useActionState } from "react";
import { Mail } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { FormState } from "@/app/admin/alumnos/actions";

const initialState: FormState = { error: null, ok: false };

export function CambiarCorreoForm({
  accion,
  camposOcultos,
  etiqueta = "Cambiar correo",
}: {
  accion: (prevState: FormState, formData: FormData) => Promise<FormState>;
  camposOcultos?: Record<string, string>;
  etiqueta?: string;
}) {
  const [state, formAction, pending] = useActionState(accion, initialState);

  return (
    <form action={formAction} className="space-y-3">
      {camposOcultos &&
        Object.entries(camposOcultos).map(([nombre, valor]) => (
          <input key={nombre} type="hidden" name={nombre} value={valor} />
        ))}
      <div>
        <label className="text-caption mb-1.5 block text-text-tertiary">CORREO NUEVO</label>
        <Input type="email" name="correo" required autoComplete="email" />
      </div>
      {state.error && <p className="text-caption text-error">{state.error}</p>}
      {state.ok && <p className="text-caption text-success">Correo actualizado.</p>}
      <Button type="submit" variant="secondary" loading={pending}>
        <Mail size={16} /> {etiqueta}
      </Button>
    </form>
  );
}
