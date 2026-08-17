import type { EjercicioSesion } from "@/app/alumno/entrenar/data";
import { repsObjetivo } from "./reps";

/**
 * Peso y reps objetivo a mostrar arriba del campo de carga: la meta de
 * Impulso VIP si hay una aprobada, si no el último registro o el rango que
 * escribió el entrenador. Extraído de SesionEjercicioCard.tsx (donde vivía
 * inline) para que SesionGrupoCard.tsx (biseries/triseries) pueda mostrar
 * lo mismo — antes esa pantalla no tenía ninguna referencia de peso al
 * entrar a cargar una serie, a diferencia del ejercicio suelto (pedido de
 * Alejandro, 2026-08-17).
 */
export function objetivoSerie(ejercicio: EjercicioSesion, esTiempo: boolean) {
  // Solo una recomendación APROBADA precarga algo — 'propuesta' (esperando
  // al entrenador) y 'bloqueada' (Regla E) nunca sugieren peso ni reps.
  const recomendacionAprobada =
    ejercicio.recomendacionImpulso
    && (ejercicio.recomendacionImpulso.estado === "aprobada" || ejercicio.recomendacionImpulso.estado === "modificada")
      ? ejercicio.recomendacionImpulso
      : null;
  const pesoSugeridoEfectivo =
    recomendacionAprobada && !recomendacionAprobada.esPesoCorporal ? recomendacionAprobada.pesoSugeridoKg : null;
  const objetivoReps = recomendacionAprobada?.repsObjetivoMax ?? repsObjetivo(ejercicio.repsProgramadas);
  const pesoObjetivoKg = pesoSugeridoEfectivo ?? (
    !ejercicio.ultimoRegistro?.esPesoCorporal ? ejercicio.ultimoRegistro?.pesoKg ?? null : null
  );
  const pesoObjetivoTexto = recomendacionAprobada?.esPesoCorporal || ejercicio.ultimoRegistro?.esPesoCorporal
    ? "Peso corporal"
    : pesoObjetivoKg != null
      ? `${pesoObjetivoKg} kg`
      : "— kg";
  const repsObjetivoTexto = recomendacionAprobada?.repsObjetivoMin != null
    ? recomendacionAprobada.repsObjetivoMax != null && recomendacionAprobada.repsObjetivoMax !== recomendacionAprobada.repsObjetivoMin
      ? `${recomendacionAprobada.repsObjetivoMin}–${recomendacionAprobada.repsObjetivoMax} reps`
      : `${recomendacionAprobada.repsObjetivoMin} reps`
    : `${ejercicio.repsProgramadas}${esTiempo ? " seg" : " reps"}`;

  return { recomendacionAprobada, pesoSugeridoEfectivo, objetivoReps, pesoObjetivoKg, pesoObjetivoTexto, repsObjetivoTexto };
}
