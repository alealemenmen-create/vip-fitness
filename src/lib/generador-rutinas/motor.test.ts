import { describe, expect, it } from "vitest";
import { diaLlevaTecnica, ejerciciosPorTiempo, generarRutinaPorReglas, modalidadesCardioDisponibles } from "./motor";
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

  it("el título incluye el nivel y, si hay, el grupo prioritario como enfoque", () => {
    const bibliotecaSimple = [base("full-1", "pecho", "full_body", { posicionSesion: "principal" })];
    const r = generarRutinaPorReglas(
      { ...perfil, experiencia: "avanzado" },
      { ...brief, dias: 1, distribucion: "full_body", ejerciciosPorSesion: 1, grupoPrioritario: "piernas" },
      bibliotecaSimple
    );
    expect(r.nombreRutina).toBe("Plan hipertrofia avanzado — enfoque piernas");
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

  it("120 minutos permiten el doble: dos o tres más por grupo muscular", () => {
    expect(ejerciciosPorTiempo(120)).toBe(12);
  });

  it("el cardio se descuenta del tiempo de fuerza", () => {
    expect(ejerciciosPorTiempo(60, 20)).toBeLessThan(ejerciciosPorTiempo(60, 0));
  });

  it("nunca baja de 3 ni pasa de 15, aunque el tiempo sea extremo", () => {
    expect(ejerciciosPorTiempo(20)).toBe(3);
    expect(ejerciciosPorTiempo(300)).toBe(15);
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
