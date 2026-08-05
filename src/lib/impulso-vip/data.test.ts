import { describe, expect, it } from "vitest";
import { ERROR_ALERTA_SIN_SESION, esSerieUtilizable, filaAlertaDesdeRow, filaRecomendacionDesdeRow } from "./data";
import type { FilaRecomendacionDB } from "./data";

function filaRecomendacionDBEjemplo(overrides: Partial<FilaRecomendacionDB> = {}): FilaRecomendacionDB {
  return {
    id: "rec-1",
    sesion_ejercicio_id: "se-1",
    dia_ejercicio_id: "de-1",
    alumno_id: "alumno-1",
    regla: "A_subir_reps",
    peso_sugerido_kg: 20,
    reps_objetivo_min: 8,
    reps_objetivo_max: 12,
    es_peso_corporal: false,
    justificacion: "Mantené el peso e intentá sumar una repetición.",
    estado: "aprobada",
    cumplimiento: null,
    decision_data: { objetivo: "masa", motivos: ["dentro_del_rango"], alertaTipo: null },
    ...overrides,
  };
}

describe("filaRecomendacionDesdeRow", () => {
  it("mapea todos los campos snake_case a camelCase", () => {
    const fila = filaRecomendacionDesdeRow(filaRecomendacionDBEjemplo());
    expect(fila).toEqual({
      id: "rec-1",
      sesionEjercicioId: "se-1",
      diaEjercicioId: "de-1",
      alumnoId: "alumno-1",
      regla: "A_subir_reps",
      pesoSugeridoKg: 20,
      repsObjetivoMin: 8,
      repsObjetivoMax: 12,
      esPesoCorporal: false,
      justificacion: "Mantené el peso e intentá sumar una repetición.",
      estado: "aprobada",
      cumplimiento: null,
      decisionData: { objetivo: "masa", motivos: ["dentro_del_rango"], alertaTipo: null },
    });
  });

  it("conserva decisionData tal cual viene, sin validarlo ni transformarlo (queda unknown para quien lo lea)", () => {
    // JSON "viejo" o incompleto, de una hipotética versión anterior del
    // motor: el mapper no debe fallar ni intentar completar nada acá — la
    // validación real vive en `leerAlertaTipo` (congelar.ts), no acá.
    const decisionDataVieja = { formaAntigua: true };
    const fila = filaRecomendacionDesdeRow(filaRecomendacionDBEjemplo({ decision_data: decisionDataVieja }));
    expect(fila.decisionData).toBe(decisionDataVieja);
  });

  it("una recomendación E con decision_data inválido no falla en el mapper — fallará después, en leerAlertaTipo", () => {
    const fila = filaRecomendacionDesdeRow(
      filaRecomendacionDBEjemplo({ regla: "E_consultar", decision_data: { sinAlertaTipo: true } })
    );
    // El mapper genérico no valida nada específico de Regla E.
    expect(fila.regla).toBe("E_consultar");
    expect(fila.decisionData).toEqual({ sinAlertaTipo: true });
  });
});

describe("filaAlertaDesdeRow", () => {
  it("mapea una fila con sesion_ejercicio_id válido", () => {
    const fila = filaAlertaDesdeRow({ id: "alerta-1", sesion_ejercicio_id: "se-1", tipo: "dolor", estado: "pendiente" });
    expect(fila).toEqual({ id: "alerta-1", sesionEjercicioId: "se-1", tipo: "dolor", estado: "pendiente" });
  });

  it("lanza ERROR_ALERTA_SIN_SESION exactamente si sesion_ejercicio_id es null, sin usar '!' ni devolver una fila incompleta", () => {
    expect(() =>
      filaAlertaDesdeRow({ id: "alerta-1", sesion_ejercicio_id: null, tipo: "dolor", estado: "pendiente" })
    ).toThrow(ERROR_ALERTA_SIN_SESION);
  });
});

describe("esSerieUtilizable", () => {
  const base = { sesion_ejercicio_id: "se-1", numero_serie: 1, peso_kg: 20, es_peso_corporal: false, reps_realizadas: 10, realizada: true };

  it("una serie completa con datos válidos es utilizable", () => {
    expect(esSerieUtilizable(base)).toBe(true);
  });

  it("no utilizable si no está marcada como realizada", () => {
    expect(esSerieUtilizable({ ...base, realizada: false })).toBe(false);
  });

  it("no utilizable sin repeticiones (serie marcada realizada pero sin cargar número)", () => {
    expect(esSerieUtilizable({ ...base, reps_realizadas: null })).toBe(false);
    expect(esSerieUtilizable({ ...base, reps_realizadas: 0 })).toBe(false);
  });

  it("no utilizable con peso negativo", () => {
    expect(esSerieUtilizable({ ...base, peso_kg: -5 })).toBe(false);
  });

  it("utilizable con peso null (peso corporal)", () => {
    expect(esSerieUtilizable({ ...base, peso_kg: null, es_peso_corporal: true })).toBe(true);
  });

  it("no utilizable con numero_serie inválido", () => {
    expect(esSerieUtilizable({ ...base, numero_serie: 0 })).toBe(false);
  });
});
