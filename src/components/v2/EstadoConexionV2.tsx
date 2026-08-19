"use client";

import { useEffect, useRef, useState } from "react";
import { CloudOff, Wifi } from "lucide-react";
import styles from "./PortalV2.module.css";

type EstadoConexion = "desconectado" | "recuperado" | null;

export function EstadoConexionV2() {
  const [estado, setEstado] = useState<EstadoConexion>(null);
  const estuvoDesconectado = useRef(false);

  useEffect(() => {
    let temporizador: ReturnType<typeof setTimeout> | null = null;

    const desconectado = () => {
      if (temporizador) clearTimeout(temporizador);
      estuvoDesconectado.current = true;
      setEstado("desconectado");
    };
    const conectado = () => {
      if (!estuvoDesconectado.current) {
        setEstado(null);
        return;
      }
      setEstado("recuperado");
      temporizador = setTimeout(() => setEstado(null), 3200);
    };

    if (!navigator.onLine) desconectado();
    window.addEventListener("offline", desconectado);
    window.addEventListener("online", conectado);
    return () => {
      window.removeEventListener("offline", desconectado);
      window.removeEventListener("online", conectado);
      if (temporizador) clearTimeout(temporizador);
    };
  }, []);

  if (!estado) return null;

  return (
    <div
      className={`${styles.connectionNotice} ${estado === "recuperado" ? styles.connectionNoticeRecovered : ""}`}
      role="status"
      aria-live="polite"
    >
      {estado === "recuperado" ? <Wifi size={16} /> : <CloudOff size={16} />}
      <div>
        <strong>{estado === "recuperado" ? "Conexión recuperada" : "Estás sin conexión"}</strong>
        <span>{estado === "recuperado" ? "Ya puedes continuar normalmente." : "No recargues ni cierres una sesión activa hasta volver a tener internet."}</span>
      </div>
    </div>
  );
}
