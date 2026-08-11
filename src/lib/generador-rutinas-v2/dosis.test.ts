import { describe, expect, it } from "vitest";
import { calcularDosisVipV2 } from "@/lib/generador-rutinas-v2/dosis";
import { crearEntrevistaVipV2, GRUPOS_DOSIS_V2, type EntrevistaVipV2 } from "@/lib/generador-rutinas-v2/tipos";

function entrevistaCalculable(): EntrevistaVipV2 {
  const entrevista = crearEntrevistaVipV2("caso-prueba");
  Object.assign(entrevista.seguridad, {
    sintomasAlarma: "no",
    condicionInestable: "no",
    dolorActual: "no",
    cirugiaReciente: "no",
    caidasRecientes: "no",
    requiereCoordinacionProfesional: "no",
  });
  Object.assign(entrevista.funcion, {
    movilidad: "sin_limitacion",
    estabilidad: "sin_limitacion",
    rangoActivo: "sin_limitacion",
  });
  Object.assign(entrevista.experiencia, {
    practicaConsistenteMeses: 0,
    tecnicaReproducible: "no",
    estimaRir: "no",
    registraCargas: "no",
    autorregula: "no",
    nivelDeclarado: "novato",
  });
  entrevista.objetivo.principal = "hipertrofia";
  entrevista.competencia.compite = "no";
  entrevista.dosisReciente.estadoHistorial = "novato_sin_historial";
  Object.assign(entrevista.recuperacion, {
    sueno: 3,
    energia: 3,
    estres: 3,
    doms: 3,
    apetito: 3,
  });
  Object.assign(entrevista.recursos, {
    diasReales: 5,
    minutosSesion: 60,
    equipo: "gimnasio_completo",
    supervision: "parcial",
  });
  entrevista.medicion.metricas = ["carga", "repeticiones", "rir", "fatiga"];
  entrevista.medicion.revisionCadaSemanas = 4;
  return entrevista;
}

describe("Motor de Dosis VIP 2.0", () => {
  it("no calcula cuando la puerta de seguridad está bloqueada", () => {
    const entrevista = entrevistaCalculable();
    entrevista.seguridad.sintomasAlarma = "si";

    const resultado = calcularDosisVipV2(entrevista);

    expect(resultado.estado).toBe("no_disponible");
    expect(resultado.dosisPorGrupo).toEqual([]);
    expect(resultado.intensidad.fallo).toBe("no_habilitado");
  });

  it("inicia al novato con máximo tres días, margen de RIR y sin técnicas avanzadas", () => {
    const resultado = calcularDosisVipV2(entrevistaCalculable());

    expect(resultado.estado).toBe("calculado");
    expect(resultado.estructura.diasRecomendados).toBe(3);
    expect(resultado.intensidad.rirCompuestos).toEqual([3, 4]);
    expect(resultado.intensidad.fallo).toBe("no_habilitado");
    expect(resultado.tecnicasAvanzadas.estado).toBe("no_habilitadas");
    expect(Math.max(...resultado.dosisPorGrupo.map((grupo) => grupo.seriesDirectasSemanales.objetivo))).toBeLessThanOrEqual(10);
  });

  it("permite distribuir manualmente la dosis de un novato en cinco días sin aumentar el volumen semanal", () => {
    const recomendada = calcularDosisVipV2(entrevistaCalculable());
    const entrevistaManual = entrevistaCalculable();
    entrevistaManual.recursos.modoDistribucionDias = "manual";
    entrevistaManual.recursos.diasReales = 5;

    const manual = calcularDosisVipV2(entrevistaManual);
    const volumenRecomendado = recomendada.dosisPorGrupo.reduce((total, grupo) => total + grupo.seriesDirectasSemanales.objetivo, 0);
    const volumenManual = manual.dosisPorGrupo.reduce((total, grupo) => total + grupo.seriesDirectasSemanales.objetivo, 0);

    expect(manual.estructura.diasRecomendados).toBe(5);
    expect(manual.estructura.diasSugeridosMotor).toBe(3);
    expect(manual.estructura.modoDistribucionDias).toBe("manual");
    expect(volumenManual).toBe(volumenRecomendado);
    expect(manual.alertas.join(" ")).toContain("La dosis semanal no aumenta");
  });

  it("nunca aumenta más de 20% sobre un historial válido", () => {
    const entrevista = entrevistaCalculable();
    Object.assign(entrevista.experiencia, {
      practicaConsistenteMeses: 36,
      tecnicaReproducible: "si",
      estimaRir: "si",
      registraCargas: "si",
      autorregula: "si",
      nivelDeclarado: "avanzado",
    });
    entrevista.dosisReciente.estadoHistorial = "con_historial";
    entrevista.dosisReciente.semanasObservadas = 6;
    entrevista.dosisReciente.tendenciaRendimiento = "mejora";
    entrevista.dosisReciente.adherenciaPorcentaje = 95;
    for (const grupo of GRUPOS_DOSIS_V2) entrevista.dosisReciente.seriesPorGrupo[grupo] = 8;
    Object.assign(entrevista.recuperacion, { sueno: 5, energia: 5, estres: 4, doms: 4, apetito: 4 });
    Object.assign(entrevista.recursos, { diasReales: 5, minutosSesion: 75 });

    const resultado = calcularDosisVipV2(entrevista);

    for (const grupo of resultado.dosisPorGrupo) {
      expect(grupo.cambioRespectoAlHistorialPorcentaje ?? 0).toBeLessThanOrEqual(20);
      expect(grupo.seriesDirectasSemanales.maximoAutomatico).toBeLessThanOrEqual(10);
    }
  });

  it("reduce la dosis cuando coinciden mala recuperación y retroceso", () => {
    const entrevista = entrevistaCalculable();
    entrevista.dosisReciente.estadoHistorial = "con_historial";
    entrevista.dosisReciente.semanasObservadas = 4;
    entrevista.dosisReciente.tendenciaRendimiento = "retroceso";
    for (const grupo of GRUPOS_DOSIS_V2) entrevista.dosisReciente.seriesPorGrupo[grupo] = 10;
    Object.assign(entrevista.recuperacion, { sueno: 2, energia: 2, estres: 2, doms: 2, apetito: 2 });

    const resultado = calcularDosisVipV2(entrevista);

    expect(resultado.recuperacion.calidad).toBe("baja");
    expect(resultado.estructura.diasRecomendados).toBe(3);
    expect(resultado.dosisPorGrupo.every((grupo) => grupo.seriesDirectasSemanales.objetivo < 10)).toBe(true);
    expect(resultado.intensidad.fallo).toBe("no_habilitado");
    expect(resultado.alertas.join(" ")).toContain("recuperación");
  });

  it("convierte una limitación funcional en dosis provisional", () => {
    const entrevista = entrevistaCalculable();
    entrevista.funcion.estabilidad = "limitado";

    const resultado = calcularDosisVipV2(entrevista);

    expect(resultado.estado).toBe("provisional_revision");
    expect(resultado.intensidad.fallo).toBe("no_habilitado");
    expect(resultado.alertas.join(" ")).toContain("adaptación");
  });

  it("prioriza la musculatura de Wellness sin copiar una plantilla extrema", () => {
    const entrevista = entrevistaCalculable();
    Object.assign(entrevista.experiencia, {
      practicaConsistenteMeses: 36,
      tecnicaReproducible: "si",
      estimaRir: "si",
      registraCargas: "si",
      autorregula: "si",
      nivelDeclarado: "avanzado",
    });
    entrevista.objetivo.principal = "competencia";
    Object.assign(entrevista.competencia, {
      compite: "si",
      division: "wellness",
      fase: "preparacion_general",
      fechaEvento: "2026-12-01",
    });
    entrevista.dosisReciente.estadoHistorial = "con_historial";
    entrevista.dosisReciente.semanasObservadas = 6;
    for (const grupo of GRUPOS_DOSIS_V2) entrevista.dosisReciente.seriesPorGrupo[grupo] = 6;
    Object.assign(entrevista.recuperacion, { sueno: 4, energia: 4, estres: 4, doms: 4, apetito: 4 });
    Object.assign(entrevista.recursos, { diasReales: 5, minutosSesion: 75 });

    const resultado = calcularDosisVipV2(entrevista);
    const porGrupo = Object.fromEntries(resultado.dosisPorGrupo.map((grupo) => [grupo.grupo, grupo]));

    expect(porGrupo.gluteos.prioridad).toBe("prioridad");
    expect(porGrupo.cuadriceps.prioridad).toBe("prioridad");
    expect(porGrupo.femorales.prioridad).toBe("prioridad");
    expect(porGrupo.gluteos.seriesDirectasSemanales.objetivo).toBeGreaterThan(porGrupo.pecho.seriesDirectasSemanales.objetivo);
    expect(porGrupo.gluteos.seriesDirectasSemanales.objetivo).toBeLessThanOrEqual(18);
  });

  it("marca y recorta un historial de volumen extremo", () => {
    const entrevista = entrevistaCalculable();
    entrevista.dosisReciente.estadoHistorial = "con_historial";
    entrevista.dosisReciente.semanasObservadas = 4;
    for (const grupo of GRUPOS_DOSIS_V2) entrevista.dosisReciente.seriesPorGrupo[grupo] = 30;

    const resultado = calcularDosisVipV2(entrevista);

    expect(Math.max(...resultado.dosisPorGrupo.map((grupo) => grupo.seriesDirectasSemanales.objetivo))).toBeLessThanOrEqual(10);
    expect(resultado.alertas.join(" ")).toContain("supera el límite automático");
    expect(resultado.alertas.join(" ")).toContain("no cabe");
  });

  it("no añade vaciados ni cardio terminal por seleccionar pérdida de grasa", () => {
    const entrevista = entrevistaCalculable();
    entrevista.objetivo.principal = "perdida_grasa";

    const resultado = calcularDosisVipV2(entrevista);

    expect(resultado.intensidad.rirCompuestos).toEqual([3, 4]);
    expect(resultado.alertas.join(" ")).toContain("no añade circuitos de vaciado");
    expect(resultado.cardio).toContain("módulo separado");
  });

  it("prohíbe compartir la dosis en modalidad grupal", () => {
    const entrevista = entrevistaCalculable();
    entrevista.persona.modalidad = "grupal";

    const resultado = calcularDosisVipV2(entrevista);

    expect(resultado.alertas.join(" ")).toContain("no se comparten volumen");
  });
});
