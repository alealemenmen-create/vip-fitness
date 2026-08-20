"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Play } from "lucide-react";
import styles from "./PortalV2.module.css";

/** La cadena real del servidor tarda unos 5-6 segundos (crear/entrar a la
 * sesión, chequear el plan mensual, Impulso VIP, revalidar, más la carga
 * de la pantalla siguiente) -- demasiado para una pantalla estática sin
 * dar la sensación de que avanza. No hay forma de medir el progreso real
 * del servidor desde acá (una Server Action no manda eventos parciales),
 * así que se simula: arranca rápido y se frena a medida que se acerca al
 * tope, el mismo truco que usan las barras de carga de casi cualquier
 * app. Nunca llega a 100 sola -- el overlay desaparece solo cuando la
 * navegación de verdad termina (se desmonta), así que quedarse cerca del
 * tope en vez de "completarse" antes de tiempo es lo que se ve honesto. */
function useProgresoSimulado(activo: boolean) {
  const [progreso, setProgreso] = useState(0);
  useEffect(() => {
    if (!activo) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reinicio deliberado para la próxima vez que se use este mismo botón sin recargar la página.
      setProgreso(0);
      return;
    }
    const tope = 92;
    const intervalo = window.setInterval(() => {
      setProgreso((actual) => actual + (tope - actual) * 0.035);
    }, 150);
    return () => window.clearInterval(intervalo);
  }, [activo]);
  return Math.round(progreso);
}

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
  const progreso = useProgresoSimulado(pending);
  return (
    <>
      <button type="submit" className={className} disabled={deshabilitado || pending} aria-busy={pending}>
        <Play size={16} fill="currentColor" /> {texto}
      </button>
      {pending ? (
        <div className={styles.splash} role="status" aria-live="polite" aria-label={`Preparando tu entrenamiento, ${progreso} por ciento`}>
          <div className={styles.splashBrand}>
            <span className={styles.splashGlow} />
            <p className={styles.splashName}>VIP FITNESS</p>
            <div className={styles.splashBarra}><i style={{ width: `${progreso}%` }} /></div>
            <p className={styles.splashHint}>Preparando tu entrenamiento… <strong>{progreso}%</strong></p>
          </div>
        </div>
      ) : null}
    </>
  );
}
