"use client";

import { useEffect, useState } from "react";
import { BellRing, Check } from "lucide-react";
import { guardarSuscripcionPushEntrenador } from "@/app/admin/alumnos/impulso-actions";

function claveComoUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalizada = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const crudo = window.atob(normalizada);
  const salida = new Uint8Array(new ArrayBuffer(crudo.length));
  for (let i = 0; i < crudo.length; i++) salida[i] = crudo.charCodeAt(i);
  return salida;
}

export function AvisosImpulsoPush() {
  const [estado, setEstado] = useState<"inicial" | "activando" | "activo" | "no_disponible" | "denegado">("inicial");

  useEffect(() => {
    const id = window.setTimeout(() => {
      if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        setEstado("no_disponible");
      } else if (Notification.permission === "granted") {
        void activar(false);
      } else if (Notification.permission === "denied") {
        setEstado("denegado");
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  async function activar(pedirPermiso = true) {
    try {
      setEstado("activando");
      const permiso = pedirPermiso ? await Notification.requestPermission() : Notification.permission;
      if (permiso !== "granted") {
        setEstado(permiso === "denied" ? "denegado" : "inicial");
        return;
      }
      const clave = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!clave) return setEstado("no_disponible");
      const registro = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      let suscripcion = await registro.pushManager.getSubscription();
      if (!suscripcion) suscripcion = await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: claveComoUint8Array(clave),
      });
      const json = suscripcion.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return setEstado("no_disponible");
      await guardarSuscripcionPushEntrenador({
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      });
      setEstado("activo");
    } catch {
      setEstado("no_disponible");
    }
  }

  if (estado === "activo") return (
    <div className="mt-3 flex items-center gap-2 rounded-xl border border-success/25 bg-success/[0.07] px-3 py-2 text-[10px] font-semibold text-success">
      <Check size={13} /> Avisos en este teléfono activados
    </div>
  );
  if (estado === "no_disponible" || estado === "denegado") return (
    <p className="mt-3 rounded-xl border border-warning/25 bg-warning/[0.06] px-3 py-2 text-[10px] text-warning">
      {estado === "denegado" ? "Las notificaciones están bloqueadas en este teléfono." : "Este navegador no permite activar avisos push."}
    </p>
  );
  return (
    <button type="button" onClick={() => void activar()} disabled={estado === "activando"} className="mt-3 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-vip/35 bg-vip/10 px-3 text-[10px] font-bold text-vip disabled:opacity-50">
      <BellRing size={14} /> {estado === "activando" ? "Activando…" : "Avisarme en este teléfono"}
    </button>
  );
}
