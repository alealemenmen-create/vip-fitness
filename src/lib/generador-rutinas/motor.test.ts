import { describe, expect, it } from "vitest";
import { generarRutinaPorReglas } from "./motor";
import type { BriefGenerador, EjercicioGenerador, PerfilEntrenamiento } from "./tipos";

const perfil: PerfilEntrenamiento = { alumnoId: "a", objetivoPrincipal: "hipertrofia", objetivoSecundario: null, diasDisponibles: 3, minutosSesion: 60, experiencia: "intermedio", cardioNivel: "medio", preferenciaEquipo: "indistinto", molestias: null, lesionesDiagnosticadas: null, condicionesMedicas: null, medicamentosRelevantes: null, requiereRevision: false };
const brief: BriefGenerador = { alumnoId: "a", objetivo: "hipertrofia", prioridad: "hipertrofia", dias: 3, minutosSesion: 60, distribucion: "automatica", ejerciciosPorSesion: 2, cardio: "moderado", cardioMinutos: 10, abdominales: false, soloMaquinas: false, evitarSaltos: true, obligatorios: [], prohibidos: [], preferidos: [], tecnicaNombre: null, observaciones: "" };
const base = (id: string, grupoMuscular: EjercicioGenerador["grupoMuscular"], categoria: EjercicioGenerador["categoria"], extra = {}): EjercicioGenerador => ({ id, nombre: id, grupoMuscular, categoria, equipo: "maquina", nivel: "principiante", posicionSesion: "principal", ...extra });
const biblioteca = [base("pecho", "pecho", "empuje"), base("espalda", "espalda", "traccion"), base("pierna", "piernas", "pierna"), base("salto", "cardio", "cardio", { requiereSalto: true }), base("bici", "cardio", "cardio")];

describe("generarRutinaPorReglas", () => {
  it("usa IDs reales, respeta prohibidos y deja cardio al final", () => {
    const r = generarRutinaPorReglas(perfil, { ...brief, prohibidos: ["espalda"] }, biblioteca);
    expect(r.dias).toHaveLength(3);
    expect(r.dias.flatMap((d) => d.ejercicios).some((e) => e.ejercicioId === "espalda")).toBe(false);
    expect(r.dias.every((d) => d.ejercicios.at(-1)?.grupoMuscular === "cardio")).toBe(true);
  });
  it("bloquea saltos cuando se solicita", () => {
    const r = generarRutinaPorReglas(perfil, brief, biblioteca);
    expect(r.dias.flatMap((d) => d.ejercicios).some((e) => e.ejercicioId === "salto")).toBe(false);
  });
});

