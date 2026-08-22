"use client";

import { useActionState, useState } from "react";
import { RotateCcw } from "lucide-react";
import { reabrirMiSesion, type FormStateReinicio } from "@/app/alumno/entrenar/actions";
import styles from "@/components/v2/PortalV2.module.css";

const inicial: FormStateReinicio = { error: null, ok: false };

/** Deshace una sesión propia que quedó registrada/completada por error. No
 * borra historial ni Puntos VIP — solo la reabre para poder corregirla. */
export function ReabrirMiSesionBoton({ sesionId }: { sesionId: string }) {
  const [confirmando, setConfirmando] = useState(false);
  const [estado, accion, pendiente] = useActionState(reabrirMiSesion, inicial);

  if (estado.ok) {
    return <p className={styles.historyV2ReabrirHecho}>Sesión reabierta — ya podés corregirla</p>;
  }

  if (!confirmando) {
    return (
      <button type="button" onClick={() => setConfirmando(true)} className={styles.historyV2ReabrirBoton}>
        <RotateCcw size={11} /> ¿La registraste por error? Reabrir
      </button>
    );
  }

  return (
    <div className={styles.historyV2ReabrirConfirmar}>
      <p>¿Reabrir esta sesión para corregirla? No se borra nada.</p>
      {estado.error && <p className={styles.historyV2ReabrirError}>{estado.error}</p>}
      <div>
        <form action={accion}>
          <input type="hidden" name="sesion_id" value={sesionId} />
          <button type="submit" disabled={pendiente}>{pendiente ? "Reabriendo…" : "Sí, reabrir"}</button>
        </form>
        <button type="button" onClick={() => setConfirmando(false)}>Cancelar</button>
      </div>
    </div>
  );
}
