import { finQuincenaISO, quincenaDeISO, siguienteQuincenaISO } from "@/lib/date";

/**
 * Una foto de progreso ya resuelta (con URL firmada) — mismo shape que
 * `FotoProgreso` en `app/alumno/progreso/data.ts`, repetido acá para que
 * esta función sea pura y no dependa de ese módulo (que sí toca Supabase).
 */
export type FotoGaleriaInput = {
  id: string;
  fechaFoto: string;
  fechaCarga: string;
  url: string | null;
  storagePath: string;
};

export type QuincenaGaleria = {
  /** Primer día de la quincena, YYYY-MM-DD — la clave. */
  inicio: string;
  fin: string;
  /** Es la quincena en curso: la única donde se puede subir o borrar. */
  esActual: boolean;
  foto: FotoGaleriaInput | null;
};

/**
 * Arma la línea de tiempo quincenal de fotos de progreso: una entrada por
 * cada quincena desde la primera foto que el alumno subió hasta la quincena
 * en curso, con o sin foto.
 *
 * Cada 15 días, no cada semana (pedido de Alejandro, 2026-08-16: "semanal
 * es muy pronto para ver resultados" — el físico cambia más despacio que el
 * peso). Quincenas sin foto SE INCLUYEN a propósito, mismo criterio que
 * antes: no se disimula un hueco. Si el alumno todavía no subió ninguna, el
 * resultado es un array de un solo elemento: la quincena actual, vacía.
 *
 * Si por datos de antes de esta función existieran dos fotos en la misma
 * quincena (no había límite antes de esta regla, o venían de cuando el
 * límite era semanal), se conserva la de `fechaCarga` más reciente —
 * ninguna foto real se borra de la base, solo se elige cuál representa esa
 * quincena en la línea de tiempo.
 */
export function construirGaleriaQuincenal(fotos: FotoGaleriaInput[], hoyISO: string): QuincenaGaleria[] {
  const porQuincena = new Map<string, FotoGaleriaInput>();
  for (const foto of fotos) {
    const inicio = quincenaDeISO(foto.fechaFoto);
    const previa = porQuincena.get(inicio);
    if (!previa || foto.fechaCarga > previa.fechaCarga) porQuincena.set(inicio, foto);
  }

  const inicioActual = quincenaDeISO(hoyISO);
  const quincenasConFoto = [...porQuincena.keys()].sort();
  const primerInicio = quincenasConFoto[0] ?? inicioActual;

  const quincenas: QuincenaGaleria[] = [];
  for (let inicio = primerInicio; inicio <= inicioActual; inicio = siguienteQuincenaISO(inicio)) {
    quincenas.push({
      inicio,
      fin: finQuincenaISO(inicio),
      esActual: inicio === inicioActual,
      foto: porQuincena.get(inicio) ?? null,
    });
  }
  return quincenas;
}
