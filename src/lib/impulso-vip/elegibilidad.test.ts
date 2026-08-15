import { describe, expect, it } from "vitest";
import { evaluarTecnicaIntensiva } from "./elegibilidad";

const base = {
  ejercicioVinculado: true,
  perfilEjercicioRevisado: true,
  intensidadMaxima: "media" as const,
  tecnicasPermitidas: ["drop_set" as const],
  tecnicasConRetroceso: [],
  experiencia: "intermedio" as const,
  tieneRestriccionMedica: false,
  dolorActivo: false,
  registroConfiable: true,
  rirCalibracion: 2,
  tecnicasIntensasSesion: 0,
};

describe("evaluarTecnicaIntensiva", () => {
  it("permite drop set en un ejercicio y alumno aptos", () => {
    expect(evaluarTecnicaIntensiva(base).tecnica).toBe("drop_set");
  });

  it("bloquea a principiantes, dolor y registros sin numeros", () => {
    expect(evaluarTecnicaIntensiva({ ...base, experiencia: "principiante" }).tecnica).toBeNull();
    expect(evaluarTecnicaIntensiva({ ...base, dolorActivo: true }).tecnica).toBeNull();
    expect(evaluarTecnicaIntensiva({ ...base, registroConfiable: false }).tecnica).toBeNull();
  });

  it("bloquea ejercicios nuevos hasta que Alejandro revise su perfil", () => {
    const resultado = evaluarTecnicaIntensiva({ ...base, perfilEjercicioRevisado: false });
    expect(resultado.tecnica).toBeNull();
    expect(resultado.motivosBloqueo).toContain("perfil_ejercicio_sin_revisar");
  });

  it("permite hasta 3 tecnicas intensas por sesion, no mas", () => {
    expect(evaluarTecnicaIntensiva({ ...base, tecnicasIntensasSesion: 1 }).tecnica).toBe("drop_set");
    expect(evaluarTecnicaIntensiva({ ...base, tecnicasIntensasSesion: 2 }).tecnica).toBe("drop_set");
    expect(evaluarTecnicaIntensiva({ ...base, tecnicasIntensasSesion: 3 }).tecnica).toBeNull();
  });

  it("no repite una tecnica que la memoria marco para retroceder", () => {
    const resultado = evaluarTecnicaIntensiva({ ...base, tecnicasConRetroceso: ["drop_set"] });
    expect(resultado.tecnica).toBeNull();
    expect(resultado.motivosBloqueo).toContain("memoria_indica_retroceder");
  });

  it("reserva rest-pause para autorizacion alta y experiencia avanzada", () => {
    const resultado = evaluarTecnicaIntensiva({
      ...base,
      intensidadMaxima: "alta",
      experiencia: "avanzado",
      tecnicasPermitidas: ["rest_pause"],
    });
    expect(resultado).toMatchObject({ tecnica: "rest_pause", requiereSupervision: true });
  });

  it("fuerza supervision en las tres tecnicas intensas, sin importar configuracion del ejercicio", () => {
    expect(evaluarTecnicaIntensiva(base).requiereSupervision).toBe(true);
    const restPause = evaluarTecnicaIntensiva({
      ...base,
      intensidadMaxima: "alta",
      experiencia: "avanzado",
      tecnicasPermitidas: ["rest_pause"],
    });
    expect(restPause.requiereSupervision).toBe(true);
    const falloControlado = evaluarTecnicaIntensiva({
      ...base,
      intensidadMaxima: "alta",
      experiencia: "avanzado",
      tecnicasPermitidas: ["fallo_controlado"],
    });
    expect(falloControlado.requiereSupervision).toBe(true);
  });
});
