"use client";

import { useActionState, useState } from "react";
import { UserPlus, Copy, Check, Mail } from "lucide-react";
import { crearAlumnoYEnviarCorreo, type FormStateCredenciales } from "@/app/admin/alumnos/actions";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";

const initialState: FormStateCredenciales = { error: null, ok: false };

export function CrearAlumnoForm() {
  const [abierto, setAbierto] = useState(false);
  const [state, formAction, pending] = useActionState(crearAlumnoYEnviarCorreo, initialState);

  return (
    <div className="space-y-3">
      <Button onClick={() => setAbierto((v) => !v)}>
        <UserPlus size={18} /> {abierto ? "Cancelar" : "Agregar alumno nuevo"}
      </Button>

      {abierto && (
        <Card>
          {state.ok && state.password ? (
            <ResultadoCreacion
              email={state.email!}
              password={state.password}
              correoEnviado={!!state.correoEnviado}
              onCerrar={() => setAbierto(false)}
            />
          ) : (
            <form action={formAction} className="space-y-3">
              <div>
                <label className="text-caption mb-1.5 block text-text-tertiary">NOMBRE</label>
                <Input name="nombre" required className="uppercase" />
              </div>
              <div>
                <label className="text-caption mb-1.5 block text-text-tertiary">CORREO</label>
                <Input name="email" type="email" required />
              </div>
              <div>
                <label className="text-caption mb-1.5 block text-text-tertiary">OBJETIVO (opcional)</label>
                <Select name="objetivo" defaultValue="">
                  <option value="">Pendiente de definir</option>
                  <option value="Pérdida de grasa">Pérdida de grasa</option>
                  <option value="Aumento de masa muscular">Aumento de masa muscular</option>
                  <option value="Recomposición corporal">Recomposición corporal</option>
                  <option value="Mejorar condición física">Mejorar condición física</option>
                </Select>
              </div>

              <p className="text-caption text-text-tertiary">
                Se crea la cuenta con una contraseña generada y se le manda por correo, con el
                usuario y la contraseña, listos para entrar.
              </p>

              {state.error && <p className="text-caption text-error">{state.error}</p>}

              <Button type="submit" variant="success" loading={pending}>
                <Mail size={16} /> {pending ? "Creando y enviando…" : "Crear alumno y enviar por correo"}
              </Button>
            </form>
          )}
        </Card>
      )}
    </div>
  );
}

function ResultadoCreacion({
  email,
  password,
  correoEnviado,
  onCerrar,
}: {
  email: string;
  password: string;
  correoEnviado: boolean;
  onCerrar: () => void;
}) {
  return (
    <div className="space-y-3 text-center">
      {correoEnviado ? (
        <p className="text-body text-text">
          Cuenta lista. Le mandamos el usuario y la contraseña a <strong>{email}</strong>.
        </p>
      ) : (
        <>
          <p className="text-body text-text">
            Cuenta lista, pero no se pudo enviar el correo todavía (falta configurar el servicio
            de correo). Pasále estos datos al alumno por WhatsApp o en persona:
          </p>
          <CredencialesVisibles email={email} password={password} />
        </>
      )}
      <button onClick={onCerrar} className="text-secondary font-medium text-vip">
        Cerrar
      </button>
    </div>
  );
}

/** Muestra las credenciales de forma seleccionable y con un botón de copiar
 * que funciona también por HTTP (LAN/celular): `navigator.clipboard`
 * requiere un contexto seguro (HTTPS), así que si falla se cae a un
 * `<textarea>` temporal + `execCommand` como respaldo. */
export function CredencialesVisibles({ email, password }: { email: string; password: string }) {
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    const texto = `Correo: ${email}\nContraseña: ${password}`;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(texto);
      } else {
        throw new Error("clipboard API no disponible");
      }
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = texto;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      try {
        document.execCommand("copy");
      } catch {
        // Ni el respaldo funcionó — los datos igual quedan visibles y
        // seleccionables abajo para copiarlos a mano.
      }
      document.body.removeChild(textarea);
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <div className="space-y-3">
      <div className="radius-control select-all space-y-1 bg-surface-2 p-4 text-left">
        <p className="text-secondary text-text-tertiary">
          CORREO <span className="block font-mono text-body text-text">{email}</span>
        </p>
        <p className="text-secondary mt-2 text-text-tertiary">
          CONTRASEÑA <span className="block font-mono text-body text-text">{password}</span>
        </p>
      </div>
      <Button onClick={copiar} variant="secondary">
        {copiado ? <Check size={16} /> : <Copy size={16} />} {copiado ? "Copiado" : "Copiar datos"}
      </Button>
    </div>
  );
}
