import { Sparkles } from "lucide-react";

/** Mensaje del día. Va en ámbar apagado —el morado saturado hacía ruido— con
 * el barrido de luz corriendo por encima para que igual destaque. */
export function MensajeMotivacional({ frase }: { frase: string }) {
  return (
    <div className="mensaje-dia mensaje-dia-movimiento radius-card flex items-center gap-2.5 px-4 py-3">
      <Sparkles size={16} className="shrink-0 text-vip" />
      <p className="text-secondary font-medium text-text">{frase}</p>
    </div>
  );
}
