import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { fetchInstrumentado } from "./instrumentacion";

/**
 * Cliente con la service_role key: ignora RLS por completo.
 * Solo se usa dentro de Server Actions ya protegidas con requireRol();
 * nunca debe importarse desde código que pueda ejecutarse en el navegador.
 */
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      "Falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno del servidor."
    );
  }

  const instrumentado = fetchInstrumentado();
  return createSupabaseClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    ...(instrumentado ? { global: { fetch: instrumentado } } : {}),
  });
}
