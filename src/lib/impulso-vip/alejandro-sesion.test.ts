import { describe, expect, it } from "vitest";
import {
  estimarRirAutomaticoAlejandro,
  resolverCupoAlejandroSesion,
  seleccionarMomentosAlejandro,
  type PerfilSesionAlejandro,
} from "./alejandro-sesion";

const PERFIL: PerfilSesionAlejandro = {
  activo: true,
  nivel: "intermedio",
  sesionesValidas: 18,
  constancia30Dias: 0.84,
  registroConfiable: true,
  exitosRecientes: 3,
  desafiosRecientes: 4,
  dolorORestriccion: false,
  intensidadAltaAutorizada: false,
};

describe("resolverCupoAlejandroSesion", () => {
  it("reserva dos momentos para un intermedio constante", () => {
    expect(resolverCupoAlejandroSesion(PERFIL)).toBe(2);
  });

  it("apaga toda intensificacion ante dolor o restriccion", () => {
    expect(resolverCupoAlejandroSesion({ ...PERFIL, dolorORestriccion: true })).toBe(0);
  });

  it("solo llega a cuatro en un experto autorizado y confiable", () => {
    expect(resolverCupoAlejandroSesion({ ...PERFIL, nivel: "experto", intensidadAltaAutorizada: true })).toBe(4);
  });
});

describe("seleccionarMomentosAlejandro", () => {
  it("elige ultimas series dispersas y evita una superserie programada", () => {
    const momentos = seleccionarMomentosAlejandro(PERFIL, [
      { ejercicioId: "a", nombre: "Sentadilla", totalSeries: 4, posicion: 0, compuesto: true, tecnicaProgramada: false, perfilRevisado: true, tecnicasPermitidas: ["cierre_controlado", "repeticion_extra"] },
      { ejercicioId: "b", nombre: "Peso muerto", totalSeries: 3, posicion: 1, compuesto: true, tecnicaProgramada: true, perfilRevisado: true, tecnicasPermitidas: ["cierre_controlado"] },
      { ejercicioId: "c", nombre: "Extension", totalSeries: 3, posicion: 3, compuesto: false, tecnicaProgramada: false, perfilRevisado: true, tecnicasPermitidas: ["cierre_controlado", "drop_set"] },
    ]);

    expect(momentos).toHaveLength(2);
    expect(momentos.map((momento) => momento.ejercicioId)).toEqual(["a", "c"]);
    expect(momentos.map((momento) => momento.serieIndice)).toEqual([3, 2]);
    expect(momentos[1].tipo).toBe("drop_set");
  });
});

describe("estimarRirAutomaticoAlejandro", () => {
  it("no inventa un RIR cuando faltan muestras comparables", () => {
    expect(estimarRirAutomaticoAlejandro({ repsObjetivo: 10, repsRealizadas: 10, rirHistoricoMediano: 2, muestrasComparables: 2, mismaCarga: true })).toEqual({
      rir: null,
      confianza: "baja",
      requierePregunta: true,
    });
  });

  it("automatiza un patron repetido de alta confianza", () => {
    expect(estimarRirAutomaticoAlejandro({ repsObjetivo: 10, repsRealizadas: 11, rirHistoricoMediano: 1, muestrasComparables: 7, mismaCarga: true })).toEqual({
      rir: 2,
      confianza: "alta",
      requierePregunta: false,
    });
  });
});
