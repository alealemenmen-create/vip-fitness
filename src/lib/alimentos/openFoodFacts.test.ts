import { afterEach, describe, expect, it, vi } from "vitest";
import { buscarPorCodigoOFF } from "./openFoodFacts";

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
});
