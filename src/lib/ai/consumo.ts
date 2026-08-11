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
 * Si cambian, se cambian acá y todo el contador se corrige de una.
 *
 * Escribir caché tiene DOS tarifas según el TTL pedido, no una: 5 minutos
 * cuesta 1.25x la entrada normal, 1 hora cuesta el doble (2x). `revisarRutina`
 * pide `ttl: "1h"` a propósito (ver su comentario) porque es la llamada más
 * cara de la app — si acá se le aplicara la tarifa de 5 minutos, el contador
 * subestimaría justo esa llamada, que es la que existe para no subestimar. */
const PRECIOS_USD: Record<
  string,
  { entrada: number; salida: number; escrituraCache5m: number; escrituraCache1h: number; lecturaCache: number }
> = {
  "claude-opus-5": { entrada: 15, salida: 75, escrituraCache5m: 18.75, escrituraCache1h: 30, lecturaCache: 1.5 },
  "claude-sonnet-5": { entrada: 3, salida: 15, escrituraCache5m: 3.75, escrituraCache1h: 6, lecturaCache: 0.3 },
  "claude-haiku-4-5-20251001": { entrada: 1, salida: 5, escrituraCache5m: 1.25, escrituraCache1h: 2, lecturaCache: 0.1 },
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
  /** Desglose por TTL del SDK (`response.usage.cache_creation`). Si no viene
   * (llamador viejo, o el SDK no lo entregó), se asume todo a 5 minutos —
   * es la tarifa más barata de las dos, así que ante la duda no se cobra de
   * más, pero tampoco es el caso real de `revisarRutinaGenerada`. */
  cache_creation?: { ephemeral_1h_input_tokens: number; ephemeral_5m_input_tokens: number } | null;
};

/**
 * La caché no es gratis ni cuesta lo mismo que la entrada normal: escribirla
 * cuesta más y leerla, mucho menos. Contar solo `input_tokens` (que ya viene
 * sin lo cacheado) subestimaba justo la llamada más cara de la app.
 */
export function calcularCostoUsd(modelo: string, uso: UsoTokens): number {
  const precio = PRECIOS_USD[modelo] ?? PRECIO_POR_DEFECTO;
  const totalCache = uso.cache_creation_input_tokens ?? 0;
  const cache1h = uso.cache_creation?.ephemeral_1h_input_tokens ?? 0;
  // Sin desglose, se asume 5 minutos entero (ver comentario del tipo). Con
  // desglose, `ephemeral_5m` debería alcanzar para el resto, pero se resta
  // del total real por si el SDK redondeara distinto entre los dos campos.
  const cache5m = uso.cache_creation ? Math.max(0, totalCache - cache1h) : totalCache;
  return (
    (uso.input_tokens / 1_000_000) * precio.entrada +
    (uso.output_tokens / 1_000_000) * precio.salida +
    (cache5m / 1_000_000) * precio.escrituraCache5m +
    (cache1h / 1_000_000) * precio.escrituraCache1h +
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
