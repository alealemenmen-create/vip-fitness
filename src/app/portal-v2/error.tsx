"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import styles from "@/components/v2/PortalV2.module.css";

export default function PortalV2Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("[portal-v2] error recuperable", error);
  }, [error]);

  return (
    <section className={styles.v2Error} role="alert">
      <span><AlertTriangle size={27} /></span>
      <small>PORTAL VIP</small>
      <h1>No pudimos cargar esta sección</h1>
      <p>Tu información no se borró. Comprueba la conexión e inténtalo nuevamente.</p>
      <button type="button" onClick={() => retry()}><RotateCcw size={16} /> Intentar de nuevo</button>
      <Link href="/portal-v2/entrenamiento">Volver a entrenamiento</Link>
      {error.digest ? <code>Referencia {error.digest}</code> : null}
    </section>
  );
}
