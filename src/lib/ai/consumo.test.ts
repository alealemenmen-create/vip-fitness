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

  it("una revisión real de rutina da del orden de los US$0,24 medidos en vivo", () => {
    // Números de la medición del handoff 1.15, llamada 1.
    const costo = calcularCostoUsd("claude-opus-5", {
      input_tokens: 3636,
      output_tokens: 6556,
      cache_creation_input_tokens: 8849,
      cache_read_input_tokens: 0,
    });
    expect(costo).toBeGreaterThan(0.15);
    expect(costo).toBeLessThan(0.9);
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
