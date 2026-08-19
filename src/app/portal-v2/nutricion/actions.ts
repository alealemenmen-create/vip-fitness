"use server";

import { revalidatePath } from "next/cache";
import { requireAlumno } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AlimentoCatalogo } from "@/app/alumno/comer/tipos";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CAMPOS_ALIMENTO = "id, nombre, categoria, porcion_base, unidad, kcal, prot, carb, grasa, medida_nombre, medida_gramos, fibra, azucares, sodio";

type RecetaV2 = {
  id: string;
  nombre: string;
  porciones: number;
  ingredientes: Array<{ alimento: AlimentoCatalogo; cantidadBase: number }>;
};

export type BibliotecaNutricionV2 = {
  disponible: boolean;
  favoritos: AlimentoCatalogo[];
  recetas: RecetaV2[];
};

function faltaMigracion(error: { code?: string; message?: string } | null) {
  return Boolean(error && (error.code === "42P01" || error.code === "PGRST205" || /alimentos_favoritos|recetas_alumno|receta_ingredientes/i.test(error.message ?? "")));
}

function aCatalogo(fila: {
  id: string; nombre: string; categoria: string | null; porcion_base: number; unidad: string;
  kcal: number; prot: number; carb: number; grasa: number; medida_nombre: string | null;
  medida_gramos: number | null; fibra: number | null; azucares: number | null; sodio: number | null;
}): AlimentoCatalogo {
  return {
    id: fila.id,
    nombre: fila.nombre,
    categoria: fila.categoria,
    porcionBase: Number(fila.porcion_base),
    unidad: fila.unidad,
    kcal: Number(fila.kcal),
    prot: Number(fila.prot),
    carb: Number(fila.carb),
    grasa: Number(fila.grasa),
    medidaNombre: fila.medida_nombre,
    medidaGramos: fila.medida_gramos === null ? null : Number(fila.medida_gramos),
    fibra: fila.fibra === null ? null : Number(fila.fibra),
    azucares: fila.azucares === null ? null : Number(fila.azucares),
    sodio: fila.sodio === null ? null : Number(fila.sodio),
  };
}

export async function obtenerBibliotecaNutricionV2(): Promise<BibliotecaNutricionV2> {
  const { alumnoId } = await requireAlumno();
  const db = createAdminClient();
  const [{ data: favoritos, error: errorFavoritos }, { data: recetas, error: errorRecetas }] = await Promise.all([
    db.from("alimentos_favoritos").select("alimento_id").eq("alumno_id", alumnoId).order("created_at", { ascending: false }).limit(80),
    db.from("recetas_alumno").select("id, nombre, porciones").eq("alumno_id", alumnoId).order("updated_at", { ascending: false }).limit(50),
  ]);
  if (faltaMigracion(errorFavoritos) || faltaMigracion(errorRecetas)) return { disponible: false, favoritos: [], recetas: [] };
  if (errorFavoritos || errorRecetas) return { disponible: true, favoritos: [], recetas: [] };

  const idsFavoritos = (favoritos ?? []).map((fila) => fila.alimento_id);
  const idsRecetas = (recetas ?? []).map((receta) => receta.id);
  const [{ data: ingredientes }, { data: alimentosFavoritos }] = await Promise.all([
    idsRecetas.length
      ? db.from("receta_ingredientes").select("receta_id, alimento_id, cantidad, orden").in("receta_id", idsRecetas).order("orden")
      : Promise.resolve({ data: [] }),
    idsFavoritos.length
      ? db.from("alimentos").select(CAMPOS_ALIMENTO).in("id", idsFavoritos).eq("activo", true).eq("aprobado", true)
      : Promise.resolve({ data: [] }),
  ]);
  const idsIngredientes = [...new Set((ingredientes ?? []).map((fila) => fila.alimento_id))];
  const { data: alimentosIngredientes } = idsIngredientes.length
    ? await db.from("alimentos").select(CAMPOS_ALIMENTO).in("id", idsIngredientes).eq("activo", true).eq("aprobado", true)
    : { data: [] };
  const alimentoPorId = new Map((alimentosIngredientes ?? []).map((fila) => [fila.id, aCatalogo(fila)]));

  return {
    disponible: true,
    favoritos: (alimentosFavoritos ?? []).map(aCatalogo),
    recetas: (recetas ?? []).map((receta) => ({
      id: receta.id,
      nombre: receta.nombre,
      porciones: receta.porciones,
      ingredientes: (ingredientes ?? [])
        .filter((ingrediente) => ingrediente.receta_id === receta.id && alimentoPorId.has(ingrediente.alimento_id))
        .map((ingrediente) => ({ alimento: alimentoPorId.get(ingrediente.alimento_id)!, cantidadBase: Number(ingrediente.cantidad) })),
    })),
  };
}

export async function alternarFavoritoNutricionV2(alimentoId: string, activo: boolean) {
  const { alumnoId, soloLectura } = await requireAlumno();
  if (soloLectura) return { ok: false, error: "No puedes cambiar favoritos en modo solo lectura." };
  if (!UUID.test(alimentoId)) return { ok: false, error: "El alimento no es válido." };
  const db = createAdminClient();
  const { data: alimento } = await db.from("alimentos").select("id").eq("id", alimentoId).eq("activo", true).eq("aprobado", true).maybeSingle();
  if (!alimento) return { ok: false, error: "Ese alimento no está disponible en el catálogo aprobado." };
  const resultado = activo
    ? await db.from("alimentos_favoritos").upsert({ alumno_id: alumnoId, alimento_id: alimentoId }, { onConflict: "alumno_id,alimento_id" })
    : await db.from("alimentos_favoritos").delete().eq("alumno_id", alumnoId).eq("alimento_id", alimentoId);
  if (resultado.error) {
    if (faltaMigracion(resultado.error)) return { ok: false, error: "Los favoritos todavía no están habilitados en este entorno." };
    return { ok: false, error: "No pudimos actualizar el favorito." };
  }
  revalidatePath("/portal-v2/nutricion");
  return { ok: true, error: null };
}

export async function guardarRecetaNutricionV2(input: {
  nombre: string;
  porciones?: number;
  ingredientes: Array<{ alimentoId: string; cantidadBase: number }>;
}) {
  const { alumnoId, soloLectura } = await requireAlumno();
  if (soloLectura) return { ok: false, error: "No puedes guardar recetas en modo solo lectura.", recetaId: null };
  const nombre = input.nombre.trim().replace(/\s+/g, " ").slice(0, 60);
  const porciones = Math.round(input.porciones ?? 1);
  const ingredientes = input.ingredientes.filter((item) => UUID.test(item.alimentoId) && Number.isFinite(item.cantidadBase) && item.cantidadBase > 0 && item.cantidadBase <= 100000);
  if (nombre.length < 2) return { ok: false, error: "Escribe un nombre de al menos dos caracteres.", recetaId: null };
  if (porciones < 1 || porciones > 20) return { ok: false, error: "Las porciones deben estar entre 1 y 20.", recetaId: null };
  if (ingredientes.length === 0 || ingredientes.length > 30 || new Set(ingredientes.map((item) => item.alimentoId)).size !== ingredientes.length) {
    return { ok: false, error: "La receta necesita entre 1 y 30 ingredientes distintos.", recetaId: null };
  }
  const db = createAdminClient();
  const { data: validos } = await db.from("alimentos").select("id").in("id", ingredientes.map((item) => item.alimentoId)).eq("activo", true).eq("aprobado", true);
  if ((validos ?? []).length !== ingredientes.length) return { ok: false, error: "Uno de los ingredientes ya no está aprobado.", recetaId: null };

  const ahora = new Date().toISOString();
  const { data: receta, error } = await db.from("recetas_alumno").insert({ alumno_id: alumnoId, nombre, porciones, updated_at: ahora }).select("id").single();
  if (error || !receta) {
    if (faltaMigracion(error)) return { ok: false, error: "Las recetas todavía no están habilitadas en este entorno.", recetaId: null };
    return { ok: false, error: "No pudimos crear la receta.", recetaId: null };
  }
  const { error: errorIngredientes } = await db.from("receta_ingredientes").insert(ingredientes.map((item, orden) => ({ receta_id: receta.id, alimento_id: item.alimentoId, cantidad: item.cantidadBase, orden })));
  if (errorIngredientes) {
    await db.from("recetas_alumno").delete().eq("id", receta.id).eq("alumno_id", alumnoId);
    return { ok: false, error: "No pudimos guardar los ingredientes; la receta no fue creada.", recetaId: null };
  }
  revalidatePath("/portal-v2/nutricion");
  return { ok: true, error: null, recetaId: receta.id };
}

export async function eliminarRecetaNutricionV2(recetaId: string) {
  const { alumnoId, soloLectura } = await requireAlumno();
  if (soloLectura) return { ok: false, error: "No puedes borrar recetas en modo solo lectura." };
  if (!UUID.test(recetaId)) return { ok: false, error: "La receta no es válida." };
  const db = createAdminClient();
  const { error } = await db.from("recetas_alumno").delete().eq("id", recetaId).eq("alumno_id", alumnoId);
  if (error) return { ok: false, error: "No pudimos eliminar la receta." };
  revalidatePath("/portal-v2/nutricion");
  return { ok: true, error: null };
}
