"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Zap } from "lucide-react";
import { EVENTO_XP_GANADO, type DetalleXpGanado } from "@/lib/xp-eventos";
import styles from "./PortalV2.module.css";

/** Contador de Puntos VIP siempre visible, montado una sola vez en el layout
 * de portal-v2 (no en cada pantalla) para que sobreviva la navegación entre
 * Entrenar y Sesión: cuando una sesión termina y avisa con `EVENTO_XP_GANADO`,
 * el mismo componente sigue montado y puede sumar el "+XP" flotante sin
 * esperar a que el servidor vuelva a calcular el ranking. */
export function XpBadgeV2({ xpInicial }: { xpInicial: number | null }) {
  // Si el layout vuelve a resolver `xpInicial` (otra navegación, otro
  // alumno), se resincroniza el total durante el render -- no en un efecto,
  // que dispararía un renderizado extra solo para esto (patrón "Adjusting
  // state based on a prop change" de React).
  const [xpInicialPrevio, setXpInicialPrevio] = useState(xpInicial);
  const [total, setTotal] = useState(xpInicial ?? 0);
  if (xpInicial !== xpInicialPrevio) {
    setXpInicialPrevio(xpInicial);
    setTotal(xpInicial ?? 0);
  }

  const [flotantes, setFlotantes] = useState<{ id: number; puntos: number }[]>([]);
  const idSiguiente = useRef(0);

  useEffect(() => {
    function alGanarPuntos(evento: Event) {
      const detalle = (evento as CustomEvent<DetalleXpGanado>).detail;
      if (!detalle || !Number.isFinite(detalle.puntos) || detalle.puntos === 0) return;
      const id = ++idSiguiente.current;
      setFlotantes((actuales) => [...actuales, { id, puntos: detalle.puntos }]);
      setTotal((actual) => actual + detalle.puntos);
      setTimeout(() => setFlotantes((actuales) => actuales.filter((item) => item.id !== id)), 1700);
    }
    window.addEventListener(EVENTO_XP_GANADO, alGanarPuntos);
    return () => window.removeEventListener(EVENTO_XP_GANADO, alGanarPuntos);
  }, []);

  if (xpInicial === null) return null;

  return (
    <Link
      href="/portal-v2/progreso/ranking"
      className={styles.xpBadge}
      aria-label={`${total.toLocaleString("es-CL")} puntos VIP acumulados. Ver Arena VIP.`}
    >
      <span className={styles.xpBadgeIcon}><Zap size={11} fill="currentColor" /></span>
      <span className={styles.xpBadgeValue}>{total.toLocaleString("es-CL")} XP</span>
      {flotantes.map((item) => (
        <span key={item.id} className={styles.xpBadgeFloat} aria-hidden="true">
          {item.puntos > 0 ? "+" : ""}
          {item.puntos.toLocaleString("es-CL")} XP
        </span>
      ))}
    </Link>
  );
}
