import { afterEach, describe, expect, it, vi } from "vitest";
import { buscarEnOFF, buscarPorCodigoOFF, etiquetaMedidaEnEspanol } from "./openFoodFacts";

function respuesta(product: Record<string, unknown>) {
  return new Response(JSON.stringify({ status: 1, product }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Open Food Facts", () => {
  it("presenta las porciones importadas en español sin envolturas duplicadas", () => {
    expect(etiquetaMedidaEnEspanol("porción (1 portion (200 ml))")).toBe("porción (200 ml)");
    expect(etiquetaMedidaEnEspanol("porción (1 pote (125 g))")).toBe("porción (1 pote · 125 g)");
    expect(etiquetaMedidaEnEspanol("1 cup (240 ml)")).toBe("1 taza (240 ml)");
    expect(etiquetaMedidaEnEspanol("porción (155.0g)")).toBe("porción (155 g)");
    expect(etiquetaMedidaEnEspanol("porción (1,5l)")).toBe("porción (1,5 l)");
  });

  it("normaliza un producto válido por 100 gramos", async () => {
    const fetchMock = vi.fn().mockResolvedValue(respuesta({
      code: "7801234567890",
      product_name_es: "Yogur natural",
      brands: "Soprole",
      serving_size: "1 pote (125 g)",
      serving_quantity: 125,
      nutriments: {
        "energy-kcal_100g": 82,
        "proteins_100g": 4.1,
        "carbohydrates_100g": 11,
        "fat_100g": 2.3,
        "sugars_100g": 9,
        "sodium_100g": 0.08,
      },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const resultado = await buscarPorCodigoOFF("7801234567890");
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.producto).toMatchObject({ nombre: "Yogur natural", marca: "Soprole", kcal: 82, prot: 4.1, medidaGramos: 125 });
    expect(fetchMock.mock.calls[0]?.[0]).toContain("?fields=");
  });

  it("rechaza calorías imposibles en vez de contaminar el catálogo", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuesta({
      code: "7800000000001",
      product_name_es: "Producto manipulado",
      nutriments: { "energy-kcal_100g": 9999, "proteins_100g": 10 },
    })));

    const resultado = await buscarPorCodigoOFF("7800000000001");
    expect(resultado).toEqual({ ok: true, producto: null });
  });

  it("rechaza macros negativos o sobre 100 gramos", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuesta({
      code: "7800000000002",
      product_name_es: "Producto inconsistente",
      nutriments: { "energy-kcal_100g": 120, "proteins_100g": -4, "carbohydrates_100g": 140 },
    })));

    const resultado = await buscarPorCodigoOFF("7800000000002");
    expect(resultado).toEqual({ ok: true, producto: null });
  });

  it("trata un 404 como producto ausente y no como una falla del servicio", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ status: 0, status_verbose: "product not found" }),
      { status: 404, headers: { "content-type": "application/json" } },
    ));
    vi.stubGlobal("fetch", fetchMock);

    const resultado = await buscarPorCodigoOFF("0000000000000");
    expect(resultado).toEqual({ ok: true, producto: null });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("usa Search-a-licious para encontrar marcas chilenas y normaliza marcas en arreglo", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      hits: [{
        code: "7802900001407",
        product_name_es: "Soprole protein",
        brands: ["Soprole"],
        countries_tags: ["en:chile"],
        nutriments: {
          "energy-kcal_100g": 68,
          "proteins_100g": 6.6,
          "carbohydrates_100g": 6.3,
          "fat_100g": 1.8,
        },
      }],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const resultado = await buscarEnOFF("Soprole prueba buscador actual", "chile");

    expect(resultado).toEqual({
      ok: true,
      productos: [expect.objectContaining({ offId: "7802900001407", nombre: "Soprole protein", marca: "Soprole", kcal: 68 })],
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://search.openfoodfacts.org/search");
    const opciones = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(opciones.method).toBe("POST");
    expect(JSON.parse(String(opciones.body))).toMatchObject({
      q: expect.stringContaining('countries_tags:"en:chile"'),
      langs: ["es", "en"],
      page_size: 20,
    });
  });

  it("recurre al buscador histórico si Search-a-licious no está disponible", async () => {
    const caida = new Response("temporal", { status: 503 });
    const legado = new Response(JSON.stringify({
      products: [{
        code: "7802900001292",
        product_name_es: "Leche Entera",
        brands: "Soprole",
        nutriments: {
          "energy-kcal_100g": 61,
          "proteins_100g": 3.1,
          "carbohydrates_100g": 4.7,
          "fat_100g": 3.3,
        },
      }],
    }), { status: 200, headers: { "content-type": "application/json" } });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(caida)
      .mockResolvedValueOnce(legado);
    vi.stubGlobal("fetch", fetchMock);

    const resultado = await buscarEnOFF("Leche fallback unico", "chile");

    expect(resultado).toMatchObject({
      ok: true,
      productos: [expect.objectContaining({ nombre: "Leche Entera", marca: "Soprole" })],
      aviso: expect.stringContaining("respaldo"),
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("/cgi/search.pl?");
  });

  it("no multiplica una búsqueda de texto cuando ambos servicios están saturados", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => new Response("temporal", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    const resultado = await buscarEnOFF("consulta saturada irrepetible", "chile");

    expect(resultado).toMatchObject({ ok: false, causa: "limite" });
    // Una llamada al buscador actual y una al respaldo histórico. Antes eran
    // cuatro por los reintentos, precisamente lo peor ante un límite por IP.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
