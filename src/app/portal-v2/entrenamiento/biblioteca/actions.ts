"use server";

import { obtenerBiblioteca } from "@/lib/ejercicios/data";
import type { Ejercicio } from "@/lib/ejercicios/tipos";

export async function obtenerFichaEjercicioV2(ejercicioId: string): Promise<Ejercicio | null> {
  if (!ejercicioId || ejercicioId.length > 80) return null;
  const biblioteca = await obtenerBiblioteca();
  return biblioteca.find((ejercicio) => ejercicio.id === ejercicioId) ?? null;
}
