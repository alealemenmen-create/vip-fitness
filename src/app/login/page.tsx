"use client";

import { useActionState, useState } from "react";
import { login, recuperarPassword, type LoginState, type RecuperarState } from "./actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";

const initialState: LoginState = { error: null };
const initialRecuperarState: RecuperarState = { mensaje: null, error: null };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);
  const [recuperando, setRecuperando] = useState(false);
  const [stateRecuperar, formActionRecuperar, pendingRecuperar] = useActionState(
    recuperarPassword,
    initialRecuperarState
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="radius-card w-full max-w-sm bg-surface p-8">
        <div className="mb-3 flex justify-end">
          <ThemeToggle />
        </div>
        <Logo height={72} className="mb-6" />
        <h1 className="text-h2 text-text">Iniciar sesión</h1>

        {!recuperando ? (
          <>
            <form action={formAction} className="mt-8 space-y-4">
              <div>
                <label htmlFor="login-email" className="text-caption mb-1.5 block text-text-tertiary">
                  CORREO
                </label>
                <Input id="login-email" name="email" type="email" required autoComplete="email" />
              </div>
              <div>
                <label htmlFor="login-password" className="text-caption mb-1.5 block text-text-tertiary">
                  CONTRASEÑA
                </label>
                <Input
                  id="login-password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                />
              </div>

              {state.error && <p className="text-caption text-error">{state.error}</p>}

              <Button type="submit" loading={pending} className="mt-2">
                {pending ? "Ingresando…" : "Ingresar"}
              </Button>
            </form>

            <button
              onClick={() => setRecuperando(true)}
              className="text-secondary mt-4 block w-full text-center font-medium text-vip"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </>
        ) : (
          <>
            {stateRecuperar.mensaje ? (
              <p className="text-body mt-6 text-text">{stateRecuperar.mensaje}</p>
            ) : (
              <form action={formActionRecuperar} className="mt-6 space-y-4">
                <p className="text-secondary text-text-secondary">
                  Ingresa tu correo y te mandamos un link para elegir una contraseña nueva.
                </p>
                <div>
                  <label
                    htmlFor="recovery-email"
                    className="text-caption mb-1.5 block text-text-tertiary"
                  >
                    CORREO
                  </label>
                  <Input
                    id="recovery-email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                  />
                </div>

                {stateRecuperar.error && (
                  <p className="text-caption text-error">{stateRecuperar.error}</p>
                )}

                <Button type="submit" loading={pendingRecuperar} className="mt-2">
                  {pendingRecuperar ? "Enviando…" : "Enviar link de recuperación"}
                </Button>
              </form>
            )}

            <button
              onClick={() => setRecuperando(false)}
              className="text-secondary mt-4 block w-full text-center font-medium text-vip"
            >
              Volver a iniciar sesión
            </button>
          </>
        )}
      </div>
    </div>
  );
}
