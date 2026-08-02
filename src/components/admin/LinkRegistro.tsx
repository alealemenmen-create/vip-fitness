"use client";

import { useState } from "react";
import { Check, Copy, Link2, MessageCircle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

const MENSAJE_WHATSAPP =
  "¡Hola! Para empezar en VIP Fitness completa tu inscripción acá y yo activo tu cuenta: ";

/**
 * El link que el entrenador le pasa por WhatsApp a un alumno nuevo.
 *
 * La URL llega armada desde el servidor (con el host de la petición, ver
 * app/admin/solicitudes/page.tsx) en vez de calcularse acá con
 * `window.location`: así el link se pinta ya en el primer render, sin el
 * parpadeo de un efecto, y sigue apuntando al lugar desde donde se está usando
 * el panel — producción, la IP del gimnasio en la LAN o localhost.
 */
export function LinkRegistro({ url }: { url: string }) {
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    try {
      if (!navigator.clipboard) throw new Error("clipboard API no disponible");
      await navigator.clipboard.writeText(url);
    } catch {
      // Sin HTTPS no hay clipboard API (pasa al entrar por IP desde el
      // celular). Respaldo con un textarea temporal, igual que en
      // CredencialesVisibles.
      const textarea = document.createElement("textarea");
      textarea.value = url;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand("copy");
      } catch {
        // El link igual queda visible abajo para copiarlo a mano.
      }
      document.body.removeChild(textarea);
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <Link2 size={16} className="text-vip" />
        <p className="text-caption text-text-tertiary">LINK DE INSCRIPCIÓN</p>
      </div>
      <p className="text-secondary mb-3 text-text-secondary">
        Mándaselo a quien quiera entrenar: completa sus datos y te llega la solicitud acá para
        aceptarla.
      </p>

      <p className="radius-control select-all break-all bg-surface-2 p-3 font-mono text-caption text-text">
        {url}
      </p>

      <div className="mt-3 flex gap-2">
        <Button onClick={copiar} variant="secondary" size="sm" className="flex-1">
          {copiado ? <Check size={16} /> : <Copy size={16} />} {copiado ? "Copiado" : "Copiar link"}
        </Button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(MENSAJE_WHATSAPP + url)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="radius-control flex h-10 flex-1 items-center justify-center gap-2 bg-surface-2 text-secondary font-medium text-success"
        >
          <MessageCircle size={16} /> WhatsApp
        </a>
      </div>
    </Card>
  );
}
