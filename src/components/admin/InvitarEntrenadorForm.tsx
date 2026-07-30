"use client";

import { useActionState, useState } from "react";
import { UserCog } from "lucide-react";
import { crearEntrenador, type FormState } from "@/app/admin/alumnos/actions";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const initialState: FormState = { error: null, ok: false };

export function InvitarEntrenadorForm() {
  const [abierto, setAbierto] = useState(false);
  const [state, formAction, pending] = useActionState(crearEntrenador, initialState);

  return (
    <div className="space-y-3">
      <Button variant="secondary" onClick={() => setAbierto((v) => !v)}>
        <UserCog size={18} /> {abierto ? "Cancelar" : "Agregar entrenador"}
      </Button>

      {abierto && (
        <Card>
          {state.ok ? (
            <div className="space-y-2 text-center">
              <p className="text-body text-text">
                Invitación enviada. El entrenador recibirá un correo para crear su contraseña.
              </p>
              <button onClick={() => setAbierto(false)} className="text-secondary font-medium text-vip">
                Cerrar
              </button>
            </div>
          ) : (
            <form action={formAction} className="space-y-3">
              <div>
                <label className="text-caption mb-1.5 block text-text-tertiary">NOMBRE</label>
                <Input name="nombre" required />
              </div>
              <div>
                <label className="text-caption mb-1.5 block text-text-tertiary">CORREO</label>
                <Input name="email" type="email" required />
              </div>

              {state.error && <p className="text-caption text-error">{state.error}</p>}

              <Button type="submit" variant="success" loading={pending}>
                {pending ? "Enviando invitación…" : "Enviar invitación"}
              </Button>
            </form>
          )}
        </Card>
      )}
    </div>
  );
}
