import { describe, expect, it } from "vitest";
import {
  fechaEnQuincenaActualValida,
  fechaEnVentanaValida,
  fechaPasadaValida,
  finQuincenaISO,
  hoyISO,
  lunesDeISO,
  quincenaDeISO,
  siguienteQuincenaISO,
  sumarDiasISO,
} from "./date";

describe("fechaEnVentanaValida", () => {
  it("acepta hoy y ayer", () => {
    expect(fechaEnVentanaValida(hoyISO())).toBe(true);
    expect(fechaEnVentanaValida(sumarDiasISO(hoyISO(), -1))).toBe(true);
  });

  it("rechaza cualquier fecha más atrás que ayer", () => {
    expect(fechaEnVentanaValida(sumarDiasISO(hoyISO(), -2))).toBe(false);
    expect(fechaEnVentanaValida(sumarDiasISO(hoyISO(), -30))).toBe(false);
    expect(fechaEnVentanaValida(sumarDiasISO(hoyISO(), -365))).toBe(false);
  });

  it("rechaza fechas futuras", () => {
    expect(fechaEnVentanaValida(sumarDiasISO(hoyISO(), 1))).toBe(false);
    expect(fechaEnVentanaValida(sumarDiasISO(hoyISO(), 30))).toBe(false);
  });

  it("rechaza texto que no es una fecha ISO válida", () => {
    expect(fechaEnVentanaValida("")).toBe(false);
    expect(fechaEnVentanaValida("no es una fecha")).toBe(false);
    expect(fechaEnVentanaValida("2026-8-5")).toBe(false);
    expect(fechaEnVentanaValida("05-08-2026")).toBe(false);
  });
});

describe("fechaPasadaValida", () => {
  it("acepta hoy y fechas viejas — es la fecha real de una foto de antes", () => {
    expect(fechaPasadaValida(hoyISO())).toBe(true);
    expect(fechaPasadaValida(sumarDiasISO(hoyISO(), -30))).toBe(true);
    expect(fechaPasadaValida(sumarDiasISO(hoyISO(), -700))).toBe(true);
  });

  it("rechaza el futuro", () => {
    expect(fechaPasadaValida(sumarDiasISO(hoyISO(), 1))).toBe(false);
  });

  it("rechaza lo absurdamente viejo", () => {
    expect(fechaPasadaValida(sumarDiasISO(hoyISO(), -365 * 11))).toBe(false);
  });

  it("rechaza texto que no es una fecha ISO válida", () => {
    expect(fechaPasadaValida("")).toBe(false);
    expect(fechaPasadaValida("2026-8-5")).toBe(false);
  });
});

describe("lunesDeISO", () => {
  it("un lunes es lunes de sí mismo", () => {
    // 2026-08-10 es lunes.
    expect(lunesDeISO("2026-08-10")).toBe("2026-08-10");
  });

  it("cualquier día de la semana cae en el mismo lunes", () => {
    expect(lunesDeISO("2026-08-11")).toBe("2026-08-10"); // martes
    expect(lunesDeISO("2026-08-14")).toBe("2026-08-10"); // viernes
    expect(lunesDeISO("2026-08-16")).toBe("2026-08-10"); // domingo
  });

  it("cruza de mes correctamente", () => {
    // 2026-08-31 es lunes; el domingo siguiente cae en septiembre.
    expect(lunesDeISO("2026-08-31")).toBe("2026-08-31");
    expect(lunesDeISO("2026-09-06")).toBe("2026-08-31");
    expect(lunesDeISO("2026-09-07")).toBe("2026-09-07");
  });
});

describe("quincenaDeISO", () => {
  it("días 1 a 15 caen en la quincena que arranca el 1", () => {
    expect(quincenaDeISO("2026-08-01")).toBe("2026-08-01");
    expect(quincenaDeISO("2026-08-08")).toBe("2026-08-01");
    expect(quincenaDeISO("2026-08-15")).toBe("2026-08-01");
  });

  it("días 16 a fin de mes caen en la quincena que arranca el 16", () => {
    expect(quincenaDeISO("2026-08-16")).toBe("2026-08-16");
    expect(quincenaDeISO("2026-08-25")).toBe("2026-08-16");
    expect(quincenaDeISO("2026-08-31")).toBe("2026-08-16");
  });

  it("cada mes es independiente", () => {
    expect(quincenaDeISO("2026-09-03")).toBe("2026-09-01");
    expect(quincenaDeISO("2026-02-16")).toBe("2026-02-16");
  });
});

describe("finQuincenaISO", () => {
  it("la primera quincena siempre termina el 15", () => {
    expect(finQuincenaISO("2026-08-01")).toBe("2026-08-15");
    expect(finQuincenaISO("2026-02-01")).toBe("2026-02-15");
  });

  it("la segunda quincena termina el último día real del mes", () => {
    expect(finQuincenaISO("2026-08-16")).toBe("2026-08-31"); // agosto: 31 días
    expect(finQuincenaISO("2026-09-16")).toBe("2026-09-30"); // septiembre: 30 días
    expect(finQuincenaISO("2026-02-16")).toBe("2026-02-28"); // 2026 no es bisiesto
    expect(finQuincenaISO("2028-02-16")).toBe("2028-02-29"); // 2028 sí es bisiesto
  });
});

describe("siguienteQuincenaISO", () => {
  it("de la primera quincena a la segunda, mismo mes", () => {
    expect(siguienteQuincenaISO("2026-08-01")).toBe("2026-08-16");
  });

  it("de la segunda quincena a la primera del mes siguiente", () => {
    expect(siguienteQuincenaISO("2026-08-16")).toBe("2026-09-01");
  });

  it("cruza de diciembre a enero del año siguiente", () => {
    expect(siguienteQuincenaISO("2026-12-16")).toBe("2027-01-01");
  });
});

describe("fechaEnQuincenaActualValida", () => {
  it("acepta cualquier día de la quincena en curso, incluido hoy", () => {
    const inicioActual = quincenaDeISO(hoyISO());
    expect(fechaEnQuincenaActualValida(hoyISO())).toBe(true);
    expect(fechaEnQuincenaActualValida(inicioActual)).toBe(true);
  });

  it("rechaza la quincena pasada, aunque sea de hace un día", () => {
    const inicioActual = quincenaDeISO(hoyISO());
    const diaAnterior = sumarDiasISO(inicioActual, -1);
    expect(fechaEnQuincenaActualValida(diaAnterior)).toBe(false);
  });

  it("rechaza el futuro", () => {
    expect(fechaEnQuincenaActualValida(sumarDiasISO(hoyISO(), 1))).toBe(false);
  });

  it("rechaza texto que no es una fecha ISO válida", () => {
    expect(fechaEnQuincenaActualValida("")).toBe(false);
    expect(fechaEnQuincenaActualValida("2026-8-5")).toBe(false);
  });
});
