import { describe, expect, it } from "vitest";
import { emparejarEjercicio } from "./emparejar";
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
    patronMovimiento: null,
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
