"use client";

import { useState, type FormEvent } from "react";
import { KeyRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

/**
 * Cambia la contraseña de la cuenta con la que se está logueado ahora mismo,
 * sin pasar por Supabase ni por correo — usa la sesión activa del navegador
 * (`auth.updateUser`), que no necesita la contraseña anterior.
 */
export function CambiarMiPassword() {
  const [nueva, setNueva] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [estado, setEstado] = useState<"idle" | "cargando" | "ok" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (nueva.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (nueva !== confirmar) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setEstado("cargando");
    const { error: errorUpdate } = await createClient().auth.updateUser({ password: nueva });
    if (errorUpdate) {
      setEstado("error");
      setError("No fue posible cambiar la contraseña. Intenta nuevamente.");
      return;
    }
    setEstado("ok");
    setNueva("");
    setConfirmar("");
  }

  return (
    <Card className="space-y-3 p-4">
      <p className="text-caption text-text-tertiary">MI CUENTA</p>
      <p className="text-secondary text-text-secondary">
        Cambiá tu propia contraseña acá, sin necesitar entrar a Supabase.
      </p>
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="text-caption mb-1.5 block text-text-tertiary">CONTRASEÑA NUEVA</label>
          <Input
            type="password"
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            minLength={8}
            autoComplete="new-password"
          />
        </div>
        <div>
          <label className="text-caption mb-1.5 block text-text-tertiary">CONFIRMAR</label>
          <Input
            type="password"
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
            minLength={8}
            autoComplete="new-password"
          />
        </div>
        {error && <p className="text-caption text-error">{error}</p>}
        {estado === "ok" && (
          <p className="text-caption text-success">Contraseña actualizada.</p>
        )}
        <Button type="submit" variant="secondary" loading={estado === "cargando"}>
          <KeyRound size={16} /> Cambiar contraseña
        </Button>
      </form>
    </Card>
  );
}
