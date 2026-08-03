"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { login, recuperarPassword, type LoginState, type RecuperarState } from "@/app/login/actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { InputPassword } from "@/components/ui/InputPassword";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";

const initialState: LoginState = { error: null };
const initialRecuperarState: RecuperarState = { mensaje: null, error: null };

/**
 * Pantalla de entrada. Vive en un componente aparte de app/login/page.tsx
 * para que la página pueda ser un Server Component y leer la configuración
 * del gimnasio (si la beta está en curso, ver lib/configuracion/registro.ts)
 * sin que este formulario deje de correr en el navegador.
 *
 * `beta` solo cambia cómo se invita a inscribirse: durante la prueba el
 * llamado es explícito ("Inscríbete a la beta") y aclara que es un
 * estreno; después queda como un alta normal.
 *
 * El verbo es "inscribirse", no "registrarse", para que el botón hable el
 * mismo idioma que la pantalla a la que lleva ("Inscríbete"). La ruta sigue
 * siendo /registro.
 */
export function LoginForm({ beta }: { beta: boolean }) {
  const [state, formAction, pending] = useActionState(login, initialState);
  const [recuperando, setRecuperando] = useState(false);
  const [stateRecuperar, formActionRecuperar, pendingRecuperar] = useActionState(
    recuperarPassword,
    initialRecuperarState
  );

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
                <InputPassword
                  id="login-password"
                  name="password"
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

            <div className="mt-6 border-t border-border pt-6">
              <Link
                href="/registro"
                className="radius-control flex h-12 w-full items-center justify-center gap-2 border border-border text-body font-medium text-vip"
              >
                <UserPlus size={18} />
                {beta ? "Inscríbete a la beta" : "Inscríbete"}
              </Link>
              <p className="text-caption mt-3 text-center text-text-tertiary">
                {beta
                  ? "¿Todavía no tienes cuenta? Estamos estrenando la app: inscríbete y tu entrenador te activa el acceso. Recuerda que esto es solo una prueba."
                  : "¿Todavía no tienes cuenta? Déjanos tus datos y tu entrenador activa tu acceso."}
              </p>
            </div>
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
