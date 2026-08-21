"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dumbbell, Layers3, LayoutGrid, UtensilsCrossed } from "lucide-react";
import type { ConfiguracionEstudioVip, SeccionPortalId } from "@/lib/estudio-vip/configuracion";
import styles from "./PortalV2.module.css";

const TABS: Record<SeccionPortalId, { href: string; icon: typeof Dumbbell }> = {
  entrenamiento: { href: "/portal-v2/entrenamiento", icon: Dumbbell },
  nutricion: { href: "/portal-v2/nutricion", icon: UtensilsCrossed },
  progreso: { href: "/portal-v2/progreso", icon: LayoutGrid },
  mas: { href: "/portal-v2/mas", icon: Layers3 },
};

export function BottomNavV2({ navegacion }: { navegacion: ConfiguracionEstudioVip["navegacion"] }) {
  const pathname = usePathname();
  const pantallaInmersiva = pathname.startsWith("/portal-v2/entrenamiento/rutina") || pathname.startsWith("/portal-v2/entrenamiento/sesion");
  const tabsVisibles = navegacion.filter((item) => item.visible);

  if (pantallaInmersiva) return null;

  return (
    <div className={styles.navWrap}>
      <nav className={styles.nav} aria-label="Navegación principal">
        {tabsVisibles.map((item) => {
          const tab = TABS[item.id];
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
              <span className={styles.navLabel}>{item.etiqueta}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
