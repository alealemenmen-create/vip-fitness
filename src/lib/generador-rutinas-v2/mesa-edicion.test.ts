import { describe, expect, it } from "vitest";
import type { ResultadoMotorDosisV2 } from "@/lib/generador-rutinas-v2/dosis";
import {
  VERSION_CONSTRUCTOR_SEMANAL_VIP_2,
  type DiaSemanaV2,
  type EjercicioSemanaV2,
  type ResultadoConstructorSemanalV2,
} from "@/lib/generador-rutinas-v2/constructor-semanal";
import {
  actualizarPrescripcionMesaV2,
  agregarEjercicioMesaV2,
  auditarMesaEdicionVipV2,
  eliminarEjercicioMesaV2,
  moverDiaMesaV2,
  moverEjercicioMesaV2,
  reemplazarEjercicioMesaV2,
} from "@/lib/generador-rutinas-v2/mesa-edicion";

function ejercicio(id: string, nombre: string, grupo: "pecho" | "espalda", series = 3): EjercicioSemanaV2 {
  return {
    orden: 1,
    ejercicioId: id,
    nombre,
    grupoDosis: grupo,
    patron: grupo === "pecho" ? "pecho_press_horizontal" : "espalda_remo_horizontal",
    series,
    repeticiones: "8–12",
    rir: "2–3",
    descansoSegundos: 90,
    motivo: "Compatible.",
    sustituciones: [],
  };
}

function diasBase(): DiaSemanaV2[] {
  const dia1 = [ejercicio("press", "Press", "pecho"), ejercicio("remo", "Remo", "espalda")];
  const dia2 = [ejercicio("press-inclinado", "Press inclinado", "pecho"), ejercicio("jalon", "Jalón", "espalda")];
  return [
    { numero: 1, nombre: "Superior A", enfoque: ["pecho", "espalda"], seriesDirectas: 6, minutosEstimados: 26, ejercicios: dia1.map((item, indice) => ({ ...item, orden: indice + 1 })) },
    { numero: 2, nombre: "Superior B", enfoque: ["pecho", "espalda"], seriesDirectas: 6, minutosEstimados: 26, ejercicios: dia2.map((item, indice) => ({ ...item, orden: indice + 1 })) },
  ];
}

function dosis(estado: ResultadoMotorDosisV2["estado"] = "calculado"): ResultadoMotorDosisV2 {
  return {
    version: 1,
    estado,
    razones: [],
    alertas: [],
    nivelExperiencia: "intermedio",
    recuperacion: { puntuacion: 4, calidad: "buena", ajusteAplicado: "Sin ajuste." },
    estructura: { diasRecomendados: 2, diasSugeridosMotor: 2, modoDistribucionDias: "recomendada", minutosPorSesion: 60, capacidadSeriesTrabajoPorSesion: 12, presupuestoSeriesDirectasSemanal: 24 },
    intensidad: {
      rirCompuestos: [2, 3],
      rirAislamientos: [1, 2],
      fallo: "no_habilitado",
      descansoCompuestosSegundos: [90, 150],
      descansoAislamientosSegundos: [60, 90],
    },
    tecnicasAvanzadas: { estado: "no_habilitadas", regla: "No se insertan." },
    dosisPorGrupo: [
      { grupo: "pecho", prioridad: "base", seriesDirectasRecientes: 6, seriesDirectasSemanales: { minimo: 4, objetivo: 6, maximoAutomatico: 8 }, frecuenciaSemanal: 2, maximoPorSesion: 4, cambioRespectoAlHistorialPorcentaje: 0 },
      { grupo: "espalda", prioridad: "base", seriesDirectasRecientes: 6, seriesDirectasSemanales: { minimo: 4, objetivo: 6, maximoAutomatico: 8 }, frecuenciaSemanal: 2, maximoPorSesion: 4, cambioRespectoAlHistorialPorcentaje: 0 },
    ],
    cardio: "Separado.",
    progresion: [],
    criteriosReduccion: [],
    revisionCadaSemanas: 4,
    supuestos: [],
  };
}

function borrador(estado: ResultadoConstructorSemanalV2["estado"] = "borrador"): ResultadoConstructorSemanalV2 {
  return {
    version: VERSION_CONSTRUCTOR_SEMANAL_VIP_2,
    estado,
    razones: [],
    alertas: [],
    reglasAplicadas: [],
    dias: diasBase(),
    auditoria: {
      seriesObjetivo: 12,
      seriesProgramadas: 12,
      minutosMaximosPermitidos: 60,
      minutosMaximosProgramados: 26,
      catalogoRecibido: 4,
      catalogoElegible: 4,
      porGrupo: [],
    },
  };
}

describe("Mesa de Edición VIP 2.0", () => {
  it("habilita aprobación cuando el borrador conserva dosis, frecuencia y tiempo", () => {
    const resultado = auditarMesaEdicionVipV2(diasBase(), dosis(), borrador());

    expect(resultado.estado).toBe("lista_para_aprobar");
    expect(resultado.puedeAprobar).toBe(true);
    expect(resultado.alertasBloqueantes).toEqual([]);
    expect(resultado.seriesEditadas).toBe(12);
  });

  it("bloquea una edición que rompe volumen y máximo por sesión", () => {
    const editados = actualizarPrescripcionMesaV2(diasBase(), 1, 1, { series: 6 });
    const resultado = auditarMesaEdicionVipV2(editados, dosis(), borrador());

    expect(resultado.estado).toBe("requiere_ajustes");
    expect(resultado.puedeAprobar).toBe(false);
    expect(resultado.alertasBloqueantes.join(" ")).toContain("series editadas");
    expect(resultado.alertasBloqueantes.join(" ")).toContain("máximo");
  });

  it("conserva la prescripción al reemplazar un ejercicio", () => {
    const editados = reemplazarEjercicioMesaV2(diasBase(), 1, 1, {
      ejercicioId: "press-maquina",
      nombre: "Press en máquina",
      grupoDosis: "pecho",
      patron: "pecho_press_horizontal",
      motivo: "Reemplazo compatible.",
      sustituciones: [],
    });

    expect(editados[0].ejercicios[0]).toMatchObject({ nombre: "Press en máquina", series: 3, repeticiones: "8–12", rir: "2–3", descansoSegundos: 90 });
    expect(auditarMesaEdicionVipV2(editados, dosis(), borrador()).puedeAprobar).toBe(true);
  });

  it("reordena ejercicios y días sin alterar la dosis", () => {
    const ejerciciosMovidos = moverEjercicioMesaV2(diasBase(), 1, 2, -1);
    const diasMovidos = moverDiaMesaV2(ejerciciosMovidos, 2, -1);

    expect(ejerciciosMovidos[0].ejercicios[0].nombre).toBe("Remo");
    expect(diasMovidos[0].nombre).toBe("Superior B");
    expect(auditarMesaEdicionVipV2(diasMovidos, dosis(), borrador()).puedeAprobar).toBe(true);
  });

  it("reaudita al eliminar y volver a agregar trabajo", () => {
    const eliminados = eliminarEjercicioMesaV2(diasBase(), 1, 1);
    expect(auditarMesaEdicionVipV2(eliminados, dosis(), borrador()).puedeAprobar).toBe(false);

    const restaurados = agregarEjercicioMesaV2(eliminados, 1, ejercicio("press-nuevo", "Press nuevo", "pecho"));
    expect(auditarMesaEdicionVipV2(restaurados, dosis(), borrador()).puedeAprobar).toBe(true);
  });

  it("mantiene bloqueada una propuesta provisional aunque cuadre matemáticamente", () => {
    const resultado = auditarMesaEdicionVipV2(diasBase(), dosis("provisional_revision"), borrador("provisional_revision"));

    expect(resultado.estado).toBe("bloqueada_revision");
    expect(resultado.puedeAprobar).toBe(false);
    expect(resultado.advertencias.join(" ")).toContain("adaptación");
  });
});
