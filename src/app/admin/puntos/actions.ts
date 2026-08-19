"use server";

import { revalidateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { guardarMovimiento } from "@/lib/ranking/movimientos";
import { TAG_RANKING } from "@/lib/ranking/data";
import { hoyISO } from "@/lib/date";

/** Tope por ajuste. No es burocracia: un cero de más en un campo numérico
 * manda a alguien al tope del ranking y arreglarlo después es peor que el
 * problema original. Si de verdad hace falta más, se hacen dos ajustes. */
const MAXIMO_POR_AJUSTE = 1000;

export type ResultadoAjuste = { ok: true; puntos: number } | { ok: false; error: string };

/** Otorga (o descuenta) Puntos VIP a mano, desde el panel del entrenador.
 *
 * Nació de un caso real: un bug en las rutinas le comió 300 puntos a una
 * alumna que sí había entrenado. Antes eso se arreglaba escribiendo en la base
 * a mano; ahora lo hace el entrenador, queda registrado con su motivo y el
 * alumno ve por qué se los dieron.
 *
 * Se guarda como categoría "ajuste" —la misma que ya usa la penalización por
 * descanso excedido— así que suma en el ranking igual que cualquier otro
 * punto. La clave lleva la marca de tiempo para que dos ajustes al mismo
 * alumno no se pisen entre sí (`guardarMovimiento` hace upsert por
 * alumno+clave). */
export async function otorgarPuntosManual(params: {
  alumnoId: string;
  puntos: number;
  motivo: string;
}): Promise<ResultadoAjuste> {
  const sesion = await requireAdmin();

  const puntos = Math.round(params.puntos);
  if (!params.alumnoId) return { ok: false, error: "Falta elegir al alumno." };
  if (!Number.isFinite(puntos) || puntos === 0) return { ok: false, error: "Poné una cantidad distinta de cero." };
  if (Math.abs(puntos) > MAXIMO_POR_AJUSTE) {
    return { ok: false, error: `El máximo por ajuste es ${MAXIMO_POR_AJUSTE} puntos. Si necesitás más, hacé dos.` };
  }
  const motivo = params.motivo.trim();
  // El motivo es obligatorio a propósito: el alumno lo lee en su historial, y
  // dentro de un mes nadie se acuerda por qué aparecieron 300 puntos sueltos.
  if (motivo.length < 3) return { ok: false, error: "Escribí el motivo: el alumno lo va a leer." };

  const fecha = hoyISO();
  try {
    await guardarMovimiento({
      alumnoId: params.alumnoId,
      clave: `ajuste_manual:${Date.now()}`,
      categoria: "ajuste",
      puntos,
      titulo: puntos > 0 ? "Puntos otorgados por tu entrenador" : "Ajuste de tu entrenador",
      detalle: motivo,
      fecha,
      metadata: { otorgadoPor: sesion.userId, manual: true },
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudieron guardar los puntos." };
  }

  // Sin esto el ranking sigue mostrando el número viejo hasta que venza su
  // caché, y el entrenador cree que no funcionó.
  revalidateTag(TAG_RANKING, { expire: 0 });
  return { ok: true, puntos };
}
