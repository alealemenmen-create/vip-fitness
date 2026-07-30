"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAlumno } from "@/lib/auth";
import { marcarNoticiasVistas } from "@/lib/noticias/data";

/**
 * Apaga el globito de Noticias VIP.
 *
 * Antes esto se hacía durante el render de la página de Noticias, y por eso el
 * icono no se quitaba: el layout (que es quien dibuja el globito) se renderiza
 * junto con la página, así que leía el contador ANTES de que quedara marcada la
 * visita, y encima el layout queda cacheado en el router del cliente. Hecho
 * como Server Action + `refresh()`, el router vuelve a pedir el layout y el
 * globito desaparece en el momento.
 */
export async function marcarNoticiasVistasAction(): Promise<void> {
  const { alumnoId, soloLectura } = await requireAlumno();
  if (soloLectura) return;

  const supabase = await createClient();
  await marcarNoticiasVistas(supabase, alumnoId);
  refresh();
}
