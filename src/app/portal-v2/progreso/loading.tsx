import styles from "@/components/v2/PortalV2.module.css";

export default function CargandoProgresoV2() {
  return (
    <section className={styles.progressLoading} aria-busy="true" aria-label="Cargando progreso">
      <header><i /><div><span /><b /></div></header>
      <div className={styles.progressLoadingHero}><i /><span /><span /></div>
      <div className={styles.progressLoadingGrid}>
        {Array.from({ length: 6 }, (_, indice) => <i key={indice} />)}
      </div>
      <p>Reconstruyendo tu progreso verificado…</p>
    </section>
  );
}
