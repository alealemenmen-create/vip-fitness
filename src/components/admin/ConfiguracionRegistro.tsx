"use client";

import { useActionState, useState } from "react";
import { CreditCard, UserPlus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import {
  actualizarConfiguracionRegistro,
  type ConfiguracionState,
} from "@/app/admin/configuracion/actions";
import type { ConfiguracionRegistro as Config } from "@/lib/configuracion/registro";

const inicial: ConfiguracionState = { ok: false, mensaje: "" };

function Interruptor({
  name,
  label,
  detalle,
  defaultChecked,
  onChange,
}: {
  name: string;
  label: string;
  detalle: string;
  defaultChecked: boolean;
  onChange?: (valor: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 rounded-xl border border-border p-3">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        onChange={(e) => onChange?.(e.target.checked)}
        className="mt-1 h-4 w-4"
        style={{ accentColor: "var(--color-vip)" }}
      />
      <span>
        <span className="block text-body font-medium text-text">{label}</span>
        <span className="text-caption text-text-tertiary">{detalle}</span>
      </span>
    </label>
  );
}

function Campo({
  name,
  label,
  defaultValue,
  placeholder,
  type = "text",
}: {
  name: string;
  label: string;
  defaultValue: string;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="text-secondary block text-text-secondary">
      {label}
      <Input
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="mt-1"
      />
    </label>
  );
}

/**
 * Controla el link público de inscripción: el aviso de que la app está en
 * prueba y, sobre todo, el cobro.
 *
 * El cobro viene apagado de fábrica (migración 0033). Mientras lo esté, quien
 * se inscribe no ve datos bancarios ni se le pide comprobante — el registro
 * termina al mandar sus datos. Los campos del pago siguen editables con el
 * cobro apagado a propósito: así se deja todo listo y se enciende el día que
 * corresponda, sin tener que llenar nada a última hora.
 */
export function ConfiguracionRegistro({ config }: { config: Config }) {
  const [state, formAction, guardando] = useActionState(actualizarConfiguracionRegistro, inicial);
  const [pagoActivo, setPagoActivo] = useState(config.pagoActivo);

  return (
    <Card className="border border-border p-4">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-vip/10 text-vip">
          <UserPlus size={20} />
        </span>
        <div>
          <p className="text-card-title text-text">Registro de alumnos</p>
          <p className="text-secondary mt-0.5 text-text-secondary">
            El link público que compartes por WhatsApp para que se inscriban solos.
          </p>
        </div>
      </div>

      <form action={formAction} className="space-y-4">
        <Interruptor
          name="beta"
          label="Avisar que la app está en prueba"
          detalle="Muestra el aviso de beta en la pantalla de inscripción y en la de entrada. Apágalo cuando termine la prueba."
          defaultChecked={config.betaAviso}
        />

        <Interruptor
          name="pago_activo"
          label="Pedir el pago de la inscripción"
          detalle="Con esto encendido, después de mandar sus datos ve tus datos bancarios y puede adjuntar el comprobante."
          defaultChecked={config.pagoActivo}
          onChange={setPagoActivo}
        />

        <div className={pagoActivo ? "" : "opacity-60"}>
          <div className="mb-3 flex items-center gap-2">
            <CreditCard size={16} className="text-text-tertiary" />
            <p className="text-caption text-text-tertiary">
              DATOS DE PAGO {pagoActivo ? "" : "(GUARDADOS, PERO NO SE MUESTRAN)"}
            </p>
          </div>

          <div className="space-y-3">
            <Campo
              name="pago_monto"
              label="Valor de la inscripción (pesos, vacío = no se muestra)"
              type="number"
              defaultValue={config.pagoMonto?.toString() ?? ""}
              placeholder="35000"
            />
            <Campo name="pago_banco" label="Banco" defaultValue={config.banco ?? ""} placeholder="Banco de Chile" />
            <Campo
              name="pago_tipo_cuenta"
              label="Tipo de cuenta"
              defaultValue={config.tipoCuenta ?? ""}
              placeholder="Cuenta corriente"
            />
            <Campo
              name="pago_numero_cuenta"
              label="Número de cuenta"
              defaultValue={config.numeroCuenta ?? ""}
              placeholder="00012345678"
            />
            <Campo name="pago_rut" label="RUT" defaultValue={config.rut ?? ""} placeholder="12.345.678-9" />
            <Campo
              name="pago_titular"
              label="A nombre de"
              defaultValue={config.titular ?? ""}
              placeholder="Nombre del titular"
            />
            <Campo
              name="pago_correo"
              label="Correo para el comprobante"
              type="email"
              defaultValue={config.correo ?? ""}
            />
            <label className="text-secondary block text-text-secondary">
              Instrucciones extra (opcional)
              <Textarea
                name="pago_instrucciones"
                rows={2}
                defaultValue={config.instrucciones ?? ""}
                placeholder="Ej: pon tu nombre en el mensaje de la transferencia."
                className="mt-1"
              />
            </label>
          </div>
        </div>

        <Campo
          name="whatsapp"
          label="WhatsApp del gimnasio (con código de país, solo números)"
          defaultValue={config.whatsapp ?? ""}
          placeholder="56912345678"
        />

        {state.mensaje && (
          <p className={`text-caption ${state.ok ? "text-success" : "text-error"}`}>
            {state.mensaje}
          </p>
        )}

        <Button type="submit" loading={guardando}>
          {guardando ? "Guardando…" : "Guardar"}
        </Button>
      </form>
    </Card>
  );
}
