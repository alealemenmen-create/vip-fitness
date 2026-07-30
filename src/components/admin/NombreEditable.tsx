"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { actualizarNombrePerfil, type FormState } from "@/app/admin/alumnos/actions";
import { Input } from "@/components/ui/Input";
import { Button, IconButton } from "@/components/ui/Button";

const initialState: FormState = { error: null, ok: false };

export function NombreEditable({ perfilId, nombre }: { perfilId: string; nombre: string }) {
  const [editando, setEditando] = useState(false);
  const [state, formAction, pending] = useActionState(actualizarNombrePerfil, initialState);
  const estadoPrevio = useRef(state);

  useEffect(() => {
    if (state !== estadoPrevio.current && state.ok) setEditando(false);
    estadoPrevio.current = state;
  }, [state]);

  if (!editando) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-body text-text">{nombre}</span>
        <IconButton ariaLabel="Editar nombre" onClick={() => setEditando(true)}>
          <Pencil size={15} />
        </IconButton>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="perfil_id" value={perfilId} />
      <Input name="nombre" defaultValue={nombre} className="h-10 py-2" autoFocus />
      <Button type="submit" size="sm" variant="success" loading={pending}>
        Guardar
      </Button>
      <button
        type="button"
        onClick={() => setEditando(false)}
        className="text-secondary text-text-tertiary"
      >
        Cancelar
      </button>
      {state.error && <p className="text-caption text-error">{state.error}</p>}
    </form>
  );
}
