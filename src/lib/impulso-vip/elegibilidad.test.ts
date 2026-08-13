import { describe, expect, it } from "vitest";
import { evaluarTecnicaIntensiva } from "./elegibilidad";

const base = {
  ejercicioVinculado: true,
  perfilEjercicioRevisado: true,
  intensidadMaxima: "media" as const,
  tecnicasPermitidas: ["drop_set" as const],
  tecnicasConRetroceso: [],
  requiereSupervision: false,
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

  it("no agrega una segunda tecnica intensa en la misma sesion", () => {
    expect(evaluarTecnicaIntensiva({ ...base, tecnicasIntensasSesion: 1 }).tecnica).toBeNull();
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
      requiereSupervision: true,
    });
    expect(resultado).toMatchObject({ tecnica: "rest_pause", requiereSupervision: true });
  });
});
