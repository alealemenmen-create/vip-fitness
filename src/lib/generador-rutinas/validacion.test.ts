import { describe, expect, it } from "vitest";
import { auditarRutinaDeterminista } from "./validacion";

const biblioteca = [{ id: "11111111-1111-4111-8111-111111111111", nombre: "Prensa VIP", grupoMuscular: "piernas" }];
const rutina = (ejercicioId?: string | null, nombre = "Prensa VIP") => ({ nombreRutina: "Plan VIP", dias: [{ numero: 1, nombre: "Piernas", tipo: "entrenamiento" as const, descripcion: null, ejercicios: [{ orden: 1, ejercicioId, nombre, series: 3, reps: "10", descansoSegundos: 60, tecnicaTipo: null, tecnicaInstruccion: null, observacion: null, grupoMuscular: "piernas" as const }] }] });

describe("auditarRutinaDeterminista", () => {
  it("rechaza un ID inválido aunque el nombre coincida", () => expect(auditarRutinaDeterminista({ rutina: rutina("22222222-2222-4222-8222-222222222222"), biblioteca, origen: "generador" }).valida).toBe(false));
  it("rechaza la ausencia de ID en el generador", () => expect(auditarRutinaDeterminista({ rutina: rutina(null), biblioteca, origen: "generador" }).valida).toBe(false));
  it("mantiene la compatibilidad del legado sin ID", () => expect(auditarRutinaDeterminista({ rutina: rutina(undefined, "Nombre histórico"), biblioteca, origen: "legado_pdf" }).valida).toBe(true));
  it("bloquea IDs prohibidos", () => expect(auditarRutinaDeterminista({ rutina: rutina(biblioteca[0].id), biblioteca, origen: "generador", idsProhibidos: [biblioteca[0].id] }).hallazgos.some((hallazgo) => hallazgo.codigo === "EJERCICIO_PROHIBIDO")).toBe(true));
});
