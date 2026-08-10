import "server-only";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TecnicaEntrenamiento } from "./tipos";

export const TAG_TECNICAS_ENTRENAMIENTO = "tecnicas-entrenamiento";

type FilaTecnica = {
  id: string;
  nombre: string;
  slug: string;
  tipo: "individual" | "encadenada";
  cantidad_ejercicios: number | null;
  nivel_minimo: TecnicaEntrenamiento["nivelMinimo"];
  fatiga: TecnicaEntrenamiento["fatiga"];
  requiere_supervision: boolean;
  descanso_interno_seg: number;
  descanso_final_seg: number;
  maximo_por_sesion: number;
};

/** Catálogo de técnicas de intensidad (biserie, drop-set, rest-pause…) que el
 * motor de reglas usa para alumnos avanzados. Mismo patrón de caché global
 * que `obtenerBiblioteca` en src/lib/ejercicios/data.ts: son las mismas ~8
 * filas para todos, cambian casi nunca, y `createAdminClient` evita el
 * problema de leer cookies dentro de `unstable_cache`. */
async function leerTecnicas(): Promise<TecnicaEntrenamiento[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("tecnicas_entrenamiento")
    .select("id, nombre, slug, tipo, cantidad_ejercicios, nivel_minimo, fatiga, requiere_supervision, descanso_interno_seg, descanso_final_seg, maximo_por_sesion")
    .eq("activa", true)
    .order("nombre");

  return ((data ?? []) as FilaTecnica[]).map((f) => ({
    id: f.id,
    nombre: f.nombre,
    slug: f.slug,
    tipo: f.tipo,
    cantidadEjercicios: f.cantidad_ejercicios,
    nivelMinimo: f.nivel_minimo,
    fatiga: f.fatiga,
    requiereSupervision: f.requiere_supervision,
    descansoInternoSeg: f.descanso_interno_seg,
    descansoFinalSeg: f.descanso_final_seg,
    maximoPorSesion: f.maximo_por_sesion,
  }));
}

export const obtenerTecnicas = unstable_cache(leerTecnicas, ["tecnicas-entrenamiento"], {
  revalidate: 3600,
  tags: [TAG_TECNICAS_ENTRENAMIENTO],
});
