import { describe, expect, it } from "vitest";
import { serializarRutinaATexto } from "./serializar";

describe("serializarRutinaATexto", () => {
  it("firma los documentos generados con Alejandro Mendoza y el Método VIP", () => {
    const texto = serializarRutinaATexto({
      nombreRutina: "Rutina de prueba",
      metodoGeneracion: {
        nivel: "Intermedio",
        inspiracion: "Arnold split",
        organizacion: "Biseries agonista–antagonista",
        generadoAutomaticamente: true,
      },
      dias: [
        {
          numero: 1,
          nombre: "Pecho y espalda",
          tipo: "entrenamiento",
          descripcion: null,
          ejercicios: [
            {
              orden: 1,
              nombre: "Press de pecho",
              series: 4,
              reps: "8-12",
              descansoSegundos: 90,
              tecnicaTipo: null,
              tecnicaInstruccion: null,
              observacion: null,
              grupoMuscular: "pecho",
            },
          ],
        },
      ],
    });

    expect(texto).toContain("Alejandro Mendoza");
    expect(texto).toContain("Entrenador · Método VIP Fitness");
    expect(texto).toContain("Press de pecho");
    expect(texto).toContain("Nivel: Intermedio");
    expect(texto).toContain("Programa VIP: Arnold split");
    expect(texto).toContain("Organización: Biseries agonista–antagonista");
  });
});
