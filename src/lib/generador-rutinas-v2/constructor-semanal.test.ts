import { describe, expect, it } from "vitest";
import {
  construirSemanaVipV2,
  seleccionarDivisionSemanalVipV2,
  type EjercicioConstructorV2,
} from "@/lib/generador-rutinas-v2/constructor-semanal";
import { calcularDosisVipV2 } from "@/lib/generador-rutinas-v2/dosis";
import { crearEntrevistaVipV2, type EntrevistaVipV2 } from "@/lib/generador-rutinas-v2/tipos";
import type { PatronMovimiento } from "@/lib/rutinas/patrones";

function entrevistaCalculable(): EntrevistaVipV2 {
  const entrevista = crearEntrevistaVipV2("constructor-prueba");
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
    diasReales: 3,
    minutosSesion: 60,
    equipo: "gimnasio_completo",
    supervision: "parcial",
  });
  entrevista.medicion.metricas = ["carga", "repeticiones", "rir", "fatiga"];
  entrevista.medicion.revisionCadaSemanas = 4;
  return entrevista;
}

function ejercicio(
  id: string,
  nombre: string,
  grupoMuscular: EjercicioConstructorV2["grupoMuscular"],
  patron: PatronMovimiento,
  extras: Partial<EjercicioConstructorV2> = {},
): EjercicioConstructorV2 {
  return {
    id,
    nombre,
    aliases: [],
    grupoMuscular,
    categoria: grupoMuscular === "piernas" ? "pierna" : grupoMuscular === "core" ? "core" : "aislamiento",
    equipo: "maquina",
    nivel: "principiante",
    patron,
    impacto: "bajo",
    requiereSalto: false,
    complejidad: "baja",
    requiereSupervision: false,
    posicionSesion: "accesorio",
    etiquetasPrecaucion: [],
    ...extras,
  };
}

function catalogoCompleto(): EjercicioConstructorV2[] {
  return [
    ejercicio("press-maquina", "Press de pecho en máquina", "pecho", "pecho_press_horizontal", { posicionSesion: "principal", categoria: "empuje" }),
    ejercicio("press-inclinado", "Press inclinado en máquina", "pecho", "pecho_press_inclinado", { posicionSesion: "principal", categoria: "empuje" }),
    ejercicio("apertura", "Apertura en máquina", "pecho", "pecho_aislamiento"),
    ejercicio("jalon", "Jalón al pecho", "espalda", "espalda_traccion_vertical", { posicionSesion: "principal", categoria: "traccion" }),
    ejercicio("remo", "Remo sentado", "espalda", "espalda_remo_horizontal", { posicionSesion: "principal", categoria: "traccion" }),
    ejercicio("pullover", "Pullover en polea", "espalda", "espalda_pullover", { equipo: "polea" }),
    ejercicio("press-hombro", "Press de hombros", "hombros", "hombro_press_vertical", { posicionSesion: "principal", categoria: "empuje" }),
    ejercicio("lateral", "Elevación lateral", "hombros", "hombro_lateral", { equipo: "mancuerna" }),
    ejercicio("posterior", "Deltoide posterior", "hombros", "hombro_posterior"),
    ejercicio("curl", "Curl de bíceps", "brazos", "biceps_supinado", { equipo: "mancuerna" }),
    ejercicio("martillo", "Curl martillo", "brazos", "biceps_neutro", { equipo: "mancuerna" }),
    ejercicio("triceps", "Extensión de tríceps", "brazos", "triceps_polea_abajo", { equipo: "polea" }),
    ejercicio("sentadilla", "Sentadilla guiada", "piernas", "pierna_dominante_rodilla", { posicionSesion: "principal", categoria: "pierna", equipo: "smith" }),
    ejercicio("prensa", "Prensa de piernas", "piernas", "pierna_dominante_rodilla", { posicionSesion: "principal", categoria: "pierna" }),
    ejercicio("extension", "Extensión de cuádriceps", "piernas", "pierna_extension_rodilla", { categoria: "aislamiento" }),
    ejercicio("rumano", "Peso muerto rumano", "piernas", "pierna_bisagra_cadera", { posicionSesion: "principal", categoria: "pierna", equipo: "mancuerna" }),
    ejercicio("curl-femoral", "Curl femoral", "piernas", "pierna_flexion_rodilla"),
    ejercicio("hip-thrust", "Hip thrust en máquina", "piernas", "pierna_empuje_cadera", { posicionSesion: "principal", categoria: "pierna" }),
    ejercicio("abduccion", "Abducción en máquina", "piernas", "pierna_abduccion"),
    ejercicio("gemelos", "Elevación de gemelos", "piernas", "pierna_pantorrilla"),
    ejercicio("gemelos-prensa", "Gemelos en prensa", "piernas", "pierna_pantorrilla"),
    ejercicio("plancha", "Plancha frontal", "core", "core", { equipo: "peso_corporal" }),
    ejercicio("crunch", "Crunch en máquina", "core", "core"),
    ejercicio("salto", "Sentadilla con salto", "piernas", "pierna_dominante_rodilla", { impacto: "alto", requiereSalto: true, complejidad: "alta" }),
    ejercicio("supervisado", "Press técnico supervisado", "pecho", "pecho_press_horizontal", { requiereSupervision: true }),
  ];
}

describe("Constructor Semanal Inteligente VIP 2.0", () => {
  it("convierte la dosis en una semana auditable sin superar sus objetivos", () => {
    const entrevista = entrevistaCalculable();
    const dosis = calcularDosisVipV2(entrevista);
    const semana = construirSemanaVipV2(entrevista, dosis, catalogoCompleto());

    expect(semana.estado).toBe("borrador");
    expect(semana.dias).toHaveLength(3);
    expect(semana.auditoria.seriesProgramadas).toBe(semana.auditoria.seriesObjetivo);
    expect(semana.auditoria.porGrupo.every((grupo) => grupo.cumple)).toBe(true);
    expect(semana.auditoria.minutosMaximosProgramados).toBeLessThanOrEqual(60);
    expect(semana.dias.flatMap((dia) => dia.ejercicios).some((item) => item.ejercicioId === "salto")).toBe(false);
  });

  it("construye cinco sesiones cuando el entrenador elige distribución manual", () => {
    const entrevista = entrevistaCalculable();
    entrevista.recursos.modoDistribucionDias = "manual";
    entrevista.recursos.diasReales = 5;
    const dosis = calcularDosisVipV2(entrevista);
    const semana = construirSemanaVipV2(entrevista, dosis, catalogoCompleto());

    expect(dosis.estructura.diasSugeridosMotor).toBe(3);
    expect(dosis.estructura.diasRecomendados).toBe(5);
    expect(semana.dias).toHaveLength(5);
    expect(semana.dias.every((dia) => dia.ejercicios.length > 0)).toBe(true);
    expect(semana.auditoria.seriesProgramadas).toBe(semana.auditoria.seriesObjetivo);
    expect(semana.dias.map((dia) => dia.nombre)).toEqual([
      "Pecho + tríceps",
      "Espalda + bíceps",
      "Cuádriceps + aductores",
      "Hombros + brazos",
      "Femoral + glúteos + abductores",
    ]);

    const gruposInferiores = new Set(["cuadriceps", "femorales", "gluteos", "pantorrillas"]);
    for (const dia of semana.dias.slice(0, 2).concat(semana.dias.slice(3, 4))) {
      expect(dia.enfoque.some((grupo) => gruposInferiores.has(grupo))).toBe(false);
    }
    for (const dia of [semana.dias[2], semana.dias[4]]) {
      expect(dia.enfoque.some((grupo) => ["pecho", "espalda"].includes(grupo))).toBe(false);
    }
    expect(semana.reglasAplicadas.join(" ")).toContain("antes de elegir ejercicios");
    expect(semana.dias[0].enfoque).toEqual(expect.arrayContaining(["pecho", "brazos"]));
    expect(semana.dias[1].enfoque).toEqual(expect.arrayContaining(["espalda", "brazos"]));
    expect(semana.dias[0].ejercicios.filter((item) => item.grupoDosis === "brazos").every((item) => item.patron.startsWith("triceps"))).toBe(true);
    expect(semana.dias[1].ejercicios.filter((item) => item.grupoDosis === "brazos").every((item) => item.patron.startsWith("biceps"))).toBe(true);
    expect(semana.dias.slice(0, 2).concat(semana.dias.slice(3, 4)).some((dia) => dia.enfoque.includes("core"))).toBe(false);
  });

  it("aplica la secuencia Wellness de tres inferiores y dos superiores", () => {
    const entrevista = entrevistaCalculable();
    entrevista.recursos.modoDistribucionDias = "manual";
    entrevista.recursos.diasReales = 5;
    Object.assign(entrevista.competencia, {
      compite: "si",
      division: "wellness",
      fase: "preparacion_general",
      fechaEvento: "2027-06-01",
    });

    const division = seleccionarDivisionSemanalVipV2(entrevista, 5);
    const semana = construirSemanaVipV2(entrevista, calcularDosisVipV2(entrevista), catalogoCompleto());

    expect(division.categoria).toBe("wellness");
    expect(semana.dias.map((dia) => dia.nombre)).toEqual([
      "Glúteos + cuádriceps",
      "Espalda + hombros",
      "Femoral + glúteos",
      "Tren superior completo",
      "Cuádriceps + glúteos",
    ]);
    expect(division.dias.filter((dia) => dia.grupos.includes("gluteos"))).toHaveLength(3);
    expect(division.dias.filter((dia) => dia.grupos.includes("espalda"))).toHaveLength(2);
    expect(semana.auditoria.porGrupo.every((grupo) => grupo.cumple)).toBe(true);
  });

  it("respeta ejercicios no deseados y entrega reemplazos compatibles", () => {
    const entrevista = entrevistaCalculable();
    entrevista.preferencias.ejerciciosNoDeseados = "prensa de piernas";
    const semana = construirSemanaVipV2(entrevista, calcularDosisVipV2(entrevista), catalogoCompleto());
    const ejercicios = semana.dias.flatMap((dia) => dia.ejercicios);

    expect(ejercicios.some((item) => item.nombre === "Prensa de piernas")).toBe(false);
    expect(ejercicios.some((item) => item.sustituciones.length > 0)).toBe(true);
    expect(ejercicios.flatMap((item) => item.sustituciones).some((item) => item.nombre === "Prensa de piernas")).toBe(false);
  });

  it("filtra el catálogo según el equipo disponible en casa", () => {
    const entrevista = entrevistaCalculable();
    entrevista.recursos.equipo = "casa";
    const semana = construirSemanaVipV2(entrevista, calcularDosisVipV2(entrevista), catalogoCompleto());
    const permitidos = new Set(["peso_corporal", "banda", "mancuerna", "kettlebell", "banco", "otro"]);
    const catalogo = new Map(catalogoCompleto().map((item) => [item.id, item]));

    for (const item of semana.dias.flatMap((dia) => dia.ejercicios)) {
      expect(permitidos.has(catalogo.get(item.ejercicioId)!.equipo)).toBe(true);
    }
    expect(semana.alertas.length).toBeGreaterThan(0);
  });

  it("mantiene como provisional una semana con limitación funcional", () => {
    const entrevista = entrevistaCalculable();
    entrevista.funcion.estabilidad = "limitado";
    const dosis = calcularDosisVipV2(entrevista);
    const semana = construirSemanaVipV2(entrevista, dosis, catalogoCompleto());

    expect(dosis.estado).toBe("provisional_revision");
    expect(semana.estado).toBe("provisional_revision");
    expect(semana.razones.join(" ")).toContain("adaptaciones");
  });

  it("no inventa ejercicios cuando el catálogo no cubre la dosis", () => {
    const entrevista = entrevistaCalculable();
    const semana = construirSemanaVipV2(entrevista, calcularDosisVipV2(entrevista), []);

    expect(semana.auditoria.seriesProgramadas).toBe(0);
    expect(semana.alertas.join(" ")).toContain("catálogo");
    expect(semana.auditoria.porGrupo.some((grupo) => !grupo.cumple)).toBe(true);
  });

  it("concentra la dosis cuando solo existe una variante y no duplica filas", () => {
    const entrevista = entrevistaCalculable();
    const catalogo = catalogoCompleto().filter((item) => item.id !== "gemelos-prensa");
    const dosis = calcularDosisVipV2(entrevista);
    const semana = construirSemanaVipV2(entrevista, dosis, catalogo);

    for (const dia of semana.dias) {
      const ids = dia.ejercicios.map((item) => item.ejercicioId);
      expect(new Set(ids).size).toBe(ids.length);
    }
    const pantorrillas = semana.dias.flatMap((dia) => dia.ejercicios).filter((item) => item.grupoDosis === "pantorrillas");
    expect(pantorrillas).toHaveLength(1);
    expect(pantorrillas[0].series).toBe(dosis.dosisPorGrupo.find((item) => item.grupo === "pantorrillas")?.seriesDirectasSemanales.objetivo);
  });
});
