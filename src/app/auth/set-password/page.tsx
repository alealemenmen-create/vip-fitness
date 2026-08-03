"use client";

import { useActionState, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fijarContrasena, type SetPasswordState } from "./actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";

const initialState: SetPasswordState = { error: null };

// Supabase entrega la sesión de invitación en el fragmento #access_token=...
// de la URL (flujo implícito). Ese fragmento nunca llega al servidor, así que
// hay que dejar que el cliente de Supabase en el navegador lo procese antes
// de mostrar el formulario.
function useSesionDesdeLink() {
  const [estado, setEstado] = useState<"cargando" | "lista" | "sin_sesion">("cargando");

  useEffect(() => {
    let activo = true;
    createClient()
      .auth.getSession()
      .then(({ data: { session } }) => {
        if (activo) setEstado(session ? "lista" : "sin_sesion");
      });
    return () => {
      activo = false;
    };
  }, []);

  return estado;
}

export default function SetPasswordPage() {
  const estadoSesion = useSesionDesdeLink();
  const [state, formAction, pending] = useActionState(fijarContrasena, initialState);

  return (
    // `h-dvh overflow-y-auto`: ver el comentario en registro/page.tsx — desde
    // que `html`/`body` dejaron de scrollear globalmente, cualquier página
    // fuera de /alumno y /admin necesita su propio contenedor con scroll.
    <div className="flex h-dvh items-center justify-center overflow-y-auto bg-bg px-4 [-webkit-overflow-scrolling:touch]">
      <div className="radius-card w-full max-w-sm bg-surface p-8">
        <div className="mb-3 flex justify-end">
          <ThemeToggle />
        </div>
        <Logo height={72} className="mb-6" />
        <h1 className="text-h2 text-text">Crea tu contraseña</h1>

        {estadoSesion === "cargando" && (
          <p className="text-body mt-4 text-text-secondary">Verificando tu invitación…</p>
        )}

        {estadoSesion === "sin_sesion" && (
          <p className="text-body mt-4 text-error">
            Este link no es válido o ya expiró. Pide a tu entrenador que te envíe una nueva
            invitación.
          </p>
        )}

        {estadoSesion === "lista" && (
          <>
            <p className="text-secondary mt-2 text-text-secondary">
              Tu entrenador te invitó a la plataforma. Elige una contraseña para tu cuenta.
            </p>

            <form action={formAction} className="mt-8 space-y-4">
              <div>
                <label className="text-caption mb-1.5 block text-text-tertiary">CONTRASEÑA</label>
                <Input
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="text-caption mb-1.5 block text-text-tertiary">
                  CONFIRMAR CONTRASEÑA
                </label>
                <Input
                  name="confirmar"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>

              {state.error && <p className="text-caption text-error">{state.error}</p>}

              <Button type="submit" loading={pending} className="mt-2">
                {pending ? "Guardando…" : "Guardar y entrar"}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
