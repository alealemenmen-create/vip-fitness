import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { CategoriaEliminacion, ConteoTabla } from "./tipos";

type AdminClient = ReturnType<typeof createAdminClient>;

const BUCKET_FOTOS_PROGRESO = "fotos-progreso";

/** Nombres literales (no `string` suelto) para que `.from(tabla)` siga
 * type-checkeado contra `Database` más abajo. */
type TablaAlumno =
  | "sesiones_entrenamiento"
  | "registros_diarios"
  | "pesos_corporales"
  | "medidas_corporales"
  | "fotos_progreso"
  | "puntos_vip_movimientos"
  | "ranking_semanas";

/** Una categoría de borrado = una o más tablas propias del alumno, siempre
 * filtradas por `alumno_id`. Las tablas hijas (sesion_ejercicios, series_
 * realizadas, comidas_registradas, alimentos_consumidos) NO se listan acá:
 * caen solas por `on delete cascade` al borrar la fila padre. */
const TABLAS_POR_CATEGORIA: Record<CategoriaEliminacion, { tabla: TablaAlumno; etiqueta: string }[]> = {
  entrenamiento: [{ tabla: "sesiones_entrenamiento", etiqueta: "sesiones de entrenamiento" }],
  comida: [{ tabla: "registros_diarios", etiqueta: "días con comida registrada" }],
  progreso: [
    { tabla: "pesos_corporales", etiqueta: "registros de peso" },
    { tabla: "medidas_corporales", etiqueta: "registros de medidas" },
    { tabla: "fotos_progreso", etiqueta: "fotos de progreso" },
  ],
  ranking: [
    { tabla: "puntos_vip_movimientos", etiqueta: "movimientos de Puntos VIP" },
    { tabla: "ranking_semanas", etiqueta: "semanas de ranking cerradas" },
  ],
};

/** Solo lectura — el conteo real de lo que se borraría. Se llama al armar la
 * propuesta (nunca borra) y de nuevo, server-side, al confirmar (nunca se
 * confía en un conteo que haya viajado desde el cliente). */
export async function contarDatosCategoria(
  admin: AdminClient,
  alumnoId: string,
  categoria: CategoriaEliminacion
): Promise<ConteoTabla[]> {
  const tablas = TABLAS_POR_CATEGORIA[categoria];
  const conteos = await Promise.all(
    tablas.map(async ({ tabla, etiqueta }) => {
      const { count } = await admin
        .from(tabla)
        .select("id", { count: "exact", head: true })
        .eq("alumno_id", alumnoId);
      return { tabla, etiqueta, cantidad: count ?? 0 };
    })
  );
  return conteos;
}

/** El borrado real. Se llama SOLO desde `confirmarEliminacionDatos` (server
 * action), nunca desde el flujo de IA — la IA solo llega hasta proponer. */
export async function borrarDatosCategoria(
  admin: AdminClient,
  alumnoId: string,
  categoria: CategoriaEliminacion
): Promise<void> {
  if (categoria === "progreso") {
    // Las fotos tienen archivo real en Storage — hay que borrarlo antes de
    // borrar la fila, si no queda huérfano (mismo patrón que
    // eliminarFotoProgreso en src/app/alumno/progreso/actions.ts).
    const { data: fotos } = await admin
      .from("fotos_progreso")
      .select("storage_path")
      .eq("alumno_id", alumnoId);
    const rutas = (fotos ?? []).map((f) => f.storage_path).filter(Boolean);
    if (rutas.length > 0) {
      await admin.storage.from(BUCKET_FOTOS_PROGRESO).remove(rutas);
    }
  }

  for (const { tabla } of TABLAS_POR_CATEGORIA[categoria]) {
    await admin.from(tabla).delete().eq("alumno_id", alumnoId);
  }
}
