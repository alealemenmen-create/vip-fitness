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
export function BotonIniciarEntrenamientoV2({ texto }: { texto: string }) {
  const { pending } = useFormStatus();
  return (
    <>
      <button type="submit" className={styles.workoutFixedStart} disabled={pending} aria-busy={pending}>
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
