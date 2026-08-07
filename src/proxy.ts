import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
      // Los Server Actions (subir una foto, un video, un PDF de rutina, etc.)
      // viajan como un POST a la misma URL de la página que los llama, con
      // este header puesto por Next.js — NO son una ruta aparte que se pueda
      // excluir por path. Cuando el proxy corre sobre un request, Next.js
      // clona y guarda una copia del cuerpo internamente (para que tanto el
      // proxy como la Server Action lo puedan leer), y esa copia se hace
      // como texto — lo cual corrompe cualquier archivo binario (una foto)
      // que venga en el cuerpo, byte por byte, en silencio. El síntoma real:
      // "Foto lista" y "Guardado" se veían bien, pero el archivo que
      // terminaba en Storage tenía basura en vez de la imagen.
      //
      // acá "missing" con este header significa lo opuesto de lo que suena:
      // el proxy corre cuando el header FALTA (una navegación normal), y se
      // salta enteros los Server Actions (que sí lo traen) — así nunca les
      // toca el cuerpo. La sesión de todos modos se revalida sola adentro de
      // cada Server Action (ver requireRol/createClient en lib/auth.ts), así
      // que no se pierde nada de seguridad por saltear el refresco acá.
      missing: [{ type: "header", key: "next-action" }],
    },
  ],
};
