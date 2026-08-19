import { describe, expect, it } from "vitest";
import {
  detectarTipoEquipoAlejandro,
  evaluarProgresionAutomaticaAlejandro,
  evaluarSiguienteSerieAlejandro,
  type EvaluarAlejandroInput,
} from "./alejandro";

const BASE: EvaluarAlejandroInput = {
  nombreEjercicio: "Sentadilla Smith",
  equipo: "Máquina Smith",
  unidad: "kg",
  objetivo: "masa",
  rango: { min: 8, max: 12 },
  pesoBase: 40,
  repsRealizadas: 12,
  repsObjetivoActual: 12,
  respuesta: "mas",
  tecnicaLimpia: true,
  serieCompletada: true,
  rachaPositivaPrevia: 0,
  sesionesExitosasConsecutivas: 0,
  caidaRendimiento: false,
};

function input(cambios: Partial<EvaluarAlejandroInput> = {}): EvaluarAlejandroInput {
  return { ...BASE, ...cambios };
}

describe("detectarTipoEquipoAlejandro", () => {
  it("distingue mancuernas, barra, máquina y peso corporal", () => {
    expect(detectarTipoEquipoAlejandro("Press DB", "Mancuernas")).toBe("mancuernas");
    expect(detectarTipoEquipoAlejandro("Peso muerto", "Barra olímpica")).toBe("barra");
    expect(detectarTipoEquipoAlejandro("Prensa inclinada", "Prensa 45°")).toBe("maquina");
    expect(detectarTipoEquipoAlejandro("Flexiones", "Peso corporal")).toBe("peso_corporal");
  });
});

describe("evaluarProgresionAutomaticaAlejandro — entrenador activo", () => {
  it("exige una repetición más sin esperar una respuesta", () => {
    const decision = evaluarProgresionAutomaticaAlejandro(input({
      repsRealizadas: 9,
      respuesta: null,
    }));
    expect(decision.respuestaInferida).toBe("mas");
    expect(decision.accion).toBe("subir_reps");
    expect(decision.repsObjetivo).toBe(10);
    expect(decision.motivos[0]).toBe("progresion_automatica");
  });

  it("sube automáticamente el escalón base al completar el techo", () => {
    const decision = evaluarProgresionAutomaticaAlejandro(input({ respuesta: null }));
    expect(decision.respuestaInferida).toBe("mas");
    expect(decision.accion).toBe("subir_carga");
    expect(decision.incrementoAplicado).toBe(5);
    expect(decision.repsObjetivo).toBe(8);
  });

  it("acelera solo cuando hay sobrecumplimiento y confianza", () => {
    const decision = evaluarProgresionAutomaticaAlejandro(input({
      repsRealizadas: 15,
      rachaPositivaPrevia: 2,
      respuesta: null,
    }));
    expect(decision.respuestaInferida).toBe("muy_facil");
    expect(decision.confianza).toBe("alta");
    expect(decision.incrementoAplicado).toBe(15);
  });

  it("corrige automáticamente si la serie queda debajo del mínimo", () => {
    const decision = evaluarProgresionAutomaticaAlejandro(input({
      repsRealizadas: 6,
      respuesta: null,
    }));
    expect(decision.respuestaInferida).toBe("dificil");
    expect(decision.accion).toBe("reducir");
    expect(decision.pesoObjetivo).toBe(35);
  });
});

describe("evaluarSiguienteSerieAlejandro — seguridad", () => {
  it("la preparación automática conserva la carga", () => {
    const decision = evaluarSiguienteSerieAlejandro(input({ respuesta: null }));
    expect(decision.accion).toBe("preparar");
    expect(decision.pesoObjetivo).toBe(40);
    expect(decision.incrementoAplicado).toBe(0);
  });

  it("una molestia detiene y bloquea la progresión", () => {
    const decision = evaluarSiguienteSerieAlejandro(input({ respuesta: "molestia" }));
    expect(decision.accion).toBe("detener_consultar");
    expect(decision.bloqueaProgresion).toBe(true);
    expect(decision.motivos).toContain("dolor_reportado");
  });

  it("una técnica inestable reduce un nivel aunque la sensación fuera fácil", () => {
    const decision = evaluarSiguienteSerieAlejandro(input({ respuesta: "muy_facil", tecnicaLimpia: false }));
    expect(decision.accion).toBe("reducir");
    expect(decision.pesoObjetivo).toBe(35);
  });

  it("permite reportar directamente que se perdió la técnica", () => {
    const decision = evaluarSiguienteSerieAlejandro(input({ respuesta: "tecnica" }));
    expect(decision.accion).toBe("reducir");
    expect(decision.bloqueaProgresion).toBe(true);
    expect(decision.motivos).toContain("tecnica_inestable");
  });

  it("una caída de rendimiento impide seguir aumentando", () => {
    const decision = evaluarSiguienteSerieAlejandro(input({ respuesta: "mas", caidaRendimiento: true }));
    expect(decision.accion).toBe("mantener");
    expect(decision.pesoObjetivo).toBe(40);
    expect(decision.motivos).toContain("fatiga_acumulada");
  });
});

describe("evaluarSiguienteSerieAlejandro — doble progresión", () => {
  it("sube repeticiones antes que peso cuando aún no llegó al techo del rango", () => {
    const decision = evaluarSiguienteSerieAlejandro(input({ repsRealizadas: 9, respuesta: "facil" }));
    expect(decision.accion).toBe("subir_reps");
    expect(decision.repsObjetivo).toBe(11);
    expect(decision.pesoObjetivo).toBe(40);
  });

  it("no sube peso si quedó debajo del mínimo aunque el alumno diga que podía más", () => {
    const decision = evaluarSiguienteSerieAlejandro(input({ repsRealizadas: 7, respuesta: "mas" }));
    expect(decision.accion).toBe("mantener");
    expect(decision.repsObjetivo).toBe(8);
    expect(decision.incrementoAplicado).toBe(0);
  });
});

describe("evaluarSiguienteSerieAlejandro — carga y confianza", () => {
  it("con una primera señal una máquina sube solo el escalón base", () => {
    const decision = evaluarSiguienteSerieAlejandro(input({ respuesta: "muy_facil" }));
    expect(decision.confianza).toBe("aprendiendo");
    expect(decision.pesoObjetivo).toBe(45);
    expect(decision.incrementoAplicado).toBe(5);
  });

  it("con evidencia media una máquina permite diez kilos", () => {
    const decision = evaluarSiguienteSerieAlejandro(input({ respuesta: "facil", rachaPositivaPrevia: 1 }));
    expect(decision.confianza).toBe("media");
    expect(decision.pesoObjetivo).toBe(50);
  });

  it("con evidencia alta y respuesta muy fácil una máquina permite quince kilos", () => {
    const decision = evaluarSiguienteSerieAlejandro(input({
      respuesta: "muy_facil",
      rachaPositivaPrevia: 2,
      sesionesExitosasConsecutivas: 1,
    }));
    expect(decision.confianza).toBe("alta");
    expect(decision.pesoObjetivo).toBe(55);
  });

  it("alcanza confianza alta tras tres señales positivas consecutivas", () => {
    const decision = evaluarSiguienteSerieAlejandro(input({
      respuesta: "muy_facil",
      rachaPositivaPrevia: 2,
    }));
    expect(decision.confianza).toBe("alta");
    expect(decision.incrementoAplicado).toBe(15);
  });

  it("una barra no supera diez kilos incluso con confianza alta", () => {
    const decision = evaluarSiguienteSerieAlejandro(input({
      nombreEjercicio: "Peso muerto rumano",
      equipo: "Barra",
      respuesta: "muy_facil",
      rachaPositivaPrevia: 3,
    }));
    expect(decision.tipoEquipo).toBe("barra");
    expect(decision.incrementoAplicado).toBe(10);
  });

  it("las mancuernas nunca superan un salto de 2,5 kilos", () => {
    const decision = evaluarSiguienteSerieAlejandro(input({
      nombreEjercicio: "Press de hombros con mancuernas",
      equipo: "Mancuernas",
      respuesta: "muy_facil",
      rachaPositivaPrevia: 5,
      sesionesExitosasConsecutivas: 3,
    }));
    expect(decision.tipoEquipo).toBe("mancuernas");
    expect(decision.incrementoAplicado).toBe(2.5);
  });

  it("un objetivo de salud mantiene el salto base aun con mucha confianza", () => {
    const decision = evaluarSiguienteSerieAlejandro(input({
      objetivo: "salud_general",
      respuesta: "muy_facil",
      rachaPositivaPrevia: 5,
      sesionesExitosasConsecutivas: 3,
    }));
    expect(decision.incrementoAplicado).toBe(5);
    expect(decision.motivos).toContain("objetivo_conservador");
  });
});
