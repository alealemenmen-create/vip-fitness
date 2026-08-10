import { describe, expect, it } from "vitest";
import { sugerirDesdeFichas, type FichaParaSugerencias } from "./sugerencias-perfil";

const ficha = (extra: Partial<FichaParaSugerencias> = {}): FichaParaSugerencias => ({
  nombre: "Alumno", objetivoPrincipal: "hipertrofia", experiencia: "intermedio", cardioNivel: "medio",
  preferenciaEquipo: "indistinto", dias: 5, minutos: 75, molestias: null, lesiones: null,
  categoriaReferencia: "ninguna", operaciones: null, condiciones: null, noDeseados: null, preferidos: null, ...extra,
});
const ejercicios = [
  { id: "press", nombre: "Press banca", grupo: "pecho", equipo: "barra" },
  { id: "peso-muerto", nombre: "Peso muerto", grupo: "espalda", equipo: "barra" },
  { id: "curl", nombre: "Curl martillo", grupo: "brazos", equipo: "mancuerna" },
];

describe("sugerirDesdeFichas", () => {
  it("precarga objetivo, prioridad, días, tiempo e intensidad desde una ficha", () => {
    const r = sugerirDesdeFichas([ficha({ objetivoPrincipal: "fuerza", experiencia: "avanzado" })], ejercicios, ["spinning"]);
    expect(r).toMatchObject({ objetivo: "fuerza", prioridad: "fuerza", dias: 5, minutos: 75, intensidad: "alta", tecnicasIntensidad: "si" });
  });

  it("en grupo usa la disponibilidad y experiencia más conservadoras", () => {
    const r = sugerirDesdeFichas([ficha(), ficha({ experiencia: "principiante", dias: 3, minutos: 45 })], ejercicios, ["spinning"]);
    expect(r).toMatchObject({ dias: 3, minutos: 45, intensidad: "estandar", tecnicasIntensidad: "automatico" });
    expect(r.alertas.some((a) => a.includes("disponibilidades distintas"))).toBe(true);
  });

  it("no decide el objetivo grupal cuando las fichas son incompatibles", () => {
    const r = sugerirDesdeFichas([ficha(), ficha({ objetivoPrincipal: "fuerza" })], ejercicios, ["spinning"]);
    expect(r.objetivo).toBeNull();
    expect(r.prioridad).toBeNull();
    expect(r.alertas.some((a) => a.includes("objetivos diferentes"))).toBe(true);
  });

  it("convierte coincidencias seguras de texto en preferidos y prohibidos", () => {
    const r = sugerirDesdeFichas([ficha({ preferidos: "Me gusta el curl martillo", noDeseados: "Nada de peso muerto" })], ejercicios, []);
    expect(r.preferidos).toEqual(["curl"]);
    expect(r.prohibidos).toEqual(["peso-muerto"]);
  });

  it("sugiere cardio por objetivo y lo calibra con el nivel declarado", () => {
    const r = sugerirDesdeFichas([ficha({ objetivoPrincipal: "perdida_grasa", cardioNivel: "bajo" })], ejercicios, ["spinning"]);
    expect(r.cardio).toBe("spinning");
    expect(r.cardioMinutos).toBe(10);
  });

  it("ante salud solo alerta y no inventa restricciones", () => {
    const r = sugerirDesdeFichas([ficha({ molestias: "rodilla derecha" })], ejercicios, []);
    expect(r.alertas.some((a) => a.includes("antecedentes"))).toBe(true);
  });

  it("precarga una referencia física común y deja la decisión final al entrenador", () => {
    const r = sugerirDesdeFichas([ficha({ categoriaReferencia: "wellness" })], ejercicios, []);
    expect(r.categoriaCompetencia).toBe("wellness");
    expect(r.razones.some((razon) => razon.includes("sujeta a la decisión"))).toBe(true);
  });

  it("no mezcla referencias físicas incompatibles en una rutina grupal", () => {
    const r = sugerirDesdeFichas([
      ficha({ categoriaReferencia: "wellness" }),
      ficha({ categoriaReferencia: "mens_physique" }),
    ], ejercicios, []);
    expect(r.categoriaCompetencia).toBeNull();
    expect(r.alertas.some((alerta) => alerta.includes("referencias físicas diferentes"))).toBe(true);
  });
});
