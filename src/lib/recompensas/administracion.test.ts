import { describe, expect, it } from "vitest";
import {
  esEstadoAdministrableCanjeVip,
  esUuidVip,
  mensajeAdministracionRecompensasVip,
  textoSeguroVip,
  validarNuevaRecompensaVip,
} from "./administracion";

describe("administración de recompensas VIP", () => {
  it("normaliza una recompensa válida sin inventar stock", () => {
    expect(validarNuevaRecompensaVip({
      nombre: "  Evaluación   VIP  ",
      descripcion: "  Sesión\ncon Alejandro ",
      tipo: "servicio",
      costo: 250.4,
      stock: null,
    })).toEqual({
      nombre: "Evaluación VIP",
      descripcion: "Sesión con Alejandro",
      tipo: "servicio",
      costo: 250,
      stock: null,
    });
  });

  it.each([
    null,
    [],
    { nombre: "A", descripcion: "", tipo: "servicio", costo: 10, stock: 1 },
    { nombre: "Premio", descripcion: "", tipo: "secreto", costo: 10, stock: 1 },
    { nombre: "Premio", descripcion: "", tipo: "digital", costo: "10", stock: 1 },
    { nombre: "Premio", descripcion: "", tipo: "digital", costo: 0, stock: 1 },
    { nombre: "Premio", descripcion: "", tipo: "digital", costo: 10, stock: -1 },
    { nombre: "Premio", descripcion: "", tipo: "digital", costo: 10, stock: "" },
  ])("rechaza payloads manipulados: %j", (input) => {
    expect(validarNuevaRecompensaVip(input)).toBeNull();
  });

  it("reconoce únicamente UUID y estados permitidos", () => {
    expect(esUuidVip("ebe78865-97c6-4181-93ad-31e4007c123a")).toBe(true);
    expect(esUuidVip("../../otra-recompensa")).toBe(false);
    expect(esEstadoAdministrableCanjeVip("entregado")).toBe(true);
    expect(esEstadoAdministrableCanjeVip("cancelado")).toBe(false);
  });

  it("limita y compacta texto no confiable", () => {
    expect(textoSeguroVip("  uno\n  dos   tres  ", 11)).toBe("uno dos tre");
    expect(textoSeguroVip(null, 20)).toBe("");
  });

  it("traduce fallos transaccionales sin prometer cambios", () => {
    expect(mensajeAdministracionRecompensasVip("CANJE_YA_RESUELTO")).toContain("ya fue resuelto");
    expect(mensajeAdministracionRecompensasVip("PRIMERO_APROBAR")).toContain("Primero debes aprobar");
    expect(mensajeAdministracionRecompensasVip("SIN_PERMISO")).toContain("administrador");
    expect(mensajeAdministracionRecompensasVip("fallo desconocido")).toContain("No se modificaron");
  });
});
