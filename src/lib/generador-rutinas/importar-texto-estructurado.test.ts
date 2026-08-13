import { describe, expect, it } from "vitest";
import { importarRutinaEstructurada } from "./importar-texto-estructurado";

describe("importarRutinaEstructurada", () => {
  it("convierte el formato fijo sin IA, incluyendo descansos y técnicas", () => {
    const rutina = importarRutinaEstructurada(`RUTINA: Hipertrofia A
DIA 1: Pecho y tríceps
1. Press de banca | 4 | 8-10 | 120
Extensión de tríceps en polea | 3 | 12 | 60 | Drop set | ultima | Reduce el peso 25% | Sin balanceo
DESCANSO: Movilidad
DIA 2: Piernas
Sentadilla | 4 | 6-8 | 150`);

    expect(rutina?.nombreRutina).toBe("Hipertrofia A");
    expect(rutina?.dias).toHaveLength(3);
    expect(rutina?.dias[0].ejercicios[0]).toMatchObject({ nombre: "Press de banca", series: 4, reps: "8-10", descansoSegundos: 120, grupoMuscular: "pecho" });
    expect(rutina?.dias[0].ejercicios[1]).toMatchObject({ tecnicaTipo: "Drop set", tecnicaSeries: [3], tecnicaInstruccion: "Reduce el peso 25%", observacion: "Sin balanceo", grupoMuscular: "brazos" });
    expect(rutina?.dias[1].tipo).toBe("descanso");
  });

  it("deja el texto libre para el respaldo con IA", () => {
    expect(importarRutinaEstructurada("Lunes hago pecho con press banca 4x10")).toBeNull();
  });
});
