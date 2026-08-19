import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  buscarEnOFF,
  type ProductoOFF,
  type ResultadoOFF,
} from "./openFoodFacts";

const TTL_CON_RESULTADOS_MS = 7 * 24 * 60 * 60 * 1000;
const TTL_SIN_RESULTADOS_MS = 6 * 60 * 60 * 1000;
const MAX_ANTIGUEDAD_RESPALDO_MS = 30 * 24 * 60 * 60 * 1000;
const CIRCUITO_MS = 60 * 1000;
const FALLOS_PARA_ABRIR_CIRCUITO = 3;

type PaisOFF = "chile" | "global";
type FilaCache = {
  consulta: string;
  pais: PaisOFF;
  productos: unknown;
  expira_en: string;
  actualizado_en: string;
};

let fallosConsecutivos = 0;
let circuitoAbiertoHasta = 0;
const consultasEnCurso = new Map<string, Promise<ResultadoOFF>>();

/** La clave no guarda mayúsculas ni espacios accidentales, pero conserva los
 * acentos porque forman parte de la consulta que recibe el buscador externo. */
export function normalizarConsultaOFF(texto: string): string {
  return texto.trim().replace(/\s+/g, " ").toLocaleLowerCase("es-CL").slice(0, 120);
}

function esNumeroSeguro(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isFinite(valor);
}

/** La caché es service-role-only, pero se valida igualmente antes de devolver
 * JSON almacenado. Una fila dañada nunca debe contaminar el diario nutricional. */
function esProductoOFF(valor: unknown): valor is ProductoOFF {
  if (!valor || typeof valor !== "object") return false;
  const p = valor as Partial<ProductoOFF>;
  return (
    typeof p.offId === "string" &&
    /^\d{4,24}$/.test(p.offId) &&
    typeof p.nombre === "string" &&
    p.nombre.trim().length > 0 &&
    esNumeroSeguro(p.kcal) &&
    p.kcal >= 0 && p.kcal <= 900 &&
    esNumeroSeguro(p.prot) && p.prot >= 0 && p.prot <= 100 &&
    esNumeroSeguro(p.carb) && p.carb >= 0 && p.carb <= 100 &&
    esNumeroSeguro(p.grasa) && p.grasa >= 0 && p.grasa <= 100
  );
}

function productosValidos(valor: unknown): ProductoOFF[] | null {
  if (!Array.isArray(valor)) return null;
  return valor.every(esProductoOFF) ? valor : null;
}

async function leerCache(consulta: string, pais: PaisOFF): Promise<(FilaCache & { productos: ProductoOFF[] }) | null> {
  try {
    const { data, error } = await createAdminClient()
      .from("open_food_facts_cache")
      .select("consulta, pais, productos, expira_en, actualizado_en")
      .eq("consulta", consulta)
      .eq("pais", pais)
      .maybeSingle();
    if (error || !data) return null;
    const productos = productosValidos(data.productos);
    if (!productos) return null;
    return { ...(data as FilaCache), productos };
  } catch {
    // La migración puede todavía no estar aplicada en un entorno de preview.
    // El proveedor externo sigue siendo utilizable: la caché nunca bloquea.
    return null;
  }
}

async function guardarCache(consulta: string, pais: PaisOFF, productos: ProductoOFF[]): Promise<void> {
  const ahora = Date.now();
  const ttl = productos.length > 0 ? TTL_CON_RESULTADOS_MS : TTL_SIN_RESULTADOS_MS;
  try {
    await createAdminClient()
      .from("open_food_facts_cache")
      .upsert({
        consulta,
        pais,
        productos,
        expira_en: new Date(ahora + ttl).toISOString(),
        actualizado_en: new Date(ahora).toISOString(),
      }, { onConflict: "consulta,pais" });
  } catch {
    // La respuesta externa ya es válida. No se la ocultamos al alumno solo
    // porque el almacenamiento de respaldo haya fallado.
  }
}

function respaldoVigente(fila: (FilaCache & { productos: ProductoOFF[] }) | null, ahora: number): boolean {
  if (!fila) return false;
  const actualizado = Date.parse(fila.actualizado_en);
  return Number.isFinite(actualizado) && ahora - actualizado <= MAX_ANTIGUEDAD_RESPALDO_MS;
}

async function resolverConsulta(texto: string, consulta: string, pais: PaisOFF): Promise<ResultadoOFF> {
  const ahora = Date.now();
  const cache = await leerCache(consulta, pais);
  if (cache && Date.parse(cache.expira_en) > ahora) {
    return { ok: true, productos: cache.productos, origen: "cache" };
  }

  if (circuitoAbiertoHasta > ahora) {
    if (respaldoVigente(cache, ahora)) {
      return {
        ok: true,
        productos: cache!.productos,
        origen: "cache",
        aviso: "Mostramos resultados guardados mientras el catálogo externo se recupera.",
      };
    }
    return {
      ok: false,
      causa: "limite",
      error: "Open Food Facts está ocupado. El catálogo VIP sigue disponible; inténtalo nuevamente en un minuto.",
    };
  }

  const resultado = await buscarEnOFF(texto, pais);
  if (resultado.ok) {
    fallosConsecutivos = 0;
    circuitoAbiertoHasta = 0;
    await guardarCache(consulta, pais, resultado.productos);
    return { ...resultado, origen: "externo" };
  }

  fallosConsecutivos += 1;
  if (fallosConsecutivos >= FALLOS_PARA_ABRIR_CIRCUITO) {
    circuitoAbiertoHasta = ahora + CIRCUITO_MS;
  }
  if (respaldoVigente(cache, ahora)) {
    return {
      ok: true,
      productos: cache!.productos,
      origen: "cache",
      aviso: "Mostramos resultados guardados porque Open Food Facts no respondió.",
    };
  }
  return resultado;
}

/** Caché compartida en Supabase + deduplicación dentro del proceso. Dos socios
 * buscando lo mismo al mismo tiempo generan una sola consulta externa. */
export async function buscarEnOFFConCache(texto: string, pais: PaisOFF): Promise<ResultadoOFF> {
  const consulta = normalizarConsultaOFF(texto);
  if (consulta.length < 2) return { ok: true, productos: [], origen: "cache" };

  const clave = `${pais}:${consulta}`;
  const existente = consultasEnCurso.get(clave);
  if (existente) return existente;

  const promesa = resolverConsulta(texto.trim().slice(0, 120), consulta, pais)
    .finally(() => consultasEnCurso.delete(clave));
  consultasEnCurso.set(clave, promesa);
  return promesa;
}

/** Solo para aislar pruebas: no forma parte del flujo de producción. */
export function reiniciarEstadoOFFParaPruebas(): void {
  fallosConsecutivos = 0;
  circuitoAbiertoHasta = 0;
  consultasEnCurso.clear();
}

