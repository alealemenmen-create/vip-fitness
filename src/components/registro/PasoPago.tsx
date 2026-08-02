"use client";

import { useActionState, useRef, useState } from "react";
import { Check, Copy, MessageCircle, Paperclip, Upload } from "lucide-react";
import { subirComprobante, type ComprobanteState } from "@/app/registro/actions";
import { Button } from "@/components/ui/Button";
import { formatearMonto } from "@/lib/solicitudes/campos";

/** Los datos bancarios que se le muestran a quien se inscribe. Es un espejo
 * client-safe de ConfiguracionRegistro (lib/configuracion/registro.ts es
 * server-only), con solo lo que la pantalla de pago necesita. */
export type DatosPago = {
  monto: number | null;
  banco: string | null;
  tipoCuenta: string | null;
  numeroCuenta: string | null;
  rut: string | null;
  titular: string | null;
  correo: string | null;
  instrucciones: string | null;
  whatsapp: string | null;
};

const initialState: ComprobanteState = { error: null, ok: false };

/** Copia texto al portapapeles, con respaldo para cuando no hay HTTPS (la
 * clipboard API solo existe en contexto seguro). Mismo criterio que
 * CredencialesVisibles en el panel del entrenador. */
async function copiarTexto(texto: string) {
  try {
    if (!navigator.clipboard) throw new Error("clipboard API no disponible");
    await navigator.clipboard.writeText(texto);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = texto;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand("copy");
    } catch {
      // Los datos quedan visibles y seleccionables para copiarlos a mano.
    }
    document.body.removeChild(textarea);
  }
}

function FilaDato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    await copiarTexto(valor);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  };

  return (
    <div className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-0">
      <div className="min-w-0">
        <p className="text-caption text-text-tertiary">{etiqueta}</p>
        <p className="text-body select-all break-all text-text">{valor}</p>
      </div>
      <button
        onClick={copiar}
        aria-label={`Copiar ${etiqueta.toLowerCase()}`}
        className="radius-control flex h-9 w-9 shrink-0 items-center justify-center bg-surface-2 text-text-secondary"
      >
        {copiado ? <Check size={16} className="text-success" /> : <Copy size={16} />}
      </button>
    </div>
  );
}

export function PasoPago({
  solicitudId,
  nombre,
  datos,
}: {
  solicitudId: string;
  nombre: string;
  datos: DatosPago;
}) {
  const [state, formAction, pending] = useActionState(subirComprobante, initialState);
  const [archivo, setArchivo] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const mensajeWhatsApp = `Hola, soy ${nombre}. Acabo de hacer la transferencia de la inscripción a VIP Fitness y te mando el comprobante.`;

  /**
   * WhatsApp no acepta archivos por link (`wa.me` solo lleva texto), así que
   * el capture se entrega con el menú de compartir del sistema, que en el
   * celular sí puede pasarle la imagen a WhatsApp. Si el navegador no lo
   * soporta (típico en computador), se cae a abrir el chat con el mensaje ya
   * escrito para que adjunte el archivo a mano.
   */
  const enviarPorWhatsApp = async () => {
    if (archivo && navigator.canShare?.({ files: [archivo] })) {
      try {
        await navigator.share({ files: [archivo], text: mensajeWhatsApp });
        return;
      } catch {
        // Canceló el menú de compartir, o el navegador lo rechazó: sigue al
        // camino del link de abajo.
      }
    }
    const numero = datos.whatsapp ?? "";
    window.open(
      `https://wa.me/${numero}?text=${encodeURIComponent(mensajeWhatsApp)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const filas = [
    datos.banco && { etiqueta: "BANCO", valor: datos.banco },
    datos.tipoCuenta && { etiqueta: "TIPO DE CUENTA", valor: datos.tipoCuenta },
    datos.numeroCuenta && { etiqueta: "N° DE CUENTA", valor: datos.numeroCuenta },
    datos.rut && { etiqueta: "RUT", valor: datos.rut },
    datos.titular && { etiqueta: "A NOMBRE DE", valor: datos.titular },
    datos.correo && { etiqueta: "CORREO", valor: datos.correo },
  ].filter(Boolean) as { etiqueta: string; valor: string }[];

  return (
    <div className="space-y-5">
      <div>
        <p className="text-caption text-success">✓ DATOS RECIBIDOS</p>
        <h2 className="text-h3 mt-1 text-text">Último paso: el pago</h2>
        <p className="text-secondary mt-1 text-text-secondary">
          Transfiere el valor de la inscripción y adjunta el comprobante. Tu entrenador lo revisa y
          activa tu cuenta.
        </p>
      </div>

      {datos.monto !== null && (
        <div className="radius-control bg-vip/10 p-4 text-center">
          <p className="text-caption text-text-tertiary">VALOR DE LA INSCRIPCIÓN</p>
          <p className="text-h2 text-vip">{formatearMonto(datos.monto)}</p>
        </div>
      )}

      {filas.length > 0 && (
        <div className="radius-control bg-surface-2 px-4 py-1">
          {filas.map((fila) => (
            <FilaDato key={fila.etiqueta} etiqueta={fila.etiqueta} valor={fila.valor} />
          ))}
        </div>
      )}

      {datos.instrucciones && (
        <p className="text-secondary whitespace-pre-line text-text-secondary">
          {datos.instrucciones}
        </p>
      )}

      {state.ok ? (
        <div className="radius-control bg-success/10 p-4 text-center">
          <Check size={24} className="mx-auto mb-2 text-success" />
          <p className="text-body text-text">¡Comprobante recibido!</p>
          <p className="text-secondary mt-1 text-text-secondary">
            Tu entrenador lo va a verificar y te llega un correo con tu usuario y contraseña.
          </p>
        </div>
      ) : (
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="solicitud_id" value={solicitudId} />
          <input
            ref={inputRef}
            type="file"
            name="archivo"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
          />

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="radius-control flex w-full items-center justify-center gap-2 border border-dashed border-border py-4 text-secondary text-text-secondary"
          >
            <Paperclip size={16} />
            {archivo ? archivo.name : "Adjuntar comprobante (foto o PDF)"}
          </button>

          {state.error && <p className="text-caption text-error">{state.error}</p>}

          {archivo && (
            <Button type="submit" variant="success" loading={pending}>
              <Upload size={16} /> {pending ? "Enviando…" : "Enviar comprobante"}
            </Button>
          )}
        </form>
      )}

      {datos.whatsapp && (
        <button
          onClick={enviarPorWhatsApp}
          className="radius-control flex h-12 w-full items-center justify-center gap-2 bg-surface-2 text-body font-medium text-success"
        >
          <MessageCircle size={18} />
          {archivo ? "Enviarlo también por WhatsApp" : "Enviarlo por WhatsApp"}
        </button>
      )}

      <p className="text-caption text-text-tertiary">
        ¿No puedes pagar ahora? No hay problema: tus datos ya quedaron guardados y puedes mandar el
        comprobante por WhatsApp cuando quieras.
      </p>
    </div>
  );
}
