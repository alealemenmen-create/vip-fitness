import { describe, expect, it } from "vitest";
import { calcularRecomendacion, esTecnicaExcluida, objetivoAImpulso, resolverCumplimiento } from "./motor";
import type { CalcularRecomendacionInput, ConfigProgresion, SerieHistorial, SesionHistorial } from "./tipos";

const RANGO = { min: 8, max: 12 };

const CONFIG: ConfigProgresion = {
  aptoProgresion: true,
  tipoProgresion: "doble",
  incrementoKg: 2.5,
  requiereAutorizacion: false,
  rirObjetivo: null,
};

function serie(overrides: Partial<SerieHistorial> = {}): SerieHistorial {
  return {
    numeroSerie: 1,
    pesoKg: 20,
    esPesoCorporal: false,
    repsRealizadas: 10,
    realizada: true,
    ...overrides,
  };
}

let contadorSesion = 0;

function sesion(series: SerieHistorial[], overrides: Partial<SesionHistorial> = {}): SesionHistorial {
  return {
    sesionEjercicioId: `se-${++contadorSesion}`,
    fecha: "2026-08-01",
    series,
    dificultadPercibida: "justo",
    dolorReportado: false,
    ...overrides,
  };
}

function input(overrides: Partial<CalcularRecomendacionInput> = {}): CalcularRecomendacionInput {
  return {
    objetivo: "masa",
    rango: RANGO,
    seriesProgramadas: 3,
    config: CONFIG,
    historialUltimasSesiones: [],
    ...overrides,
  };
}

describe("objetivoAImpulso", () => {
  it("mapea los 4 valores reales del select del entrenador", () => {
    expect(objetivoAImpulso("Aumento de masa muscular")).toBe("masa");
    expect(objetivoAImpulso("Pérdida de grasa")).toBe("perdida_grasa");
    expect(objetivoAImpulso("Recomposición corporal")).toBe("perdida_grasa");
    expect(objetivoAImpulso("Mejorar condición física")).toBe("salud_general");
  });

  it("usa salud_general como default para texto no reconocido o vacío", () => {
    expect(objetivoAImpulso(null)).toBe("salud_general");
    expect(objetivoAImpulso("")).toBe("salud_general");
    expect(objetivoAImpulso("algo raro")).toBe("salud_general");
  });
});

describe("esTecnicaExcluida", () => {
  it("excluye técnicas encadenadas e intra-serie", () => {
    expect(esTecnicaExcluida("Superserie (1/2)")).toBe(true);
    expect(esTecnicaExcluida("Biserie (2/2)")).toBe(true);
    expect(esTecnicaExcluida("Circuito metabólico (1/3)")).toBe(true);
    expect(esTecnicaExcluida("Dropset")).toBe(true);
    expect(esTecnicaExcluida("Rest-pause")).toBe(true);
    expect(esTecnicaExcluida("Myo-reps")).toBe(true);
  });

  it("no excluye ejercicios sin técnica encadenada", () => {
    expect(esTecnicaExcluida(null)).toBe(false);
    expect(esTecnicaExcluida("")).toBe(false);
    expect(esTecnicaExcluida("Tempo 3-1-1")).toBe(false);
  });
});

describe("calcularRecomendacion — sin historial", () => {
  it("Regla A: propone el rango del entrenador sin peso sugerido", () => {
    const r = calcularRecomendacion(input({ historialUltimasSesiones: [] }));
    expect(r.regla).toBe("A_subir_reps");
    expect(r.pesoSugeridoKg).toBeNull();
    expect(r.repsObjetivoMin).toBe(8);
    expect(r.repsObjetivoMax).toBe(12);
  });
});

describe("calcularRecomendacion — Regla A (subir reps)", () => {
  it("mantiene el peso y pide hasta 2 repeticiones más si no llegó al máximo (2+ sesiones de historial)", () => {
    const ultima = sesion([serie({ repsRealizadas: 10 }), serie({ repsRealizadas: 9 }), serie({ repsRealizadas: 9 })]);
    const anterior = sesion([serie({ repsRealizadas: 9 }), serie({ repsRealizadas: 9 }), serie({ repsRealizadas: 8 })]);
    const r = calcularRecomendacion(input({ historialUltimasSesiones: [ultima, anterior] }));
    expect(r.regla).toBe("A_subir_reps");
    expect(r.pesoSugeridoKg).toBe(20);
    expect(r.repsObjetivoMax).toBe(12);
    expect(r.metaTotalReps).toBe(30); // 10+9+9=28, +2 (tope con 2+ sesiones) = 30
  });
});

describe("calcularRecomendacion — Regla B (subir peso)", () => {
  it("sube al siguiente incremento cuando completó el máximo en todas las series", () => {
    const ultima = sesion([serie({ repsRealizadas: 12 }), serie({ repsRealizadas: 12 }), serie({ repsRealizadas: 12 })]);
    const r = calcularRecomendacion(input({ historialUltimasSesiones: [ultima] }));
    expect(r.regla).toBe("B_subir_peso");
    expect(r.pesoSugeridoKg).toBe(22.5);
  });

  it("cae a Regla C (no B) si el esfuerzo fue muy alto aunque haya completado el máximo", () => {
    const ultima = sesion(
      [serie({ repsRealizadas: 12 }), serie({ repsRealizadas: 12 }), serie({ repsRealizadas: 12 })],
      { dificultadPercibida: "fallo" }
    );
    const r = calcularRecomendacion(input({ historialUltimasSesiones: [ultima] }));
    expect(r.regla).toBe("C_mantener");
  });

  it("respeta el incrementoKg configurado por el entrenador", () => {
    const ultima = sesion([serie({ pesoKg: 40, repsRealizadas: 12 }), serie({ pesoKg: 40, repsRealizadas: 12 })]);
    const r = calcularRecomendacion(
      input({ historialUltimasSesiones: [ultima], config: { ...CONFIG, incrementoKg: 5 } })
    );
    expect(r.regla).toBe("B_subir_peso");
    expect(r.pesoSugeridoKg).toBe(45);
  });
});

describe("calcularRecomendacion — Regla C (mantener, resultado de respaldo)", () => {
  it("en pérdida de grasa, Regla A sigue aplicando dentro del rango (el objetivo ajusta agresividad, no sustituye el árbol)", () => {
    const series: SerieHistorial[] = [serie({ repsRealizadas: 9 }), serie({ repsRealizadas: 8 })];
    const historial = [sesion(series), sesion(series)];
    const r = calcularRecomendacion(input({ objetivo: "perdida_grasa", historialUltimasSesiones: historial }));
    expect(r.regla).toBe("A_subir_reps");
    expect(r.pesoSugeridoKg).toBe(20);
  });

  it("un fallo aislado por debajo del mínimo (sin ser 2 consecutivos) cae en C, no en A", () => {
    const falla = sesion([serie({ repsRealizadas: 6 }), serie({ repsRealizadas: 10 })]);
    const buena = sesion([serie({ repsRealizadas: 11 }), serie({ repsRealizadas: 11 })]);
    const r = calcularRecomendacion(input({ historialUltimasSesiones: [falla, buena] }));
    expect(r.regla).toBe("C_mantener");
  });

  it("ejercicios de peso corporal que completan el máximo van a C, no a B", () => {
    const ultima = sesion([
      serie({ esPesoCorporal: true, pesoKg: null, repsRealizadas: 12 }),
      serie({ esPesoCorporal: true, pesoKg: null, repsRealizadas: 12 }),
    ]);
    const r = calcularRecomendacion(input({ historialUltimasSesiones: [ultima] }));
    expect(r.regla).toBe("C_mantener");
    expect(r.pesoSugeridoKg).toBeNull();
  });
});

describe("calcularRecomendacion — Regla D (reducir)", () => {
  it("reduce ~7.5% tras 2 fallos consecutivos del mínimo (objetivo masa)", () => {
    const falla = sesion([serie({ repsRealizadas: 6 }), serie({ repsRealizadas: 5 })]);
    const r = calcularRecomendacion(input({ historialUltimasSesiones: [falla, falla] }));
    expect(r.regla).toBe("D_reducir");
    expect(r.pesoSugeridoKg).toBeLessThan(20);
    expect(r.pesoSugeridoKg).toBeGreaterThan(17);
  });

  it("en pérdida de grasa necesita 3 fallos consecutivos, no 2", () => {
    const falla = sesion([serie({ repsRealizadas: 6 }), serie({ repsRealizadas: 5 })]);
    const r = calcularRecomendacion(input({ objetivo: "perdida_grasa", historialUltimasSesiones: [falla, falla] }));
    expect(r.regla).not.toBe("D_reducir");
  });
});

describe("calcularRecomendacion — Regla E (consultar al entrenador)", () => {
  it("dispara si se reportó dolor en la última sesión, sin precargar peso ni reps", () => {
    const conDolor = sesion([serie()], { dolorReportado: true });
    const r = calcularRecomendacion(input({ historialUltimasSesiones: [conDolor] }));
    expect(r.regla).toBe("E_consultar");
    expect(r.pesoSugeridoKg).toBeNull();
    expect(r.repsObjetivoMin).toBeNull();
    expect(r.repsObjetivoMax).toBeNull();
  });

  it("dispara tras 3 sesiones sin ningún progreso", () => {
    const estancada = sesion([serie({ repsRealizadas: 9 }), serie({ repsRealizadas: 9 })]);
    const r = calcularRecomendacion(input({ historialUltimasSesiones: [estancada, estancada, estancada] }));
    expect(r.regla).toBe("E_consultar");
  });

  it("dispara si el rendimiento cae bruscamente respecto a la sesión anterior", () => {
    const buena = sesion([serie({ repsRealizadas: 12 }), serie({ repsRealizadas: 12 })]);
    const mala = sesion([serie({ repsRealizadas: 3 }), serie({ repsRealizadas: 3 })]);
    const r = calcularRecomendacion(input({ historialUltimasSesiones: [mala, buena] }));
    expect(r.regla).toBe("E_consultar");
  });

  it("dolor tiene prioridad incluso si además completó el máximo", () => {
    const ultima = sesion([serie({ repsRealizadas: 12 }), serie({ repsRealizadas: 12 })], { dolorReportado: true });
    const r = calcularRecomendacion(input({ historialUltimasSesiones: [ultima] }));
    expect(r.regla).toBe("E_consultar");
  });
});

describe("calcularRecomendacion — una sola sesión de historial (Fase 1, cauteloso)", () => {
  it("Regla A se limita a +1 repetición total, no +2", () => {
    const ultima = sesion([serie({ repsRealizadas: 10 }), serie({ repsRealizadas: 9 }), serie({ repsRealizadas: 9 })]);
    const r = calcularRecomendacion(input({ historialUltimasSesiones: [ultima] }));
    expect(r.regla).toBe("A_subir_reps");
    expect(r.metaTotalReps).toBe(29); // 10+9+9=28, +1
  });

  it("no sugiere subir peso si completó el máximo pero no hay dificultad registrada", () => {
    const ultima = sesion([serie({ repsRealizadas: 12 }), serie({ repsRealizadas: 12 })], {
      dificultadPercibida: null,
    });
    const r = calcularRecomendacion(input({ historialUltimasSesiones: [ultima] }));
    expect(r.regla).toBe("C_mantener");
    expect(r.pesoSugeridoKg).toBe(20);
  });

  it("sí sugiere subir peso con una sola sesión si la dificultad fue 'facil'", () => {
    const ultima = sesion([serie({ repsRealizadas: 12 }), serie({ repsRealizadas: 12 })], {
      dificultadPercibida: "facil",
    });
    const r = calcularRecomendacion(input({ historialUltimasSesiones: [ultima] }));
    expect(r.regla).toBe("B_subir_peso");
  });

  it("no sube peso con una sola sesión si la dificultad fue 'dificil'", () => {
    const ultima = sesion([serie({ repsRealizadas: 12 }), serie({ repsRealizadas: 12 })], {
      dificultadPercibida: "dificil",
    });
    const r = calcularRecomendacion(input({ historialUltimasSesiones: [ultima] }));
    expect(r.regla).toBe("C_mantener");
  });

  it("una serie por debajo del mínimo con una sola sesión va a C, nunca a D", () => {
    const ultima = sesion([serie({ repsRealizadas: 5 }), serie({ repsRealizadas: 10 })]);
    const r = calcularRecomendacion(input({ historialUltimasSesiones: [ultima] }));
    expect(r.regla).toBe("C_mantener");
  });

  it("nunca reduce automáticamente con una sola sesión (Regla D necesita 2+)", () => {
    const falla = sesion([serie({ repsRealizadas: 4 }), serie({ repsRealizadas: 3 })]);
    const r = calcularRecomendacion(input({ historialUltimasSesiones: [falla] }));
    expect(r.regla).not.toBe("D_reducir");
  });
});

describe("calcularRecomendacion — solo_reps configurado explícitamente", () => {
  it("al llegar al máximo va a C, nunca a B, aunque no sea peso corporal", () => {
    const ultima = sesion([serie({ repsRealizadas: 12 }), serie({ repsRealizadas: 12 })]);
    const r = calcularRecomendacion(
      input({ historialUltimasSesiones: [ultima], config: { ...CONFIG, tipoProgresion: "solo_reps" } })
    );
    expect(r.regla).toBe("C_mantener");
    expect(r.pesoSugeridoKg).toBe(20); // informativo, pero no se propone subirlo
  });
});

describe("calcularRecomendacion — determinismo", () => {
  // Esto prueba que el motor es determinista (mismo historial → misma
  // decisión), no que la recomendación quede "congelada" una vez guardada.
  // Esa propiedad es de la capa de persistencia (generarYGuardarRecomendacion
  // en data.ts: primera vez inserta, siguientes veces devuelve la fila ya
  // existente sin recalcular) y se prueba ahí, no acá.
  it("la misma entrada produce siempre la misma salida, sin efectos de lado", () => {
    const ultima = sesion([serie({ repsRealizadas: 11 }), serie({ repsRealizadas: 10 })]);
    const a = calcularRecomendacion(input({ historialUltimasSesiones: [ultima] }));
    const b = calcularRecomendacion(input({ historialUltimasSesiones: [ultima] }));
    expect(a).toEqual(b);
  });
});

describe("calcularRecomendacion — tipo manual", () => {
  it("tipo 'manual' siempre mantiene, sin importar el desempeño", () => {
    const ultima = sesion([serie({ repsRealizadas: 12 }), serie({ repsRealizadas: 12 })]);
    const r = calcularRecomendacion(
      input({ historialUltimasSesiones: [ultima], config: { ...CONFIG, tipoProgresion: "manual" } })
    );
    expect(r.regla).toBe("C_mantener");
  });
});

describe("resolverCumplimiento", () => {
  it("Regla E nunca se evalúa (no otorga puntos)", () => {
    const r = resolverCumplimiento(
      { regla: "E_consultar", pesoSugeridoKg: null, repsObjetivoMin: null, repsObjetivoMax: null, metaTotalReps: null },
      [serie()],
      20
    );
    expect(r).toBeNull();
  });

  it("Regla A: cumplida si alcanzó exactamente la meta total sin salir del rango", () => {
    const r = resolverCumplimiento(
      { regla: "A_subir_reps", pesoSugeridoKg: 20, repsObjetivoMin: 8, repsObjetivoMax: 12, metaTotalReps: 30 },
      [serie({ repsRealizadas: 10 }), serie({ repsRealizadas: 10 }), serie({ repsRealizadas: 10 })],
      28
    );
    expect(r).toBe("cumplida");
  });

  it("Regla A: superada si excede la meta total sin salir del rango", () => {
    const r = resolverCumplimiento(
      { regla: "A_subir_reps", pesoSugeridoKg: 20, repsObjetivoMin: 8, repsObjetivoMax: 12, metaTotalReps: 30 },
      [serie({ repsRealizadas: 11 }), serie({ repsRealizadas: 11 }), serie({ repsRealizadas: 10 })],
      28
    );
    expect(r).toBe("superada");
  });

  it("Regla A: no_cumplida si quedó igual o peor que la sesión anterior", () => {
    const r = resolverCumplimiento(
      { regla: "A_subir_reps", pesoSugeridoKg: 20, repsObjetivoMin: 8, repsObjetivoMax: 12, metaTotalReps: 30 },
      [serie({ repsRealizadas: 9 }), serie({ repsRealizadas: 9 })],
      28
    );
    expect(r).toBe("no_cumplida");
  });

  it("Regla B: no_cumplida si no usó el peso sugerido", () => {
    const r = resolverCumplimiento(
      { regla: "B_subir_peso", pesoSugeridoKg: 22.5, repsObjetivoMin: 8, repsObjetivoMax: 12, metaTotalReps: null },
      [serie({ pesoKg: 20, repsRealizadas: 10 })],
      null
    );
    expect(r).toBe("no_cumplida");
  });

  it("Regla B: parcial si usó el peso sugerido pero alguna serie quedó bajo el mínimo", () => {
    const r = resolverCumplimiento(
      { regla: "B_subir_peso", pesoSugeridoKg: 22.5, repsObjetivoMin: 8, repsObjetivoMax: 12, metaTotalReps: null },
      [serie({ pesoKg: 22.5, repsRealizadas: 9 }), serie({ pesoKg: 22.5, repsRealizadas: 6 })],
      null
    );
    expect(r).toBe("parcial");
  });

  it("Regla B: cumplida si usó el peso sugerido y llegó al mínimo en todas", () => {
    const r = resolverCumplimiento(
      { regla: "B_subir_peso", pesoSugeridoKg: 22.5, repsObjetivoMin: 8, repsObjetivoMax: 12, metaTotalReps: null },
      [serie({ pesoKg: 22.5, repsRealizadas: 8 }), serie({ pesoKg: 22.5, repsRealizadas: 8 })],
      null
    );
    expect(r).toBe("cumplida");
  });
});
