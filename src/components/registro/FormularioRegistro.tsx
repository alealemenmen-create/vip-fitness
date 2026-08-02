"use client";

import { useActionState, useState } from "react";
import { Check, Send } from "lucide-react";
import { enviarSolicitudRegistro, type SolicitudState } from "@/app/registro/actions";
import { PasoPago, type DatosPago } from "@/components/registro/PasoPago";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { CampoFecha } from "@/components/ui/CampoFecha";
import { OBJETIVOS, SEXOS } from "@/lib/solicitudes/campos";

const initialState: SolicitudState = { error: null, ok: false };

function Campo({
  etiqueta,
  htmlFor,
  children,
}: {
  etiqueta: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="text-caption mb-1.5 block text-text-tertiary">
        {etiqueta}
      </label>
      {children}
    </div>
  );
}

export function FormularioRegistro({ pago }: { pago: DatosPago | null }) {
  const [state, formAction, pending] = useActionState(enviarSolicitudRegistro, initialState);
  // El nombre se guarda al enviar para saludar por WhatsApp en el paso del
  // pago: el formulario ya no está en pantalla cuando hace falta.
  const [nombreEnviado, setNombreEnviado] = useState("");

  // Con el cobro apagado (`pago === null`, que es el estado de la beta) el
  // registro termina acá mismo: no se le muestran datos bancarios a nadie.
  if (state.ok && pago && state.solicitudId) {
    return (
      <PasoPago solicitudId={state.solicitudId} nombre={nombreEnviado} datos={pago} />
    );
  }

  if (state.ok) {
    return (
      <div className="space-y-4 py-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/15">
          <Check size={28} className="text-success" />
        </div>
        <h2 className="text-h3 text-text">¡Listo, recibimos tus datos!</h2>
        <p className="text-body text-text-secondary">
          Tu entrenador va a revisar la solicitud. Cuando la acepte te llega un correo con tu
          usuario y contraseña para entrar a la app.
        </p>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        setNombreEnviado(new FormData(e.currentTarget).get("nombre")?.toString() ?? "");
      }}
      className="space-y-4"
    >
      {/* Campo trampa para bots — invisible y fuera del recorrido del teclado. */}
      <input
        type="text"
        name="sitio_web"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />

      <p className="text-caption text-text-tertiary">TUS DATOS</p>

      <Campo etiqueta="NOMBRE COMPLETO" htmlFor="reg-nombre">
        <Input id="reg-nombre" name="nombre" required autoComplete="name" className="uppercase" />
      </Campo>

      <Campo etiqueta="CORREO" htmlFor="reg-email">
        <Input id="reg-email" name="email" type="email" required autoComplete="email" />
      </Campo>

      <Campo etiqueta="TELÉFONO (WHATSAPP)" htmlFor="reg-telefono">
        <Input
          id="reg-telefono"
          name="telefono"
          type="tel"
          required
          autoComplete="tel"
          placeholder="+56 9 1234 5678"
          inputMode="tel"
        />
      </Campo>

      <Campo etiqueta="FECHA DE NACIMIENTO" htmlFor="reg-nacimiento">
        <CampoFecha id="reg-nacimiento" name="fecha_nacimiento" />
      </Campo>

      <Campo etiqueta="SEXO" htmlFor="reg-sexo">
        <Select id="reg-sexo" name="sexo" defaultValue="">
          <option value="">Prefiero no decirlo</option>
          {SEXOS.filter((s) => s.valor !== "otro").map((s) => (
            <option key={s.valor} value={s.valor}>
              {s.etiqueta}
            </option>
          ))}
        </Select>
      </Campo>

      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="ESTATURA (CM)" htmlFor="reg-estatura">
          <Input
            id="reg-estatura"
            name="estatura_cm"
            type="number"
            step="0.5"
            min="80"
            max="260"
            inputMode="decimal"
            placeholder="170"
          />
        </Campo>
        <Campo etiqueta="PESO ACTUAL (KG)" htmlFor="reg-peso">
          <Input
            id="reg-peso"
            name="peso_kg"
            type="number"
            step="0.1"
            min="20"
            max="500"
            inputMode="decimal"
            placeholder="70"
          />
        </Campo>
      </div>

      <p className="text-caption pt-2 text-text-tertiary">TU ENTRENAMIENTO</p>

      <Campo etiqueta="OBJETIVO" htmlFor="reg-objetivo">
        <Select id="reg-objetivo" name="objetivo" defaultValue="">
          <option value="">Todavía no lo tengo claro</option>
          {OBJETIVOS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </Select>
      </Campo>

      <Campo etiqueta="CONDICIÓN MÉDICA O LESIONES">
        <Textarea
          name="condicion_medica"
          rows={2}
          placeholder="Ej: Ninguna, asma, hipertensión, lesión de rodilla…"
        />
      </Campo>

      <Campo etiqueta="CONDICIÓN ALIMENTICIA / ALERGIAS">
        <Textarea
          name="restriccion_alimenticia"
          rows={2}
          placeholder="Ej: Ninguna, vegetariano, alergia al maní…"
        />
      </Campo>

      <Campo etiqueta="ALGO MÁS QUE QUIERAS CONTARNOS (OPCIONAL)">
        <Textarea
          name="mensaje"
          rows={2}
          placeholder="Horarios en los que puedes entrenar, experiencia previa…"
        />
      </Campo>

      {state.error && <p className="text-caption text-error">{state.error}</p>}

      <p className="text-caption text-text-tertiary">
        Solo tu entrenador ve esta información. Al aceptar tu solicitud te llega un correo con los
        datos para entrar.
      </p>

      <Button type="submit" loading={pending} className="mt-1">
        <Send size={16} /> {pending ? "Enviando…" : "Enviar solicitud"}
      </Button>
    </form>
  );
}
