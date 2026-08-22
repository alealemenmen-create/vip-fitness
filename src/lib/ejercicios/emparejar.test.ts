import { describe, expect, it } from "vitest";
import { detectarAliasEnDisputa, emparejarEjercicio } from "./emparejar";
import type { Ejercicio } from "./tipos";

/** Biblioteca mínima de prueba, con los mismos casos límite que ya están
 * documentados como comentarios en emparejar.ts — así quedan verificados de
 * verdad en vez de solo confiar en que nadie los rompa sin darse cuenta. */
function ejercicio(overrides: Partial<Ejercicio> & Pick<Ejercicio, "id" | "nombre">): Ejercicio {
  return {
    slug: overrides.nombre.toLowerCase().replace(/\s+/g, "-"),
    aliases: [],
    grupoMuscular: "pecho",
    gruposSecundarios: [],
    categoria: "empuje",
    equipo: "barra",
    nivel: "intermedio",
    descripcionCorta: null,
    tecnica: null,
    erroresComunes: [],
    consejos: [],
    ilustracionSlug: null,
    videoUrl: null,
    videoCloudflareUid: null,
    videoCloudflareEstado: null,
    videoCloudflareDuracionSeg: null,
    videoCloudflareMiniaturaUrl: null,
    videoCloudflareError: null,
    fotoMiniaturaUrl: null,
    fotoCompletaUrl: null,
    fotoPanoramaX: 50,
    fotoPanoramaY: 50,
    fotoCuadradaX: 50,
    fotoCuadradaY: 50,
    fotoHash: null,
    patronMovimiento: null,
    articulaciones: [],
    impacto: "bajo",
    requiereSalto: false,
    lateralidad: "bilateral",
    complejidad: "media",
    requiereSupervision: false,
    tiempoMontaje: "bajo",
    aptoCircuito: true,
    posicionSesion: "accesorio",
    etiquetasPrecaucion: [],
    sustitutosIds: [],
    impulsoIntensidadMaxima: "ninguna",
    impulsoTecnicasPermitidas: [],
    impulsoRequiereSupervision: true,
    impulsoPerfilRevisado: false,
    ...overrides,
  };
}

const BIBLIOTECA: Ejercicio[] = [
  ejercicio({ id: "1", nombre: "Press de banca", aliases: ["press banca plano", "press pecho", "bench press"] }),
  ejercicio({ id: "2", nombre: "Press plano con mancuernas", equipo: "mancuerna", aliases: ["press mancuernas"] }),
  ejercicio({ id: "3", nombre: "Press militar", grupoMuscular: "hombros", aliases: ["press hombro"] }),
  ejercicio({ id: "4", nombre: "Salto a la cuerda", grupoMuscular: "cardio", aliases: ["cuerda", "jump rope"] }),
  ejercicio({ id: "5", nombre: "Trepar la cuerda", grupoMuscular: "espalda", aliases: ["rope climb"] }),
  ejercicio({ id: "6", nombre: "Remo sentado en polea", grupoMuscular: "espalda", equipo: "polea", aliases: ["remo sentado", "seated row"] }),
  ejercicio({ id: "7", nombre: "Dominadas", grupoMuscular: "espalda", aliases: ["pull ups", "barra fija"] }),
  ejercicio({ id: "8", nombre: "Sentadilla", grupoMuscular: "piernas", aliases: ["squat"] }),
];

describe("emparejarEjercicio", () => {
  it("empareja por coincidencia exacta del nombre, con confianza exacta", () => {
    const r = emparejarEjercicio("Press de banca", BIBLIOTECA);
    expect(r?.ejercicio.id).toBe("1");
    expect(r?.confianza).toBe("exacta");
  });

  it("empareja por alias, con confianza exacta", () => {
    const r = emparejarEjercicio("bench press", BIBLIOTECA);
    expect(r?.ejercicio.id).toBe("1");
    expect(r?.confianza).toBe("exacta");
  });

  it("es insensible a mayúsculas, tildes y espacios extra", () => {
    const r = emparejarEjercicio("  PRESS   DE   BÁNCA  ", BIBLIOTECA);
    expect(r?.ejercicio.id).toBe("1");
  });

  it("usa el equipo mencionado para desambiguar entre variantes del mismo movimiento", () => {
    // "Press banca con mancuernas" comparte "press"/"banca" con la entrada 1
    // (barra) tanto como con la 2 (mancuerna) — ver el comentario de
    // equipoMencionado en emparejar.ts sobre este caso real.
    const r = emparejarEjercicio("Press banca con mancuernas", BIBLIOTECA);
    expect(r?.ejercicio.id).toBe("2");
  });

  it("no empareja solo por compartir una palabra genérica (press militar vs press banca)", () => {
    const r = emparejarEjercicio("Press militar de pie con barra ancha", BIBLIOTECA);
    // Si emparejara, tendría que ser con la entrada 3 (press militar) por
    // "palabras en común" — nunca con la 1 solo por compartir "press".
    expect(r?.ejercicio.id !== "1").toBe(true);
  });

  it("no confunde 'trepar la cuerda' con 'cuerda' (salto a la cuerda) por contener la palabra", () => {
    const r = emparejarEjercicio("Cuerda", BIBLIOTECA);
    expect(r?.ejercicio.id).toBe("4");
    expect(r?.ejercicio.id !== "5").toBe(true);
  });

  it("recorta variantes con alternativas ('X o Y') y usa la primera opción, con confianza degradada", () => {
    const r = emparejarEjercicio("Dominadas o jalón pesado", BIBLIOTECA);
    expect(r?.ejercicio.id).toBe("7");
    // No es "exacta": tuvo que recortar el texto para emparejar, así que el
    // entrenador debería poder revisarlo (ver el comentario de
    // emparejarEjercicio en emparejar.ts).
    expect(r?.confianza).not.toBe("exacta");
  });

  it("saca calificadores de ejecución y sigue emparejando, con confianza degradada", () => {
    const r = emparejarEjercicio("Sentadilla pesada", BIBLIOTECA);
    expect(r?.ejercicio.id).toBe("8");
    expect(r?.confianza).not.toBe("exacta");
  });

  it("deja pasar 2 de 3 palabras en común (remo sentado en polea → alias remo sentado)", () => {
    const r = emparejarEjercicio("Remo sentado en polea", BIBLIOTECA);
    expect(r?.ejercicio.id).toBe("6");
  });

  it("devuelve null en vez de un emparejado dudoso cuando no hay nada parecido", () => {
    expect(emparejarEjercicio("Ejercicio totalmente inventado xyz", BIBLIOTECA)).toBeNull();
  });

  it("devuelve null con biblioteca vacía", () => {
    expect(emparejarEjercicio("Press de banca", [])).toBeNull();
  });
});

/**
 * Casos sacados de la base de producción el 15/08/2026. Cada uno le mostró al
 * alumno la foto de otro ejercicio y terminó en un reporte real, así que acá
 * quedan clavados para que no vuelvan a pasar.
 */
const BIBLIOTECA_REAL: Ejercicio[] = [
  ejercicio({
    id: "p1", nombre: "Press inclinado con barra", equipo: "barra",
    aliases: ["press inclinado", "press superior", "incline press"],
  }),
  ejercicio({
    id: "p2", nombre: "Press inclinado con mancuernas", equipo: "mancuerna",
    aliases: ["press inclinado mancuerna", "incline dumbbell press"],
  }),
  ejercicio({
    id: "p3", nombre: "Press de banca en Smith", equipo: "smith",
    aliases: ["press smith", "press multipower", "press banca maquina smith"],
  }),
  ejercicio({
    id: "p4", nombre: "Elevaciones laterales en polea", grupoMuscular: "hombros", equipo: "polea",
    aliases: ["laterales en polea", "lateral polea", "laterales cable"],
  }),
  ejercicio({
    id: "p5", nombre: "Extensión unilateral de cuádriceps", grupoMuscular: "piernas", equipo: "maquina",
    aliases: ["extension unilateral", "cuadriceps unilateral"],
  }),
  ejercicio({
    id: "p6", nombre: "Extensión unilateral de tríceps", grupoMuscular: "brazos", equipo: "polea",
    aliases: ["extension unilateral", "triceps unilateral", "pushdown a una mano"],
  }),
  ejercicio({
    id: "p7", nombre: "Patada de glúteo en polea", grupoMuscular: "piernas", equipo: "polea",
    aliases: ["patada gluteo cable", "cable kickback"],
  }),
];

describe("emparejarEjercicio — regresiones de producción", () => {
  it("entiende la abreviatura 'manc.' y no manda un ejercicio de mancuernas a la barra", () => {
    // 67 rutinas decían "Press inclinado manc." y mostraban una barra: el
    // desambiguador buscaba /\bmancuerna/ y "manc." nunca coincidía.
    const r = emparejarEjercicio("Press inclinado manc.", BIBLIOTECA_REAL);
    expect(r?.ejercicio.id).toBe("p2");
  });

  it("no cruza hombro con pecho aunque compartan 2 de 3 palabras", () => {
    // "Press de hombro en Smith" caía en "Press de banca en Smith" (0,666).
    const r = emparejarEjercicio("Press de hombro en Smith", BIBLIOTECA_REAL);
    expect(r?.ejercicio.id).not.toBe("p3");
  });

  it("no confunde una patada de glúteo con una elevación lateral de hombro", () => {
    const r = emparejarEjercicio("Patada Lateral en Polea o Banda", BIBLIOTECA_REAL);
    expect(r?.ejercicio.id).not.toBe("p4");
  });

  it("NUNCA elige cuádriceps o tríceps al azar cuando el alias es de los dos", () => {
    // El caso que más dolió: "extensión unilateral" está registrado en los dos
    // ejercicios, y antes ganaba el que la base devolviera primero.
    expect(emparejarEjercicio("Extensión unilateral", BIBLIOTECA_REAL)).toBeNull();
  });

  it("sí resuelve la extensión unilateral cuando el texto dice el músculo", () => {
    expect(emparejarEjercicio("Extensión unilateral de tríceps", BIBLIOTECA_REAL)?.ejercicio.id).toBe("p6");
    expect(emparejarEjercicio("Extensión unilateral de cuádriceps", BIBLIOTECA_REAL)?.ejercicio.id).toBe("p5");
  });

  it("el orden de la biblioteca no cambia el resultado", () => {
    const alReves = [...BIBLIOTECA_REAL].reverse();
    for (const nombre of ["Press inclinado manc.", "Extensión unilateral", "Extensión unilateral de tríceps"]) {
      expect(emparejarEjercicio(nombre, BIBLIOTECA_REAL)?.ejercicio.id ?? null)
        .toBe(emparejarEjercicio(nombre, alReves)?.ejercicio.id ?? null);
    }
  });
});

describe("detectarAliasEnDisputa", () => {
  it("encuentra el alias que dos ejercicios distintos reclaman", () => {
    const disputas = detectarAliasEnDisputa(BIBLIOTECA_REAL);
    const extension = disputas.find((d) => d.alias.toLowerCase().includes("extension unilateral"));
    expect(extension).toBeDefined();
    expect(extension!.ejercicios.map((e) => e.id).sort()).toEqual(["p5", "p6"]);
  });

  it("no inventa disputas en una biblioteca sana", () => {
    expect(detectarAliasEnDisputa(BIBLIOTECA)).toEqual([]);
  });
});
