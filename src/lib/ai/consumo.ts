import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Registro único de consumo de IA.
 *
 * Antes cada herramienta escribía su propia fila en `asistente_uso_ia` con su
 * propio cálculo de costo, y las tres más caras —la revisión de rutinas, la
 * extracción de PDF y los retos— no escribían ninguna. Resultado: el contador
 * de Configuración mostraba una fracción del gasto real.
 *
 * Degrada en silencio a propósito. Si la migración 0065 todavía no corrió en
 * este entorno, la restricción de `herramienta` rechaza los valores nuevos:
 * eso NO puede impedir que se revise una rutina o se lea un PDF. Mismo
 * criterio que ya se usa con la columna `dificultad_percibida` de Impulso VIP.
 */

/** Precio por millón de tokens, en dólares. De la tabla pública de Anthropic.
 * Si cambian, se cambian acá y todo el contador se corrige de una. */
const PRECIOS_USD: Record<string, { entrada: number; salida: number; escrituraCache: number; lecturaCache: number }> = {
  "claude-opus-5": { entrada: 15, salida: 75, escrituraCache: 18.75, lecturaCache: 1.5 },
  "claude-sonnet-5": { entrada: 3, salida: 15, escrituraCache: 3.75, lecturaCache: 0.3 },
  "claude-haiku-4-5-20251001": { entrada: 1, salida: 5, escrituraCache: 1.25, lecturaCache: 0.1 },
};

/** Modelo desconocido: se cobra como Sonnet en vez de como 0. Un contador que
 * subestima es peor que uno impreciso — el objetivo es que no se le acabe el
 * saldo sin aviso. */
const PRECIO_POR_DEFECTO = PRECIOS_USD["claude-sonnet-5"];

export type UsoTokens = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
};

/**
 * La caché no es gratis ni cuesta lo mismo que la entrada normal: escribirla
 * cuesta más y leerla, mucho menos. Contar solo `input_tokens` (que ya viene
 * sin lo cacheado) subestimaba justo la llamada más cara de la app.
 */
export function calcularCostoUsd(modelo: string, uso: UsoTokens): number {
  const precio = PRECIOS_USD[modelo] ?? PRECIO_POR_DEFECTO;
  return (
    (uso.input_tokens / 1_000_000) * precio.entrada +
    (uso.output_tokens / 1_000_000) * precio.salida +
    ((uso.cache_creation_input_tokens ?? 0) / 1_000_000) * precio.escrituraCache +
    ((uso.cache_read_input_tokens ?? 0) / 1_000_000) * precio.lecturaCache
  );
}

export type HerramientaIA =
  | "revision_rutina"
  | "extraccion_documento"
  | "reto"
  | "atencion"
  | "nutricion"
  | "entrenamiento"
  | "progreso"
  | "noticia"
  | "alumno"
  | "eliminar_datos";

export async function registrarUsoIA(params: {
  usuarioId: string;
  herramienta: HerramientaIA;
  modelo: string;
  uso: UsoTokens;
}): Promise<number> {
  const costoUsd = calcularCostoUsd(params.modelo, params.uso);
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("asistente_uso_ia").insert({
      usuario_id: params.usuarioId,
      herramienta: params.herramienta,
      modelo: params.modelo,
      // La columna cuenta tokens de entrada: se suma lo cacheado, que se pagó
      // igual aunque no haya viajado como entrada nueva.
      tokens_entrada:
        params.uso.input_tokens +
        (params.uso.cache_creation_input_tokens ?? 0) +
        (params.uso.cache_read_input_tokens ?? 0),
      tokens_salida: params.uso.output_tokens,
      costo_usd: costoUsd,
    });
    if (error) console.warn(`[consumo-ia] no se registró el uso de ${params.herramienta}:`, error.message);
  } catch (e) {
    console.warn("[consumo-ia] no se registró el uso:", e instanceof Error ? e.message : e);
  }
  return costoUsd;
}
