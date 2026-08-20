"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dumbbell } from "lucide-react";
import styles from "./PortalV2.module.css";
import { leerSalidaTemporalSesionV2 } from "@/lib/entrenamiento/salida-temporal-sesion-v2";

/** Recordatorio flotante ("Entrenamiento en pausa") mientras el alumno usa
 * "Salir un momento" desde la sesión activa -- sin esto, era fácil olvidarse
 * de volver y dejar la serie a medias sin darse cuenta. No se muestra en la
 * pantalla inmersiva de la sesión misma: ahí no hace falta, ya está adentro. */
export function AvisoSesionPausadaV2() {
  const pathname = usePathname();
  const pantallaInmersiva = pathname.startsWith("/portal-v2/entrenamiento/rutina") || pathname.startsWith("/portal-v2/entrenamiento/sesion");
  const [sesionId, setSesionId] = useState<string | null>(null);

  useEffect(() => {
    const cuadro = window.requestAnimationFrame(() => {
      setSesionId(pantallaInmersiva ? null : leerSalidaTemporalSesionV2());
    });
    return () => window.cancelAnimationFrame(cuadro);
  }, [pathname, pantallaInmersiva]);

  if (!sesionId) return null;

  return (
    <Link href={`/portal-v2/entrenamiento/sesion?id=${sesionId}`} className={styles.pausedSessionNotice}>
      <Dumbbell size={16} />
      <div><strong>Entrenamiento en pausa</strong><span>Toca para volver a tu serie</span></div>
    </Link>
  );
}
