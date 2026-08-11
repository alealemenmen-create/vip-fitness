import { describe, expect, it } from "vitest";
import { briefDesdeNivel, NIVELES_ARMADO, type NivelArmado } from "./niveles-armado";
import { generarRutinaPorReglas } from "./motor";
import type { EjercicioGenerador, PerfilEntrenamiento } from "./tipos";

const perfil: PerfilEntrenamiento = {
  alumnoId: "a",
  sexo: null,
  edad: null,
  ejerciciosRecientes: [],
  objetivoPrincipal: "hipertrofia",
  objetivoSecundario: null,
  diasDisponibles: 3,
  minutosSesion: 60,
  // Avanzado a propósito: es el caso donde los tres niveles TIENEN que
  // diferenciarse por el preset y no por el nivel del alumno.
  experiencia: "avanzado",
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

const base = (
  id: string,
  nombre: string,
  grupoMuscular: EjercicioGenerador["grupoMuscular"],
  categoria: EjercicioGenerador["categoria"],
  extra: Partial<EjercicioGenerador> = {}
): EjercicioGenerador => ({
  id,
  nombre,
  grupoMuscular,
  categoria,
  equipo: "maquina",
  nivel: "principiante",
  posicionSesion: "principal",
  ...extra,
});

const biblioteca: EjercicioGenerador[] = [
  base("press-banca", "Press de banca", "pecho", "empuje"),
  base("press-inclinado", "Press inclinado con mancuernas", "pecho", "empuje"),
  base("aperturas", "Aperturas en polea", "pecho", "aislamiento"),
  base("jalon", "Jalón al pecho", "espalda", "traccion"),
  base("remo", "Remo en polea baja", "espalda", "traccion"),
  base("pullover", "Pullover en polea alta", "espalda", "traccion"),
  base("press-militar", "Press militar", "hombros", "empuje"),
  base("laterales", "Elevaciones laterales", "hombros", "aislamiento"),
  // Varios por sub-grupo a propósito: con un solo bíceps el día se quedaba
  // corto por falta de catálogo y no por el tope del nivel, que es lo que
  // este archivo tiene que medir.
  base("curl", "Curl con barra", "brazos", "aislamiento"),
  base("curl-martillo", "Curl martillo", "brazos", "aislamiento"),
  base("curl-predicador", "Curl predicador", "brazos", "aislamiento"),
  base("triceps", "Extensión de tríceps en polea", "brazos", "aislamiento"),
  base("fondos", "Fondos de tríceps", "brazos", "aislamiento"),
  base("press-maquina", "Press de pecho en máquina", "pecho", "empuje"),
  base("sentadilla", "Sentadilla", "piernas", "pierna"),
  base("prensa", "Prensa", "piernas", "pierna"),
  base("curl-femoral", "Curl femoral", "piernas", "pierna"),
  base("crunch", "Crunch abdominal", "core", "core"),
  // Con salto e impacto alto: el nivel senior tiene que dejarlo afuera.
  base("box-jump", "Sentadilla con salto", "piernas", "pierna", { requiereSalto: true, impacto: "alto" }),
];

const generar = (nivel: NivelArmado) =>
  generarRutinaPorReglas(
    perfil,
    briefDesdeNivel(nivel, { alumnoId: "a", dias: 3, minutosSesion: 60 }),
    biblioteca
  );

const seriesTotales = (r: ReturnType<typeof generar>) =>
  r.dias.reduce((total, d) => total + d.ejercicios.reduce((s, e) => s + e.series, 0), 0);

describe("niveles de armado manual", () => {
  it("los tres niveles producen rutinas distintas con el mismo alumno", () => {
    const competitivo = generar("competitivo");
    const estandar = generar("estandar");
    const senior = generar("senior");

    // Volumen semanal ordenado de mayor a menor, que es lo que separa a los
    // tres niveles para el entrenador.
    expect(seriesTotales(competitivo)).toBeGreaterThan(seriesTotales(estandar));
    expect(seriesTotales(estandar)).toBeGreaterThan(seriesTotales(senior));
  });

  it("senior no incluye saltos ni impacto alto, aunque el alumno sea avanzado", () => {
    const senior = generar("senior");
    const nombres = senior.dias.flatMap((d) => d.ejercicios.map((e) => e.nombre));
    expect(nombres).not.toContain("Sentadilla con salto");
  });

  it("senior no aplica técnicas de intensidad aunque el nivel del alumno las permita", () => {
    const senior = generar("senior");
    const conTecnica = senior.dias.flatMap((d) => d.ejercicios).filter((e) => e.tecnicaTipo !== null);
    expect(conTecnica).toHaveLength(0);
  });

  it("competitivo pide más ejercicios por sesión que senior", () => {
    expect(NIVELES_ARMADO.competitivo.brief.ejerciciosPorSesion).toBeGreaterThan(
      NIVELES_ARMADO.senior.brief.ejerciciosPorSesion
    );
    const competitivo = generar("competitivo");
    const senior = generar("senior");
    expect(competitivo.dias[0].ejercicios.length).toBeGreaterThan(senior.dias[0].ejercicios.length);
  });

  it("el brief que arma cada nivel respeta los días y minutos del alumno", () => {
    const brief = briefDesdeNivel("estandar", { alumnoId: "x", dias: 5, minutosSesion: 90 });
    expect(brief.dias).toBe(5);
    expect(brief.minutosSesion).toBe(90);
    expect(brief.alumnoId).toBe("x");
  });

  it("ofrece la escala completa de nivel solicitada por el entrenador", () => {
    expect(["principiante", "intermedio", "avanzado", "olympia", "profesional"].map((nivel) =>
      NIVELES_ARMADO[nivel as keyof typeof NIVELES_ARMADO].etiqueta
    )).toEqual(["Principiante", "Intermedio", "Avanzado", "Olympia", "Profesional"]);
    expect(NIVELES_ARMADO.principiante.brief.tecnicasIntensidad).toBe("no");
    expect(NIVELES_ARMADO.olympia.brief.intensidadDeseada).toBe("competitiva");
  });
});
