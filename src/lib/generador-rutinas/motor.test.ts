import { describe, expect, it } from "vitest";
import { diaLlevaTecnica, ejerciciosObjetivoDelDia, ejerciciosPorTiempo, generarRutinaPorReglas, indicacionTecnica, maximoTecnicasPorSesion, modalidadesCardioDisponibles } from "./motor";
import type { BriefGenerador, EjercicioGenerador, PerfilEntrenamiento, TecnicaEntrenamiento } from "./tipos";

const perfil: PerfilEntrenamiento = {
  alumnoId: "a",
  sexo: null,
  edad: null,
  ejerciciosRecientes: [],
  objetivoPrincipal: "hipertrofia",
  objetivoSecundario: null,
  diasDisponibles: 3,
  minutosSesion: 60,
  experiencia: "intermedio",
  cardioNivel: "medio",
  preferenciaEquipo: "indistinto",
  ayudasErgogenicas: "no",
  categoriaCompetencia: "ninguna",
  estiloEntrenamiento: "hibrido",
  intensidadDeseada: "estandar",
  molestias: null,
  lesionesDiagnosticadas: null,
  condicionesMedicas: null,
  medicamentosRelevantes: null,
  operacionesPrevias: null,
  actividadesAdicionales: null,
  ejerciciosPreferidos: null,
  ejerciciosNoDeseados: null,
  requiereRevision: false,
};
const brief: BriefGenerador = {
  alumnoId: "a",
  objetivo: "hipertrofia",
  prioridad: "hipertrofia",
  dias: 3,
  minutosSesion: 60,
  distribucion: "automatica",
  diaGrupos: null,
  grupoPrioritario: null,
  enfoqueForma: "ninguno",
  ejerciciosPorSesion: 2,
  cardio: "caminadora",
  cardioMinutos: 10,
  cardioEjercicios: [],
  cardioFormato: "circuito",
  abdominales: false,
  evitarSaltos: true,
  obligatorios: [],
  prohibidos: [],
  preferidos: [],
  tecnicaNombre: null,
  estiloEntrenamiento: "hibrido",
  ayudasErgogenicas: "no",
  categoriaCompetencia: "ninguna",
  intensidadDeseada: "estandar",
  tecnicasIntensidad: "automatico",
  tecnicasPermitidas: [],
  inspiracionEstilo: "ninguna",
  observaciones: "",
};
const base = (id: string, grupoMuscular: EjercicioGenerador["grupoMuscular"], categoria: EjercicioGenerador["categoria"], extra = {}): EjercicioGenerador => ({ id, nombre: id, grupoMuscular, categoria, equipo: "maquina", nivel: "principiante", posicionSesion: "principal", ...extra });
const biblioteca = [base("pecho", "pecho", "empuje"), base("espalda", "espalda", "traccion"), base("pierna", "piernas", "pierna"), base("salto", "cardio", "cardio", { requiereSalto: true }), base("bici", "cardio", "cardio")];

describe("generarRutinaPorReglas", () => {
  it("impide el borrador incoherente reportado: pecho sin press, espalda sin remo y patrones traducidos repetidos", () => {
    const e = (id: string, nombre: string, grupoMuscular: EjercicioGenerador["grupoMuscular"], categoria: EjercicioGenerador["categoria"], posicionSesion: EjercicioGenerador["posicionSesion"] = "principal") =>
      base(id, grupoMuscular, categoria, { nombre, posicionSesion });
    const bibliotecaRealista = [
      e("fly-plano", "Aperturas con mancuernas", "pecho", "aislamiento"),
      e("fly-inclinado", "Aperturas con mancuernas inclinado", "pecho", "aislamiento"),
      e("fly-polea", "Aperturas en polea", "pecho", "aislamiento"),
      e("press-maquina", "Press de pecho en máquina", "pecho", "empuje", "accesorio"),
      e("press-inclinado", "Press inclinado con mancuernas", "pecho", "empuje", "accesorio"),
      e("buenos-dias", "Buenos días", "espalda", "traccion"),
      e("dominadas", "Dominadas", "espalda", "traccion"),
      e("shrugs", "Encogimiento de hombros", "espalda", "traccion"),
      e("jalon-neutro", "Jalón al pecho agarre neutro", "espalda", "traccion"),
      e("jalon-cerrado", "Jalón al pecho agarre cerrado", "espalda", "traccion"),
      e("remo-polea", "Remo en polea baja", "espalda", "traccion", "accesorio"),
      e("pullover", "Pullover en polea alta", "espalda", "traccion", "accesorio"),
      e("triceps-abajo", "Extensión de tríceps en polea", "brazos", "aislamiento"),
      e("triceps-cabeza", "Extensión de tríceps sobre la cabeza", "brazos", "aislamiento"),
      e("triceps-overhead", "Extensión de tríceps overhead con cuerda", "brazos", "aislamiento"),
      e("fondos", "Fondos en paralelas", "brazos", "empuje"),
      e("curl-barra", "Curl de bíceps con barra", "brazos", "aislamiento"),
      e("curl-martillo", "Curl martillo", "brazos", "aislamiento"),
      e("curl-inclinado", "Curl inclinado", "brazos", "aislamiento"),
      e("aductor", "Aductor en máquina", "piernas", "aislamiento"),
      e("belt", "Belt squat", "piernas", "pierna", "accesorio"),
      e("rumano", "Peso muerto rumano", "piernas", "pierna", "accesorio"),
      e("press-hombro", "Press de hombros", "hombros", "empuje", "accesorio"),
      e("lateral", "Elevación lateral", "hombros", "aislamiento"),
      e("face", "Face pull", "hombros", "aislamiento"),
      e("pajaro", "Pájaro con mancuernas", "hombros", "aislamiento"),
    ];
    const r = generarRutinaPorReglas(
      { ...perfil, experiencia: "avanzado" },
      { ...brief, dias: 5, distribucion: "vip_balanceada", ejerciciosPorSesion: 8, cardio: "ninguno", intensidadDeseada: "alta" },
      bibliotecaRealista
    );

    const dia1 = r.dias[0].ejercicios;
    expect(dia1.filter((x) => x.grupoMuscular === "pecho").map((x) => x.nombre)).toEqual(expect.arrayContaining(["Press de pecho en máquina", "Press inclinado con mancuernas"]));
    const dia2Espalda = r.dias[1].ejercicios.filter((x) => x.grupoMuscular === "espalda").map((x) => x.nombre);
    expect(dia2Espalda.some((n) => /Dominadas|Jalón/.test(n))).toBe(true);
    expect(dia2Espalda.some((n) => /Remo/.test(n))).toBe(true);
    const dia2Triceps = r.dias[1].ejercicios.filter((x) => x.grupoMuscular === "brazos").map((x) => x.nombre);
    expect(dia2Triceps.filter((n) => /sobre la cabeza|overhead/i.test(n))).toHaveLength(1);
    const piernasDia3 = r.dias[2].ejercicios.filter((x) => x.grupoMuscular === "piernas");
    expect(piernasDia3[0].nombre).not.toBe("Aductor en máquina");
    const dia4Pecho = r.dias[3].ejercicios.filter((x) => x.grupoMuscular === "pecho").map((x) => x.nombre);
    expect(dia4Pecho.some((n) => /Press/.test(n))).toBe(true);
  });

  it("incorpora activación e indicaciones técnicas como las rutinas reales de Alejandro", () => {
    const r = generarRutinaPorReglas(perfil, { ...brief, cardio: "ninguno" }, biblioteca);
    expect(r.dias.every((dia) => dia.descripcion?.startsWith("Activación:"))).toBe(true);
    expect(r.dias.flatMap((dia) => dia.ejercicios).every((e) => Boolean(e.observacion))).toBe(true);
    expect(indicacionTecnica("Peso muerto rumano", "piernas")).toContain("columna neutra");
  });

  it("periodiza repeticiones y descanso en compuestos avanzados de alta intensidad", () => {
    const r = generarRutinaPorReglas(
      { ...perfil, experiencia: "avanzado" },
      { ...brief, dias: 1, distribucion: "personalizada", diaGrupos: [["pecho"]], ejerciciosPorSesion: 1, cardio: "ninguno", intensidadDeseada: "alta" },
      [base("press-avanzado", "pecho", "empuje", { equipo: "barra" })]
    );
    expect(r.dias[0].ejercicios[0]).toMatchObject({ series: 5, reps: "15-12-10-8-8", descansoSegundos: 120 });
  });

  it("Wellness cambia el énfasis semanal sin convertir el objetivo en pérdida de grasa", () => {
    const bibliotecaCategoria = [
      base("press-pecho", "pecho", "empuje"),
      base("jalon-espalda", "espalda", "traccion"),
      base("press-hombro", "hombros", "empuje"),
      base("curl-biceps", "brazos", "aislamiento"),
      base("extension-triceps", "brazos", "aislamiento"),
      base("hip thrust gluteo", "piernas", "pierna"),
      base("sentadilla cuadriceps", "piernas", "pierna"),
      base("curl femoral", "piernas", "pierna"),
    ];
    const r = generarRutinaPorReglas(
      { ...perfil, sexo: "femenino", categoriaCompetencia: "wellness" },
      { ...brief, objetivo: "hipertrofia", categoriaCompetencia: "wellness", dias: 5, cardio: "ninguno" },
      bibliotecaCategoria
    );
    const diasPierna = r.dias.filter((dia) => dia.ejercicios.some((e) => e.grupoMuscular === "piernas"));
    expect(diasPierna.length).toBe(3);
    expect(r.nombreRutina).toContain("hipertrofia");
    expect(r.reglasAplicadas.some((regla) => regla.includes("piernas y glúteos protagonistas"))).toBe(true);
  });

  it("Men's Physique orienta el tren superior sin eliminar el día de piernas", () => {
    const bibliotecaCategoria = [
      base("press-pecho", "pecho", "empuje"), base("jalon-espalda", "espalda", "traccion"),
      base("press-hombro", "hombros", "empuje"), base("curl-biceps", "brazos", "aislamiento"),
      base("extension-triceps", "brazos", "aislamiento"), base("sentadilla", "piernas", "pierna"),
    ];
    const r = generarRutinaPorReglas(
      { ...perfil, sexo: "masculino", categoriaCompetencia: "mens_physique" },
      { ...brief, categoriaCompetencia: "mens_physique", dias: 5, cardio: "ninguno" },
      bibliotecaCategoria
    );
    expect(r.dias.some((dia) => dia.ejercicios.some((e) => e.grupoMuscular === "piernas"))).toBe(true);
    expect(r.reglasAplicadas.some((regla) => regla.includes("sin omitir piernas"))).toBe(true);
  });

  it("usa IDs reales, respeta prohibidos y deja cardio al final", () => {
    const r = generarRutinaPorReglas(perfil, { ...brief, prohibidos: ["espalda"] }, biblioteca);
    expect(r.dias).toHaveLength(3);
    expect(r.dias.flatMap((d) => d.ejercicios).some((e) => e.ejercicioId === "espalda")).toBe(false);
    expect(r.dias.every((d) => d.ejercicios.at(-1)?.grupoMuscular === "cardio")).toBe(true);
  });
  it("bloquea saltos cuando se solicita", () => {
    const r = generarRutinaPorReglas(perfil, brief, biblioteca);
    expect(r.dias.flatMap((d) => d.ejercicios).some((e) => e.ejercicioId === "salto")).toBe(false);
  });

  it("upper/lower reparte por grupo en vez de llenar el día con uno solo (bug reportado: solo espalda+pierna)", () => {
    const bibliotecaAmplia = [
      ...Array.from({ length: 5 }, (_, i) => base(`espalda-${i}`, "espalda", "traccion", { posicionSesion: "principal" })),
      base("pecho-1", "pecho", "empuje"),
      base("hombro-1", "hombros", "empuje"),
      base("brazo-1", "brazos", "empuje"),
      base("pierna-1", "piernas", "pierna"),
      base("core-1", "core", "core"),
    ];
    const r = generarRutinaPorReglas(
      perfil,
      { ...brief, dias: 4, distribucion: "upper_lower", ejerciciosPorSesion: 4 },
      bibliotecaAmplia
    );
    const diaSuperior = r.dias[0];
    const gruposDelDia = new Set(diaSuperior.ejercicios.map((e) => e.grupoMuscular));
    // Con 4 ejercicios y 4 grupos objetivo (pecho, espalda, hombros, brazos)
    // debe tocar los 4, no solo espalda aunque haya muchos más candidatos ahí.
    expect(gruposDelDia.has("pecho")).toBe(true);
    expect(gruposDelDia.has("hombros")).toBe(true);
    expect(gruposDelDia.has("brazos")).toBe(true);
    expect(diaSuperior.ejercicios.filter((e) => e.grupoMuscular === "espalda").length).toBeLessThanOrEqual(1);
  });

  it("personalizada no tiene tope de grupos por día (evidencia real: 4 grupos combinados)", () => {
    const bibliotecaAmplia = [
      base("pecho-1", "pecho", "empuje"),
      base("espalda-1", "espalda", "traccion"),
      base("hombro-1", "hombros", "empuje"),
      base("brazo-1", "brazos", "empuje"),
      base("core-1", "core", "core"),
    ];
    const r = generarRutinaPorReglas(
      perfil,
      { ...brief, dias: 1, distribucion: "personalizada", diaGrupos: [["pecho", "espalda", "hombros", "brazos"]], ejerciciosPorSesion: 4 },
      bibliotecaAmplia
    );
    const grupos = new Set(r.dias[0].ejercicios.map((e) => e.grupoMuscular));
    expect(grupos.has("pecho")).toBe(true);
    expect(grupos.has("espalda")).toBe(true);
    expect(grupos.has("hombros")).toBe(true);
    expect(grupos.has("brazos")).toBe(true);
    expect(r.dias[0].nombre).toBe("Pecho + Espalda + Hombros + Brazos");
  });

  it("personalizada avisa si un día se dejó sin grupos asignados (antes quedaba vacío en silencio)", () => {
    const r = generarRutinaPorReglas(
      perfil,
      { ...brief, dias: 2, distribucion: "personalizada", diaGrupos: [["pecho"], []], ejerciciosPorSesion: 3 },
      [base("pecho-1", "pecho", "empuje")]
    );
    expect(r.alertas.some((a) => a.includes("día 2") && a.includes("ningún grupo"))).toBe(true);
  });

  it("personalizada respeta los grupos elegidos a mano por día", () => {
    const bibliotecaAmplia = [
      base("pecho-1", "pecho", "empuje"),
      base("pecho-2", "pecho", "empuje"),
      base("hombro-1", "hombros", "empuje"),
      base("pierna-1", "piernas", "pierna"),
      base("espalda-1", "espalda", "traccion"),
    ];
    const r = generarRutinaPorReglas(
      perfil,
      { ...brief, dias: 2, distribucion: "personalizada", diaGrupos: [["pecho", "hombros"], ["piernas"]], ejerciciosPorSesion: 3 },
      bibliotecaAmplia
    );
    expect(r.dias[0].ejercicios.every((e) => ["pecho", "hombros"].includes(e.grupoMuscular))).toBe(true);
    expect(r.dias[1].ejercicios.every((e) => e.grupoMuscular === "piernas")).toBe(true);
    expect(r.dias[0].nombre).toBe("Pecho + Hombros");
  });

  it("el volumen (series) escala con la experiencia del alumno", () => {
    const bibliotecaSimple = [base("full-1", "pecho", "full_body", { posicionSesion: "principal" })];
    const generar = (experiencia: PerfilEntrenamiento["experiencia"]) =>
      generarRutinaPorReglas({ ...perfil, experiencia }, { ...brief, dias: 1, distribucion: "full_body", ejerciciosPorSesion: 1 }, bibliotecaSimple).dias[0].ejercicios[0].series;
    expect(generar("principiante")).toBeLessThanOrEqual(generar("avanzado"));
  });

  it("aplica técnicas de intensidad reales en avanzado + intensidad alta", () => {
    const bibliotecaAmplia = [
      base("pecho-1", "pecho", "empuje", { posicionSesion: "principal" }),
      base("pecho-2", "pecho", "empuje", { posicionSesion: "accesorio" }),
      base("hombro-1", "hombros", "empuje", { posicionSesion: "accesorio" }),
    ];
    const tecnicas: TecnicaEntrenamiento[] = [
      { id: "1", nombre: "Drop set", slug: "drop-set", tipo: "individual", cantidadEjercicios: null, nivelMinimo: "intermedio", fatiga: "alta", requiereSupervision: true, descansoInternoSeg: 0, descansoFinalSeg: 120, maximoPorSesion: 1 },
    ];
    const r = generarRutinaPorReglas(
      { ...perfil, experiencia: "avanzado" },
      { ...brief, dias: 1, distribucion: "personalizada", diaGrupos: [["pecho", "hombros"]], ejerciciosPorSesion: 3, intensidadDeseada: "alta" },
      bibliotecaAmplia,
      tecnicas
    );
    expect(r.dias[0].ejercicios.some((e) => e.tecnicaTipo === "Drop set")).toBe(true);
  });

  it("un avanzado con intensidad estándar SÍ recibe técnicas (nivel manda, no la intensidad)", () => {
    const bibliotecaAmplia = [base("pecho-1", "pecho", "empuje"), base("pecho-2", "pecho", "empuje")];
    const tecnicas: TecnicaEntrenamiento[] = [
      { id: "1", nombre: "Drop set", slug: "drop-set", tipo: "individual", cantidadEjercicios: null, nivelMinimo: "principiante", fatiga: "alta", requiereSupervision: true, descansoInternoSeg: 0, descansoFinalSeg: 120, maximoPorSesion: 1 },
    ];
    const r = generarRutinaPorReglas(
      { ...perfil, experiencia: "avanzado" },
      { ...brief, dias: 1, distribucion: "personalizada", diaGrupos: [["pecho"]], ejerciciosPorSesion: 2, intensidadDeseada: "estandar" },
      bibliotecaAmplia,
      tecnicas
    );
    expect(r.dias[0].ejercicios.some((e) => e.tecnicaTipo === "Drop set")).toBe(true);
  });

  it("principiante no recibe técnicas por defecto (automático)", () => {
    const bibliotecaAmplia = [base("pecho-1", "pecho", "empuje"), base("pecho-2", "pecho", "empuje")];
    const tecnicas: TecnicaEntrenamiento[] = [
      { id: "1", nombre: "Tempo controlado", slug: "tempo-controlado", tipo: "individual", cantidadEjercicios: null, nivelMinimo: "principiante", fatiga: "media", requiereSupervision: false, descansoInternoSeg: 0, descansoFinalSeg: 90, maximoPorSesion: 1 },
    ];
    const r = generarRutinaPorReglas(
      { ...perfil, experiencia: "principiante" },
      { ...brief, dias: 1, distribucion: "personalizada", diaGrupos: [["pecho"]], ejerciciosPorSesion: 2 },
      bibliotecaAmplia,
      tecnicas
    );
    expect(r.dias[0].ejercicios.every((e) => e.tecnicaTipo === null)).toBe(true);
  });

  it("biserie/superserie se arma desde intermedio, sin necesitar intensidad competitiva (bug reportado)", () => {
    const bibliotecaAmplia = [
      base("pecho-1", "pecho", "empuje", { posicionSesion: "principal" }),
      base("pecho-2", "pecho", "empuje", { posicionSesion: "accesorio" }),
      base("pecho-3", "pecho", "empuje", { posicionSesion: "accesorio" }),
    ];
    const tecnicas: TecnicaEntrenamiento[] = [
      { id: "1", nombre: "Biserie", slug: "biserie", tipo: "encadenada", cantidadEjercicios: 2, nivelMinimo: "intermedio", fatiga: "media", requiereSupervision: false, descansoInternoSeg: 0, descansoFinalSeg: 90, maximoPorSesion: 1 },
    ];
    const r = generarRutinaPorReglas(
      { ...perfil, experiencia: "intermedio" },
      { ...brief, dias: 1, distribucion: "personalizada", diaGrupos: [["pecho"]], ejerciciosPorSesion: 3, intensidadDeseada: "estandar" },
      bibliotecaAmplia,
      tecnicas
    );
    expect(r.dias[0].ejercicios.filter((e) => e.tecnicaTipo === "Biserie")).toHaveLength(2);
  });

  it("tecnicasIntensidad: 'si' fuerza técnicas aunque el nivel sea principiante", () => {
    const bibliotecaAmplia = [base("pecho-1", "pecho", "empuje"), base("pecho-2", "pecho", "empuje", { posicionSesion: "accesorio" })];
    const tecnicas: TecnicaEntrenamiento[] = [
      { id: "1", nombre: "Tempo controlado", slug: "tempo-controlado", tipo: "individual", cantidadEjercicios: null, nivelMinimo: "principiante", fatiga: "media", requiereSupervision: false, descansoInternoSeg: 0, descansoFinalSeg: 90, maximoPorSesion: 1 },
    ];
    const r = generarRutinaPorReglas(
      { ...perfil, experiencia: "principiante" },
      { ...brief, dias: 1, distribucion: "personalizada", diaGrupos: [["pecho"]], ejerciciosPorSesion: 2, tecnicasIntensidad: "si" },
      bibliotecaAmplia,
      tecnicas
    );
    expect(r.dias[0].ejercicios.some((e) => e.tecnicaTipo === "Tempo controlado")).toBe(true);
  });

  it("tecnicasIntensidad: 'no' bloquea técnicas aunque sea avanzado + competitiva", () => {
    const bibliotecaAmplia = [base("pecho-1", "pecho", "empuje"), base("pecho-2", "pecho", "empuje", { posicionSesion: "accesorio" })];
    const tecnicas: TecnicaEntrenamiento[] = [
      { id: "1", nombre: "Drop set", slug: "drop-set", tipo: "individual", cantidadEjercicios: null, nivelMinimo: "principiante", fatiga: "alta", requiereSupervision: true, descansoInternoSeg: 0, descansoFinalSeg: 120, maximoPorSesion: 1 },
    ];
    const r = generarRutinaPorReglas(
      { ...perfil, experiencia: "avanzado" },
      { ...brief, dias: 1, distribucion: "personalizada", diaGrupos: [["pecho"]], ejerciciosPorSesion: 2, intensidadDeseada: "competitiva", tecnicasIntensidad: "no" },
      bibliotecaAmplia,
      tecnicas
    );
    expect(r.dias[0].ejercicios.every((e) => e.tecnicaTipo === null)).toBe(true);
  });

  it("grupoPrioritario se entrena primero en el día", () => {
    const bibliotecaAmplia = [
      base("pecho-1", "pecho", "empuje", { posicionSesion: "principal" }),
      base("hombro-1", "hombros", "empuje", { posicionSesion: "principal" }),
      base("brazo-1", "brazos", "empuje", { posicionSesion: "accesorio" }),
    ];
    const r = generarRutinaPorReglas(
      perfil,
      { ...brief, dias: 1, distribucion: "personalizada", diaGrupos: [["pecho", "hombros", "brazos"]], ejerciciosPorSesion: 3, grupoPrioritario: "brazos" },
      bibliotecaAmplia
    );
    expect(r.dias[0].ejercicios[0].grupoMuscular).toBe("brazos");
  });

  it("enfoqueForma 'amplitud' prioriza ejercicios de ancho (jalón) sobre los de grosor (remo)", () => {
    const bibliotecaAmplia = [
      { id: "jalon", nombre: "Jalón al pecho", grupoMuscular: "espalda" as const, categoria: "traccion" as const, equipo: "polea" as const, nivel: "principiante" as const, posicionSesion: "principal" as const },
      { id: "remo", nombre: "Remo con barra", grupoMuscular: "espalda" as const, categoria: "traccion" as const, equipo: "barra" as const, nivel: "principiante" as const, posicionSesion: "principal" as const },
    ];
    const r = generarRutinaPorReglas(
      perfil,
      { ...brief, dias: 1, distribucion: "personalizada", diaGrupos: [["espalda"]], ejerciciosPorSesion: 1, enfoqueForma: "amplitud" },
      bibliotecaAmplia
    );
    expect(r.dias[0].ejercicios[0].ejercicioId).toBe("jalon");
  });

  it("enfoqueForma 'definicion' prioriza ejercicios de aislamiento", () => {
    const bibliotecaAmplia = [
      base("compuesto", "pecho", "empuje", { posicionSesion: "principal" }),
      base("aislado", "pecho", "aislamiento", { posicionSesion: "principal" }),
    ];
    const r = generarRutinaPorReglas(
      perfil,
      { ...brief, dias: 1, distribucion: "personalizada", diaGrupos: [["pecho"]], ejerciciosPorSesion: 1, enfoqueForma: "definicion" },
      bibliotecaAmplia
    );
    expect(r.dias[0].ejercicios[0].ejercicioId).toBe("aislado");
  });

  it("sub-grupo de pierna 'gluteo' filtra dentro de piernas por nombre", () => {
    const bibliotecaAmplia = [
      { id: "hip-thrust", nombre: "Hip thrust", grupoMuscular: "piernas" as const, categoria: "pierna" as const, equipo: "barra" as const, nivel: "principiante" as const, posicionSesion: "principal" as const },
      { id: "extension-cuadriceps", nombre: "Extensión de cuádriceps", grupoMuscular: "piernas" as const, categoria: "pierna" as const, equipo: "maquina" as const, nivel: "principiante" as const, posicionSesion: "principal" as const },
    ];
    const r = generarRutinaPorReglas(
      perfil,
      { ...brief, dias: 1, distribucion: "personalizada", diaGrupos: [["gluteo"]], ejerciciosPorSesion: 2 },
      bibliotecaAmplia
    );
    expect(r.dias[0].ejercicios.every((e) => e.ejercicioId === "hip-thrust")).toBe(true);
    expect(r.dias[0].nombre).toBe("Glúteo");
  });

  it("piernas se puede separar por sub-grupo en días distintos de la misma semana", () => {
    const bibliotecaAmplia = [
      { id: "hip-thrust", nombre: "Hip thrust", grupoMuscular: "piernas" as const, categoria: "pierna" as const, equipo: "barra" as const, nivel: "principiante" as const, posicionSesion: "principal" as const },
      { id: "curl-femoral", nombre: "Curl femoral", grupoMuscular: "piernas" as const, categoria: "pierna" as const, equipo: "maquina" as const, nivel: "principiante" as const, posicionSesion: "principal" as const },
      { id: "sentadilla", nombre: "Sentadilla", grupoMuscular: "piernas" as const, categoria: "pierna" as const, equipo: "barra" as const, nivel: "principiante" as const, posicionSesion: "principal" as const },
    ];
    const r = generarRutinaPorReglas(
      perfil,
      { ...brief, dias: 2, distribucion: "personalizada", diaGrupos: [["gluteo", "femoral"], ["cuadriceps"]], ejerciciosPorSesion: 2 },
      bibliotecaAmplia
    );
    expect(r.dias[0].nombre).toBe("Glúteo + Femoral");
    expect(r.dias[1].nombre).toBe("Cuádriceps");
    expect(r.dias[1].ejercicios.every((e) => e.ejercicioId === "sentadilla")).toBe(true);
  });

  it("sub-grupo de brazo 'biceps' filtra dentro de brazos por nombre", () => {
    const bibliotecaAmplia = [
      { id: "curl-biceps", nombre: "Curl de bíceps", grupoMuscular: "brazos" as const, categoria: "aislamiento" as const, equipo: "mancuerna" as const, nivel: "principiante" as const, posicionSesion: "principal" as const },
      { id: "extension-triceps", nombre: "Extensión de tríceps", grupoMuscular: "brazos" as const, categoria: "aislamiento" as const, equipo: "polea" as const, nivel: "principiante" as const, posicionSesion: "principal" as const },
    ];
    const r = generarRutinaPorReglas(
      perfil,
      { ...brief, dias: 1, distribucion: "personalizada", diaGrupos: [["biceps"]], ejerciciosPorSesion: 2 },
      bibliotecaAmplia
    );
    expect(r.dias[0].ejercicios.every((e) => e.ejercicioId === "curl-biceps")).toBe(true);
    expect(r.dias[0].nombre).toBe("Bíceps");
  });

  it("brazos se puede separar por sub-grupo en días distintos de la misma semana", () => {
    const bibliotecaAmplia = [
      { id: "curl-biceps", nombre: "Curl de bíceps", grupoMuscular: "brazos" as const, categoria: "aislamiento" as const, equipo: "mancuerna" as const, nivel: "principiante" as const, posicionSesion: "principal" as const },
      { id: "extension-triceps", nombre: "Extensión de tríceps", grupoMuscular: "brazos" as const, categoria: "aislamiento" as const, equipo: "polea" as const, nivel: "principiante" as const, posicionSesion: "principal" as const },
    ];
    const r = generarRutinaPorReglas(
      perfil,
      { ...brief, dias: 2, distribucion: "personalizada", diaGrupos: [["biceps"], ["triceps"]], ejerciciosPorSesion: 2 },
      bibliotecaAmplia
    );
    expect(r.dias[0].nombre).toBe("Bíceps");
    expect(r.dias[0].ejercicios.every((e) => e.ejercicioId === "curl-biceps")).toBe(true);
    expect(r.dias[1].nombre).toBe("Tríceps");
    expect(r.dias[1].ejercicios.every((e) => e.ejercicioId === "extension-triceps")).toBe(true);
  });

  it("inspiracionEstilo 'alta_intensidad' baja una serie y salta las encadenadas", () => {
    const bibliotecaAmplia = [
      base("pecho-1", "pecho", "empuje", { posicionSesion: "principal" }),
      base("pecho-2", "pecho", "empuje", { posicionSesion: "accesorio" }),
      base("pecho-3", "pecho", "empuje", { posicionSesion: "accesorio" }),
    ];
    const tecnicas: TecnicaEntrenamiento[] = [
      { id: "1", nombre: "Biserie", slug: "biserie", tipo: "encadenada", cantidadEjercicios: 2, nivelMinimo: "intermedio", fatiga: "media", requiereSupervision: false, descansoInternoSeg: 0, descansoFinalSeg: 90, maximoPorSesion: 1 },
      { id: "2", nombre: "Rest-pause", slug: "rest-pause", tipo: "individual", cantidadEjercicios: null, nivelMinimo: "intermedio", fatiga: "alta", requiereSupervision: true, descansoInternoSeg: 15, descansoFinalSeg: 150, maximoPorSesion: 1 },
    ];
    const conAlta = generarRutinaPorReglas(
      { ...perfil, experiencia: "avanzado" },
      { ...brief, dias: 1, distribucion: "personalizada", diaGrupos: [["pecho"]], ejerciciosPorSesion: 3, inspiracionEstilo: "alta_intensidad" },
      bibliotecaAmplia,
      tecnicas
    );
    const sinInspiracion = generarRutinaPorReglas(
      { ...perfil, experiencia: "avanzado" },
      { ...brief, dias: 1, distribucion: "personalizada", diaGrupos: [["pecho"]], ejerciciosPorSesion: 3 },
      bibliotecaAmplia
    );
    expect(conAlta.dias[0].ejercicios[0].series).toBe(sinInspiracion.dias[0].ejercicios[0].series - 1);
    expect(conAlta.dias[0].ejercicios.some((e) => e.tecnicaTipo === "Biserie")).toBe(false);
    expect(conAlta.dias[0].ejercicios.some((e) => e.tecnicaTipo === "Rest-pause")).toBe(true);
  });

  it("inspiracionEstilo 'volumen_tradicional' sube una serie", () => {
    const bibliotecaSimple = [base("full-1", "pecho", "full_body", { posicionSesion: "principal" })];
    const conVolumen = generarRutinaPorReglas(perfil, { ...brief, dias: 1, distribucion: "full_body", ejerciciosPorSesion: 1, inspiracionEstilo: "volumen_tradicional" }, bibliotecaSimple);
    const base_ = generarRutinaPorReglas(perfil, { ...brief, dias: 1, distribucion: "full_body", ejerciciosPorSesion: 1 }, bibliotecaSimple);
    expect(conVolumen.dias[0].ejercicios[0].series).toBe(base_.dias[0].ejercicios[0].series + 1);
  });

  it("ajustarVolumenCritico: baja el volumen semanal que supera el tope crítico sin tocar principales", () => {
    const bibliotecaPierna = [
      base("sentadilla", "piernas", "pierna", { nombre: "Sentadilla" }),
      base("prensa", "piernas", "pierna", { nombre: "Prensa" }),
      ...Array.from({ length: 6 }, (_, i) => base(`pierna-acc-${i}`, "piernas", "aislamiento", { posicionSesion: "accesorio" })),
    ];
    const r = generarRutinaPorReglas(
      { ...perfil, experiencia: "avanzado" },
      {
        ...brief,
        dias: 2,
        distribucion: "personalizada",
        diaGrupos: [["piernas"], ["piernas"]],
        ejerciciosPorSesion: 6,
        intensidadDeseada: "alta",
        cardio: "ninguno",
      },
      bibliotecaPierna
    );
    const ejerciciosPiernas = r.dias.flatMap((d) => d.ejercicios).filter((e) => e.grupoMuscular === "piernas");
    const totalPiernas = ejerciciosPiernas.reduce((s, e) => s + e.series, 0);
    expect(totalPiernas).toBeLessThanOrEqual(50);
    expect(r.alertas.some((a) => a.includes("Volumen semanal de piernas ajustado"))).toBe(true);
    // Los principales en pirámide no se tocaron: un número de reps por serie.
    const principales = ejerciciosPiernas.filter((e) => /Sentadilla|Prensa/.test(e.nombre));
    principales.forEach((e) => expect(e.reps.split("-").length).toBe(e.series));
    // Ningún accesorio quedó en menos de 2 series.
    ejerciciosPiernas.forEach((e) => expect(e.series).toBeGreaterThanOrEqual(2));
  });

  it("ajustarVolumenCritico avisa cuando ni bajando todos los accesorios al mínimo alcanza el tope", () => {
    const bibliotecaPierna = [
      base("sentadilla", "piernas", "pierna", { nombre: "Sentadilla" }),
      base("prensa", "piernas", "pierna", { nombre: "Prensa" }),
      ...Array.from({ length: 6 }, (_, i) => base(`pierna-acc-${i}`, "piernas", "aislamiento", { posicionSesion: "accesorio" })),
    ];
    // Con 3 días de piernas, los principales solos (2 por día × 5 series)
    // ya suman 30 — ni bajando los accesorios al piso de 2 se llega a 50.
    const r = generarRutinaPorReglas(
      { ...perfil, experiencia: "avanzado" },
      {
        ...brief,
        dias: 3,
        distribucion: "personalizada",
        diaGrupos: [["piernas"], ["piernas"], ["piernas"]],
        ejerciciosPorSesion: 6,
        intensidadDeseada: "alta",
        cardio: "ninguno",
      },
      bibliotecaPierna
    );
    const totalPiernas = r.dias.flatMap((d) => d.ejercicios).filter((e) => e.grupoMuscular === "piernas").reduce((s, e) => s + e.series, 0);
    expect(totalPiernas).toBeGreaterThan(50);
    expect(r.alertas.some((a) => a.includes("sigue en") && a.includes("revisa manualmente"))).toBe(true);
  });

  it("inspiracionEstilo 'volumen_tradicional' prioriza una segunda encadenada en vez de individual", () => {
    const bibliotecaAmplia = [
      base("pecho-principal", "pecho", "empuje", { posicionSesion: "principal" }),
      base("pecho-1", "pecho", "empuje", { posicionSesion: "accesorio" }),
      base("pecho-2", "pecho", "empuje", { posicionSesion: "accesorio" }),
      base("pecho-3", "pecho", "empuje", { posicionSesion: "accesorio" }),
      base("pecho-4", "pecho", "empuje", { posicionSesion: "accesorio" }),
    ];
    // Avanzado + intensidad no estándar = 2 técnicas por sesión (ver
    // maximoTecnicasPorSesion) — sin margen para una segunda familia, no
    // habría diferencia que medir.
    const perfilAvanzado = { ...perfil, experiencia: "avanzado" as const };
    const briefDia: BriefGenerador = { ...brief, dias: 1, distribucion: "personalizada", diaGrupos: [["pecho"]], ejerciciosPorSesion: 5, intensidadDeseada: "alta" };
    const tecnicas: TecnicaEntrenamiento[] = [
      { id: "1", nombre: "Biserie", slug: "biserie", tipo: "encadenada", cantidadEjercicios: 2, nivelMinimo: "intermedio", fatiga: "media", requiereSupervision: false, descansoInternoSeg: 0, descansoFinalSeg: 90, maximoPorSesion: 2 },
    ];
    const conVolumen = generarRutinaPorReglas(perfilAvanzado, { ...briefDia, inspiracionEstilo: "volumen_tradicional" }, bibliotecaAmplia, tecnicas);
    const sinInspiracion = generarRutinaPorReglas(perfilAvanzado, briefDia, bibliotecaAmplia, tecnicas);
    const accesoriosConTecnica = (r: typeof conVolumen) => r.dias[0].ejercicios.filter((e) => e.tecnicaTipo === "Biserie").length;
    expect(accesoriosConTecnica(conVolumen)).toBe(4);
    expect(accesoriosConTecnica(sinInspiracion)).toBe(2);
  });

  it("inspiracionEstilo 'cientifico_rir' agrega RIR a las reps", () => {
    const bibliotecaSimple = [base("full-1", "pecho", "full_body", { posicionSesion: "principal" })];
    const r = generarRutinaPorReglas(perfil, { ...brief, dias: 1, distribucion: "full_body", ejerciciosPorSesion: 1, inspiracionEstilo: "cientifico_rir" }, bibliotecaSimple);
    expect(r.dias[0].ejercicios[0].reps).toMatch(/RIR/);
  });

  it("objetivo 'perdida_grasa' sube las reps y avisa si falta cardio", () => {
    const bibliotecaSimple = [base("full-1", "pecho", "full_body", { posicionSesion: "principal" })];
    const r = generarRutinaPorReglas(perfil, { ...brief, dias: 1, distribucion: "full_body", ejerciciosPorSesion: 1, objetivo: "perdida_grasa", cardio: "ninguno" }, bibliotecaSimple);
    expect(r.dias[0].ejercicios[0].reps).toBe("12-15");
    expect(r.alertas.some((a) => a.includes("cardio"))).toBe(true);
  });

  it("objetivo 'mantencion' baja una serie", () => {
    const bibliotecaSimple = [base("full-1", "pecho", "full_body", { posicionSesion: "principal" })];
    const conMantencion = generarRutinaPorReglas(perfil, { ...brief, dias: 1, distribucion: "full_body", ejerciciosPorSesion: 1, objetivo: "mantencion" }, bibliotecaSimple);
    const base_ = generarRutinaPorReglas(perfil, { ...brief, dias: 1, distribucion: "full_body", ejerciciosPorSesion: 1 }, bibliotecaSimple);
    expect(conMantencion.dias[0].ejercicios[0].series).toBe(base_.dias[0].ejercicios[0].series - 1);
  });

  it("dos rutinas avanzadas con objetivos distintos no son iguales", () => {
    const bibliotecaAmplia = [
      base("pecho-1", "pecho", "empuje", { posicionSesion: "principal" }),
      base("pecho-2", "pecho", "aislamiento", { posicionSesion: "accesorio" }),
    ];
    const rendimiento = generarRutinaPorReglas({ ...perfil, experiencia: "avanzado" }, { ...brief, dias: 1, distribucion: "full_body", ejerciciosPorSesion: 2, objetivo: "rendimiento" }, bibliotecaAmplia);
    const mantencion = generarRutinaPorReglas({ ...perfil, experiencia: "avanzado" }, { ...brief, dias: 1, distribucion: "full_body", ejerciciosPorSesion: 2, objetivo: "mantencion" }, bibliotecaAmplia);
    expect(rendimiento.dias[0].ejercicios[0].reps).not.toBe(mantencion.dias[0].ejercicios[0].reps);
  });

  it("baja series por edad: 60+ una menos, 70+ dos menos", () => {
    const bibliotecaSimple = [base("full-1", "pecho", "full_body", { posicionSesion: "principal" })];
    // avanzado + intensidad alta = 5 series base, con margen suficiente para
    // que el piso de 2 no tape la diferencia que se está midiendo.
    const briefUno = { ...brief, dias: 1, distribucion: "full_body" as const, ejerciciosPorSesion: 1, intensidadDeseada: "alta" as const };
    const perfilBase = { ...perfil, experiencia: "avanzado" as const };
    const joven = generarRutinaPorReglas({ ...perfilBase, edad: 30 }, briefUno, bibliotecaSimple).dias[0].ejercicios[0].series;
    const sesenta = generarRutinaPorReglas({ ...perfilBase, edad: 62 }, briefUno, bibliotecaSimple).dias[0].ejercicios[0].series;
    const setenta = generarRutinaPorReglas({ ...perfilBase, edad: 74 }, briefUno, bibliotecaSimple).dias[0].ejercicios[0].series;
    expect(sesenta).toBe(joven - 1);
    expect(setenta).toBe(joven - 2);
  });

  it("evita, cuando puede, los ejercicios de la rutina anterior del alumno", () => {
    const bibliotecaAmplia = [
      base("nuevo", "pecho", "empuje", { posicionSesion: "principal" }),
      base("repetido", "pecho", "empuje", { posicionSesion: "principal" }),
    ];
    const r = generarRutinaPorReglas(
      { ...perfil, ejerciciosRecientes: ["repetido"] },
      { ...brief, dias: 1, distribucion: "personalizada", diaGrupos: [["pecho"]], ejerciciosPorSesion: 1 },
      bibliotecaAmplia
    );
    expect(r.dias[0].ejercicios[0].ejercicioId).toBe("nuevo");
  });

  it("ordena de músculo más grande a más chico dentro de un día combinado", () => {
    const bibliotecaAmplia = [
      base("brazo-1", "brazos", "empuje", { posicionSesion: "principal" }),
      base("espalda-1", "espalda", "traccion", { posicionSesion: "principal" }),
      base("hombro-1", "hombros", "empuje", { posicionSesion: "principal" }),
    ];
    const r = generarRutinaPorReglas(
      perfil,
      { ...brief, dias: 1, distribucion: "personalizada", diaGrupos: [["brazos", "hombros", "espalda"]], ejerciciosPorSesion: 3 },
      bibliotecaAmplia
    );
    expect(r.dias[0].ejercicios.map((e) => e.grupoMuscular)).toEqual(["espalda", "hombros", "brazos"]);
  });

  it("avisa si un día enfocado queda con muy pocos ejercicios por grupo (salvo principiante)", () => {
    const bibliotecaAmplia = [base("pecho-1", "pecho", "empuje"), base("pecho-2", "pecho", "empuje")];
    const avanzado = generarRutinaPorReglas(
      { ...perfil, experiencia: "avanzado" },
      { ...brief, dias: 1, distribucion: "personalizada", diaGrupos: [["pecho"]], ejerciciosPorSesion: 2 },
      bibliotecaAmplia
    );
    const principiante = generarRutinaPorReglas(
      { ...perfil, experiencia: "principiante" },
      { ...brief, dias: 1, distribucion: "personalizada", diaGrupos: [["pecho"]], ejerciciosPorSesion: 2 },
      bibliotecaAmplia
    );
    expect(avanzado.alertas.some((a) => a.includes("solo 2 ejercicios de Pecho"))).toBe(true);
    expect(principiante.alertas.some((a) => a.includes("solo 2 ejercicios de Pecho"))).toBe(false);
  });

  it("un día de brazos con cuatro espacios garantiza dos bíceps y dos tríceps", () => {
    const bibliotecaBrazos = [
      { ...base("curl-1", "brazos", "aislamiento"), nombre: "Curl con barra" },
      { ...base("curl-2", "brazos", "aislamiento"), nombre: "Curl martillo" },
      { ...base("curl-3", "brazos", "aislamiento"), nombre: "Curl predicador" },
      { ...base("triceps-1", "brazos", "aislamiento"), nombre: "Extensión de tríceps en polea" },
      { ...base("triceps-2", "brazos", "aislamiento"), nombre: "Press francés" },
    ];
    const r = generarRutinaPorReglas(
      perfil,
      { ...brief, dias: 1, distribucion: "personalizada", diaGrupos: [["brazos"]], ejerciciosPorSesion: 4 },
      bibliotecaBrazos
    );
    const nombres = r.dias[0].ejercicios.map((e) => e.nombre);
    expect(nombres.filter((n) => n.startsWith("Curl"))).toHaveLength(2);
    expect(nombres.filter((n) => n.includes("tríceps") || n.includes("francés"))).toHaveLength(2);
    expect(r.alertas.some((a) => a.includes("desbalanceado"))).toBe(false);
  });

  it("un día de brazos avisa si el catálogo solo permite un ejercicio de tríceps", () => {
    const bibliotecaBrazos = [
      { ...base("curl-1", "brazos", "aislamiento"), nombre: "Curl con barra" },
      { ...base("curl-2", "brazos", "aislamiento"), nombre: "Curl martillo" },
      { ...base("curl-3", "brazos", "aislamiento"), nombre: "Curl predicador" },
      { ...base("triceps-1", "brazos", "aislamiento"), nombre: "Extensión de tríceps en polea" },
    ];
    const r = generarRutinaPorReglas(
      perfil,
      { ...brief, dias: 1, distribucion: "personalizada", diaGrupos: [["brazos"]], ejerciciosPorSesion: 4 },
      bibliotecaBrazos
    );
    expect(r.alertas.some((a) => a.includes("3 de bíceps y 1 de tríceps"))).toBe(true);
  });

  it("respeta el tope de ejercicios por grupo y le pasa los espacios liberados al otro grupo del día", () => {
    const bibliotecaMixta = [
      { ...base("press-banca", "pecho", "empuje"), nombre: "Press de banca" },
      { ...base("press-inclinado", "pecho", "empuje"), nombre: "Press inclinado con mancuernas" },
      { ...base("aperturas", "pecho", "aislamiento"), nombre: "Aperturas en polea" },
      { ...base("fondos", "pecho", "empuje"), nombre: "Fondos en paralelas" },
      { ...base("jalon", "espalda", "traccion"), nombre: "Jalón al pecho" },
      { ...base("remo", "espalda", "traccion"), nombre: "Remo en polea baja" },
      { ...base("pullover", "espalda", "traccion"), nombre: "Pullover en polea alta" },
      { ...base("dominadas", "espalda", "traccion"), nombre: "Dominadas" },
    ];
    const briefDia: BriefGenerador = {
      ...brief,
      dias: 1,
      distribucion: "personalizada",
      diaGrupos: [["pecho", "espalda"]],
      ejerciciosPorSesion: 6,
      cardio: "ninguno",
    };
    const sinTope = generarRutinaPorReglas(perfil, briefDia, bibliotecaMixta);
    const conTope = generarRutinaPorReglas(perfil, { ...briefDia, limitesPorGrupo: { pecho: 2 } }, bibliotecaMixta);
    const contar = (r: typeof sinTope, grupo: string) => r.dias[0].ejercicios.filter((e) => e.grupoMuscular === grupo).length;

    expect(contar(sinTope, "pecho")).toBe(3);
    expect(contar(conTope, "pecho")).toBe(2);
    // El día no se achica: los 2 espacios que soltó pecho se los lleva espalda.
    expect(conTope.dias[0].ejercicios).toHaveLength(6);
    expect(contar(conTope, "espalda")).toBe(4);
    expect(conTope.reglasAplicadas.some((r) => r.includes("Pecho máx. 2"))).toBe(true);
  });

  it("el tope de un sub-grupo recorta dentro de su grupo padre", () => {
    const bibliotecaBrazos = [
      { ...base("curl-1", "brazos", "aislamiento"), nombre: "Curl con barra" },
      { ...base("curl-2", "brazos", "aislamiento"), nombre: "Curl martillo" },
      { ...base("curl-3", "brazos", "aislamiento"), nombre: "Curl predicador" },
      { ...base("triceps-1", "brazos", "aislamiento"), nombre: "Extensión de tríceps en polea" },
      { ...base("triceps-2", "brazos", "aislamiento"), nombre: "Press francés" },
      { ...base("triceps-3", "brazos", "aislamiento"), nombre: "Fondos de tríceps" },
    ];
    const r = generarRutinaPorReglas(
      perfil,
      { ...brief, dias: 1, distribucion: "personalizada", diaGrupos: [["brazos"]], ejerciciosPorSesion: 4, cardio: "ninguno", limitesPorGrupo: { biceps: 1 } },
      bibliotecaBrazos
    );
    const nombres = r.dias[0].ejercicios.map((e) => e.nombre);
    expect(nombres.filter((n) => n.startsWith("Curl"))).toHaveLength(1);
    // El resto del día lo completa tríceps, no queda corto por el tope.
    expect(nombres).toHaveLength(4);
  });

  it("avisa cuando los topes dejan el día más corto de lo pedido, y no reclama por 'pocos ejercicios' de un grupo topado", () => {
    const bibliotecaPecho = [
      { ...base("press-banca", "pecho", "empuje"), nombre: "Press de banca" },
      { ...base("press-inclinado", "pecho", "empuje"), nombre: "Press inclinado con mancuernas" },
      { ...base("aperturas", "pecho", "aislamiento"), nombre: "Aperturas en polea" },
      { ...base("fondos", "pecho", "empuje"), nombre: "Fondos en paralelas" },
    ];
    const r = generarRutinaPorReglas(
      perfil,
      { ...brief, dias: 1, distribucion: "personalizada", diaGrupos: [["pecho"]], ejerciciosPorSesion: 4, cardio: "ninguno", limitesPorGrupo: { pecho: 2 } },
      bibliotecaPecho
    );
    expect(r.dias[0].ejercicios).toHaveLength(2);
    expect(r.alertas.some((a) => a.includes("los topes por grupo que pusiste no dejan lugar"))).toBe(true);
    expect(r.alertas.some((a) => a.includes("solo 2 ejercicios de Pecho"))).toBe(false);
  });

  it("push usa tríceps y pull usa bíceps aunque ambos sean aislamiento", () => {
    const bibliotecaPpl = [
      base("pecho", "pecho", "empuje"),
      base("hombro", "hombros", "empuje"),
      base("espalda", "espalda", "traccion"),
      { ...base("curl", "brazos", "aislamiento"), nombre: "Curl con barra" },
      { ...base("triceps", "brazos", "aislamiento"), nombre: "Extensión de tríceps en polea" },
      base("pierna", "piernas", "pierna"),
      base("core", "core", "core"),
    ];
    const r = generarRutinaPorReglas(
      perfil,
      { ...brief, dias: 3, distribucion: "push_pull_legs", ejerciciosPorSesion: 3 },
      bibliotecaPpl
    );
    expect(r.dias[0].ejercicios.some((e) => e.nombre.includes("tríceps"))).toBe(true);
    expect(r.dias[0].ejercicios.some((e) => e.nombre.startsWith("Curl"))).toBe(false);
    expect(r.dias[1].ejercicios.some((e) => e.nombre.startsWith("Curl"))).toBe(true);
    expect(r.dias[1].ejercicios.some((e) => e.nombre.includes("tríceps"))).toBe(false);
  });

  it("un obligatorio no puede saltarse el nivel ni el filtro de impacto", () => {
    const bibliotecaSegura = [
      base("seguro", "piernas", "pierna"),
      { ...base("avanzado", "piernas", "pierna"), nombre: "Sentadilla avanzada", nivel: "avanzado" as const },
      { ...base("salto", "piernas", "pierna"), nombre: "Sentadilla con salto", requiereSalto: true, impacto: "alto" as const },
    ];
    const r = generarRutinaPorReglas(
      { ...perfil, experiencia: "principiante" },
      { ...brief, dias: 1, distribucion: "personalizada", diaGrupos: [["piernas"]], ejerciciosPorSesion: 3, evitarSaltos: true, obligatorios: ["avanzado", "salto"] },
      bibliotecaSegura
    );
    expect(r.dias[0].ejercicios.map((e) => e.ejercicioId)).toEqual(["seguro"]);
    expect(r.alertas.some((a) => a.includes("2 ejercicios obligatorios son incompatibles"))).toBe(true);
  });

  it("el título incluye el nivel y, si hay, el grupo prioritario como enfoque", () => {
    const bibliotecaSimple = [base("full-1", "pecho", "full_body", { posicionSesion: "principal" })];
    const r = generarRutinaPorReglas(
      { ...perfil, experiencia: "avanzado" },
      { ...brief, dias: 1, distribucion: "full_body", ejerciciosPorSesion: 1, grupoPrioritario: "piernas" },
      bibliotecaSimple
    );
    expect(r.nombreRutina).toBe("Plan hipertrofia avanzado — enfoque piernas");
  });

  it("la distribución automática de cinco días usa grupos combinados VIP", () => {
    const bibliotecaVip = [
      base("pecho-1", "pecho", "empuje"), base("pecho-2", "pecho", "empuje"),
      base("espalda-1", "espalda", "traccion"), base("espalda-2", "espalda", "traccion"),
      base("hombros-1", "hombros", "empuje"), base("hombros-2", "hombros", "empuje"),
      base("piernas-1", "piernas", "pierna"), base("piernas-2", "piernas", "pierna"),
      { ...base("biceps-1", "brazos", "aislamiento"), nombre: "Curl con barra" },
      { ...base("biceps-2", "brazos", "aislamiento"), nombre: "Curl martillo" },
      { ...base("triceps-1", "brazos", "aislamiento"), nombre: "Extensión de tríceps" },
      { ...base("triceps-2", "brazos", "aislamiento"), nombre: "Press francés" },
    ];
    const r = generarRutinaPorReglas(perfil, { ...brief, dias: 5, distribucion: "automatica", ejerciciosPorSesion: 4, cardio: "ninguno" }, bibliotecaVip);
    expect(r.reglasAplicadas).toContain("Distribución vip balanceada");
    expect(r.dias.map((d) => d.nombre)).toEqual(["Pecho + Bíceps", "Espalda + Tríceps", "Hombros + Piernas", "Pecho + Espalda", "Hombros + Brazos"]);
    expect(r.dias[0].ejercicios.some((e) => e.nombre.startsWith("Curl"))).toBe(true);
    expect(r.dias[1].ejercicios.some((e) => e.nombre.includes("tríceps") || e.nombre.includes("francés"))).toBe(true);
  });

  it("uno o dos días automáticos conservan full body", () => {
    const bibliotecaSimple = [base("pecho", "pecho", "empuje"), base("espalda", "espalda", "traccion")];
    const r = generarRutinaPorReglas(perfil, { ...brief, dias: 2, distribucion: "automatica", ejerciciosPorSesion: 2, cardio: "ninguno" }, bibliotecaSimple);
    expect(r.reglasAplicadas).toContain("Distribución full body");
  });

  it("tecnicasPermitidas restringe a solo las elegidas a mano, aunque el nivel permita otras", () => {
    const bibliotecaAmplia = [base("pecho-1", "pecho", "empuje"), base("pecho-2", "pecho", "empuje", { posicionSesion: "accesorio" })];
    const tecnicas: TecnicaEntrenamiento[] = [
      { id: "1", nombre: "Drop set", slug: "drop-set", tipo: "individual", cantidadEjercicios: null, nivelMinimo: "intermedio", fatiga: "alta", requiereSupervision: true, descansoInternoSeg: 0, descansoFinalSeg: 120, maximoPorSesion: 1 },
      { id: "2", nombre: "Fallo muscular", slug: "fallo-muscular", tipo: "individual", cantidadEjercicios: null, nivelMinimo: "intermedio", fatiga: "media", requiereSupervision: false, descansoInternoSeg: 0, descansoFinalSeg: 90, maximoPorSesion: 1 },
    ];
    const r = generarRutinaPorReglas(
      { ...perfil, experiencia: "avanzado" },
      { ...brief, dias: 1, distribucion: "personalizada", diaGrupos: [["pecho"]], ejerciciosPorSesion: 2, tecnicasPermitidas: ["fallo-muscular"] },
      bibliotecaAmplia,
      tecnicas
    );
    expect(r.dias[0].ejercicios.some((e) => e.tecnicaTipo === "Drop set")).toBe(false);
    expect(r.dias[0].ejercicios.some((e) => e.tecnicaTipo === "Fallo muscular")).toBe(true);
  });
});

describe("ejerciciosPorTiempo", () => {
  // Calibrado con el ejemplo del entrenador: en 60 minutos entran pecho
  // (plano, inclinado, aperturas) + press militar + dos de tríceps.
  it("60 minutos dan para seis ejercicios de fuerza", () => {
    expect(ejerciciosPorTiempo(60)).toBe(6);
  });

  it("120 minutos no inflan la sesión: el tiempo extra mejora descansos y ejecución", () => {
    expect(ejerciciosPorTiempo(120)).toBe(8);
  });

  it("el cardio se descuenta del tiempo de fuerza", () => {
    expect(ejerciciosPorTiempo(60, 20)).toBeLessThan(ejerciciosPorTiempo(60, 0));
  });

  it("nunca baja de 3 ni pasa de 8, aunque el tiempo sea extremo", () => {
    expect(ejerciciosPorTiempo(20)).toBe(3);
    expect(ejerciciosPorTiempo(300)).toBe(8);
  });

  it("un día combinado limita a tres ejercicios por grupo aunque se pidan doce", () => {
    expect(ejerciciosObjetivoDelDia(12, 2)).toBe(6);
    expect(ejerciciosObjetivoDelDia(8, 1)).toBe(6);
    expect(ejerciciosObjetivoDelDia(8, 4)).toBe(8);
  });
});

describe("reparto de técnicas en la semana", () => {
  const tecnicas: TecnicaEntrenamiento[] = [
    { id: "1", nombre: "Drop set", slug: "drop-set", tipo: "individual", cantidadEjercicios: null, nivelMinimo: "intermedio", fatiga: "alta", requiereSupervision: true, descansoInternoSeg: 0, descansoFinalSeg: 120, maximoPorSesion: 1 },
    { id: "2", nombre: "Rest-pause", slug: "rest-pause", tipo: "individual", cantidadEjercicios: null, nivelMinimo: "intermedio", fatiga: "alta", requiereSupervision: true, descansoInternoSeg: 0, descansoFinalSeg: 150, maximoPorSesion: 1 },
    { id: "3", nombre: "Fallo muscular", slug: "fallo-muscular", tipo: "individual", cantidadEjercicios: null, nivelMinimo: "intermedio", fatiga: "media", requiereSupervision: false, descansoInternoSeg: 0, descansoFinalSeg: 90, maximoPorSesion: 1 },
  ];
  const bibliotecaPecho = Array.from({ length: 4 }, (_, i) =>
    base(`pecho-${i}`, "pecho", "empuje", { posicionSesion: i === 0 ? "principal" : "accesorio" })
  );
  const briefSemana = {
    ...brief,
    dias: 4,
    distribucion: "personalizada" as const,
    diaGrupos: Array.from({ length: 4 }, () => ["pecho" as const]),
    ejerciciosPorSesion: 4,
    cardio: "ninguno" as const,
  };

  it("no le mete técnica a todos los días con intensidad estándar", () => {
    const dias = 4;
    const conTecnica = [0, 1, 2, 3].filter((i) => diaLlevaTecnica(i, dias, "estandar"));
    expect(conTecnica).toHaveLength(2);
    // Repartidos, no los dos primeros seguidos.
    expect(conTecnica).not.toEqual([0, 1]);
  });

  it("intensidad competitiva sí las lleva todos los días", () => {
    expect([0, 1, 2, 3].every((i) => diaLlevaTecnica(i, 4, "competitiva"))).toBe(true);
  });

  it("rota la técnica en vez de repetir la misma toda la semana", () => {
    const r = generarRutinaPorReglas(
      { ...perfil, experiencia: "avanzado" },
      { ...briefSemana, intensidadDeseada: "competitiva" },
      bibliotecaPecho,
      tecnicas
    );
    const usadas = r.dias
      .map((d) => d.ejercicios.map((e) => e.tecnicaTipo).filter(Boolean).join("+"))
      .filter(Boolean);
    expect(usadas.length).toBeGreaterThan(1);
    expect(new Set(usadas).size).toBeGreaterThan(1);
  });

  it("deja escrito en qué serie va la técnica", () => {
    const r = generarRutinaPorReglas(
      { ...perfil, experiencia: "avanzado" },
      { ...briefSemana, intensidadDeseada: "competitiva" },
      bibliotecaPecho,
      tecnicas
    );
    const conTecnica = r.dias.flatMap((d) => d.ejercicios).filter((e) => e.tecnicaInstruccion);
    expect(conTecnica.length).toBeGreaterThan(0);
    expect(conTecnica.every((e) => e.tecnicaInstruccion?.startsWith("Última serie:"))).toBe(true);
  });

  it("dosifica las familias de intensidad según nivel e intensidad", () => {
    expect(maximoTecnicasPorSesion("principiante", "competitiva")).toBe(1);
    expect(maximoTecnicasPorSesion("intermedio", "estandar")).toBe(1);
    expect(maximoTecnicasPorSesion("intermedio", "competitiva")).toBe(2);
    expect(maximoTecnicasPorSesion("avanzado", "alta")).toBe(2);
  });

  it("un avanzado con intensidad alta puede combinar hasta dos familias en el día", () => {
    const tecnicasCombinables: TecnicaEntrenamiento[] = [
      { id: "1", nombre: "Biserie", slug: "biserie", tipo: "encadenada", cantidadEjercicios: 2, nivelMinimo: "intermedio", fatiga: "media", requiereSupervision: false, descansoInternoSeg: 0, descansoFinalSeg: 90, maximoPorSesion: 1 },
      { id: "2", nombre: "Fallo muscular", slug: "fallo-muscular", tipo: "individual", cantidadEjercicios: null, nivelMinimo: "intermedio", fatiga: "media", requiereSupervision: false, descansoInternoSeg: 0, descansoFinalSeg: 90, maximoPorSesion: 1 },
    ];
    const biblioteca = Array.from({ length: 5 }, (_, i) => base(`pecho-${i}`, "pecho", i === 0 ? "empuje" : "aislamiento", { posicionSesion: i === 0 ? "principal" : "accesorio" }));
    const r = generarRutinaPorReglas(
      { ...perfil, experiencia: "avanzado" },
      { ...briefSemana, dias: 1, diaGrupos: [["pecho"]], ejerciciosPorSesion: 5, intensidadDeseada: "alta" },
      biblioteca,
      tecnicasCombinables
    );
    const familias = new Set(r.dias[0].ejercicios.map((e) => e.tecnicaTipo).filter(Boolean));
    expect(familias).toEqual(new Set(["Biserie", "Fallo muscular"]));
  });

  it("FST-7 se convierte en siete series reales, no en una etiqueta decorativa", () => {
    const tecnicaFst: TecnicaEntrenamiento[] = [
      { id: "fst", nombre: "FST-7", slug: "fst-7", tipo: "individual", cantidadEjercicios: null, nivelMinimo: "avanzado", fatiga: "alta", requiereSupervision: true, descansoInternoSeg: 30, descansoFinalSeg: 90, maximoPorSesion: 1 },
    ];
    const bibliotecaFst = [
      base("press-banca", "pecho", "empuje", { nombre: "Press de banca", posicionSesion: "principal" }),
      base("press-inclinado", "pecho", "empuje", { nombre: "Press inclinado", posicionSesion: "accesorio" }),
      base("aperturas", "pecho", "aislamiento", { nombre: "Aperturas en polea", posicionSesion: "accesorio" }),
    ];
    const r = generarRutinaPorReglas(
      { ...perfil, experiencia: "avanzado" },
      { ...briefSemana, dias: 1, diaGrupos: [["pecho"]], ejerciciosPorSesion: 3, intensidadDeseada: "competitiva" },
      bibliotecaFst,
      tecnicaFst
    );
    const aplicado = r.dias[0].ejercicios.find((e) => e.tecnicaTipo === "FST-7");
    expect(aplicado).toMatchObject({ nombre: "Aperturas en polea", series: 7, reps: "10-15" });
    expect(aplicado?.tecnicaInstruccion).toContain("7 series");
  });

  it("un giant set avanzado enlaza cuatro ejercicios y descansa al cerrar", () => {
    const giantSet: TecnicaEntrenamiento[] = [
      { id: "giant", nombre: "Giant set", slug: "giant-set", tipo: "encadenada", cantidadEjercicios: 4, nivelMinimo: "avanzado", fatiga: "alta", requiereSupervision: true, descansoInternoSeg: 0, descansoFinalSeg: 120, maximoPorSesion: 1 },
    ];
    const bibliotecaCinco = Array.from({ length: 5 }, (_, i) =>
      base(`pecho-giant-${i}`, "pecho", i === 0 ? "empuje" : "aislamiento", { posicionSesion: i === 0 ? "principal" : "accesorio" })
    );
    const r = generarRutinaPorReglas(
      { ...perfil, experiencia: "avanzado" },
      { ...briefSemana, dias: 1, diaGrupos: [["pecho"]], ejerciciosPorSesion: 5, intensidadDeseada: "competitiva" },
      bibliotecaCinco,
      giantSet
    );
    const bloque = r.dias[0].ejercicios.filter((e) => e.tecnicaTipo === "Giant set");
    expect(bloque).toHaveLength(4);
    expect(bloque.slice(0, -1).every((e) => e.descansoSegundos === 0)).toBe(true);
    expect(bloque.at(-1)?.descansoSegundos).toBe(120);
  });
});

describe("cardio por modalidad", () => {
  const bibliotecaCardio = [
    base("pecho-1", "pecho", "empuje"),
    { ...base("caminadora", "cardio", "cardio"), nombre: "Caminadora" },
    { ...base("spinning", "cardio", "cardio"), nombre: "Bicicleta de spinning" },
    { ...base("burpees", "cardio", "cardio"), nombre: "Burpees" },
    { ...base("cuerda", "cardio", "cardio"), nombre: "Salto de cuerda" },
    { ...base("slam", "cardio", "cardio"), nombre: "Slam ball" },
  ];
  const briefCardio = { ...brief, dias: 2, distribucion: "personalizada" as const, diaGrupos: [["pecho" as const], ["pecho" as const]], ejerciciosPorSesion: 1, evitarSaltos: false };

  it("elige la máquina que pidió el entrenador, no la primera del catálogo", () => {
    const r = generarRutinaPorReglas(perfil, { ...briefCardio, cardio: "spinning" }, bibliotecaCardio);
    const cardio = r.dias[0].ejercicios.filter((e) => e.grupoMuscular === "cardio");
    expect(cardio).toHaveLength(1);
    expect(cardio[0].nombre).toBe("Bicicleta de spinning");
    expect(cardio[0].reps).toBe("10 min");
  });

  it("el funcional arma un circuito de varias estaciones, no un solo bloque", () => {
    const r = generarRutinaPorReglas(perfil, { ...briefCardio, cardio: "funcional", cardioMinutos: 12 }, bibliotecaCardio);
    const cardio = r.dias[0].ejercicios.filter((e) => e.grupoMuscular === "cardio");
    expect(cardio.length).toBeGreaterThan(1);
    expect(cardio.every((e) => e.reps.endsWith("s"))).toBe(true);
  });

  it("en circuito entran todas las estaciones marcadas, no un recorte", () => {
    const r = generarRutinaPorReglas(
      perfil,
      { ...briefCardio, cardio: "funcional", cardioEjercicios: ["burpees", "cuerda", "slam"] },
      bibliotecaCardio
    );
    const cardio = r.dias[0].ejercicios.filter((e) => e.grupoMuscular === "cardio");
    expect(cardio).toHaveLength(3);
    expect(cardio.every((e) => e.observacion?.includes("Circuito"))).toBe(true);
  });

  it("\"separados\" da bloques con descanso real, no un circuito", () => {
    const r = generarRutinaPorReglas(
      perfil,
      { ...briefCardio, cardio: "funcional", cardioFormato: "separado", cardioEjercicios: ["burpees", "slam"] },
      bibliotecaCardio
    );
    const cardio = r.dias[0].ejercicios.filter((e) => e.grupoMuscular === "cardio");
    expect(cardio).toHaveLength(2);
    expect(cardio.every((e) => e.descansoSegundos === 60)).toBe(true);
    expect(cardio.every((e) => e.observacion?.includes("por separado"))).toBe(true);
  });

  it("respeta los movimientos marcados a mano para el circuito", () => {
    const r = generarRutinaPorReglas(
      perfil,
      { ...briefCardio, cardio: "funcional", cardioEjercicios: ["slam"] },
      bibliotecaCardio
    );
    const cardio = r.dias[0].ejercicios.filter((e) => e.grupoMuscular === "cardio");
    expect(cardio.every((e) => e.nombre === "Slam ball")).toBe(true);
  });

  it("excluir saltos deja fuera burpees y salto de cuerda del circuito", () => {
    const conSalto = bibliotecaCardio.map((e) =>
      e.id === "burpees" || e.id === "cuerda" ? { ...e, requiereSalto: true, impacto: "alto" as const } : e
    );
    const r = generarRutinaPorReglas(perfil, { ...briefCardio, cardio: "funcional", evitarSaltos: true }, conSalto);
    const nombres = r.dias.flatMap((d) => d.ejercicios).filter((e) => e.grupoMuscular === "cardio").map((e) => e.nombre);
    expect(nombres).not.toContain("Burpees");
    expect(nombres).not.toContain("Salto de cuerda");
  });

  // Norma del entrenador: "no se pueden agregar ejercicios o maquinaria que
  // no estén en el gimnasio". Si la caminadora no está cargada, la opción
  // "Caminadora" no se puede ni ofrecer.
  it("solo ofrece las modalidades que existen en la biblioteca", () => {
    const disponibles = modalidadesCardioDisponibles(["Bicicleta estática", "Burpees", "Slam ball"]);
    expect(disponibles).toContain("spinning");
    expect(disponibles).toContain("funcional");
    expect(disponibles).not.toContain("caminadora");
    expect(disponibles).not.toContain("steps");
  });

  it("sin ningún cardio cargado no ofrece ninguna modalidad", () => {
    expect(modalidadesCardioDisponibles([])).toEqual([]);
  });

  it("la escaladora cuenta como steps, no como circuito funcional", () => {
    expect(modalidadesCardioDisponibles(["Escaladora"])).toEqual(["steps"]);
  });

  it("sin cardio no agrega nada al final del día", () => {
    const r = generarRutinaPorReglas(perfil, { ...briefCardio, cardio: "ninguno" }, bibliotecaCardio);
    expect(r.dias.flatMap((d) => d.ejercicios).some((e) => e.grupoMuscular === "cardio")).toBe(false);
  });
});
