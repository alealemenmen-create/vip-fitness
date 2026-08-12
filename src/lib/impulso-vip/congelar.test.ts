import { describe, expect, it, vi } from "vitest";
import {
  ERROR_ALERTA_TIPO_INVALIDO,
  ERROR_CONFLICTO_ALERTA,
  ERROR_CONFLICTO_RECOMENDACION,
  asegurarAlertaImpulso,
  construirPayloadAlertaDesdeFila,
  construirPayloadRecomendacion,
  crearReparadorDeAlertas,
  insertarORecuperarRecomendacion,
  leerAlertaTipo,
  leerDatosCumplimiento,
} from "./congelar";
import type {
  DecisionData,
  FilaAlerta,
  FilaRecomendacion,
  PayloadAlerta,
  PayloadRecomendacion,
  RepositorioAlertas,
  RepositorioRecomendaciones,
} from "./congelar";
import type { ConfigProgresion, Recomendacion, SesionHistorial } from "./tipos";

// ---------------------------------------------------------------------
// Helpers de repositorios falsos en memoria
// ---------------------------------------------------------------------

function crearRepoRecomendacionesFalso() {
  const filas = new Map<string, FilaRecomendacion>();
  let contador = 0;

  const repo: RepositorioRecomendaciones = {
    async buscar(sesionEjercicioId) {
      return filas.get(sesionEjercicioId) ?? null;
    },
    async insertar(payload) {
      if (filas.has(payload.sesion_ejercicio_id)) return { tipo: "conflicto" };
      contador += 1;
      const fila = payloadAFila(payload, `rec-${contador}`);
      filas.set(payload.sesion_ejercicio_id, fila);
      return { tipo: "insertada", fila };
    },
  };

  return { repo, filas };
}

function payloadAFila(payload: PayloadRecomendacion, id: string): FilaRecomendacion {
  return {
    id,
    sesionEjercicioId: payload.sesion_ejercicio_id,
    diaEjercicioId: payload.dia_ejercicio_id,
    alumnoId: payload.alumno_id,
    regla: payload.regla,
    pesoSugeridoKg: payload.peso_sugerido_kg,
    repsObjetivoMin: payload.reps_objetivo_min,
    repsObjetivoMax: payload.reps_objetivo_max,
    esPesoCorporal: payload.es_peso_corporal,
    justificacion: payload.justificacion,
    estado: payload.estado,
    cumplimiento: null,
    decisionData: payload.decision_data,
  };
}

function crearRepoAlertasFalso(inicial: FilaAlerta[] = []) {
  const filas: FilaAlerta[] = [...inicial];
  let contador = inicial.length;

  const repo: RepositorioAlertas = {
    async buscar(sesionEjercicioId, tipo) {
      return filas.find((f) => f.sesionEjercicioId === sesionEjercicioId && f.tipo === tipo) ?? null;
    },
    async insertar(payload) {
      if (filas.some((f) => f.sesionEjercicioId === payload.sesion_ejercicio_id && f.tipo === payload.tipo)) {
        return { tipo: "conflicto" };
      }
      contador += 1;
      const fila: FilaAlerta = {
        id: `alerta-${contador}`,
        sesionEjercicioId: payload.sesion_ejercicio_id,
        tipo: payload.tipo,
        estado: "pendiente",
      };
      filas.push(fila);
      return { tipo: "insertada", fila };
    },
  };

  return { repo, filas };
}

function payloadEjemplo(overrides: Partial<PayloadRecomendacion> = {}): PayloadRecomendacion {
  return {
    sesion_ejercicio_id: "se-1",
    dia_ejercicio_id: "de-1",
    alumno_id: "alumno-1",
    regla: "A_subir_reps",
    peso_sugerido_kg: 20,
    reps_objetivo_min: 8,
    reps_objetivo_max: 12,
    es_peso_corporal: false,
    justificacion: "Mantené el peso e intentá sumar una repetición.",
    basado_en_sesion_ejercicio_id: "se-anterior",
    estado: "aprobada",
    motor_version: "v1",
    decision_data: decisionDataEjemplo(),
    ...overrides,
  };
}

function decisionDataEjemplo(overrides: Partial<DecisionData> = {}): DecisionData {
  return {
    objetivo: "masa",
    rangoOriginal: { min: 8, max: 12 },
    seriesProgramadas: 3,
    tipoProgresion: "doble",
    incrementoKg: 2.5,
    pesoAnteriorKg: 20,
    repsAnterioresPorSerie: [10, 9],
    totalAnteriorReps: 19,
    metaTotalReps: 20,
    seriesConsideradas: null,
    sesionesHistoricasValidas: 1,
    dificultadAnterior: "justo",
    esPesoCorporal: false,
    motivos: ["dentro_del_rango"],
    alertaTipo: null,
    basadoEnSesionEjercicioId: "se-anterior",
    basadoEnFecha: "2026-07-28",
    ...overrides,
  };
}

const SIN_ALERTA = async () => {};

/**
 * Simula la orquestación de `generarYGuardarRecomendacion` en data.ts:
 * busca UNA vez antes de calcular nada, y solo llama a
 * `insertarORecuperarRecomendacion` si no había fila. No es el código real
 * de data.ts (eso necesita Supabase) — es la forma más chica de probar que
 * la composición de las dos capas (búsqueda inicial + insertar-o-recuperar)
 * sigue siendo idempotente y no duplica.
 */
async function simularGenerarYGuardar(
  repo: RepositorioRecomendaciones,
  sesionEjercicioId: string,
  construirPayload: () => PayloadRecomendacion,
  asegurarAlertaSiCorresponde: (fila: FilaRecomendacion) => Promise<void>
): Promise<FilaRecomendacion> {
  const existente = await repo.buscar(sesionEjercicioId);
  if (existente) {
    await asegurarAlertaSiCorresponde(existente);
    return existente;
  }
  return insertarORecuperarRecomendacion(repo, construirPayload(), asegurarAlertaSiCorresponde);
}

// ---------------------------------------------------------------------
// insertarORecuperarRecomendacion — sin búsqueda inicial propia
// ---------------------------------------------------------------------

describe("insertarORecuperarRecomendacion", () => {
  it("inserta sin buscar y repara usando exactamente la fila insertada (misma referencia)", async () => {
    const filaInsertada = payloadAFila(payloadEjemplo(), "rec-1");
    const buscar = vi.fn(async () => null);
    const insertar = vi.fn(async () => ({ tipo: "insertada" as const, fila: filaInsertada }));
    const repararAlerta = vi.fn(async () => {});

    const resultado = await insertarORecuperarRecomendacion({ buscar, insertar }, payloadEjemplo(), repararAlerta);

    expect(resultado).toBe(filaInsertada);
    expect(insertar).toHaveBeenCalledTimes(1);
    expect(buscar).not.toHaveBeenCalled();
    expect(repararAlerta).toHaveBeenCalledTimes(1);
    expect(repararAlerta).toHaveBeenCalledWith(filaInsertada);
  });

  it("conflicto recuperable: devuelve exactamente la fila persistida (misma referencia), no la local", async () => {
    const filaPersistida = payloadAFila(payloadEjemplo({ regla: "A_subir_reps" }), "rec-1");
    const buscar = vi.fn(async () => filaPersistida);
    const insertar = vi.fn(async () => ({ tipo: "conflicto" as const }));
    const repararAlerta = vi.fn(async () => {});

    const resultado = await insertarORecuperarRecomendacion(
      { buscar, insertar },
      payloadEjemplo({ regla: "B_subir_peso" }),
      repararAlerta
    );

    expect(resultado).toBe(filaPersistida);
    expect(buscar).toHaveBeenCalledTimes(1);
    expect(repararAlerta).toHaveBeenCalledWith(filaPersistida);
  });

  it("conflicto sin fila recuperable lanza ERROR_CONFLICTO_RECOMENDACION exactamente, y nunca llama al reparador", async () => {
    const repoInconsistente: RepositorioRecomendaciones = {
      buscar: async () => null,
      insertar: async () => ({ tipo: "conflicto" }),
    };
    const reparador = vi.fn(async () => {});
    await expect(insertarORecuperarRecomendacion(repoInconsistente, payloadEjemplo(), reparador)).rejects.toThrow(
      ERROR_CONFLICTO_RECOMENDACION
    );
    expect(reparador).not.toHaveBeenCalled();
  });

  it("una fila insertada en Regla E repara su alerta", async () => {
    const { repo } = crearRepoRecomendacionesFalso();
    const asegurarAlerta = vi.fn(async (fila: FilaRecomendacion) => {
      void fila;
    });
    const fila = await insertarORecuperarRecomendacion(
      repo,
      payloadEjemplo({ regla: "E_consultar", decision_data: decisionDataEjemplo({ alertaTipo: "dolor" }) }),
      asegurarAlerta
    );
    expect(fila.regla).toBe("E_consultar");
    expect(asegurarAlerta).toHaveBeenCalledTimes(1);
    expect(asegurarAlerta.mock.calls[0][0].regla).toBe("E_consultar");
  });

  it("una fila recuperada tras conflicto en Regla E repara su alerta", async () => {
    const { repo } = crearRepoRecomendacionesFalso();
    await repo.insertar(
      payloadEjemplo({ regla: "E_consultar", decision_data: decisionDataEjemplo({ alertaTipo: "caida_rendimiento" }) })
    );

    const asegurarAlerta = vi.fn(async (fila: FilaRecomendacion) => {
      void fila;
    });
    await insertarORecuperarRecomendacion(repo, payloadEjemplo({ regla: "A_subir_reps" }), asegurarAlerta);

    expect(asegurarAlerta).toHaveBeenCalledTimes(1);
    expect(asegurarAlerta.mock.calls[0][0].regla).toBe("E_consultar");
  });

  it("la fila recuperada tras el conflicto manda sobre el payload local: 'dolor' local vs 'caida_rendimiento' persistido", async () => {
    const { repo } = crearRepoRecomendacionesFalso();
    await repo.insertar(
      payloadEjemplo({ regla: "E_consultar", decision_data: decisionDataEjemplo({ alertaTipo: "caida_rendimiento" }) })
    );

    const { repo: repoAlertas, filas: filasAlertas } = crearRepoAlertasFalso();
    const buscarAlerta = vi.spyOn(repoAlertas, "buscar");

    await insertarORecuperarRecomendacion(
      repo,
      // Cálculo LOCAL de esta invocación: dice 'dolor'. Debe ser ignorado —
      // después del conflicto solo se usa la fila persistida.
      payloadEjemplo({ regla: "E_consultar", decision_data: decisionDataEjemplo({ alertaTipo: "dolor" }) }),
      crearReparadorDeAlertas(repoAlertas)
    );

    expect(filasAlertas).toHaveLength(1);
    expect(filasAlertas[0].tipo).toBe("caida_rendimiento");
    expect(buscarAlerta).not.toHaveBeenCalledWith(expect.anything(), "dolor");
  });

  it("una fila no-E nunca consulta ni inserta en el repositorio de alertas", async () => {
    const { repo } = crearRepoRecomendacionesFalso();
    const { repo: repoAlertas } = crearRepoAlertasFalso();
    const buscarAlerta = vi.spyOn(repoAlertas, "buscar");
    const insertarAlerta = vi.spyOn(repoAlertas, "insertar");

    await insertarORecuperarRecomendacion(repo, payloadEjemplo({ regla: "A_subir_reps" }), crearReparadorDeAlertas(repoAlertas));

    expect(buscarAlerta).not.toHaveBeenCalled();
    expect(insertarAlerta).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------
// Composición de dos capas (simula generarYGuardarRecomendacion de data.ts)
// ---------------------------------------------------------------------

describe("simularGenerarYGuardar — idempotencia de las dos capas juntas", () => {
  it("la primera llamada inserta una fila", async () => {
    const { repo, filas } = crearRepoRecomendacionesFalso();
    const fila = await simularGenerarYGuardar(repo, "se-1", () => payloadEjemplo(), SIN_ALERTA);
    expect(fila.sesionEjercicioId).toBe("se-1");
    expect(filas.size).toBe(1);
  });

  it("la segunda llamada devuelve exactamente la primera fila, sin recalcular ni intentar insertar de nuevo", async () => {
    const { repo } = crearRepoRecomendacionesFalso();
    const insertar = vi.spyOn(repo, "insertar");
    const primera = await simularGenerarYGuardar(repo, "se-1", () => payloadEjemplo({ regla: "A_subir_reps" }), SIN_ALERTA);
    const insercionesDespuesDePrimera = insertar.mock.calls.length;

    const construirPayloadSegundaVez = vi.fn(() => payloadEjemplo({ regla: "B_subir_peso" }));
    const segunda = await simularGenerarYGuardar(repo, "se-1", construirPayloadSegundaVez, SIN_ALERTA);

    expect(construirPayloadSegundaVez).not.toHaveBeenCalled();
    expect(insertar.mock.calls.length).toBe(insercionesDespuesDePrimera);
    expect(segunda).toBe(primera);
    expect(segunda.regla).toBe("A_subir_reps");
    expect(segunda.pesoSugeridoKg).toBe(primera.pesoSugeridoKg);
    expect(segunda.repsObjetivoMin).toBe(primera.repsObjetivoMin);
    expect(segunda.justificacion).toBe(primera.justificacion);
    expect(segunda.decisionData).toEqual(primera.decisionData);
  });

  it("un payload distinto en una segunda llamada no modifica lo persistido", async () => {
    const { repo, filas } = crearRepoRecomendacionesFalso();
    await simularGenerarYGuardar(repo, "se-1", () => payloadEjemplo({ regla: "A_subir_reps" }), SIN_ALERTA);
    await simularGenerarYGuardar(repo, "se-1", () => payloadEjemplo({ regla: "D_reducir" }), SIN_ALERTA);
    expect(filas.size).toBe(1);
    expect(filas.get("se-1")?.regla).toBe("A_subir_reps");
  });

  it("dos llamadas concurrentes de verdad (con barrera entre buscar e insertar) producen una sola recomendación", async () => {
    const filas = new Map<string, FilaRecomendacion>();
    let contador = 0;
    let liberar!: () => void;
    const barrera = new Promise<void>((resolve) => {
      liberar = resolve;
    });

    const repo: RepositorioRecomendaciones = {
      async buscar(id) {
        await barrera; // ambas llamadas quedan acá hasta que el test libere la barrera
        return filas.get(id) ?? null;
      },
      async insertar(payload) {
        if (filas.has(payload.sesion_ejercicio_id)) return { tipo: "conflicto" };
        contador += 1;
        const fila = payloadAFila(payload, `rec-${contador}`);
        filas.set(payload.sesion_ejercicio_id, fila);
        return { tipo: "insertada", fila };
      },
    };

    const p1 = simularGenerarYGuardar(repo, "se-1", () => payloadEjemplo({ regla: "A_subir_reps" }), SIN_ALERTA);
    const p2 = simularGenerarYGuardar(repo, "se-1", () => payloadEjemplo({ regla: "B_subir_peso" }), SIN_ALERTA);

    // Deja que ambas búsquedas iniciales se completen ANTES de liberar la
    // barrera — si no, las llamadas se resolverían en orden y la "carrera"
    // sería trivial (la segunda vería la fila de la primera ya en `buscar`).
    await new Promise((r) => setTimeout(r, 0));
    liberar();

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(filas.size).toBe(1);
    expect(r1.id).toBe(r2.id);
    expect(new Set([r1.id, r2.id]).size).toBe(1);
  });

  it("una recomendación E ya existente (encontrada en la búsqueda inicial) también repara su alerta, sin recalcular", async () => {
    const { repo } = crearRepoRecomendacionesFalso();
    const { fila: filaPersistida } = (await repo.insertar(
      payloadEjemplo({ regla: "E_consultar", decision_data: decisionDataEjemplo({ alertaTipo: "estancamiento_3_sesiones" }) })
    )) as { tipo: "insertada"; fila: FilaRecomendacion };

    const buscar = vi.spyOn(repo, "buscar");
    const insertar = vi.spyOn(repo, "insertar");
    const asegurarAlerta = vi.fn(async (fila: FilaRecomendacion) => {
      void fila;
    });
    const fila = await simularGenerarYGuardar(
      repo,
      "se-1",
      () => {
        throw new Error("no debería recalcular una recomendación ya existente");
      },
      asegurarAlerta
    );

    expect(fila).toBe(filaPersistida);
    expect(fila.regla).toBe("E_consultar");
    expect(buscar).toHaveBeenCalledTimes(1);
    expect(insertar).not.toHaveBeenCalled();
    expect(asegurarAlerta).toHaveBeenCalledTimes(1);
    expect(asegurarAlerta).toHaveBeenCalledWith(filaPersistida);
  });

  it("una recomendación no-E ya existente no toca el repositorio de alertas", async () => {
    const { repo } = crearRepoRecomendacionesFalso();
    const { fila: filaExistente } = (await repo.insertar(payloadEjemplo({ regla: "A_subir_reps" }))) as {
      tipo: "insertada";
      fila: FilaRecomendacion;
    };
    const { repo: repoAlertas } = crearRepoAlertasFalso();
    const buscarAlerta = vi.spyOn(repoAlertas, "buscar");
    const insertarAlerta = vi.spyOn(repoAlertas, "insertar");

    const resultado = await simularGenerarYGuardar(
      repo,
      "se-1",
      () => {
        throw new Error("no debería recalcular una recomendación ya existente");
      },
      crearReparadorDeAlertas(repoAlertas)
    );

    expect(resultado).toBe(filaExistente);
    expect(buscarAlerta).not.toHaveBeenCalled();
    expect(insertarAlerta).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------
// leerAlertaTipo
// ---------------------------------------------------------------------

describe("leerAlertaTipo", () => {
  it("devuelve null para reglas que no son E, sin exigir alertaTipo", () => {
    expect(leerAlertaTipo("A_subir_reps", { alertaTipo: "dolor" })).toBeNull();
    expect(leerAlertaTipo("A_subir_reps", null)).toBeNull();
    expect(leerAlertaTipo("C_mantener", {})).toBeNull();
  });

  it("devuelve el alertaTipo válido para cada tipo de Regla E", () => {
    expect(leerAlertaTipo("E_consultar", { alertaTipo: "dolor" })).toBe("dolor");
    expect(leerAlertaTipo("E_consultar", { alertaTipo: "estancamiento_3_sesiones" })).toBe("estancamiento_3_sesiones");
    expect(leerAlertaTipo("E_consultar", { alertaTipo: "caida_rendimiento" })).toBe("caida_rendimiento");
  });

  it("lanza ERROR_ALERTA_TIPO_INVALIDO exactamente para cada forma de dato inválido en Regla E", () => {
    expect(() => leerAlertaTipo("E_consultar", null)).toThrow(ERROR_ALERTA_TIPO_INVALIDO);
    expect(() => leerAlertaTipo("E_consultar", [])).toThrow(ERROR_ALERTA_TIPO_INVALIDO);
    expect(() => leerAlertaTipo("E_consultar", "texto")).toThrow(ERROR_ALERTA_TIPO_INVALIDO);
    expect(() => leerAlertaTipo("E_consultar", {})).toThrow(ERROR_ALERTA_TIPO_INVALIDO);
    expect(() => leerAlertaTipo("E_consultar", { alertaTipo: "desconocida" })).toThrow(ERROR_ALERTA_TIPO_INVALIDO);
    expect(() => leerAlertaTipo("E_consultar", { alertaTipo: null })).toThrow(ERROR_ALERTA_TIPO_INVALIDO);
    expect(() => leerAlertaTipo("E_consultar", 42)).toThrow(ERROR_ALERTA_TIPO_INVALIDO);
  });
});

describe("leerDatosCumplimiento", () => {
  it("lee metaTotalReps y totalAnteriorReps cuando están presentes", () => {
    expect(leerDatosCumplimiento({ metaTotalReps: 30, totalAnteriorReps: 28 })).toEqual({
      metaTotalReps: 30,
      totalAnteriorReps: 28,
      // Recomendación anterior a la técnica por serie: sin el campo, se
      // evalúan todas las series, que es lo que se hacía siempre.
      seriesConsideradas: null,
    });
  });

  it("devuelve null para cada campo faltante, sin lanzar", () => {
    const vacio = { metaTotalReps: null, totalAnteriorReps: null, seriesConsideradas: null };
    expect(leerDatosCumplimiento({})).toEqual(vacio);
    expect(leerDatosCumplimiento(null)).toEqual(vacio);
    expect(leerDatosCumplimiento([])).toEqual(vacio);
    expect(leerDatosCumplimiento("texto")).toEqual(vacio);
  });

  it("ignora valores del tipo incorrecto en vez de devolverlos tal cual", () => {
    expect(leerDatosCumplimiento({ metaTotalReps: "30", totalAnteriorReps: NaN })).toEqual({
      metaTotalReps: null,
      totalAnteriorReps: null,
      seriesConsideradas: null,
    });
  });

  it("lee seriesConsideradas y descarta lo que no sea una lista de enteros", () => {
    expect(leerDatosCumplimiento({ seriesConsideradas: [1, 2, 3] }).seriesConsideradas).toEqual([1, 2, 3]);
    expect(leerDatosCumplimiento({ seriesConsideradas: [] }).seriesConsideradas).toBeNull();
    expect(leerDatosCumplimiento({ seriesConsideradas: [1, "2"] }).seriesConsideradas).toBeNull();
    expect(leerDatosCumplimiento({ seriesConsideradas: "1,2" }).seriesConsideradas).toBeNull();
  });
});

// ---------------------------------------------------------------------
// Compatibilidad con decision_data legado/incompleto — `decisionData` es
// `unknown` en FilaRecomendacion a propósito (viene de un jsonb leído de
// Supabase, nunca se asume que cumple el contrato actual — ver el
// comentario en la definición de FilaRecomendacion en congelar.ts).
// ---------------------------------------------------------------------

describe("crearReparadorDeAlertas — decision_data legado o incompleto", () => {
  it("una fila no-E con decision_data de una forma vieja (sin ninguno de los campos actuales) se maneja normalmente, sin tocar alertas", async () => {
    const { repo, filas } = crearRepoAlertasFalso();
    const filaVieja: FilaRecomendacion = {
      ...payloadAFila(payloadEjemplo({ regla: "A_subir_reps" }), "rec-1"),
      decisionData: { formaVieja: true, sinNingunCampoActual: 123 },
    };
    await expect(crearReparadorDeAlertas(repo)(filaVieja)).resolves.toBeUndefined();
    expect(filas).toHaveLength(0);
  });

  it("una fila E con decision_data legado o incompleto (sin alertaTipo) sigue lanzando ERROR_ALERTA_TIPO_INVALIDO", async () => {
    const { repo, filas } = crearRepoAlertasFalso();
    const filaViejaE: FilaRecomendacion = {
      ...payloadAFila(payloadEjemplo({ regla: "E_consultar" }), "rec-1"),
      decisionData: { motivo: "guardado por una versión anterior del motor, sin alertaTipo" },
    };
    await expect(crearReparadorDeAlertas(repo)(filaViejaE)).rejects.toThrow(ERROR_ALERTA_TIPO_INVALIDO);
    expect(filas).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------
// construirPayloadAlertaDesdeFila
// ---------------------------------------------------------------------

describe("construirPayloadAlertaDesdeFila", () => {
  it("usa exclusivamente los campos de la fila persistida + el tipo ya validado", () => {
    const fila = payloadAFila(payloadEjemplo({ regla: "E_consultar" }), "rec-1");
    const payload = construirPayloadAlertaDesdeFila(fila, "caida_rendimiento");
    expect(payload).toEqual({
      alumno_id: "alumno-1",
      dia_ejercicio_id: "de-1",
      sesion_ejercicio_id: "se-1",
      tipo: "caida_rendimiento",
    });
  });
});

// ---------------------------------------------------------------------
// asegurarAlertaImpulso
// ---------------------------------------------------------------------

function payloadAlertaEjemplo(overrides: Partial<PayloadAlerta> = {}): PayloadAlerta {
  return { alumno_id: "alumno-1", dia_ejercicio_id: "de-1", sesion_ejercicio_id: "se-1", tipo: "dolor", ...overrides };
}

describe("asegurarAlertaImpulso", () => {
  it("crea la alerta si no existe", async () => {
    const { repo, filas } = crearRepoAlertasFalso();
    const fila = await asegurarAlertaImpulso(repo, payloadAlertaEjemplo());
    expect(fila.sesionEjercicioId).toBe("se-1");
    expect(filas).toHaveLength(1);
  });

  it("alerta preexistente pendiente se devuelve sin insertar otra", async () => {
    const existente: FilaAlerta = { id: "alerta-1", sesionEjercicioId: "se-1", tipo: "dolor", estado: "pendiente" };
    const { repo, filas } = crearRepoAlertasFalso([existente]);
    const fila = await asegurarAlertaImpulso(repo, payloadAlertaEjemplo());
    expect(fila).toEqual(existente);
    expect(filas).toHaveLength(1);
  });

  it("alerta preexistente resuelta se devuelve sin reabrir ni modificar", async () => {
    const resuelta: FilaAlerta = { id: "alerta-1", sesionEjercicioId: "se-1", tipo: "dolor", estado: "resuelta" };
    const { repo, filas } = crearRepoAlertasFalso([resuelta]);
    const fila = await asegurarAlertaImpulso(repo, payloadAlertaEjemplo());
    expect(fila).toEqual(resuelta);
    expect(fila.estado).toBe("resuelta");
    expect(filas).toHaveLength(1);
  });

  it("conflicto recuperable: otra solicitud ya la creó, la reconsulta la encuentra", async () => {
    const { repo, filas } = crearRepoAlertasFalso();
    await repo.insertar(payloadAlertaEjemplo());

    const fila = await asegurarAlertaImpulso(repo, payloadAlertaEjemplo());
    expect(filas).toHaveLength(1);
    expect(fila.id).toBe(filas[0].id);
  });

  it("conflicto no recuperable lanza ERROR_CONFLICTO_ALERTA exactamente", async () => {
    const repoInconsistente: RepositorioAlertas = {
      buscar: async () => null,
      insertar: async () => ({ tipo: "conflicto" }),
    };
    await expect(asegurarAlertaImpulso(repoInconsistente, payloadAlertaEjemplo())).rejects.toThrow(ERROR_CONFLICTO_ALERTA);
  });

  it("dos reparaciones concurrentes (con barrera real) terminan con una sola alerta", async () => {
    const filas: FilaAlerta[] = [];
    let contador = 0;
    let liberar!: () => void;
    const barrera = new Promise<void>((resolve) => {
      liberar = resolve;
    });

    const repo: RepositorioAlertas = {
      async buscar(id, tipo) {
        await barrera;
        return filas.find((f) => f.sesionEjercicioId === id && f.tipo === tipo) ?? null;
      },
      async insertar(payload) {
        if (filas.some((f) => f.sesionEjercicioId === payload.sesion_ejercicio_id && f.tipo === payload.tipo)) {
          return { tipo: "conflicto" };
        }
        contador += 1;
        const fila: FilaAlerta = {
          id: `alerta-${contador}`,
          sesionEjercicioId: payload.sesion_ejercicio_id,
          tipo: payload.tipo,
          estado: "pendiente",
        };
        filas.push(fila);
        return { tipo: "insertada", fila };
      },
    };

    const p1 = asegurarAlertaImpulso(repo, payloadAlertaEjemplo());
    const p2 = asegurarAlertaImpulso(repo, payloadAlertaEjemplo());

    await new Promise((r) => setTimeout(r, 0));
    liberar();

    const [f1, f2] = await Promise.all([p1, p2]);
    expect(filas).toHaveLength(1);
    expect(f1.id).toBe(f2.id);
  });
});

// ---------------------------------------------------------------------
// crearReparadorDeAlertas — el compositor
// ---------------------------------------------------------------------

describe("crearReparadorDeAlertas", () => {
  it("fila con Regla A: no consulta el repositorio de alertas", async () => {
    const { repo, filas } = crearRepoAlertasFalso();
    const buscar = vi.spyOn(repo, "buscar");
    await crearReparadorDeAlertas(repo)(payloadAFila(payloadEjemplo({ regla: "A_subir_reps" }), "rec-1"));
    expect(buscar).not.toHaveBeenCalled();
    expect(filas).toHaveLength(0);
  });

  it("fila con Regla E válida: asegura la alerta", async () => {
    const { repo, filas } = crearRepoAlertasFalso();
    const fila = payloadAFila(
      payloadEjemplo({ regla: "E_consultar", decision_data: decisionDataEjemplo({ alertaTipo: "dolor" }) }),
      "rec-1"
    );
    await crearReparadorDeAlertas(repo)(fila);
    expect(filas).toHaveLength(1);
    expect(filas[0].tipo).toBe("dolor");
  });

  it("fila con Regla E inválida: lanza antes de consultar o insertar en el repositorio de alertas", async () => {
    const { repo, filas } = crearRepoAlertasFalso();
    const buscar = vi.spyOn(repo, "buscar");
    const insertar = vi.spyOn(repo, "insertar");
    const filaInvalida = payloadAFila(
      payloadEjemplo({ regla: "E_consultar", decision_data: decisionDataEjemplo({ alertaTipo: null }) }),
      "rec-1"
    );
    await expect(crearReparadorDeAlertas(repo)(filaInvalida)).rejects.toThrow(ERROR_ALERTA_TIPO_INVALIDO);
    expect(buscar).not.toHaveBeenCalled();
    expect(insertar).not.toHaveBeenCalled();
    expect(filas).toHaveLength(0);
  });

  it("fila recuperada con 'caida_rendimiento' crea exactamente esa alerta aunque el payload local original dijera 'dolor'", async () => {
    const { repo, filas } = crearRepoAlertasFalso();
    // La "fila persistida" que finalmente llega al reparador ya refleja lo
    // que ganó la carrera en la base, no lo que se calculó localmente.
    const filaPersistida = payloadAFila(
      payloadEjemplo({ regla: "E_consultar", decision_data: decisionDataEjemplo({ alertaTipo: "caida_rendimiento" }) }),
      "rec-1"
    );
    await crearReparadorDeAlertas(repo)(filaPersistida);
    expect(filas).toHaveLength(1);
    expect(filas[0].tipo).toBe("caida_rendimiento");
  });
});

// ---------------------------------------------------------------------
// construirPayloadRecomendacion
// ---------------------------------------------------------------------

const RANGO = { min: 8, max: 12 };
const CONFIG: ConfigProgresion = {
  aptoProgresion: true,
  tipoProgresion: "doble",
  incrementoKg: 2.5,
  requiereAutorizacion: false,
  rirObjetivo: null,
};

function historialEjemplo(): SesionHistorial[] {
  return [
    {
      sesionEjercicioId: "se-anterior",
      fecha: "2026-07-28",
      series: [
        { numeroSerie: 1, pesoKg: 20, esPesoCorporal: false, repsRealizadas: 10, realizada: true },
        { numeroSerie: 2, pesoKg: 20, esPesoCorporal: false, repsRealizadas: 9, realizada: true },
      ],
      dificultadPercibida: "justo",
      dolorReportado: false,
    },
  ];
}

function recomendacionEjemplo(overrides: Partial<Recomendacion> = {}): Recomendacion {
  return {
    regla: "A_subir_reps",
    pesoSugeridoKg: 20,
    repsObjetivoMin: 8,
    repsObjetivoMax: 12,
    esPesoCorporal: false,
    justificacion: "Mantené el peso e intentá sumar una repetición.",
    motivos: ["dentro_del_rango"],
    metaTotalReps: 20,
    alertaTipo: null,
    ...overrides,
  };
}

describe("construirPayloadRecomendacion", () => {
  it("guarda decision_data con los campos mínimos requeridos, incluido alertaTipo, y es JSON serializable", () => {
    const payload = construirPayloadRecomendacion({
      sesionEjercicioId: "se-1",
      diaEjercicioId: "de-1",
      alumnoId: "alumno-1",
      objetivo: "masa",
      rango: RANGO,
      seriesProgramadas: 3,
      config: CONFIG,
      historial: historialEjemplo(),
      recomendacion: recomendacionEjemplo({ alertaTipo: null }),
    });

    expect(payload.motor_version).toBe("v1");
    expect(payload.decision_data).toMatchObject({
      objetivo: "masa",
      rangoOriginal: { min: 8, max: 12 },
      seriesProgramadas: 3,
      tipoProgresion: "doble",
      incrementoKg: 2.5,
      pesoAnteriorKg: 20,
      repsAnterioresPorSerie: [10, 9],
      totalAnteriorReps: 19,
      metaTotalReps: 20,
      sesionesHistoricasValidas: 1,
      dificultadAnterior: "justo",
      motivos: ["dentro_del_rango"],
      alertaTipo: null,
    });
    expect(JSON.parse(JSON.stringify(payload))).toEqual(payload);
  });

  it("propaga alertaTipo a decision_data para Regla E", () => {
    const payload = construirPayloadRecomendacion({
      sesionEjercicioId: "se-1",
      diaEjercicioId: "de-1",
      alumnoId: "alumno-1",
      objetivo: "masa",
      rango: RANGO,
      seriesProgramadas: 3,
      config: CONFIG,
      historial: historialEjemplo(),
      recomendacion: recomendacionEjemplo({
        regla: "E_consultar",
        pesoSugeridoKg: null,
        repsObjetivoMin: null,
        repsObjetivoMax: null,
        alertaTipo: "dolor",
      }),
    });
    expect(payload.decision_data.alertaTipo).toBe("dolor");
    expect(payload.estado).toBe("bloqueada");
    expect(payload.peso_sugerido_kg).toBeNull();
  });

  it("basado_en_sesion_ejercicio_id viene de la sesión histórica más reciente", () => {
    const payload = construirPayloadRecomendacion({
      sesionEjercicioId: "se-1",
      diaEjercicioId: "de-1",
      alumnoId: "alumno-1",
      objetivo: "masa",
      rango: RANGO,
      seriesProgramadas: 3,
      config: CONFIG,
      historial: historialEjemplo(),
      recomendacion: recomendacionEjemplo(),
    });
    expect(payload.basado_en_sesion_ejercicio_id).toBe("se-anterior");
  });

  it("Regla B con requiere_autorizacion nace en 'propuesta'", () => {
    const payload = construirPayloadRecomendacion({
      sesionEjercicioId: "se-1",
      diaEjercicioId: "de-1",
      alumnoId: "alumno-1",
      objetivo: "masa",
      rango: RANGO,
      seriesProgramadas: 3,
      config: { ...CONFIG, requiereAutorizacion: true },
      historial: historialEjemplo(),
      recomendacion: recomendacionEjemplo({ regla: "B_subir_peso" }),
    });
    expect(payload.estado).toBe("propuesta");
  });

  it("Regla B sin requiere_autorizacion nace 'aprobada' directamente", () => {
    const payload = construirPayloadRecomendacion({
      sesionEjercicioId: "se-1",
      diaEjercicioId: "de-1",
      alumnoId: "alumno-1",
      objetivo: "masa",
      rango: RANGO,
      seriesProgramadas: 3,
      config: CONFIG,
      historial: historialEjemplo(),
      recomendacion: recomendacionEjemplo({ regla: "B_subir_peso" }),
    });
    expect(payload.estado).toBe("aprobada");
  });

  it("Reglas A, C y D nacen 'aprobada' sin importar requiere_autorizacion", () => {
    for (const regla of ["A_subir_reps", "C_mantener", "D_reducir"] as const) {
      const payload = construirPayloadRecomendacion({
        sesionEjercicioId: "se-1",
        diaEjercicioId: "de-1",
        alumnoId: "alumno-1",
        objetivo: "masa",
        rango: RANGO,
        seriesProgramadas: 3,
        config: { ...CONFIG, requiereAutorizacion: true },
        historial: historialEjemplo(),
        recomendacion: recomendacionEjemplo({ regla }),
      });
      expect(payload.estado).toBe("aprobada");
    }
  });
});
