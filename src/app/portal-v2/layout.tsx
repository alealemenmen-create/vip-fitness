import { BottomNavV2 } from "@/components/v2/BottomNavV2";
import { VipSplash } from "@/components/v2/VipSplash";
import styles from "@/components/v2/PortalV2.module.css";

export default function PortalV2Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <VipSplash />
      <main className={styles.content}>{children}</main>
      <BottomNavV2 />
    </div>
  );
}
