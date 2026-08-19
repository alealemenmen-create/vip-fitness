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
      ahora,
    });

    expect(resultado?.registro.press[0]).toEqual(base.press[0]);
    expect(resultado?.registro.press[1]).toEqual({ reps: "12", peso: "25", completada: true });
    expect(resultado?.notas.press).toBe("Última serie exigente");
    expect(resultado?.segundosSesion).toBe(95);

    const enLibrasSinNota = restaurarBorradorSesionV2(crudo({
      unidadPeso: "lb",
      notas: { press: "" },
    }), {
      sesionId: "sesion-1",
      registroBase: base,
      notasBase: { press: "Nota anterior" },
      ahora,
    });
    expect(enLibrasSinNota?.registro.press[0].peso).toBe("44.1");
    expect(enLibrasSinNota?.notas.press).toBe("");
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
});
