import { describe, expect, it } from "vitest";
import { restaurarBorradorSesionV2 } from "./borrador-sesion-v2";

const ahora = new Date("2026-08-19T12:00:00Z").getTime();
const base = {
  press: [
    { reps: "10", peso: "20", completada: true },
    { reps: "10", peso: "", completada: false },
  ],
};

function crudo(cambios: Record<string, unknown> = {}) {
  return JSON.stringify({
    version: 1,
    sesionId: "sesion-1",
    actualizadoEn: ahora - 2_000,
    registro: {
      press: [
        { reps: "8", peso: "18", completada: false },
        { reps: "12", peso: "25", completada: true },
      ],
    },
    notas: { press: "Última serie exigente" },
    comentarioSesion: "Buena energía al cerrar",
    segundosSesion: 95,
    ejercicioActivoId: "press",
    serieActivaIndice: 1,
    unidadPeso: "kg",
    ...cambios,
  });
}

describe("borrador local de sesión V2", () => {
  it("restaura lo pendiente sin pisar una serie ya confirmada por el servidor", () => {
    const resultado = restaurarBorradorSesionV2(crudo(), {
      sesionId: "sesion-1",
      registroBase: base,
      notasBase: { press: "" },
      comentarioBase: "",
      ahora,
    });

    expect(resultado?.registro.press[0]).toEqual(base.press[0]);
    expect(resultado?.registro.press[1]).toEqual({ reps: "12", peso: "25", completada: true });
    expect(resultado?.notas.press).toBe("Última serie exigente");
    expect(resultado?.comentarioSesion).toBe("Buena energía al cerrar");
    expect(resultado?.segundosSesion).toBe(95);
    expect(resultado?.pasosTecnica).toEqual({});
    expect(resultado?.pausaTecnica).toBeNull();

    const enLibrasSinNota = restaurarBorradorSesionV2(crudo({
      unidadPeso: "lb",
      notas: { press: "" },
    }), {
      sesionId: "sesion-1",
      registroBase: base,
      notasBase: { press: "Nota anterior" },
      comentarioBase: "Comentario anterior",
      ahora,
    });
    expect(enLibrasSinNota?.registro.press[0].peso).toBe("44.1");
    expect(enLibrasSinNota?.notas.press).toBe("");

    const borradorAnterior = restaurarBorradorSesionV2(crudo({ comentarioSesion: undefined }), {
      sesionId: "sesion-1",
      registroBase: base,
      notasBase: { press: "" },
      comentarioBase: "Comentario guardado por el servidor",
      ahora,
    });
    expect(borradorAnterior?.comentarioSesion).toBe("Comentario guardado por el servidor");
  });

  it("rechaza otra sesión, un borrador vencido y una geometría incompatible", () => {
    const input = { sesionId: "sesion-1", registroBase: base, notasBase: { press: "" }, ahora };
    expect(restaurarBorradorSesionV2(crudo({ sesionId: "otra" }), input)).toBeNull();
    expect(restaurarBorradorSesionV2(crudo({ actualizadoEn: ahora - 49 * 60 * 60 * 1_000 }), input)).toBeNull();
    expect(restaurarBorradorSesionV2(crudo({ registro: { press: [] } }), input)).toBeNull();
  });

  it("limita posición y tiempo antes de usarlos en pantalla", () => {
    const resultado = restaurarBorradorSesionV2(crudo({ serieActivaIndice: 99, segundosSesion: 999_999 }), {
      sesionId: "sesion-1",
      registroBase: base,
      notasBase: { press: "" },
      ahora,
    });

    expect(resultado?.serieActivaIndice).toBe(1);
    expect(resultado?.segundosSesion).toBe(86_400);
  });

  it("reanuda un paso técnico pendiente y descuenta el tiempo fuera de la app", () => {
    const resultado = restaurarBorradorSesionV2(crudo({
      registro: {
        press: [
          { reps: "8", peso: "18", completada: false },
          { reps: "12", peso: "25", completada: false },
        ],
      },
      pasosTecnica: { "press-1": 1, "press-0": 2, "desconocido-0": 4 },
      pausaTecnica: { clave: "press-1", segundos: 15, pasoSiguiente: 2 },
    }), {
      sesionId: "sesion-1",
      registroBase: base,
      notasBase: { press: "" },
      ahora,
    });

    // press-0 ya está confirmada por el servidor y no puede recuperar un paso
    // local antiguo. La pausa de press-1 perdió los dos segundos transcurridos.
    expect(resultado?.pasosTecnica).toEqual({ "press-1": 1 });
    expect(resultado?.pausaTecnica).toEqual({ clave: "press-1", segundos: 13, pasoSiguiente: 2 });
  });
});
