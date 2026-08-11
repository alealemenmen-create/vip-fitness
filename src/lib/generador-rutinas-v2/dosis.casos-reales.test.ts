import { describe, expect, it } from "vitest";
import { calcularDosisVipV2, type ResultadoMotorDosisV2 } from "@/lib/generador-rutinas-v2/dosis";
import { crearEntrevistaVipV2, GRUPOS_DOSIS_V2, type EntrevistaVipV2, type GrupoDosisV2 } from "@/lib/generador-rutinas-v2/tipos";

function baseSegura(): EntrevistaVipV2 {
  const entrevista = crearEntrevistaVipV2("caso-sombra");
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
  Object.assign(entrevista.recuperacion, { sueno: 3, energia: 3, estres: 3, doms: 3, apetito: 3 });
  Object.assign(entrevista.recursos, {
    diasReales: 4,
    minutosSesion: 60,
    equipo: "gimnasio_completo",
    supervision: "parcial",
  });
  entrevista.medicion.metricas = ["carga", "repeticiones", "rir", "fatiga"];
  entrevista.medicion.revisionCadaSemanas = 4;
  return entrevista;
}

function demostrarNivel(entrevista: EntrevistaVipV2, nivel: "intermedio" | "avanzado") {
  Object.assign(entrevista.experiencia, {
    practicaConsistenteMeses: nivel === "avanzado" ? 36 : 12,
    tecnicaReproducible: "si",
    estimaRir: "si",
    registraCargas: nivel === "avanzado" ? "si" : "no",
    autorregula: nivel === "avanzado" ? "si" : "no",
    nivelDeclarado: nivel,
  });
}

function historial(entrevista: EntrevistaVipV2, series: number) {
  entrevista.dosisReciente.estadoHistorial = "con_historial";
  entrevista.dosisReciente.semanasObservadas = 6;
  entrevista.dosisReciente.adherenciaPorcentaje = 90;
  for (const grupo of GRUPOS_DOSIS_V2) entrevista.dosisReciente.seriesPorGrupo[grupo] = series;
}

function grupo(resultado: ResultadoMotorDosisV2, nombre: GrupoDosisV2) {
  return resultado.dosisPorGrupo.find((item) => item.grupo === nombre)!;
}

type CasoSombra = {
  id: string;
  preparar: (entrevista: EntrevistaVipV2) => void;
  verificar: (resultado: ResultadoMotorDosisV2) => void;
};

const CASOS_SOMBRA: CasoSombra[] = [
  {
    id: "caso-001 · antecedentes de alarma",
    preparar: (entrevista) => { entrevista.seguridad.sintomasAlarma = "si"; },
    verificar: (resultado) => expect(resultado.estado).toBe("no_disponible"),
  },
  {
    id: "caso-002 · Classic Physique avanzado",
    preparar: (entrevista) => {
      demostrarNivel(entrevista, "avanzado"); historial(entrevista, 8);
      entrevista.objetivo.principal = "competencia";
      Object.assign(entrevista.competencia, { compite: "si", division: "classic_physique", fase: "preparacion_general", fechaEvento: "2027-01-15" });
      Object.assign(entrevista.recuperacion, { sueno: 4, energia: 4, estres: 4, doms: 4, apetito: 4 });
      Object.assign(entrevista.recursos, { diasReales: 5, minutosSesion: 75 });
    },
    verificar: (resultado) => {
      expect(resultado.estado).toBe("calculado");
      expect(grupo(resultado, "espalda").prioridad).toBe("prioridad");
      expect(resultado.intensidad.fallo).not.toBe("limitado_aislamientos");
    },
  },
  {
    id: "caso-003 · estructura coherente de tres días",
    preparar: (entrevista) => { Object.assign(entrevista.recursos, { diasReales: 3, minutosSesion: 60 }); },
    verificar: (resultado) => expect(resultado.estructura.diasRecomendados).toBe(3),
  },
  {
    id: "caso-004 · recomposición avanzada revisada",
    preparar: (entrevista) => {
      demostrarNivel(entrevista, "avanzado"); historial(entrevista, 8);
      entrevista.objetivo.principal = "recomposicion";
      Object.assign(entrevista.recursos, { diasReales: 5, minutosSesion: 70 });
    },
    verificar: (resultado) => {
      expect(resultado.estado).toBe("calculado");
      expect(resultado.estructura.diasRecomendados).toBe(5);
    },
  },
  {
    id: "caso-005 · adulto con tres meses de experiencia",
    preparar: (entrevista) => {
      entrevista.experiencia.practicaConsistenteMeses = 3;
      entrevista.recursos.diasReales = 5;
    },
    verificar: (resultado) => {
      expect(resultado.nivelExperiencia).toBe("novato");
      expect(resultado.estructura.diasRecomendados).toBe(3);
    },
  },
  {
    id: "caso-006 · principiante con técnicas densas previas",
    preparar: (entrevista) => {
      entrevista.objetivo.principal = "recomposicion";
      entrevista.recursos.diasReales = 4;
    },
    verificar: (resultado) => {
      expect(resultado.tecnicasAvanzadas.estado).toBe("no_habilitadas");
      expect(resultado.intensidad.fallo).toBe("no_habilitado");
    },
  },
  {
    id: "caso-007 · tres días con volumen comprimido",
    preparar: (entrevista) => {
      demostrarNivel(entrevista, "intermedio"); historial(entrevista, 16);
      Object.assign(entrevista.recursos, { diasReales: 3, minutosSesion: 60 });
    },
    verificar: (resultado) => {
      expect(resultado.alertas.join(" ")).toContain("no cabe");
      expect(Math.max(...resultado.dosisPorGrupo.map((item) => item.seriesDirectasSemanales.objetivo))).toBeLessThanOrEqual(14);
    },
  },
  {
    id: "caso-008 · recomposición con circuitos de agotamiento",
    preparar: (entrevista) => {
      demostrarNivel(entrevista, "intermedio"); historial(entrevista, 8);
      entrevista.objetivo.principal = "recomposicion";
      entrevista.preferencias.estiloComoInfluencia = "hibrido";
    },
    verificar: (resultado) => expect(resultado.tecnicasAvanzadas.estado).toBe("no_habilitadas"),
  },
  {
    id: "caso-009 · Wellness avanzada",
    preparar: (entrevista) => {
      demostrarNivel(entrevista, "avanzado"); historial(entrevista, 8);
      entrevista.objetivo.principal = "competencia";
      Object.assign(entrevista.competencia, { compite: "si", division: "wellness", fase: "preparacion_general", fechaEvento: "2027-02-01" });
      Object.assign(entrevista.recuperacion, { sueno: 4, energia: 4, estres: 4, doms: 4, apetito: 4 });
      Object.assign(entrevista.recursos, { diasReales: 5, minutosSesion: 75 });
      entrevista.preferencias.estiloComoInfluencia = "rir_autoregulado";
    },
    verificar: (resultado) => {
      expect(grupo(resultado, "gluteos").prioridad).toBe("prioridad");
      expect(resultado.intensidad.fallo).toBe("limitado_aislamientos");
      expect(grupo(resultado, "gluteos").seriesDirectasSemanales.objetivo).toBeLessThanOrEqual(18);
    },
  },
  {
    id: "caso-010 · déficit con seis días y cardio diario",
    preparar: (entrevista) => {
      demostrarNivel(entrevista, "avanzado"); historial(entrevista, 18);
      entrevista.objetivo.principal = "perdida_grasa";
      entrevista.dosisReciente.tendenciaRendimiento = "retroceso";
      Object.assign(entrevista.recuperacion, { sueno: 2, energia: 2, estres: 2, doms: 2, apetito: 2 });
      entrevista.recursos.diasReales = 6;
    },
    verificar: (resultado) => {
      expect(resultado.estructura.diasRecomendados).toBe(3);
      expect(resultado.intensidad.fallo).toBe("no_habilitado");
      expect(resultado.alertas.join(" ")).toContain("no añade circuitos de vaciado");
    },
  },
  {
    id: "caso-011 · dossier de volumen extremo",
    preparar: (entrevista) => { demostrarNivel(entrevista, "avanzado"); historial(entrevista, 30); },
    verificar: (resultado) => expect(resultado.alertas.join(" ")).toContain("supera el límite automático"),
  },
  {
    id: "caso-012 · tabla extrema sin presupuesto",
    preparar: (entrevista) => { historial(entrevista, 30); },
    verificar: (resultado) => expect(resultado.dosisPorGrupo.every((item) => item.seriesDirectasSemanales.objetivo <= 10)).toBe(true),
  },
  {
    id: "caso-013 · dupla con perfiles distintos",
    preparar: (entrevista) => { entrevista.persona.modalidad = "grupal"; },
    verificar: (resultado) => expect(resultado.alertas.join(" ")).toContain("no se comparten volumen"),
  },
  {
    id: "caso-014 · pérdida de grasa con vaciados diarios",
    preparar: (entrevista) => { entrevista.objetivo.principal = "perdida_grasa"; },
    verificar: (resultado) => {
      expect(resultado.alertas.join(" ")).toContain("no añade circuitos de vaciado");
      expect(resultado.cardio).toContain("módulo separado");
    },
  },
  {
    id: "caso-015 · meseta con rendimiento en retroceso",
    preparar: (entrevista) => {
      demostrarNivel(entrevista, "intermedio"); historial(entrevista, 10);
      entrevista.dosisReciente.tendenciaRendimiento = "retroceso";
    },
    verificar: (resultado) => expect(resultado.dosisPorGrupo.every((item) => (item.cambioRespectoAlHistorialPorcentaje ?? 0) <= 0)).toBe(true),
  },
  {
    id: "caso-016 · RIR cero y fallo global",
    preparar: (entrevista) => {
      demostrarNivel(entrevista, "avanzado"); historial(entrevista, 16);
      entrevista.dosisReciente.rirHabitual = 0;
      entrevista.preferencias.estiloComoInfluencia = "hit";
      Object.assign(entrevista.recuperacion, { sueno: 4, energia: 4, estres: 4, doms: 4, apetito: 4 });
    },
    verificar: (resultado) => {
      expect(resultado.intensidad.fallo).toBe("limitado_aislamientos");
      expect(resultado.tecnicasAvanzadas.regla).toContain("Máximo una técnica");
    },
  },
  {
    id: "caso-017 · acondicionamiento usado como sello",
    preparar: (entrevista) => {
      demostrarNivel(entrevista, "avanzado"); historial(entrevista, 10);
      entrevista.objetivo.principal = "recomposicion";
    },
    verificar: (resultado) => {
      expect(resultado.intensidad.fallo).toBe("no_habilitado");
      expect(resultado.cardio).toContain("no se usa como castigo");
    },
  },
  {
    id: "caso-018 · rutina genérica sin evaluación",
    preparar: (entrevista) => {
      Object.assign(entrevista.seguridad, {
        sintomasAlarma: "sin_responder",
        condicionInestable: "sin_responder",
        dolorActual: "sin_responder",
        cirugiaReciente: "sin_responder",
        caidasRecientes: "sin_responder",
        requiereCoordinacionProfesional: "sin_responder",
      });
      entrevista.objetivo.principal = null;
      entrevista.dosisReciente.estadoHistorial = "sin_responder";
    },
    verificar: (resultado) => expect(resultado.estado).toBe("no_disponible"),
  },
];

describe("calibración sombra con los 18 contenidos únicos auditados", () => {
  it("mantiene exactamente dieciocho casos anonimizados", () => {
    expect(CASOS_SOMBRA).toHaveLength(18);
  });

  it.each(CASOS_SOMBRA)("$id", ({ preparar, verificar }) => {
    const entrevista = baseSegura();
    preparar(entrevista);
    const resultado = calcularDosisVipV2(entrevista);
    verificar(resultado);
  });
});
