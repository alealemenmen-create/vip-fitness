import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./types";
import { fetchInstrumentado } from "./instrumentacion";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Con VIP_DEBUG_SQL apagado esto no agrega nada: `fetchInstrumentado`
      // devuelve undefined y el objeto `global` ni siquiera se arma.
      ...(fetchInstrumentado() ? { global: { fetch: fetchInstrumentado()! } } : {}),
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Se llama desde un Server Component sin permiso de escritura;
            // el middleware ya se encarga de refrescar la sesion en ese caso.
          }
        },
      },
    }
  );
}
