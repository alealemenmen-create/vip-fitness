import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Saldo de IA y en qué se está yendo.
 *
 * La API de Anthropic informa el costo de cada llamada pero NO el saldo de la
 * cuenta: no hay forma de leerlo solo. Por eso el saldo lo carga a mano el
 * entrenador (decisión suya) y desde ahí se descuenta lo gastado.
 *
 * Se descuenta desde la FECHA DE CARGA, no desde el inicio del mes: si carga
 * saldo un día 20, el gasto del 1 al 19 ya estaba pagado con la carga anterior
 * y descontarlo otra vez mostraría un saldo más bajo del real.
 *
 * Todo esto vive detrás de `disponible: false` hasta que corra la migración
 * 0065 — la pantalla dice qué falta en vez de romperse.
 */

// Los tipos y las etiquetas viven en `saldo-tipos.ts`, que no es server-only:
// el panel que los usa corre en el navegador. Se importan además de
// reexportarse — un `export ... from` no los trae al alcance de este archivo.
import type { SaldoIA } from "./saldo-tipos";
export type { DesgloseHerramienta, SaldoIA } from "./saldo-tipos";
export { NOMBRE_HERRAMIENTA } from "./saldo-tipos";

const VACIO: SaldoIA = {
  disponible: false,
  cargadoUsd: 0,
  cargadoEn: null,
  gastadoDesdeCargaUsd: 0,
  restanteUsd: 0,
  desglose: [],
};

export async function obtenerSaldoIA(): Promise<SaldoIA> {
  const supabase = await createClient();
  const { data: config, error } = await supabase
    .from("configuracion_gimnasio")
    .select("saldo_ia_cargado_usd, saldo_ia_cargado_en")
    .eq("id", true)
    .maybeSingle();

  // Columna inexistente = migración sin correr. No es un error que haya que
  // mostrar como falla: es una función que todavía no está habilitada.
  if (error || !config) return VACIO;

  const fila = config as unknown as { saldo_ia_cargado_usd: number | null; saldo_ia_cargado_en: string | null };
  const cargadoUsd = Number(fila.saldo_ia_cargado_usd ?? 0);
  const cargadoEn = fila.saldo_ia_cargado_en;

  let consulta = supabase.from("asistente_uso_ia").select("costo_usd, herramienta");
  if (cargadoEn) consulta = consulta.gte("created_at", cargadoEn);
  const { data: usos } = await consulta;

  const porHerramienta = new Map<string, { usos: number; usd: number }>();
  let gastado = 0;
  for (const uso of usos ?? []) {
    const costo = Number(uso.costo_usd);
    gastado += costo;
    const actual = porHerramienta.get(uso.herramienta) ?? { usos: 0, usd: 0 };
    actual.usos += 1;
    actual.usd += costo;
    porHerramienta.set(uso.herramienta, actual);
  }

  return {
    disponible: true,
    cargadoUsd,
    cargadoEn,
    gastadoDesdeCargaUsd: gastado,
    // Nunca negativo: si el saldo cargado quedó desactualizado, "0" es más
    // honesto que un número rojo que no significa nada.
    restanteUsd: Math.max(0, cargadoUsd - gastado),
    desglose: [...porHerramienta.entries()]
      .map(([herramienta, datos]) => ({ herramienta, ...datos }))
      .sort((a, b) => b.usd - a.usd),
  };
}
