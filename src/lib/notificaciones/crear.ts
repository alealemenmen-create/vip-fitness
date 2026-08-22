import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { avisarAlEntrenador } from "@/lib/push/enviar";

export type TipoNotificacionEntrenador =
  | "habito_comida"
  | "habito_entrenamiento"
  | "bug"
  | "resena"
  | "foto_reporte"
  | "cupo_agotado";

/**
 * Registra un aviso en la bandeja del entrenador (`notificaciones_entrenador`)
 * y, si `prioridad` es `"alta"`, manda push real. Nunca lanza: un aviso que
 * no se pudo crear no puede tumbar la acción que lo disparó (reportar un
 * bug, mandar una reseña, guardar una sesión).
 *
 * `claveDedup`, cuando se pasa, evita duplicar el mismo aviso mientras siga
 * vigente: si ya existe una fila sin leer con la misma clave de los
 * últimos `horasDedup`, no se inserta una nueva.
 */
export async function crearNotificacionEntrenador({
  tipo,
  alumnoId,
  titulo,
  cuerpo,
  prioridad = "normal",
  ruta,
  claveDedup,
  horasDedup = 24,
}: {
  tipo: TipoNotificacionEntrenador;
  alumnoId?: string | null;
  titulo: string;
  cuerpo: string;
  prioridad?: "alta" | "normal";
  ruta?: string;
  claveDedup?: string;
  horasDedup?: number;
}): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const desde = new Date(Date.now() - horasDedup * 60 * 60 * 1000).toISOString();
    const { data: creadaId, error } = await admin.rpc("crear_notificacion_entrenador_dedup", {
      p_tipo: tipo,
      p_alumno_id: alumnoId ?? null,
      p_titulo: titulo,
      p_cuerpo: cuerpo,
      p_prioridad: prioridad,
      p_ruta: ruta ?? null,
      p_clave_dedup: claveDedup ?? null,
      p_desde: desde,
    });
    if (error || !creadaId) {
      // Tabla sin migración corrida todavía, u otro problema — no bloquea
      // la acción original. Mismo criterio best-effort que `enviarPush`.
      return false;
    }

    if (prioridad === "alta") {
      await avisarAlEntrenador({
        title: titulo,
        body: cuerpo,
        tag: claveDedup ?? tipo,
        url: ruta ?? "/admin/notificaciones",
      });
    }
    return true;
  } catch {
    // Best-effort — ver comentario de la función.
    return false;
  }
}
