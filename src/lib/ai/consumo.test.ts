import { describe, it, expect } from "vitest";
import { calcularCostoUsd } from "./consumo";

describe("calcularCostoUsd", () => {
  it("cobra entrada y salida al precio del modelo", () => {
    // 1M de entrada a US$15 + 1M de salida a US$75 = US$90.
    const costo = calcularCostoUsd("claude-opus-5", {
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
    });
    expect(costo).toBeCloseTo(90, 6);
  });

  it("cuenta la caché — es lo que antes se dejaba afuera", () => {
    const sinCache = calcularCostoUsd("claude-opus-5", { input_tokens: 3636, output_tokens: 6556 });
    const conCache = calcularCostoUsd("claude-opus-5", {
      input_tokens: 3636,
      output_tokens: 6556,
      cache_creation_input_tokens: 8849,
      cache_read_input_tokens: 0,
    });
    expect(conCache).toBeGreaterThan(sinCache);
  });

  it("leer de caché cuesta menos que escribirla", () => {
    const escribir = calcularCostoUsd("claude-opus-5", {
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_input_tokens: 10_000,
    });
    const leer = calcularCostoUsd("claude-opus-5", {
      input_tokens: 0,
      output_tokens: 0,
      cache_read_input_tokens: 10_000,
    });
    expect(leer).toBeLessThan(escribir);
  });

  it("con los tokens de la medición del handoff 1.15 (llamada 1), da ~US$0,71 a los precios actuales", () => {
    // El handoff citó "~US$0,24" para esta misma medición, pero esa cifra no
    // sale de esta fórmula con estos números (da ~US$0,71, casi 3x más) — el
    // rango viejo de esta prueba (0.15 a 0.9) era tan ancho que no lo
    // detectaba. O el precio de Opus en `PRECIOS_USD` está desactualizado, o
    // el "~US$0,24" del handoff/paneles quedó viejo: falta reconciliar contra
    // una factura real de Anthropic antes de confiar en el panel de saldo.
    const costo = calcularCostoUsd("claude-opus-5", {
      input_tokens: 3636,
      output_tokens: 6556,
      cache_creation_input_tokens: 8849,
      cache_read_input_tokens: 0,
    });
    expect(costo).toBeCloseTo(0.71215875, 6);
  });

  it("la escritura de caché de 1 hora cuesta más que la de 5 minutos, mismo total de tokens", () => {
    // `revisarRutinaGenerada` pide `ttl: "1h"` a propósito (ver su
    // comentario): sin este desglose, esa llamada —la más cara de la app— se
    // cobraba a la tarifa de 5 minutos, más barata, y el contador la
    // subestimaba justo a ella.
    const con5m = calcularCostoUsd("claude-opus-5", {
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_input_tokens: 10_000,
      cache_creation: { ephemeral_1h_input_tokens: 0, ephemeral_5m_input_tokens: 10_000 },
    });
    const con1h = calcularCostoUsd("claude-opus-5", {
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_input_tokens: 10_000,
      cache_creation: { ephemeral_1h_input_tokens: 10_000, ephemeral_5m_input_tokens: 0 },
    });
    expect(con1h).toBeGreaterThan(con5m);
    // 1h = 2x entrada, 5m = 1.25x entrada — la razón entre ambos es fija.
    expect(con1h).toBeCloseTo(con5m * (2 / 1.25), 6);
  });

  it("sin el desglose de 1h/5m del SDK, se asume todo a la tarifa más barata (5 min)", () => {
    const uso = { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 10_000 };
    const sinDesglose = calcularCostoUsd("claude-opus-5", uso);
    const con5mExplicito = calcularCostoUsd("claude-opus-5", {
      ...uso,
      cache_creation: { ephemeral_1h_input_tokens: 0, ephemeral_5m_input_tokens: 10_000 },
    });
    expect(sinDesglose).toBeCloseTo(con5mExplicito, 6);
  });

  it("un modelo desconocido se cobra como Sonnet, nunca como gratis", () => {
    const costo = calcularCostoUsd("modelo-que-no-existe", {
      input_tokens: 1_000_000,
      output_tokens: 0,
    });
    expect(costo).toBeCloseTo(3, 6);
  });

  it("sin tokens no cobra nada", () => {
    expect(calcularCostoUsd("claude-opus-5", { input_tokens: 0, output_tokens: 0 })).toBe(0);
  });
});
