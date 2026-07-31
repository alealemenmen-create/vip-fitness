import { Sparkles } from "lucide-react";

/** Mensaje del día. Va en ámbar apagado —el morado saturado hacía ruido— con
 * el barrido de luz corriendo por encima para que igual destaque. */
export function MensajeMotivacional({ frase }: { frase: string }) {
  return (
    // Letra chica a propósito: es un mensaje de acompañamiento, no el contenido
    // de la pantalla, y a tamaño `secondary` se comía dos líneas y empujaba el
    // calendario hacia abajo.
    <div className="mensaje-dia mensaje-dia-movimiento radius-card flex items-center gap-2 px-3 py-2">
      <Sparkles size={14} className="shrink-0 text-vip" />
      <p className="text-caption font-medium text-text">{frase}</p>
    </div>
  );
}
