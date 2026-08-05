"use client";

import { useActionState, useState } from "react";
import { KeyRound } from "lucide-react";
import { restablecerPasswordAlumno, type FormStateCredenciales } from "@/app/admin/alumnos/actions";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CredencialesVisibles } from "./CrearAlumnoForm";

const initialState: FormStateCredenciales = { error: null, ok: false };

/**
 * Para alumnos que ya existen pero quedaron trabados sin poder entrar (ej.
 * la invitación por correo nunca llegó): genera una contraseña nueva y se la
 * manda por correo, sin depender de la invitación original.
 */
export function CredencialesAlumno({ alumnoId }: { alumnoId: string }) {
  const [state, formAction, pending] = useActionState(restablecerPasswordAlumno, initialState);
  const [mostrado, setMostrado] = useState(true);

  return (
    <Card padding="p-2">
      <p className="text-[10px] mb-1 text-text-tertiary">ACCESO A LA CUENTA</p>

      {state.ok && state.password && mostrado ? (
        <div className="space-y-2 text-center">
          {state.correoEnviado ? (
            <p className="text-caption text-text">
              Listo. Le mandamos la nueva contraseña a <strong>{state.email}</strong>.
            </p>
          ) : (
            <>
              <p className="text-caption text-text">
                Contraseña cambiada, pero no se pudo enviar el correo (falta configurar el
                servicio de correo). Pasásela al alumno por WhatsApp o en persona:
              </p>
              <CredencialesVisibles email={state.email!} password={state.password} />
            </>
          )}
          <button onClick={() => setMostrado(false)} className="text-caption font-medium text-vip">
            Cerrar
          </button>
        </div>
      ) : (
        <form action={formAction} className="space-y-1.5">
          <input type="hidden" name="alumno_id" value={alumnoId} />
          <p className="text-caption text-text-secondary">
            Si el alumno no puede entrar (nunca le llegó el correo de invitación, o perdió la
            contraseña), genera una nueva aquí — se la mandamos por correo automáticamente.
          </p>
          {state.error && <p className="text-caption text-error">{state.error}</p>}
          <Button type="submit" variant="secondary" loading={pending} size="xs">
            <KeyRound size={13} /> Generar nueva contraseña
          </Button>
        </form>
      )}
    </Card>
  );
}
