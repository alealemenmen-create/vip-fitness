import { describe, expect, it } from "vitest";
import {
  ejercicioResueltoDeVerdad,
  impulsoPendienteDeAvance,
  requiereResultado,
  type IntervencionParaAvance,
} from "./impulso-avance";

function intervencion(overrides: Partial<IntervencionParaAvance> = {}): IntervencionParaAvance {
  return {
    id: "int-1",
    serieObjetivo: 4,
    tipo: "cierre_controlado",
    origen: "metodo_ale",
    estado: "mostrada",
    ...overrides,
  };
}

describe("requiereResultado", () => {
  it("una nota de orientación automática (tempo_controlado del método) no pide resultado", () => {
    expect(requiereResultado({ tipo: "tempo_controlado", origen: "metodo_ale" })).toBe(false);
  });

  it("un mensaje personal de Ale con tempo_controlado sí pide resultado", () => {
    expect(requiereResultado({ tipo: "tempo_controlado", origen: "personal_ale" })).toBe(true);
    expect(requiereResultado({ tipo: "tempo_controlado", origen: "preparada_por_ale" })).toBe(true);
  });

  it("cualquier técnica con reto real pide resultado", () => {
    expect(requiereResultado({ tipo: "cierre_controlado", origen: "metodo_ale" })).toBe(true);
    expect(requiereResultado({ tipo: "drop_set", origen: "metodo_ale" })).toBe(true);
  });
});

describe("impulsoPendienteDeAvance", () => {
  it("sin intervenciones no bloquea nada", () => {
    expect(impulsoPendienteDeAvance([], new Set())).toBe(false);
  });

  it("no bloquea mientras la serie objetivo todavía no se marcó hecha", () => {
    const intervenciones = [intervencion({ serieObjetivo: 4, estado: "preparada" })];
    expect(impulsoPendienteDeAvance(intervenciones, new Set([1, 2, 3]))).toBe(false);
  });

  it("bloquea cuando la serie objetivo ya está hecha pero el resultado sigue sin resolver — caso reportado del autoavance", () => {
    const intervenciones = [intervencion({ serieObjetivo: 4, estado: "mostrada" })];
    expect(impulsoPendienteDeAvance(intervenciones, new Set([1, 2, 3, 4]))).toBe(true);
  });

  it("deja avanzar apenas el servidor confirma estado 'resuelta'", () => {
    const intervenciones = [intervencion({ serieObjetivo: 4, estado: "resuelta" })];
    expect(impulsoPendienteDeAvance(intervenciones, new Set([1, 2, 3, 4]))).toBe(false);
  });

  it("deja avanzar de forma optimista con la confirmación local, sin esperar la revalidación del servidor", () => {
    const intervenciones = [intervencion({ id: "int-9", serieObjetivo: 4, estado: "mostrada" })];
    expect(
      impulsoPendienteDeAvance(intervenciones, new Set([1, 2, 3, 4]), { "int-9": true })
    ).toBe(false);
  });

  it("una confirmación local desactualizada no gana contra un estado local explícito en false", () => {
    const intervenciones = [intervencion({ id: "int-9", serieObjetivo: 4, estado: "resuelta" })];
    // Un caso defensivo: si el cliente registró explícitamente `false` (no
    // debería pasar en la práctica, resultadosLocales solo se llena con
    // `true`), no debe ganarle a un servidor que ya dice "resuelta"... salvo
    // que el local mande. Se documenta el criterio: el local manda siempre
    // que exista, es la señal más fresca.
    expect(
      impulsoPendienteDeAvance(intervenciones, new Set([1, 2, 3, 4]), { "int-9": false })
    ).toBe(true);
  });

  it("una intervención cancelada nunca bloquea, aunque la serie ya esté hecha", () => {
    const intervenciones = [intervencion({ serieObjetivo: 4, estado: "cancelada" })];
    expect(impulsoPendienteDeAvance(intervenciones, new Set([1, 2, 3, 4]))).toBe(false);
  });

  it("una nota de orientación automática no bloquea aunque quede 'mostrada' sin cerrar", () => {
    const intervenciones = [
      intervencion({ serieObjetivo: 2, tipo: "tempo_controlado", origen: "metodo_ale", estado: "mostrada" }),
    ];
    expect(impulsoPendienteDeAvance(intervenciones, new Set([1, 2]))).toBe(false);
  });

  it("un mensaje personal de Ale con tempo_controlado sí bloquea hasta resolverse", () => {
    const intervenciones = [
      intervencion({ serieObjetivo: 2, tipo: "tempo_controlado", origen: "personal_ale", estado: "mostrada" }),
    ];
    expect(impulsoPendienteDeAvance(intervenciones, new Set([1, 2]))).toBe(true);
  });

  it("con varias intervenciones, una sola pendiente ya bloquea el avance", () => {
    const intervenciones = [
      intervencion({ id: "resuelta-ya", serieObjetivo: 2, estado: "resuelta" }),
      intervencion({ id: "todavia-pendiente", serieObjetivo: 4, estado: "mostrada" }),
    ];
    expect(impulsoPendienteDeAvance(intervenciones, new Set([1, 2, 3, 4]))).toBe(true);
  });

  it("caso completo del reporte: última serie elegible con reto, hasta que se confirma el resultado no hay avance permitido", () => {
    // 1) La serie objetivo (la última del ejercicio, la 3) todavía no se
    //    marcó — el ejercicio ni siquiera está "completo" a ojos de
    //    SelectorDificultad, así que este tramo no aplica todavía.
    const intervenciones = [intervencion({ id: "reto-final", serieObjetivo: 3, estado: "mostrada" })];
    expect(impulsoPendienteDeAvance(intervenciones, new Set([1, 2]))).toBe(false);

    // 2) Se marca la serie 3 (RIR y aceptar/rechazar el reto ya se
    //    resolvieron antes, porque si no la serie ni se hubiera podido
    //    marcar — ver `bloqueadaPorImpulso`/`bloqueosImpulsoPorSerie`).
    //    El resultado ("¿Cómo salió?") todavía no se envió: no puede
    //    avanzar, aunque la encuesta general del ejercicio ya esté
    //    disponible.
    expect(impulsoPendienteDeAvance(intervenciones, new Set([1, 2, 3]))).toBe(true);

    // 3) El alumno confirma el resultado — el cliente lo sabe de inmediato
    //    (optimista) sin esperar la revalidación del servidor.
    expect(
      impulsoPendienteDeAvance(intervenciones, new Set([1, 2, 3]), { "reto-final": true })
    ).toBe(false);

    // 4) Tras la revalidación, el servidor también confirma "resuelta":
    //    sigue sin bloquear, con o sin el estado local.
    const intervencionesResueltas = [intervencion({ id: "reto-final", serieObjetivo: 3, estado: "resuelta" })];
    expect(impulsoPendienteDeAvance(intervencionesResueltas, new Set([1, 2, 3]))).toBe(false);
  });
});

describe("ejercicioResueltoDeVerdad", () => {
  const seriesHasta = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ numeroSerie: i + 1, realizada: true }));

  it("un ejercicio sin terminar nunca cuenta como resuelto, aunque no tenga Impulso VIP", () => {
    expect(
      ejercicioResueltoDeVerdad({ completado: false, series: seriesHasta(2), intervencionesImpulso: [] })
    ).toBe(false);
  });

  it("terminado y sin ninguna intervención de Impulso VIP: resuelto de verdad", () => {
    expect(
      ejercicioResueltoDeVerdad({ completado: true, series: seriesHasta(3), intervencionesImpulso: [] })
    ).toBe(true);
  });

  it("caso completo del bug reportado 2026-08-19: recargar la página justo después de la última serie, antes de contestar el resultado, NO debe saltar el ejercicio", () => {
    const intervenciones = [intervencion({ id: "reto-final", serieObjetivo: 3, estado: "mostrada" })];
    // El servidor ya marcó `completado = true` (la serie objetivo alcanza
    // para eso), pero el resultado de Impulso VIP sigue sin confirmar — la
    // recarga no puede tratar esto como un ejercicio cerrado de verdad.
    expect(
      ejercicioResueltoDeVerdad({ completado: true, series: seriesHasta(3), intervencionesImpulso: intervenciones })
    ).toBe(false);

    // Una vez que el servidor confirma "resuelta" (el alumno contestó antes
    // de recargar, o volvió a contestar después), la recarga sí puede
    // avanzar de verdad.
    const resueltas = [intervencion({ id: "reto-final", serieObjetivo: 3, estado: "resuelta" })];
    expect(
      ejercicioResueltoDeVerdad({ completado: true, series: seriesHasta(3), intervencionesImpulso: resueltas })
    ).toBe(true);
  });

  it("una intervención cancelada no impide dar el ejercicio por resuelto tras recargar", () => {
    const intervenciones = [intervencion({ serieObjetivo: 3, estado: "cancelada" })];
    expect(
      ejercicioResueltoDeVerdad({ completado: true, series: seriesHasta(3), intervencionesImpulso: intervenciones })
    ).toBe(true);
  });
});
