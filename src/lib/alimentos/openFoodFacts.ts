/**
 * Cliente para Open Food Facts: la fuente de respaldo cuando un alimento no
 * está en el catálogo propio del gimnasio (yogures, galletas, marcas
 * chilenas). Corre en el navegador — la API de OFF permite CORS y así se
 * evita gastar tiempo de función del servidor en algo que no toca la base
 * de datos.
 */

export type ProductoOFF = {
  offId: string;
  nombre: string;
  marca: string | null;
  kcal: number;
  prot: number;
  carb: number;
  grasa: number;
  fibra: number | null;
  azucares: number | null;
  sodio: number | null;
  /** Porción práctica que trae el propio producto ("1 pote (125 g)"), si la trae. */
  medidaNombre: string | null;
  medidaGramos: number | null;
  imagenUrl: string | null;
};

export type ResultadoOFF = { ok: true; productos: ProductoOFF[] } | { ok: false; error: string };
export type ResultadoProductoOFF = { ok: true; producto: ProductoOFF | null } | { ok: false; error: string };

const BASE_URL_BUSQUEDA = "https://world.openfoodfacts.org/cgi/search.pl";
const BASE_URL_PRODUCTO = "https://world.openfoodfacts.org/api/v2/product";
const TIMEOUT_MS = 5000;

// Cache en memoria del navegador: dura mientras el alumno tiene la página
// abierta, para no repetir la misma consulta si borra y vuelve a escribir.
const cache = new Map<string, ProductoOFF[]>();

type RawProducto = {
  code?: string;
  product_name?: string;
  product_name_es?: string;
  brands?: string;
  nutriments?: Record<string, number | string>;
  serving_size?: string;
  serving_quantity?: number | string;
  image_front_small_url?: string;
};

function numero(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Convierte "125 g" / serving_quantity en una medida casera usable. */
function medidaDesdeServing(
  servingSize: string | undefined,
  servingQuantity: number | string | undefined
): { nombre: string; gramos: number } | null {
  const gramosDirectos = numero(servingQuantity);
  if (gramosDirectos && gramosDirectos > 0) {
    return {
      nombre: servingSize ? `porción (${servingSize.trim()})` : `porción (${gramosDirectos} g)`,
      gramos: gramosDirectos,
    };
  }
  if (!servingSize) return null;
  const match = servingSize.match(/([\d.,]+)\s*(g|ml)\b/i);
  if (!match) return null;
  const valor = Number(match[1].replace(",", "."));
  if (!Number.isFinite(valor) || valor <= 0) return null;
  return { nombre: `porción (${servingSize.trim()})`, gramos: valor };
}

function normalizarProducto(p: RawProducto): ProductoOFF | null {
  const nombre = (p.product_name_es || p.product_name || "").trim();
  const kcal = numero(p.nutriments?.["energy-kcal_100g"]);
  // Sin nombre o sin calorías por 100g, el producto no sirve para el registro.
  if (!nombre || kcal === null || !p.code) return null;

  const medida = medidaDesdeServing(p.serving_size, p.serving_quantity);

  return {
    offId: String(p.code),
    nombre,
    marca: p.brands ? p.brands.split(",")[0].trim() || null : null,
    kcal,
    prot: numero(p.nutriments?.["proteins_100g"]) ?? 0,
    carb: numero(p.nutriments?.["carbohydrates_100g"]) ?? 0,
    grasa: numero(p.nutriments?.["fat_100g"]) ?? 0,
    fibra: numero(p.nutriments?.["fiber_100g"]),
    azucares: numero(p.nutriments?.["sugars_100g"]),
    sodio: numero(p.nutriments?.["sodium_100g"]),
    medidaNombre: medida?.nombre ?? null,
    medidaGramos: medida?.gramos ?? null,
    imagenUrl: p.image_front_small_url || null,
  };
}

type ResultadoJSON = { ok: true; json: unknown } | { ok: false; error: string };

/** Fetch con timeout de 5 s y un reintento ante 429 — común a la búsqueda por
 * texto y a la consulta directa por código de barras. */
async function fetchConReintento(url: string, reintentando = false): Promise<ResultadoJSON> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });

    if (res.status === 429) {
      if (!reintentando) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        return fetchConReintento(url, true);
      }
      return {
        ok: false,
        error: "Open Food Facts está saturado ahora mismo. Intenta de nuevo en un momento.",
      };
    }

    if (!res.ok) return { ok: false, error: "Open Food Facts no respondió correctamente." };

    return { ok: true, json: await res.json() };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { ok: false, error: "Open Food Facts no respondió a tiempo." };
    }
    return { ok: false, error: "No se pudo conectar con Open Food Facts." };
  } finally {
    clearTimeout(timeout);
  }
}

async function consultar(url: string): Promise<ResultadoOFF> {
  const resultado = await fetchConReintento(url);
  if (!resultado.ok) return resultado;

  const json = resultado.json as { products?: unknown };
  const crudos = Array.isArray(json?.products) ? (json.products as RawProducto[]) : [];
  const productos = crudos.map(normalizarProducto).filter((p): p is ProductoOFF => p !== null);
  return { ok: true, productos };
}

/** Busca productos por texto, priorizando Chile o abriendo a todo el catálogo global. */
export async function buscarEnOFF(texto: string, pais: "chile" | "global"): Promise<ResultadoOFF> {
  const q = texto.trim();
  if (q.length < 2) return { ok: true, productos: [] };

  const clave = `${pais}:${q.toLowerCase()}`;
  const cacheada = cache.get(clave);
  if (cacheada) return { ok: true, productos: cacheada };

  const params = new URLSearchParams({
    search_terms: q,
    search_simple: "1",
    action: "process",
    json: "1",
    page_size: "20",
  });
  if (pais === "chile") {
    params.set("tagtype_0", "countries");
    params.set("tag_contains_0", "contains");
    params.set("tag_0", "chile");
  }

  const resultado = await consultar(`${BASE_URL_BUSQUEDA}?${params.toString()}`);
  if (resultado.ok) cache.set(clave, resultado.productos);
  return resultado;
}

/** Consulta directa por código de barras (escáner). `producto: null` significa
 * que Open Food Facts respondió pero no tiene ese código — no es un error. */
export async function buscarPorCodigoOFF(codigo: string): Promise<ResultadoProductoOFF> {
  const c = codigo.trim();
  if (!c) return { ok: true, producto: null };

  const resultado = await fetchConReintento(`${BASE_URL_PRODUCTO}/${encodeURIComponent(c)}.json`);
  if (!resultado.ok) return resultado;

  const json = resultado.json as { status?: number; product?: RawProducto };
  if (json.status !== 1 || !json.product) return { ok: true, producto: null };

  // El objeto `product` del endpoint por código a veces no repite el campo
  // `code`: se usa el que se pidió si falta.
  const producto = normalizarProducto({ ...json.product, code: json.product.code || c });
  return { ok: true, producto };
}
