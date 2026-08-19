import { describe, expect, it } from "vitest";
import { DESTINOS_ADMIN, gruposDestinosParaRol } from "./destinos";

describe("gruposDestinosParaRol", () => {
  it("mantiene todas las herramientas para el administrador", () => {
    const visibles = gruposDestinosParaRol("admin").flatMap((grupo) => grupo.items);
    expect(visibles.map((item) => item.href)).toEqual(DESTINOS_ADMIN.map((item) => item.href));
  });

  it("limita al entrenador a trabajo técnico y seguimiento", () => {
    const grupos = gruposDestinosParaRol("entrenador");
    const visibles = grupos.flatMap((grupo) => grupo.items);
    expect(visibles.every((item) => !item.soloAdmin)).toBe(true);
    expect(visibles.map((item) => item.href)).toEqual(expect.arrayContaining([
      "/admin/alumnos",
      "/admin/armar-rutina",
      "/admin/generador",
      "/admin/ejercicios",
      "/admin/alimentos",
      "/admin/pendientes",
      "/admin/asistente",
    ]));
    expect(visibles.map((item) => item.href)).not.toEqual(expect.arrayContaining([
      "/admin/configuracion",
      "/admin/gastos",
      "/admin/puntos",
      "/admin/auditoria",
      "/admin/solicitudes",
    ]));
    expect(grupos.some((grupo) => grupo.label === "Administración")).toBe(false);
  });
});
