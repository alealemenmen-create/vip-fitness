"use client";

import { useEffect, useState } from "react";
import styles from "./PortalV2.module.css";

export function VipSplash() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const temporizador = window.setTimeout(() => {
      setVisible(false);
    }, 1650);

    return () => window.clearTimeout(temporizador);
  }, []);

  return (
    <div
      className={`${styles.splash} ${visible ? "" : styles.splashHidden}`}
      aria-hidden={!visible}
      aria-label="Iniciando VIP Fitness"
    >
      <div className={styles.splashBrand}>
        <span className={styles.splashGlow} />
        <p className={styles.splashName}>VIP FITNESS</p>
      </div>
    </div>
  );
}
