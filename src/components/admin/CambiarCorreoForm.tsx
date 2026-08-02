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
    <form action={formAction} className="space-y-1.5">
      {camposOcultos &&
        Object.entries(camposOcultos).map(([nombre, valor]) => (
          <input key={nombre} type="hidden" name={nombre} value={valor} />
        ))}
      <div>
        <label className="text-[9px] mb-0.5 block text-text-tertiary">CORREO NUEVO</label>
        <Input type="email" name="correo" required autoComplete="email" className="!py-1.5 text-caption" />
      </div>
      {state.error && <p className="text-caption text-error">{state.error}</p>}
      {state.ok && <p className="text-caption text-success">Correo actualizado.</p>}
      <Button type="submit" variant="secondary" loading={pending} size="xs">
        <Mail size={13} /> {etiqueta}
      </Button>
    </form>
  );
}
