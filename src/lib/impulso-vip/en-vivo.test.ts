import { describe, expect, it } from "vitest";
import {
  calcularIntervencionEnVivo,
  calcularIntervencionesEnVivo,
  calibrarCierreControlado,
  grupoMuscularPrioritarioDia,
  puntajeCandidatoDestacado,
  resolverCupoImpulsoSesion,
} from "./en-vivo";

const base = {
  seriesProgramadas: 4,
  tecnicaProgramada: null,
  ejercicioVinculado: true,
  recomendacion: {
    regla: "A_subir_reps" as const,
    pesoSugeridoKg: 70,
    repsObjetivoMin: 8,
    repsObjetivoMax: 10,
    justificacion: "Suma una repeticion.",
    estado: "aprobada" as const,
  },
};

describe("calcularIntervencionEnVivo", () => {
  it("prepara un cierre seguro en la ultima serie", () => {
    const resultado = calcularIntervencionEnVivo(base);
    expect(resultado?.serieObjetivo).toBe(4);
    expect(resultado?.tipo).toBe("cierre_controlado");
    expect(resultado?.instruccion).toContain("70 kg");
    expect(resultado?.firma).toBe("Metodo de Ale Mendoza");
  });

  it("no apila una intervencion sobre una tecnica programada", () => {
    expect(calcularIntervencionEnVivo({ ...base, tecnicaProgramada: "Drop set" })).toBeNull();
  });

  it("no interviene con una recomendacion bloqueada o de reduccion", () => {
    expect(
      calcularIntervencionEnVivo({ ...base, recomendacion: { ...base.recomendacion, estado: "bloqueada" } })
    ).toBeNull();
    expect(
      calcularIntervencionEnVivo({
        ...base,
        recomendacion: { ...base.recomendacion, regla: "D_reducir" },
      })
    ).toBeNull();
  });

  it("evita convertir ejercicios muy cortos en ruido", () => {
    expect(calcularIntervencionEnVivo({ ...base, seriesProgramadas: 2 })).toBeNull();
  });
});

describe("calcularIntervencionesEnVivo", () => {
  it("usa una sola aparicion fuerte con tres o cuatro series", () => {
    expect(calcularIntervencionesEnVivo(base)).toHaveLength(1);
  });

  it("agrega una orientacion intermedia en ejercicios de cinco series", () => {
    const resultado = calcularIntervencionesEnVivo({ ...base, seriesProgramadas: 5 });
    expect(resultado.map((i) => i.serieObjetivo)).toEqual([3, 5]);
    expect(resultado[0].prescripcion.requiereResultado).toBe(false);
  });
});

describe("puntajeCandidatoDestacado", () => {
  it("puntua mas alto un compuesto del grupo prioritario que uno aislado de otro grupo", () => {
    const compuestoDelDia = puntajeCandidatoDestacado(
      { categoria: "empuje", posicionSesion: "principal", grupoMuscular: "pecho" },
      "pecho"
    );
    const aisladoDeOtroGrupo = puntajeCandidatoDestacado(
      { categoria: "aislamiento", posicionSesion: "accesorio", grupoMuscular: "brazos" },
      "pecho"
    );
    expect(compuestoDelDia).toBeGreaterThan(aisladoDeOtroGrupo);
  });

  it("reconoce compuesto por categoria aunque la posicion de sesion sea accesorio", () => {
    expect(
      puntajeCandidatoDestacado({ categoria: "pierna", posicionSesion: "accesorio", grupoMuscular: "piernas" }, null)
    ).toBeGreaterThan(0);
  });

  it("no suma nada a un aislado fuera del grupo prioritario y sin posicion principal", () => {
    expect(
      puntajeCandidatoDestacado({ categoria: "aislamiento", posicionSesion: "accesorio", grupoMuscular: "brazos" }, "pecho")
    ).toBe(0);
  });
});

describe("grupoMuscularPrioritarioDia", () => {
  it("elige el grupo muscular mas repetido", () => {
    expect(grupoMuscularPrioritarioDia(["pecho", "brazos", "pecho", "hombros", "pecho"])).toBe("pecho");
  });

  it("en un empate, gana el primero en aparecer", () => {
    expect(grupoMuscularPrioritarioDia(["espalda", "piernas", "espalda", "piernas"])).toBe("espalda");
  });

  it("ignora ejercicios sin grupo (no vinculados a la biblioteca)", () => {
    expect(grupoMuscularPrioritarioDia([null, "core", null, "core"])).toBe("core");
  });

  it("devuelve null cuando no hay ningun grupo", () => {
    expect(grupoMuscularPrioritarioDia([null, null])).toBeNull();
  });
});

describe("resolverCupoImpulsoSesion", () => {
  it("mantiene un reto para un alumno nuevo o con evidencia incompleta", () => {
    expect(resolverCupoImpulsoSesion([])).toBe(1);
    expect(resolverCupoImpulsoSesion([
      { resultado: "lograda", verificacion: "datos" },
      { resultado: "lograda", verificacion: "declarada" },
      { resultado: "lograda", verificacion: "datos" },
      { resultado: "lograda", verificacion: "datos" },
    ])).toBe(1);
  });

  it("habilita el segundo reto tras cuatro logros verificados", () => {
    expect(resolverCupoImpulsoSesion(Array.from({ length: 4 }, () => ({
      resultado: "lograda" as const,
      verificacion: "datos" as const,
    })))).toBe(2);
  });
});

describe("calibrarCierreControlado", () => {
  const prescripcion = { repsObjetivoMin: 8, repsObjetivoMax: 10, repsObjetivo: 10 };

  it("contiene la exigencia cuando la serie anterior llego al limite", () => {
    const resultado = calibrarCierreControlado("Base", prescripcion, 0);
    expect(resultado.instruccion).toContain("8 repeticiones limpias");
    expect(resultado.prescripcion.repsObjetivo).toBe(8);
  });

  it("pide una mas solo cuando existe margen", () => {
    const resultado = calibrarCierreControlado("Base", prescripcion, 3);
    expect(resultado.instruccion).toContain("pelea una mas");
    expect(resultado.prescripcion.repsObjetivo).toBe(10);
  });
});
