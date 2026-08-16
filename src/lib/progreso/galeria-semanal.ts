import { lunesDeISO, sumarDiasISO } from "@/lib/date";

/**
 * Una foto de progreso ya resuelta (con URL firmada) — mismo shape que
 * `FotoProgreso` en `app/alumno/progreso/data.ts`, repetido acá para que
 * esta función sea pura y no dependa de ese módulo (que sí toca Supabase).
 */
export type FotoSemanaInput = {
  id: string;
  fechaFoto: string;
  fechaCarga: string;
  url: string | null;
  storagePath: string;
};

export type SemanaGaleria = {
  /** Lunes de la semana, YYYY-MM-DD — la clave. */
  lunes: string;
  domingo: string;
  /** Es la semana en curso: la única donde se puede subir o borrar. */
  esActual: boolean;
  foto: FotoSemanaInput | null;
};

/**
 * Arma la línea de tiempo semanal de fotos de progreso: una entrada por
 * cada semana desde la primera foto que el alumno subió hasta la semana en
 * curso, con o sin foto.
 *
 * Semanas sin foto SE INCLUYEN a propósito (pedido explícito: "si no la
 * sube, se cierra la semana... que diga de esta fecha a esta fecha no
 * hubieron fotos" — no se disimula un hueco). Si el alumno todavía no subió
 * ninguna, el resultado es un array de un solo elemento: la semana actual,
 * vacía.
 *
 * Si por datos de antes de esta función existieran dos fotos en la misma
 * semana (no había límite semanal antes de este cambio), se conserva la de
 * `fechaCarga` más reciente — ninguna foto real se borra de la base, solo
 * se elige cuál representa esa semana en la línea de tiempo.
 */
export function construirGaleriaSemanal(fotos: FotoSemanaInput[], hoyISO: string): SemanaGaleria[] {
  const porSemana = new Map<string, FotoSemanaInput>();
  for (const foto of fotos) {
    const lunes = lunesDeISO(foto.fechaFoto);
    const previa = porSemana.get(lunes);
    if (!previa || foto.fechaCarga > previa.fechaCarga) porSemana.set(lunes, foto);
  }

  const lunesActual = lunesDeISO(hoyISO);
  const semanasConFoto = [...porSemana.keys()].sort();
  const primerLunes = semanasConFoto[0] ?? lunesActual;

  const semanas: SemanaGaleria[] = [];
  for (let lunes = primerLunes; lunes <= lunesActual; lunes = sumarDiasISO(lunes, 7)) {
    semanas.push({
      lunes,
      domingo: sumarDiasISO(lunes, 6),
      esActual: lunes === lunesActual,
      foto: porSemana.get(lunes) ?? null,
    });
  }
  return semanas;
}
