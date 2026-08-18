"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import styles from "./PortalV2.module.css";

const MARCA_SESION = "portal-vip-v2-splash-visto";

export function VipSplash() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (sessionStorage.getItem(MARCA_SESION) === "1") {
      const ocultarSinAnimacion = window.setTimeout(() => setVisible(false), 0);
      return () => window.clearTimeout(ocultarSinAnimacion);
    }

    const temporizador = window.setTimeout(() => {
      sessionStorage.setItem(MARCA_SESION, "1");
      setVisible(false);
    }, 1450);

    return () => window.clearTimeout(temporizador);
  }, []);

  return (
    <div
      className={`${styles.splash} ${visible ? "" : styles.splashHidden}`}
      aria-hidden={!visible}
      aria-label="Iniciando VIP Fitness"
    >
      <div className={styles.splashBrand}>
        <Image
          src="/icons/icon-512.png"
          alt=""
          width={88}
          height={88}
          priority
          className={styles.splashMark}
        />
        <p className={styles.splashName}>VIP <span>FITNESS</span></p>
      </div>
    </div>
  );
}
