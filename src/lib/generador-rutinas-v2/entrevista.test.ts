import { describe, expect, it } from "vitest";
import { calcularNivelExperiencia, evaluarEntrevistaVipV2, evaluarSeguridad, preguntasPendientes } from "@/lib/generador-rutinas-v2/entrevista";
import { crearEntrevistaVipV2 } from "@/lib/generador-rutinas-v2/tipos";

describe("puerta de seguridad VIP 2.0", () => {
  it("bloquea síntomas de alarma", () => {
    const e = crearEntrevistaVipV2("alumno");
    Object.assign(e.seguridad, {
      sintomasAlarma: "si",
      condicionInestable: "no",
      dolorActual: "no",
      cirugiaReciente: "no",
      caidasRecientes: "no",
      requiereCoordinacionProfesional: "no",
    });
    expect(evaluarSeguridad(e).estado).toBe("bloqueado");
  });

  it("no confunde dolor actual con autorización automática", () => {
    const e = crearEntrevistaVipV2("alumno");
    Object.assign(e.seguridad, {
      sintomasAlarma: "no",
      condicionInestable: "no",
      dolorActual: "si",
      cirugiaReciente: "no",
      caidasRecientes: "no",
      requiereCoordinacionProfesional: "no",
    });
    expect(evaluarSeguridad(e).estado).toBe("requiere_revision");
  });
});

describe("clasificación multidimensional", () => {
  it("no convierte cumplir 30 años en una prescripción especial", () => {
    const e = crearEntrevistaVipV2("alumno");
    e.persona.edad = 30;
    e.persona.etapaVida = "adulto";
    expect(e.persona.contextos).toEqual(["ninguno"]);
  });

  it("calcula experiencia por competencia demostrada y no solo por años", () => {
    const e = crearEntrevistaVipV2("alumno");
    Object.assign(e.experiencia, {
      practicaConsistenteMeses: 60,
      tecnicaReproducible: "no",
      estimaRir: "no",
      registraCargas: "si",
      autorregula: "no",
      nivelDeclarado: "avanzado",
    });
    expect(calcularNivelExperiencia(e)).toBe("novato");
  });

  it("abre las preguntas de división, fase y fecha solo si compite", () => {
    const e = crearEntrevistaVipV2("alumno");
    e.competencia.compite = "no";
    expect(preguntasPendientes(e)).not.toContain("Elegir la división competitiva.");
    e.competencia.compite = "si";
    expect(preguntasPendientes(e)).toEqual(expect.arrayContaining([
      "Elegir la división competitiva.",
      "Indicar la fase competitiva.",
      "Registrar la fecha del evento.",
    ]));
  });

  it("no permite construir la semana sin volumen reciente y recuperación", () => {
    const e = crearEntrevistaVipV2("alumno");
    e.objetivo.principal = "hipertrofia";
    const resultado = evaluarEntrevistaVipV2(e);
    expect(resultado.puedeCalcularDosis).toBe(false);
    expect(resultado.puedeConstruirSemana).toBe(false);
    expect(resultado.confianza).toBe("baja");
  });

  it("acepta declarar novato o retorno sin inventar cuatro semanas de historial", () => {
    const e = crearEntrevistaVipV2("alumno");
    e.dosisReciente.estadoHistorial = "novato_sin_historial";
    expect(preguntasPendientes(e)).not.toContain("Registrar al menos cuatro semanas de entrenamiento reciente.");
  });

  it("habilita la construcción solo cuando la entrevista crítica está completa", () => {
    const e = crearEntrevistaVipV2("alumno");
    Object.assign(e.seguridad, {
      sintomasAlarma: "no",
      condicionInestable: "no",
      dolorActual: "no",
      cirugiaReciente: "no",
      caidasRecientes: "no",
      requiereCoordinacionProfesional: "no",
    });
    Object.assign(e.funcion, { movilidad: "sin_limitacion", estabilidad: "sin_limitacion", rangoActivo: "sin_limitacion" });
    Object.assign(e.experiencia, { practicaConsistenteMeses: 12, tecnicaReproducible: "si", estimaRir: "si" });
    e.objetivo.principal = "hipertrofia";
    e.competencia.compite = "no";
    e.dosisReciente.estadoHistorial = "con_historial";
    e.dosisReciente.semanasObservadas = 4;
    Object.assign(e.recuperacion, { sueno: 3, energia: 3, estres: 3, doms: 3 });
    Object.assign(e.recursos, { diasReales: 4, minutosSesion: 60, equipo: "gimnasio_completo", supervision: "parcial" });
    e.medicion.metricas = ["carga", "repeticiones", "rir"];
    e.medicion.revisionCadaSemanas = 4;

    expect(evaluarEntrevistaVipV2(e)).toMatchObject({
      estadoSeguridad: "habilitado",
      puedeCalcularDosis: true,
      puedeConstruirSemana: true,
      confianza: "alta",
      preguntasPendientes: [],
    });
  });
});
