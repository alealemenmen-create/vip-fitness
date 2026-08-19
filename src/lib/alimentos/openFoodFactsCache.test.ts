import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProductoOFF, ResultadoOFF } from "./openFoodFacts";

const { buscarExterno, filas } = vi.hoisted(() => ({
  buscarExterno: vi.fn<(texto: string, pais: "chile" | "global") => Promise<ResultadoOFF>>(),
  filas: new Map<string, Record<string, unknown>>(),
}));

vi.mock("./openFoodFacts", async (importOriginal) => {
  const real = await importOriginal<typeof import("./openFoodFacts")>();
  return { ...real, buscarEnOFF: buscarExterno };
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      const filtros: Record<string, unknown> = {};
      const consulta = {
        select: () => consulta,
        eq: (campo: string, valor: unknown) => {
          filtros[campo] = valor;
          return consulta;
        },
        maybeSingle: async () => ({
          data: filas.get(`${filtros.pais}:${filtros.consulta}`) ?? null,
          error: null,
        }),
        upsert: async (fila: Record<string, unknown>) => {
          filas.set(`${fila.pais}:${fila.consulta}`, fila);
          return { error: null };
        },
      };
      return consulta;
    },
  }),
}));

import {
  buscarEnOFFConCache,
  normalizarConsultaOFF,
  reiniciarEstadoOFFParaPruebas,
} from "./openFoodFactsCache";

const producto: ProductoOFF = {
  offId: "7802900001407",
  nombre: "Soprole Protein",
  marca: "Soprole",
  kcal: 68,
  prot: 6.6,
  carb: 6.3,
  grasa: 1.8,
  fibra: null,
  azucares: 5,
  sodio: 0.08,
  medidaNombre: "porción (155 g)",
  medidaGramos: 155,
  imagenUrl: null,
};

beforeEach(() => {
  filas.clear();
  buscarExterno.mockReset();
  reiniciarEstadoOFFParaPruebas();
});

describe("caché compartida de Open Food Facts", () => {
  it("normaliza la clave sin cambiar el significado de la consulta", () => {
    expect(normalizarConsultaOFF("  Yogur   ProteÍna  ")).toBe("yogur proteína");
  });

  it("reutiliza una respuesta compartida y evita una segunda llamada externa", async () => {
    buscarExterno.mockResolvedValue({ ok: true, productos: [producto] });

    const primera = await buscarEnOFFConCache("Soprole Protein", "chile");
    const segunda = await buscarEnOFFConCache("  soprole   protein ", "chile");

    expect(primera).toMatchObject({ ok: true, origen: "externo" });
    expect(segunda).toMatchObject({ ok: true, origen: "cache", productos: [producto] });
    expect(buscarExterno).toHaveBeenCalledTimes(1);
  });

  it("deduplica dos búsquedas simultáneas de la misma comida", async () => {
    let resolver!: (resultado: ResultadoOFF) => void;
    buscarExterno.mockReturnValue(new Promise((resolve) => { resolver = resolve; }));

    const primera = buscarEnOFFConCache("yogur concurrente", "chile");
    const segunda = buscarEnOFFConCache("yogur concurrente", "chile");
    await vi.waitFor(() => expect(buscarExterno).toHaveBeenCalledTimes(1));
    resolver({ ok: true, productos: [producto] });

    await expect(primera).resolves.toMatchObject({ ok: true, productos: [producto] });
    await expect(segunda).resolves.toMatchObject({ ok: true, productos: [producto] });
  });

  it("sirve un respaldo reciente cuando el proveedor está caído", async () => {
    filas.set("chile:yogur respaldo", {
      consulta: "yogur respaldo",
      pais: "chile",
      productos: [producto],
      expira_en: new Date(Date.now() - 60_000).toISOString(),
      actualizado_en: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    });
    buscarExterno.mockResolvedValue({ ok: false, causa: "limite", error: "saturado" });

    const resultado = await buscarEnOFFConCache("yogur respaldo", "chile");

    expect(resultado).toMatchObject({
      ok: true,
      origen: "cache",
      productos: [producto],
      aviso: expect.stringContaining("guardados"),
    });
  });

  it("abre un circuito breve después de tres caídas y deja de insistir", async () => {
    buscarExterno.mockResolvedValue({ ok: false, causa: "limite", error: "saturado" });

    await buscarEnOFFConCache("fallo uno", "chile");
    await buscarEnOFFConCache("fallo dos", "chile");
    await buscarEnOFFConCache("fallo tres", "chile");
    const cuarto = await buscarEnOFFConCache("fallo cuatro", "chile");

    expect(cuarto).toMatchObject({ ok: false, causa: "limite" });
    expect(buscarExterno).toHaveBeenCalledTimes(3);
  });
});
