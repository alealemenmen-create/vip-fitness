import { Bot, CheckCircle2, Clock3, Mail, XCircle } from "lucide-react";
import { Card } from "@/components/ui/Card";

function Estado({
  icono,
  nombre,
  listo,
  detalle,
}: {
  icono: React.ReactNode;
  nombre: string;
  listo: boolean;
  detalle: string;
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-text-secondary">
        {icono}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-body font-medium text-text">{nombre}</p>
        <p className="text-caption text-text-tertiary">{detalle}</p>
      </div>
      {listo ? (
        <CheckCircle2 size={18} className="shrink-0 text-success" aria-label="Configurado" />
      ) : (
        <XCircle size={18} className="shrink-0 text-error" aria-label="Pendiente" />
      )}
    </div>
  );
}

export function EstadoSistema() {
  const iaLista = Boolean(process.env.ANTHROPIC_API_KEY);
  const correoListo = Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
  const cronListo = Boolean(process.env.CRON_SECRET);

  return (
    <Card className="border border-border p-4">
      <p className="text-card-title mb-2 text-text">Estado del sistema</p>
      <Estado
        icono={<Bot size={18} />}
        nombre="Inteligencia artificial"
        listo={iaLista}
        detalle={iaLista ? "Claude está disponible." : "Falta ANTHROPIC_API_KEY."}
      />
      <Estado
        icono={<Mail size={18} />}
        nombre="Correo"
        listo={correoListo}
        detalle={correoListo ? "Resend está configurado." : "Falta completar Resend."}
      />
      <Estado
        icono={<Clock3 size={18} />}
        nombre="Ejecución semanal"
        listo={cronListo}
        detalle={
          cronListo
            ? "El endpoint semanal está protegido."
            : "CRON_SECRET se configurará antes de publicar."
        }
      />
      <p className="text-caption mt-2 border-t border-border pt-3 text-text-tertiary">
        Por seguridad, este panel muestra únicamente el estado; nunca revela claves privadas.
      </p>
    </Card>
  );
}
