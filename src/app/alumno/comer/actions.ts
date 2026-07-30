"use server";

import { revalidatePath, updateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { TAG_RANKING } from "@/lib/ranking/data";
import { buscarAlimentos, type AlimentoCatalogo } from "./data";

async function obtenerORegistroDiario(
  supabase: Awaited<ReturnType<typeof createClient>>,
  alumnoId: string,
  fecha: string
): Promise<string> {
  const { data: existente } = await supabase
    .from("registros_diarios")
    .select("id")
    .eq("alumno_id", alumnoId)
    .eq("fecha", fecha)
    .maybeSingle();

  if (existente) return existente.id;

  const { data: nuevo, error } = await supabase
    .from("registros_diarios")
    .insert({ alumno_id: alumnoId, fecha })
    .select("id")
    .single();

  if (error || !nuevo) throw new Error("No fue posible crear el registro del día.");
  return nuevo.id;
}

async function obtenerOComida(
  supabase: Awaited<ReturnType<typeof createClient>>,
  registroDiarioId: string,
  tipoComida: string
): Promise<string> {
  const { data: existente } = await supabase
    .from("comidas_registradas")
    .select("id")
    .eq("registro_diario_id", registroDiarioId)
    .eq("tipo_comida", tipoComida)
    .maybeSingle();

  if (existente) return existente.id;

  const { data: nueva, error } = await supabase
    .from("comidas_registradas")
    .insert({ registro_diario_id: registroDiarioId, tipo_comida: tipoComida })
    .select("id")
    .single();

  if (error || !nueva) throw new Error("No fue posible crear la comida.");
  return nueva.id;
}

export type ComerActionState = { error: string | null };

async function usuarioActual(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sesión expirada.");
  return user.id;
}

export async function agregarAlimentoAComida(
  fecha: string,
  tipoComida: string,
  alimentoId: string,
  cantidad: number,
  unidad: string
): Promise<ComerActionState> {
  try {
    const supabase = await createClient();
    const alumnoId = await usuarioActual(supabase);
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      return { error: "Ingresa una cantidad válida." };
    }

    const registroId = await obtenerORegistroDiario(supabase, alumnoId, fecha);
    const comidaId = await obtenerOComida(supabase, registroId, tipoComida);

    const { error } = await supabase
      .from("alimentos_consumidos")
      .insert({ comida_id: comidaId, alimento_id: alimentoId, cantidad, unidad });

    if (error) return { error: "No fue posible agregar el alimento." };

    updateTag(TAG_RANKING);
    revalidatePath(`/alumno/comer/${fecha}`);
    revalidatePath("/alumno/inicio");
    return { error: null };
  } catch {
    return { error: "No fue posible guardar. Revisa tu conexión e intenta nuevamente." };
  }
}

export async function quitarAlimentoDeComida(alimentoConsumidoId: string, fecha: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("alimentos_consumidos").delete().eq("id", alimentoConsumidoId);
  updateTag(TAG_RANKING);
  revalidatePath(`/alumno/comer/${fecha}`);
  revalidatePath("/alumno/inicio");
}

export async function actualizarCantidadAlimento(
  alimentoConsumidoId: string,
  cantidad: number,
  fecha: string
): Promise<ComerActionState> {
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    return { error: "Ingresa una cantidad válida." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("alimentos_consumidos")
    .update({ cantidad })
    .eq("id", alimentoConsumidoId);

  if (error) return { error: "No fue posible actualizar la cantidad." };

  updateTag(TAG_RANKING);
  revalidatePath(`/alumno/comer/${fecha}`);
  revalidatePath("/alumno/inicio");
  return { error: null };
}

export async function marcarComidaOmitida(
  fecha: string,
  tipoComida: string,
  omitida: boolean
): Promise<void> {
  const supabase = await createClient();
  const alumnoId = await usuarioActual(supabase);
  const registroId = await obtenerORegistroDiario(supabase, alumnoId, fecha);
  const comidaId = await obtenerOComida(supabase, registroId, tipoComida);

  await supabase.from("comidas_registradas").update({ omitida }).eq("id", comidaId);
  updateTag(TAG_RANKING);
  revalidatePath(`/alumno/comer/${fecha}`);
  revalidatePath("/alumno/inicio");
}

export async function actualizarObservacionComida(
  fecha: string,
  tipoComida: string,
  observacion: string
): Promise<void> {
  const supabase = await createClient();
  const alumnoId = await usuarioActual(supabase);
  const registroId = await obtenerORegistroDiario(supabase, alumnoId, fecha);
  const comidaId = await obtenerOComida(supabase, registroId, tipoComida);

  await supabase
    .from("comidas_registradas")
    .update({ observacion: observacion || null })
    .eq("id", comidaId);
  revalidatePath(`/alumno/comer/${fecha}`);
}

/** Búsqueda de alimentos para el buscador del alumno. Vive en el servidor
 * porque el catálogo tiene miles de items y no se puede mandar entero al
 * teléfono. */
export async function buscarAlimentosAction(texto: string): Promise<AlimentoCatalogo[]> {
  const supabase = await createClient();
  await usuarioActual(supabase);
  return buscarAlimentos(supabase, texto);
}
