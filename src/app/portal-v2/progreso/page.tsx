import Link from "next/link";
import styles from "@/components/v2/PortalV2.module.css";

export default function ProgresoV2Page() {
  return (
    <section className={styles.simplePage}>
      <h1 className={styles.simpleTitle}>Progreso</h1>
      <p className={styles.simpleLead}>Aquí uniremos estadísticas, medallas, constancia, clasificación y progreso corporal.</p>
      <Link href="/alumno/progreso" className={styles.classicLink}>Usar Mi avance actual</Link>
    </section>
  );
}
