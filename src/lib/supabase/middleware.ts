import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./types";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Verifica el token y refresca la cookie si esta por expirar.
  //
  // Va con getClaims() y NO con getUser(): este proyecto firma los JWT con
  // ES256 (clave asimetrica), asi que getClaims() valida la firma localmente
  // con WebCrypto — sin viaje de red. getUser() en cambio consultaba al
  // servidor de Auth en CADA request, ~84ms medidos desde Chile, y el
  // middleware corre en cada navegacion Y en cada prefetch de <Link>. Es igual
  // de seguro: verifica la firma criptograficamente, no es getSession().
  await supabase.auth.getClaims();

  return response;
}
