/**
 * Cliente para Open Food Facts: la fuente de respaldo cuando un alimento no
 * está en el catálogo propio del gimnasio (yogures, galletas, marcas
 * chilenas).
 *
 * Corre en el SERVIDOR, llamado desde las Server Actions de
 * `@/app/alumno/comer/actions` (`buscarEnOFFAction`, `buscarPorCodigoOFFAction`).
 * La búsqueda principal usa Search-a-licious, el buscador de texto actual de
 * Open Food Facts. `cgi/search.pl` queda como respaldo porque sigue siendo el
 * único buscador de texto de Product Opener, pero su disponibilidad es menor.
 * Todo corre servidor-a-servidor para identificar la aplicación, controlar el
 * tiempo de espera y no depender de CORS en el teléfono del alumno.
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

const BASE_URL_BUSQUEDA = "https://search.openfoodfacts.org/search";
const BASE_URL_BUSQUEDA_LEGACY = "https://world.openfoodfacts.org/cgi/search.pl";
const BASE_URL_PRODUCTO = "https://world.openfoodfacts.org/api/v2/product";
const CAMPOS_OFF = ["code", "product_name_es", "product_name", "brands", "nutriments", "serving_size", "serving_quantity", "image_front_small_url"] as const;
const CAMPOS_OFF_QUERY = CAMPOS_OFF.join(",");
const TIMEOUT_MS = 5000;

// Cache corta en memoria del proceso servidor. Evita repetir la misma consulta
// si el alumno borra y vuelve a escribir; nunca contiene datos personales.
const CACHE_TTL_MS = 15 * 60 * 1000;
const CACHE_MAX_ENTRADAS = 250;
const cache = new Map<string, { expira: number; productos: ProductoOFF[] }>();

type RawProducto = {
  code?: string;
  product_name?: string;
  product_name_es?: string;
  brands?: string | string[];
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

function nutriente(v: unknown, maximo: number): number | null {
  const valor = numero(v);
  if (valor === null) return null;
  return valor >= 0 && valor <= maximo ? valor : null;
}

/**
 * Open Food Facts mezcla etiquetas en distintos idiomas incluso cuando el
 * producto y la interfaz están en español. Normalizamos las palabras de uso
 * habitual y eliminamos la doble envoltura "porción (1 porción (...))" sin
 * tocar unidades ni cantidades.
 */
export function etiquetaMedidaEnEspanol(valor: string): string {
  const etiqueta = valor
    .trim()
    .replace(/\bportions?\b/gi, "porción")
    .replace(/\bservings?\b/gi, "porción")
    .replace(/\bpieces?\b/gi, "unidad")
    .replace(/\bunits?\b/gi, "unidad")
    .replace(/\bslices?\b/gi, "rebanada")
    .replace(/\bcups?\b/gi, "taza")
    .replace(/\btbsp\b/gi, "cucharada")
    .replace(/\btsp\b/gi, "cucharadita")
    .replace(/\s+/g, " ");

  const doblePorcion = etiqueta.match(/^porción\s*\(\s*1\s+porción\s*\((.+)\)\s*\)$/i);
  if (doblePorcion?.[1]) return `porción (${doblePorcion[1].trim()})`;

  const porcionSimple = etiqueta.match(/^1\s+porción\s*\((.+)\)$/i);
  if (porcionSimple?.[1]) return `porción (${porcionSimple[1].trim()})`;

  // "porción (1 pote (125 g))" se lee mejor sin paréntesis anidados.
  const anidada = etiqueta.match(/^porción\s*\((.+)\s*\(([^()]+)\)\s*\)$/i);
  if (anidada?.[1] && anidada[2]) return `porción (${anidada[1].trim()} · ${anidada[2].trim()})`;
  return etiqueta;
}

/** Convierte "125 g" / serving_quantity en una medida casera usable. */
function medidaDesdeServing(
  servingSize: string | undefined,
  servingQuantity: number | string | undefined
): { nombre: string; gramos: number } | null {
  const gramosDirectos = numero(servingQuantity);
  if (gramosDirectos && gramosDirectos > 0) {
    return {
      nombre: etiquetaMedidaEnEspanol(servingSize ? `porción (${servingSize.trim()})` : `porción (${gramosDirectos} g)`),
      gramos: gramosDirectos,
    };
  }
  if (!servingSize) return null;
  const match = servingSize.match(/([\d.,]+)\s*(g|ml)\b/i);
  if (!match) return null;
  const valor = Number(match[1].replace(",", "."));
  if (!Number.isFinite(valor) || valor <= 0) return null;
  return { nombre: etiquetaMedidaEnEspanol(`porción (${servingSize.trim()})`), gramos: valor };
}

function normalizarProducto(p: RawProducto): ProductoOFF | null {
  const nombre = (p.product_name_es || p.product_name || "").trim();
  const kcalCrudas = numero(p.nutriments?.["energy-kcal_100g"]);
  // Sin nombre o sin calorías por 100g, el producto no sirve para el registro.
  if (!nombre || kcalCrudas === null || kcalCrudas < 0 || kcalCrudas > 900 || !p.code) return null;

  const campos = [
    ["proteins_100g", 100],
    ["carbohydrates_100g", 100],
    ["fat_100g", 100],
    ["fiber_100g", 100],
    ["sugars_100g", 100],
    ["sodium_100g", 100],
  ] as const;
  for (const [campo, maximo] of campos) {
    const crudo = p.nutriments?.[campo];
    // Un campo ausente es aceptable; uno presente pero imposible invalida el
    // producto completo en vez de convertir silenciosamente basura en cero.
    if (crudo !== undefined && nutriente(crudo, maximo) === null) return null;
  }

  const medida = medidaDesdeServing(p.serving_size, p.serving_quantity);

  return {
    offId: String(p.code),
    nombre,
    marca: Array.isArray(p.brands)
      ? p.brands.find((marca) => marca.trim())?.trim() ?? null
      : p.brands?.split(",")[0]?.trim() || null,
    kcal: kcalCrudas,
    prot: nutriente(p.nutriments?.["proteins_100g"], 100) ?? 0,
    carb: nutriente(p.nutriments?.["carbohydrates_100g"], 100) ?? 0,
    grasa: nutriente(p.nutriments?.["fat_100g"], 100) ?? 0,
    fibra: nutriente(p.nutriments?.["fiber_100g"], 100),
    azucares: nutriente(p.nutriments?.["sugars_100g"], 100),
    sodio: nutriente(p.nutriments?.["sodium_100g"], 100),
    medidaNombre: medida?.nombre ?? null,
    medidaGramos: medida?.gramos ?? null,
    imagenUrl: p.image_front_small_url || null,
  };
}

type ResultadoJSON = { ok: true; json: unknown } | { ok: false; error: string };

/** Fetch con timeout de 5 s y un reintento — ante 429 (saturado) o cualquier
 * otro error, porque en la práctica `cgi/search.pl` (el buscador legado de
 * OFF) falla seguido de forma pasajera, sin relación con el texto buscado
 * ("mang" y "pudin" fallaron, "mango" no). Común a la búsqueda por texto y a
 * la consulta directa por código de barras. */
// OFF pide identificar a quién consulta su API (User-Agent propio); el
// navegador no deja mandar este header desde `fetch`, pero acá corre en el
// servidor, donde sí se puede — y evita que nos traten como tráfico anónimo.
const USER_AGENT = "VIPFitness/1.0 (gimnasio, app de nutricion; contacto via app)";

async function fetchConReintento(url: string, opciones: RequestInit = {}, reintentando = false): Promise<ResultadoJSON> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const headers = new Headers(opciones.headers);
    headers.set("User-Agent", USER_AGENT);
    const res = await fetch(url, {
      ...opciones,
      signal: controller.signal,
      headers,
    });

    if (!res.ok) {
      // La API de producto responde 404 cuando el código no existe. Eso es un
      // resultado válido (producto ausente), no una caída que debamos reintentar
      // ni presentar como error de conexión.
      if (res.status === 404) return { ok: true, json: { status: 0 } };
      if (!reintentando) {
        await new Promise((resolve) => setTimeout(resolve, res.status === 429 ? 1500 : 500));
        return fetchConReintento(url, opciones, true);
      }
      // Queda en los logs del servidor para poder ver por qué, la próxima vez
      // que pase — al alumno se le muestra un mensaje simple, no esto.
      console.error("Open Food Facts respondió mal:", res.status, (await res.text()).slice(0, 300));
      return {
        ok: false,
        error:
          res.status === 429
            ? "Open Food Facts está saturado ahora mismo. Intenta de nuevo en un momento."
            : "Open Food Facts no respondió correctamente.",
      };
    }

    return { ok: true, json: await res.json() };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { ok: false, error: "Open Food Facts no respondió a tiempo." };
    }
    console.error("Open Food Facts fetch error:", err);
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

function escaparConsultaLucene(texto: string): string {
  // Search-a-licious entiende Lucene. La búsqueda del alumno es texto, no una
  // consulta avanzada: escapar sus operadores evita errores 400 y filtros
  // accidentales cuando una marca trae signos como +, /, ( o ).
  return texto.replace(/([+\-=&|><!(){}\[\]^"~*?:\\/])/g, "\\$1").replace(/\s+/g, " ").trim();
}

async function consultarSearchALicious(texto: string, pais: "chile" | "global"): Promise<ResultadoOFF> {
  const consulta = escaparConsultaLucene(texto);
  const q = pais === "chile" ? `${consulta} countries_tags:"en:chile"` : consulta;
  const resultado = await fetchConReintento(BASE_URL_BUSQUEDA, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      q,
      page: 1,
      page_size: 20,
      langs: ["es", "en"],
      boost_phrase: true,
      fields: CAMPOS_OFF,
    }),
  });
  if (!resultado.ok) return resultado;
  const json = resultado.json as { hits?: unknown };
  const crudos = Array.isArray(json?.hits) ? (json.hits as RawProducto[]) : [];
  return { ok: true, productos: crudos.map(normalizarProducto).filter((p): p is ProductoOFF => p !== null) };
}

async function consultarBusquedaLegacy(texto: string, pais: "chile" | "global"): Promise<ResultadoOFF> {
  const params = new URLSearchParams({
    search_terms: texto,
    search_simple: "1",
    action: "process",
    json: "1",
    page_size: "20",
    fields: CAMPOS_OFF_QUERY,
  });
  if (pais === "chile") {
    params.set("tagtype_0", "countries");
    params.set("tag_contains_0", "contains");
    params.set("tag_0", "chile");
  }
  return consultar(`${BASE_URL_BUSQUEDA_LEGACY}?${params.toString()}`);
}

/** Busca productos por texto, priorizando Chile o abriendo a todo el catálogo global. */
export async function buscarEnOFF(texto: string, pais: "chile" | "global"): Promise<ResultadoOFF> {
  const q = texto.trim();
  if (q.length < 2) return { ok: true, productos: [] };

  const clave = `${pais}:${q.toLowerCase()}`;
  const cacheada = cache.get(clave);
  if (cacheada && cacheada.expira > Date.now()) {
    // Renovar su posición mantiene las consultas recientes al final del Map.
    cache.delete(clave);
    cache.set(clave, cacheada);
    return { ok: true, productos: cacheada.productos };
  }
  if (cacheada) cache.delete(clave);

  // Search-a-licious es el buscador oficial de texto actual. Si está caído,
  // se intenta una vez el endpoint histórico para que una incidencia de uno
  // de los dos servicios no deje al alumno sin catálogo externo.
  let resultado = await consultarSearchALicious(q, pais);
  if (!resultado.ok) resultado = await consultarBusquedaLegacy(q, pais);
  if (!resultado.ok) {
    return {
      ok: false,
      error: "El catálogo externo está temporalmente fuera de servicio. El catálogo VIP sigue disponible y también puedes crear el producto.",
    };
  }
  if (resultado.ok) {
    cache.set(clave, { expira: Date.now() + CACHE_TTL_MS, productos: resultado.productos });
    while (cache.size > CACHE_MAX_ENTRADAS) {
      const masAntigua = cache.keys().next().value;
      if (!masAntigua) break;
      cache.delete(masAntigua);
    }
  }
  return resultado;
}

/** Consulta directa por código de barras (escáner). `producto: null` significa
 * que Open Food Facts respondió pero no tiene ese código — no es un error. */
export async function buscarPorCodigoOFF(codigo: string): Promise<ResultadoProductoOFF> {
  const c = codigo.trim();
  if (!c) return { ok: true, producto: null };

  const resultado = await fetchConReintento(`${BASE_URL_PRODUCTO}/${encodeURIComponent(c)}.json?fields=${encodeURIComponent(CAMPOS_OFF_QUERY)}`);
  if (!resultado.ok) return resultado;

  const json = resultado.json as { status?: number; product?: RawProducto };
  if (json.status !== 1 || !json.product) return { ok: true, producto: null };

  // El objeto `product` del endpoint por código a veces no repite el campo
  // `code`: se usa el que se pidió si falta.
  const producto = normalizarProducto({ ...json.product, code: json.product.code || c });
  return { ok: true, producto };
}
