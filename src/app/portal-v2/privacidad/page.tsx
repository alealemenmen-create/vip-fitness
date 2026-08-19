import { PoliticaPrivacidadContenido } from "@/app/alumno/politica-privacidad/page";
import styles from "@/components/v2/PortalV2.module.css";

export default function PrivacidadV2Page() {
  return (
    <section className={styles.v2PrivacyPage}>
      <PoliticaPrivacidadContenido volverA="/portal-v2/mas" />
    </section>
  );
}
