"use client";

import { useActionState, useState } from "react";
import { AlertTriangle, Check, FileText, MessageCircle, X } from "lucide-react";
import {
  aceptarSolicitud,
  corregirContactoSolicitud,
  marcarPagoVerificado,
  rechazarSolicitud,
  type SolicitudActionState,
} from "@/app/admin/solicitudes/actions";
import { CredencialesVisibles } from "@/components/admin/CrearAlumnoForm";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Pill } from "@/components/ui/Pill";
import { calcularEdad } from "@/lib/date";
import { etiquetaSexo } from "@/lib/solicitudes/campos";

export type SolicitudPendiente = {
  id: string;
  nombre: string;
  email: string;
  telefono: string;
  /** URL firmada del comprobante de pago, o null si no adjuntó ninguno. La
   * firma la genera el servidor en cada carga (el bucket es privado). */
  comprobanteUrl: string | null;
  comprobanteEsPdf: boolean;
  pagoVerificado: boolean;
  fechaNacimiento: string | null;
  sexo: string | null;
  estaturaCm: number | null;
  pesoKg: number | null;
  objetivo: string | null;
  condicionMedica: string | null;
  restriccionAlimenticia: string | null;
  mensaje: string | null;
  createdAt: string;
};

const initialState: SolicitudActionState = { error: null, ok: false };

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | null }) {
  if (!valor) return null;
  return (
    <div>
      <p className="text-caption text-text-tertiary">{etiqueta}</p>
      <p className="text-body text-text">{valor}</p>
    </div>
  );
}

/** Solo los dígitos: wa.me no acepta espacios ni símbolos en el número. */
function numeroWhatsApp(telefono: string): string {
  return telefono.replace(/\D/g, "");
}

/**
 * Correo y teléfono, con la opción de corregirlos.
 *
 * El correo es el dato del que cuelga todo: con él se crea la cuenta y a él
 * llegan las credenciales. Como lo escribe a mano alguien desde su teléfono,
 * un dedazo ahí dejaba la solicitud imposible de aceptar — por eso se puede
 * arreglar acá en vez de tener que rechazarla.
 */
function Contacto({ solicitud }: { solicitud: SolicitudPendiente }) {
  const [state, accion, guardando] = useActionState(corregirContactoSolicitud, initialState);
  const [editando, setEditando] = useState(false);

  if (editando && !state.ok) {
    return (
      <form action={accion} className="space-y-2">
        <input type="hidden" name="solicitud_id" value={solicitud.id} />
        <label className="text-caption block text-text-tertiary">CORREO</label>
        <Input name="email" type="email" defaultValue={solicitud.email} />
        <label className="text-caption block text-text-tertiary">TELÉFONO</label>
        <Input name="telefono" type="tel" defaultValue={solicitud.telefono} />
        {state.error && <p className="text-caption text-error">{state.error}</p>}
        <div className="flex gap-2">
          <Button type="submit" variant="secondary" size="sm" loading={guardando} className="flex-1">
            Guardar
          </Button>
          <Button onClick={() => setEditando(false)} variant="ghost" size="sm" className="flex-1">
            Cancelar
          </Button>
        </div>
      </form>
    );
  }

  return (
    <>
      <div className="flex items-end justify-between gap-2">
        <Dato etiqueta="CORREO" valor={solicitud.email} />
        <button
          onClick={() => setEditando(true)}
          className="text-caption shrink-0 font-medium text-vip underline"
        >
          Corregir
        </button>
      </div>
      <div className="flex items-center justify-between gap-2">
        <Dato etiqueta="TELÉFONO" valor={solicitud.telefono} />
        <a
          href={`https://wa.me/${numeroWhatsApp(solicitud.telefono)}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Escribir a ${solicitud.nombre} por WhatsApp`}
          className="radius-control flex h-10 w-10 shrink-0 items-center justify-center bg-surface-2 text-success"
        >
          <MessageCircle size={18} />
        </a>
      </div>
    </>
  );
}

/**
 * Estado del pago de la inscripción. Solo se dibuja cuando el cobro está
 * encendido, o cuando ya hay un comprobante subido — si el cobro se apagó
 * después de que alguien pagó, esa plata igual tiene que verse.
 */
function BloquePago({ solicitud }: { solicitud: SolicitudPendiente }) {
  const [state, accion, guardando] = useActionState(marcarPagoVerificado, initialState);
  // El servidor revalida la página al guardar, pero hasta que llegue el nuevo
  // HTML conviene reflejar el cambio de inmediato: el botón es un interruptor
  // y verlo quieto se siente como que no funcionó.
  const verificado = state.ok ? !solicitud.pagoVerificado : solicitud.pagoVerificado;

  return (
    <div className="radius-control mt-4 bg-surface-2 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-caption text-text-tertiary">PAGO DE INSCRIPCIÓN</p>
        {verificado ? (
          <Pill tone="success">Verificado</Pill>
        ) : solicitud.comprobanteUrl ? (
          <Pill tone="vip">Por revisar</Pill>
        ) : (
          <Pill tone="error">Sin comprobante</Pill>
        )}
      </div>

      {solicitud.comprobanteUrl ? (
        <a
          href={solicitud.comprobanteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          {solicitud.comprobanteEsPdf ? (
            <span className="text-secondary flex items-center gap-2 py-2 font-medium text-vip">
              <FileText size={16} /> Ver comprobante (PDF)
            </span>
          ) : (
            // URL firmada de Storage con caducidad: no pasa por el
            // optimizador de next/image.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={solicitud.comprobanteUrl}
              alt="Comprobante de pago"
              className="radius-control max-h-64 w-full object-contain"
            />
          )}
        </a>
      ) : (
        <p className="text-secondary text-text-secondary">
          No adjuntó comprobante. Puede habértelo mandado por WhatsApp.
        </p>
      )}

      <form action={accion} className="mt-2">
        <input type="hidden" name="solicitud_id" value={solicitud.id} />
        <input type="hidden" name="verificado" value={verificado ? "false" : "true"} />
        <Button type="submit" variant={verificado ? "ghost" : "secondary"} size="sm" loading={guardando}>
          {verificado ? "Marcar como no verificado" : "Marcar pago verificado"}
        </Button>
      </form>
    </div>
  );
}

export function SolicitudCard({
  solicitud,
  pagoActivo,
}: {
  solicitud: SolicitudPendiente;
  pagoActivo: boolean;
}) {
  const [aceptar, accionAceptar, aceptando] = useActionState(aceptarSolicitud, initialState);
  const [rechazo, accionRechazar, rechazando] = useActionState(rechazarSolicitud, initialState);
  const [confirmandoRechazo, setConfirmandoRechazo] = useState(false);
  const mostrarPago = pagoActivo || solicitud.comprobanteUrl !== null;

  // Aceptada: la tarjeta se queda mostrando las credenciales. Es el único
  // momento en que la contraseña se puede ver, así que no se cierra sola —
  // el entrenador la copia y recarga cuando terminó.
  if (aceptar.ok && aceptar.password) {
    return (
      <Card>
        <p className="text-body mb-3 text-text">
          Cuenta creada para <strong>{solicitud.nombre}</strong>.
        </p>
        {aceptar.correoEnviado ? (
          <p className="text-secondary text-text-secondary">
            Le mandamos el usuario y la contraseña a {solicitud.email}.
          </p>
        ) : (
          <>
            <p className="text-secondary mb-3 text-text-secondary">
              El correo no salió. Pásale estos datos por WhatsApp:
            </p>
            <CredencialesVisibles email={aceptar.email!} password={aceptar.password} />
            <a
              href={`https://wa.me/${numeroWhatsApp(solicitud.telefono)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="radius-control mt-3 flex h-10 items-center justify-center gap-2 bg-surface-2 text-secondary font-medium text-success"
            >
              <MessageCircle size={16} /> Escribirle por WhatsApp
            </a>
          </>
        )}
      </Card>
    );
  }

  if (rechazo.ok) {
    return (
      <Card>
        <p className="text-secondary text-text-secondary">
          Solicitud de {solicitud.nombre} rechazada.
        </p>
      </Card>
    );
  }

  const edad = solicitud.fechaNacimiento ? `${calcularEdad(solicitud.fechaNacimiento)} años` : null;
  const fecha = new Date(solicitud.createdAt).toLocaleDateString("es-CL", {
    day: "numeric",
    month: "short",
  });

  return (
    <Card>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-h3 uppercase text-text">{solicitud.nombre}</p>
          <p className="text-caption text-text-tertiary">Se inscribió el {fecha}</p>
        </div>
        <Pill tone="vip">Pendiente</Pill>
      </div>

      <div className="space-y-3">
        <Contacto solicitud={solicitud} />

        <div className="grid grid-cols-3 gap-3">
          <Dato etiqueta="EDAD" valor={edad} />
          <Dato
            etiqueta="ESTATURA"
            valor={solicitud.estaturaCm ? `${solicitud.estaturaCm} cm` : null}
          />
          <Dato etiqueta="PESO" valor={solicitud.pesoKg ? `${solicitud.pesoKg} kg` : null} />
        </div>

        <Dato etiqueta="SEXO" valor={etiquetaSexo(solicitud.sexo)} />
        <Dato etiqueta="OBJETIVO" valor={solicitud.objetivo} />
        <Dato etiqueta="CONDICIÓN MÉDICA" valor={solicitud.condicionMedica} />
        <Dato etiqueta="CONDICIÓN ALIMENTICIA / ALERGIAS" valor={solicitud.restriccionAlimenticia} />
        <Dato etiqueta="NOS CUENTA" valor={solicitud.mensaje} />
      </div>

      {mostrarPago && <BloquePago solicitud={solicitud} />}

      {pagoActivo && !solicitud.pagoVerificado && (
        <p className="text-caption mt-3 flex items-start gap-1.5 text-text-tertiary">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          Puedes aceptar igual, pero este pago todavía no está verificado.
        </p>
      )}

      {(aceptar.error || rechazo.error) && (
        <p className="text-caption mt-3 text-error">{aceptar.error || rechazo.error}</p>
      )}

      {confirmandoRechazo ? (
        <form action={accionRechazar} className="mt-4 space-y-3">
          <input type="hidden" name="solicitud_id" value={solicitud.id} />
          <label className="text-caption block text-text-tertiary">
            MOTIVO (OPCIONAL, SOLO PARA TI)
          </label>
          <Input name="motivo" placeholder="Ej: ya tiene cuenta, se arrepintió…" />
          <div className="flex gap-2">
            <Button type="submit" variant="destructive" size="sm" loading={rechazando} className="flex-1">
              Confirmar rechazo
            </Button>
            <Button
              onClick={() => setConfirmandoRechazo(false)}
              variant="ghost"
              size="sm"
              className="flex-1"
            >
              Cancelar
            </Button>
          </div>
        </form>
      ) : (
        <div className="mt-4 space-y-2">
          <form action={accionAceptar}>
            <input type="hidden" name="solicitud_id" value={solicitud.id} />
            <Button type="submit" variant="success" loading={aceptando}>
              <Check size={18} /> {aceptando ? "Creando cuenta…" : "Aceptar y crear cuenta"}
            </Button>
          </form>
          <Button onClick={() => setConfirmandoRechazo(true)} variant="ghost" size="sm">
            <X size={16} /> Rechazar
          </Button>
        </div>
      )}
    </Card>
  );
}
