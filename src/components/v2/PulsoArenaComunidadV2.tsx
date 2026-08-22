import Link from "next/link";
import { Heart, Trophy } from "lucide-react";
import type { FilaRanking } from "@/lib/ranking/data";
import type { PulsoComunidadV2 } from "@/app/portal-v2/progreso/comunidad/data";
import { nombreAlumnoPublicado } from "@/lib/nombre";
import styles from "./PortalV2.module.css";

function haceCuanto(fechaISO: string): string {
  const minutos = Math.max(0, Math.round((Date.now() - new Date(fechaISO).getTime()) / 60_000));
  if (minutos < 1) return "recién";
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  return `hace ${Math.round(horas / 24)} d`;
}

export function PulsoArenaComunidadV2({
  propia,
  pulso,
}: {
  propia: FilaRanking | null;
  pulso: PulsoComunidadV2;
}) {
  if (!propia && !pulso) return null;

  return (
    <div className={styles.pulseRow} aria-label="Arena VIP y Comunidad">
      <Link href="/portal-v2/progreso/ranking" className={styles.pulseHalf}>
        <div className={styles.pulseHalfTop}>
          <span className={styles.pulseGlyph} data-tono="oro"><Trophy size={11} /></span>
          <span className={styles.pulseEyebrow}>Arena VIP</span>
        </div>
        {propia ? (
          <>
            <strong className={styles.pulseHeadline}>Puesto #{propia.posicion}</strong>
            <span className={styles.pulseSub}>
              <b>{propia.puntos.toLocaleString("es-CL")} pts</b> esta semana · {propia.rango.nombre}
            </span>
          </>
        ) : (
          <>
            <strong className={styles.pulseHeadline}>Aún sin puntos</strong>
            <span className={styles.pulseSub}>Entrena esta semana y entra al ranking</span>
          </>
        )}
      </Link>

      <Link href="/portal-v2/progreso/comunidad" className={styles.pulseHalf}>
        <div className={styles.pulseHalfTop}>
          <span className={styles.pulseGlyph} data-tono="rosa"><Heart size={11} /></span>
          <span className={styles.pulseEyebrow}>Comunidad</span>
        </div>
        {pulso ? (
          <>
            <strong className={styles.pulseHeadline}>{nombreAlumnoPublicado(pulso.nombre)}</strong>
            <span className={styles.pulseSub}>
              Compartió un avance · {haceCuanto(pulso.fecha)} · <b>{pulso.aplausos}</b> aplausos
            </span>
          </>
        ) : (
          <>
            <strong className={styles.pulseHeadline}>Sé el primero</strong>
            <span className={styles.pulseSub}>Comparte tu progreso y motiva al resto</span>
          </>
        )}
      </Link>
    </div>
  );
}
