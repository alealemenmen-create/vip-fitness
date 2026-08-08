import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    {
      // "api" también excluido: nada ahí depende de la cookie de sesión
      // refrescada acá (cada ruta hace su propio chequeo de auth).
      source: "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
      // Los Server Actions (subir una foto, un video, un PDF de rutina, etc.)
      // viajan como un POST a la misma URL de la página que los llama, con
      // este header puesto por Next.js — NO son una ruta aparte que se pueda
      // excluir por path. La documentación de Next 16 advierte que, cuando
      // el proxy corre sobre un request, clona y guarda una copia del cuerpo
      // internamente (para que tanto el proxy como el handler final lo
      // puedan leer) — se probó como posible causa de una corrupción real de
      // archivos subidos. Las fotos de ejercicios ya no pasan por Next.js:
      // el navegador las sube directamente a Storage. Esta exclusión queda
      // para las otras acciones con archivos y porque no hay ninguna razón
      // para que un Server Action necesite pasar por acá.
      //
      // "missing" con este header significa lo opuesto de lo que suena: el
      // proxy corre cuando el header FALTA (una navegación normal), y se
      // salta enteros los Server Actions (que sí lo traen). La sesión de
      // todos modos se revalida sola adentro de cada Server Action (ver
      // requireRol/createClient en lib/auth.ts), así que no se pierde nada
      // de seguridad por saltear el refresco acá.
      missing: [{ type: "header", key: "next-action" }],
    },
  ],
};
