"use client";

import { useFormStatus } from "react-dom";
import { Play } from "lucide-react";
import styles from "./PortalV2.module.css";

/** Arrancar una rutina hace una cadena de operaciones en el servidor
 * (crear/entrar a la sesión, chequear el plan mensual, disparar Impulso
 * VIP) antes de poder mostrar la pantalla siguiente -- un `<button
 * type="submit">` normal no da ninguna señal mientras tanto y se siente
 * "pegado". `useFormStatus` avisa el instante en que el formulario
 * padre empieza a enviarse, así que la pantalla de marca (mismo estilo
 * que `VipSplash`, el arranque de la app) aparece de inmediato en vez de
 * esperar a que el servidor responda. */
export function BotonIniciarEntrenamientoV2({
  texto,
  className = styles.workoutFixedStart,
  deshabilitado = false,
}: {
  texto: string;
  /** Clase del botón -- las tres pantallas que arrancan una rutina usan
   * estilos distintos (`workoutFixedStart` fijo abajo, `primaryButton`
   * en la tarjeta de Inicio). */
  className?: string;
  /** Bloqueo real de negocio (plan pausado, cupo agotado, solo lectura)
   * -- independiente de `pending`, que es sólo mientras se envía. */
  deshabilitado?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <>
      <button type="submit" className={className} disabled={deshabilitado || pending} aria-busy={pending}>
        <Play size={16} fill="currentColor" /> {texto}
      </button>
      {pending ? (
        <div className={styles.splash} role="status" aria-live="polite" aria-label="Preparando tu entrenamiento">
          <div className={styles.splashBrand}>
            <span className={styles.splashGlow} />
            <p className={styles.splashName}>VIP FITNESS</p>
            <p className={styles.splashHint}>Preparando tu entrenamiento…</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
