import styles from "@/components/v2/PortalV2.module.css";

export default function CargandoMasV2() {
  return (
    <section className={styles.progressLoading} aria-busy="true" aria-label="Cargando configuración">
      <header><i /><div><span /><b /></div></header>
      <div className={styles.progressLoadingHero}><i /><span /><span /></div>
      <div className={styles.progressLoadingGrid}>{Array.from({ length: 4 }, (_, indice) => <i key={indice} />)}</div>
      <p>Cargando tu cuenta y preferencias…</p>
    </section>
  );
}
