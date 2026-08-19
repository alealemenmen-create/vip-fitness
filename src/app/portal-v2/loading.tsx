import styles from "@/components/v2/PortalV2.module.css";

export default function PortalV2Loading() {
  return (
    <section className={styles.v2Loading} aria-label="Cargando Portal VIP" aria-busy="true">
      <header><i /><div><span /><b /></div><i /></header>
      <div className={styles.v2LoadingDial}>{[0, 1, 2, 3, 4].map((item) => <i key={item} />)}</div>
      <div className={styles.v2LoadingHero}><i /><span /><span /></div>
      <div className={styles.v2LoadingCards}><i /><i /></div>
      <p>Cargando tu experiencia VIP…</p>
    </section>
  );
}
