import { describe, expect, it } from "vitest";
import { combinarPerfilesGrupo } from "./perfil-grupal";
import type { PerfilEntrenamiento } from "./tipos";

const perfil = (id: string, extra: Partial<PerfilEntrenamiento> = {}): PerfilEntrenamiento => ({
  alumnoId: id, sexo: "masculino", edad: 30, ejerciciosRecientes: [], objetivoPrincipal: "hipertrofia",
  objetivoSecundario: null, diasDisponibles: 4, minutosSesion: 60, experiencia: "avanzado", cardioNivel: "alto",
  preferenciaEquipo: "indistinto", ayudasErgogenicas: "no", categoriaCompetencia: "ninguna",
  estiloEntrenamiento: "hibrido", intensidadDeseada: "estandar", molestias: null, lesionesDiagnosticadas: null,
  condicionesMedicas: null, medicamentosRelevantes: null, operacionesPrevias: null, actividadesAdicionales: null,
  ejerciciosPreferidos: null, ejerciciosNoDeseados: null, requiereRevision: false, ...extra,
});

describe("combinarPerfilesGrupo", () => {
  it("calibra la rutina con el integrante menos experimentado y la mayor edad", () => {
    const grupo = combinarPerfilesGrupo([perfil("a"), perfil("b", { experiencia: "principiante", edad: 64, cardioNivel: "bajo" })]);
    expect(grupo.experiencia).toBe("principiante");
    expect(grupo.edad).toBe(64);
    expect(grupo.cardioNivel).toBe("bajo");
  });

  it("une antecedentes y ejercicios recientes de todos los integrantes", () => {
    const grupo = combinarPerfilesGrupo([
      perfil("a", { molestias: "hombro", ejerciciosRecientes: ["press"] }),
      perfil("b", { lesionesDiagnosticadas: "rodilla", ejerciciosRecientes: ["prensa"], requiereRevision: true }),
    ]);
    expect(grupo.molestias).toBe("hombro");
    expect(grupo.lesionesDiagnosticadas).toBe("rodilla");
    expect(grupo.ejerciciosRecientes).toEqual(["press", "prensa"]);
    expect(grupo.requiereRevision).toBe(true);
  });
});
