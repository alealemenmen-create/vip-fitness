import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sql = fs.readFileSync(
  path.join(process.cwd(), "supabase", "migrations", "0114_catalogo_nutricional_vip_local.sql"),
  "utf8",
);
const delimitador = "$vip_nutricion$";
const inicio = sql.indexOf(delimitador);
const fin = sql.indexOf(delimitador, inicio + delimitador.length);
const bloque = inicio >= 0 && fin > inicio ? sql.slice(inicio + delimitador.length, fin) : null;
if (!bloque) throw new Error("La migración 0114 no contiene el bloque nutricional esperado");

type Fila = {
  fuente_clave: string;
  nombre: string;
  marca: string | null;
  porcion_base: number;
  sodio: number;
  fuente_url: string | null;
  verificacion_fuente: string;
};
const filas = JSON.parse(bloque) as Fila[];

describe("migración del catálogo nutricional local", () => {
  it("conserva las 260 filas con claves estables y sin duplicados", () => {
    expect(filas).toHaveLength(260);
    expect(new Set(filas.map((fila) => fila.fuente_clave)).size).toBe(260);
    expect(filas.every((fila) => fila.nombre.trim() && fila.porcion_base > 0)).toBe(true);
  });

  it("marca las nueve fuentes puntuales y no presenta genéricos como marcas", () => {
    expect(filas.filter((fila) => fila.fuente_url && fila.verificacion_fuente === "url_producto")).toHaveLength(9);
    expect(filas.some((fila) => fila.marca === "Generico")).toBe(false);
  });

  it("convierte sodio desde miligramos a gramos con precisión acotada", () => {
    const sal = filas.find((fila) => fila.nombre === "Sal");
    expect(sal?.sodio).toBeCloseTo(38.758, 6);
    expect(filas.every((fila) => Number.isFinite(fila.sodio) && fila.sodio >= 0)).toBe(true);
    expect(filas.every((fila) => String(fila.sodio).split(".")[1]?.length <= 6 || Number.isInteger(fila.sodio))).toBe(true);
  });

  it("no sobreescribe macros del catálogo histórico", () => {
    expect(sql).toContain("where not exists");
    expect(sql).toContain("on conflict do nothing");
    expect(sql).not.toMatch(/update public\.alimentos[\s\S]{0,500}\b(kcal|prot|carb|grasa)\s*=/i);
  });
});
