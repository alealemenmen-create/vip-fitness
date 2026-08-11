import "server-only";

import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

type CategoriaNovedad = Database["public"]["Tables"]["registro_cambios"]["Row"]["categoria"];

export type DespliegueProduccion = {
  deploymentId: string;
  sha: string;
  mensaje: string;
  rama: string;
};

type EntornoDespliegue = Partial<
  Record<
    | "VERCEL_ENV"
    | "VERCEL_DEPLOYMENT_ID"
    | "VERCEL_GIT_COMMIT_SHA"
    | "VERCEL_GIT_COMMIT_MESSAGE"
    | "VERCEL_GIT_COMMIT_REF",
    string
  >
>;

type NovedadDespliegue = {
  id: string;
  titulo: string;
  resumen: string;
  categoria: CategoriaNovedad;
};

const desplieguesRegistrados = new Set<string>();

function uuidDeterminista(valor: string): string {
  const caracteres = createHash("sha256").update(valor).digest("hex").slice(0, 32).split("");
  // Fija bits de versión/variante para que Postgres reciba un UUID estable.
  caracteres[12] = "5";
  caracteres[16] = ((Number.parseInt(caracteres[16], 16) & 0x3) | 0x8).toString(16);
  const hex = caracteres.join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function categoriaDesdeMensaje(mensaje: string): CategoriaNovedad {
  if (/^fix(?:\([^)]+\))?!?:/i.test(mensaje)) return "arreglo";
  if (/^feat(?:\([^)]+\))?!?:/i.test(mensaje)) return "funcion_nueva";
  return "mejora";
}

function tituloDesdeMensaje(mensaje: string, shaCorto: string): string {
  const primeraLinea = mensaje.split(/\r?\n/, 1)[0]?.trim() ?? "";
  const sinPrefijo = primeraLinea.replace(
    /^(?:feat|fix|docs|refactor|perf|test|build|ci|chore)(?:\([^)]+\))?!?:\s*/i,
    "",
  );
  const titulo = sinPrefijo || `Nueva versión ${shaCorto}`;
  return `${titulo.charAt(0).toUpperCase()}${titulo.slice(1)}`.slice(0, 180);
}

export function crearNovedadDesdeDespliegue(despliegue: DespliegueProduccion): NovedadDespliegue {
  const shaCorto = despliegue.sha.slice(0, 7);
  return {
    id: uuidDeterminista(`vercel:${despliegue.deploymentId}`),
    titulo: tituloDesdeMensaje(despliegue.mensaje, shaCorto),
    resumen: `Publicada automáticamente desde ${despliegue.rama}. Versión ${shaCorto}; despliegue ${despliegue.deploymentId}.`,
    categoria: categoriaDesdeMensaje(despliegue.mensaje),
  };
}

export function leerDespliegueActual(
  env: EntornoDespliegue = process.env as unknown as EntornoDespliegue,
): DespliegueProduccion | null {
  if (env.VERCEL_ENV !== "production") return null;

  const deploymentId = env.VERCEL_DEPLOYMENT_ID?.trim();
  const sha = env.VERCEL_GIT_COMMIT_SHA?.trim();
  if (!deploymentId || !sha) return null;

  return {
    deploymentId,
    sha,
    mensaje: env.VERCEL_GIT_COMMIT_MESSAGE?.trim() || "",
    rama: env.VERCEL_GIT_COMMIT_REF?.trim() || "producción",
  };
}

/** Registra una sola vez cada despliegue que realmente logró servir el panel
 * de producción. Nunca escribe desde localhost ni desde un preview. */
export async function registrarDespliegueActual(): Promise<void> {
  const despliegue = leerDespliegueActual();
  if (!despliegue || desplieguesRegistrados.has(despliegue.deploymentId)) return;

  const novedad = crearNovedadDesdeDespliegue(despliegue);

  try {
    const admin = createAdminClient();
    const { error } = await admin.from("registro_cambios").insert(novedad);

    // Otra instancia puede haber insertado el mismo deployment ID primero.
    if (!error || error.code === "23505") {
      desplieguesRegistrados.add(despliegue.deploymentId);
      return;
    }

    console.error("No se pudo registrar la actualización de producción:", error.message);
  } catch (error) {
    // El historial nunca debe impedir entrar al panel por una falla transitoria.
    console.error("No se pudo registrar la actualización de producción:", error);
  }
}
