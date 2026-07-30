import "server-only";

/**
 * Instrumentación temporal para medir el rendimiento real.
 *
 * Envuelve el `fetch` que usan los clientes de Supabase y deja en el log cada
 * viaje a la base: cuánto tardó, a qué tabla fue y en qué momento del request
 * arrancó. Con eso se reconstruye la cascada real (qué espera a qué) en vez de
 * estimarla leyendo el código.
 *
 * Se activa solo con VIP_DEBUG_SQL=1. Con la variable apagada devuelve el
 * `fetch` nativo y no cuesta absolutamente nada.
 */

const activo = process.env.VIP_DEBUG_SQL === "1";

let contador = 0;

/** Deja el nombre de la tabla (o del endpoint de Auth) a partir de la URL. */
function etiqueta(url: string): string {
  try {
    const { pathname, searchParams } = new URL(url);
    if (pathname.includes("/auth/v1/")) {
      return `AUTH ${pathname.split("/auth/v1/")[1] ?? ""}`;
    }
    const tabla = pathname.split("/rest/v1/")[1] ?? pathname;
    const select = searchParams.get("select");
    // El select suele delatar cuál de varias consultas a la misma tabla es.
    const detalle = select && select.length < 60 ? ` (${select})` : "";
    return `${tabla}${detalle}`;
  } catch {
    return url;
  }
}

export function fetchInstrumentado(): typeof fetch | undefined {
  if (!activo) return undefined;

  return async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof entrada === "string" ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
    const n = ++contador;
    const inicio = performance.now();
    try {
      return await fetch(entrada, init);
    } finally {
      const ms = performance.now() - inicio;
      console.log(`[SB ${String(n).padStart(3)}] ${ms.toFixed(0).padStart(4)}ms  ${etiqueta(url)}`);
    }
  };
}

/** Marca el comienzo de un request en el log, para separar una carga de otra. */
export function marcarRequest(nombre: string): void {
  if (!activo) return;
  console.log(`\n────── ${nombre} ──────`);
}
