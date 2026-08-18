import Link from "next/link";
import styles from "@/components/v2/PortalV2.module.css";

export default function NutricionV2Page() {
  return (
    <section className={styles.simplePage}>
      <h1 className={styles.simpleTitle}>Nutrición</h1>
      <p className={styles.simpleLead}>Esta será la segunda sección que reconstruiremos con la experiencia V2.</p>
      <Link href="/alumno/comer" className={styles.classicLink}>Usar Nutrición actual</Link>
    </section>
  );
}
