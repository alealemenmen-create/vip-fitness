import { describe, expect, it } from "vitest";
import { validarSemanaVip } from "./validador-semanal";
import type { BriefGenerador, PerfilEntrenamiento, RutinaGenerada } from "./tipos";

const perfil = { experiencia: "intermedio" } as PerfilEntrenamiento;
const brief = { distribucion: "vip_balanceada", dias: 5 } as BriefGenerador;
const ejercicio = (nombre: string, grupoMuscular: "pecho" | "espalda" | "piernas" | "hombros" | "brazos", series = 3) => ({
  orden: 1, ejercicioId: nombre, nombre, series, reps: "8-12", descansoSegundos: 60,
  tecnicaTipo: null, tecnicaInstruccion: null, observacion: null, grupoMuscular,
});
const rutina = (dias: RutinaGenerada["dias"]): RutinaGenerada => ({ nombreRutina: "VIP", dias, reglasAplicadas: [], alertas: [] });

describe("validarSemanaVip", () => {
  it("detecta grupos grandes ausentes en una estructura automática", () => {
    const r = validarSemanaVip(rutina([{ numero: 1, nombre: "Pecho", tipo: "entrenamiento", descripcion: null, ejercicios: [ejercicio("Press banca", "pecho", 8)] }]), brief, perfil);
    expect(r.alertas.some((a) => a.includes("espalda no tiene"))).toBe(true);
    expect(r.alertas.some((a) => a.includes("piernas no tiene"))).toBe(true);
  });

  it("detecta una semana de brazos sin suficiente tríceps", () => {
    const brazos = [ejercicio("Curl barra", "brazos"), ejercicio("Curl martillo", "brazos"), ejercicio("Curl predicador", "brazos"), ejercicio("Extensión de tríceps", "brazos")];
    const r = validarSemanaVip(rutina([{ numero: 1, nombre: "Brazos", tipo: "entrenamiento", descripcion: null, ejercicios: brazos }]), { ...brief, distribucion: "personalizada", dias: 1 }, perfil);
    expect(r.alertas.some((a) => a.includes("3 ejercicios de bíceps y 1 de tríceps"))).toBe(true);
  });

  it("advierte volumen directo extremo", () => {
    const r = validarSemanaVip(rutina([{ numero: 1, nombre: "Pecho", tipo: "entrenamiento", descripcion: null, ejercicios: [ejercicio("Press banca", "pecho", 31)] }]), { ...brief, distribucion: "personalizada", dias: 1 }, perfil);
    expect(r.alertas.some((a) => a.includes("31 series directas"))).toBe(true);
  });
});
