import { describe, expect, it } from "vitest";
import { CONFIGURACION_ESTUDIO_VIP_INICIAL, normalizarConfiguracionEstudioVip } from "./configuracion";

describe("normalizarConfiguracionEstudioVip", () => {
  it("conserva Entrenamiento visible aunque intenten ocultarlo", () => {
    const resultado = normalizarConfiguracionEstudioVip({ navegacion: [{ id: "entrenamiento", etiqueta: "Plan", visible: false }] });
    expect(resultado.navegacion.find((item) => item.id === "entrenamiento")).toEqual({ id: "entrenamiento", etiqueta: "Plan", visible: true });
  });

  it("descarta colores y enlaces inseguros", () => {
    const resultado = normalizarConfiguracionEstudioVip({
      tema: { colorAcento: "red", colorFondo: "#123456" },
      entrenamiento: { imagenPortadaUrl: "javascript:alert(1)", aviso: { botonHref: "//sitio.test" } },
    });
    expect(resultado.tema.colorAcento).toBe(CONFIGURACION_ESTUDIO_VIP_INICIAL.tema.colorAcento);
    expect(resultado.tema.colorFondo).toBe("#123456");
    expect(resultado.entrenamiento.imagenPortadaUrl).toBe("");
    expect(resultado.entrenamiento.aviso.botonHref).toBe("");
  });

  it("respeta el orden único y completa secciones faltantes", () => {
    const resultado = normalizarConfiguracionEstudioVip({ navegacion: [{ id: "mas", etiqueta: "Cuenta", visible: true }, { id: "entrenamiento", etiqueta: "Entrenar", visible: true }] });
    expect(resultado.navegacion.map((item) => item.id)).toEqual(["mas", "entrenamiento", "nutricion", "progreso"]);
  });
});
