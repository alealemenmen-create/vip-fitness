"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dumbbell, Layers3, LayoutGrid, UtensilsCrossed } from "lucide-react";
import styles from "./PortalV2.module.css";

const TABS = [
  { href: "/portal-v2/entrenamiento", label: "Entrenar", icon: Dumbbell },
  { href: "/portal-v2/nutricion", label: "Nutrición", icon: UtensilsCrossed },
  { href: "/portal-v2/progreso", label: "Progreso", icon: LayoutGrid },
  { href: "/portal-v2/mas", label: "Más", icon: Layers3 },
];

export function BottomNavV2() {
  const pathname = usePathname();
  const pantallaInmersiva = pathname.startsWith("/portal-v2/entrenamiento/rutina") || pathname.startsWith("/portal-v2/entrenamiento/sesion");

  if (pantallaInmersiva) return null;

  return (
    <div className={styles.navWrap}>
      <nav className={styles.nav} aria-label="Navegación principal">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const activo = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              prefetch={false}
              className={`${styles.navItem} ${activo ? styles.navActive : ""}`}
              aria-current={activo ? "page" : undefined}
            >
              <span className={styles.navIcon}><Icon strokeWidth={activo ? 2.45 : 2.05} /></span>
              <span className={styles.navLabel}>{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
