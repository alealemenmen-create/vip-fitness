import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function leerEnv(ruta) {
  if (!fs.existsSync(ruta)) return {};
  return Object.fromEntries(
    fs.readFileSync(ruta, "utf8")
      .split(/\r?\n/)
      .map((linea) => linea.trim())
      .filter((linea) => linea && !linea.startsWith("#") && linea.includes("="))
      .map((linea) => {
        const separador = linea.indexOf("=");
        return [linea.slice(0, separador), linea.slice(separador + 1).replace(/^["']|["']$/g, "")];
      }),
  );
}

const env = leerEnv(path.join(process.cwd(), ".env.local"));
assert(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY, "Faltan las variables de Supabase en .env.local");

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const fuentes = [
  ["Identidades y perfiles", "perfiles"],
  ["Perfil y preferencias", "alumno_perfil"],
  ["Programas", "rutinas"],
  ["Días de programa", "rutina_dias"],
  ["Ejercicios prescritos", "rutina_dia_ejercicios"],
  ["Sesiones históricas", "sesiones_entrenamiento"],
  ["Ejercicios ejecutados", "sesion_ejercicios"],
  ["Series y cargas", "series_realizadas"],
  ["Pesos corporales", "pesos_corporales"],
  ["Fotos privadas", "fotos_progreso"],
  ["Días de alimentación", "registros_diarios"],
  ["Comidas registradas", "comidas_registradas"],
  ["Movimientos de puntos", "puntos_vip_movimientos"],
];

function describirError(error) {
  if (!error) return "error remoto sin detalle";
  const partes = [error.message, error.details, error.hint, error.code]
    .filter((valor) => typeof valor === "string" && valor.trim());
  return partes.length ? partes.join(" · ") : JSON.stringify(error) || "error remoto sin detalle";
}

async function contarConReintento(area, tabla) {
  let ultimoError = null;
  for (let intento = 1; intento <= 3; intento += 1) {
    try {
      const { count, error } = await db.from(tabla).select("*", { count: "exact", head: true });
      if (!error) return { area, fuenteOriginal: tabla, filasConservadas: count ?? 0 };
      ultimoError = error;
    } catch (error) {
      ultimoError = error;
    }
    if (intento < 3) await new Promise((resolve) => setTimeout(resolve, 250 * intento));
  }
  throw new Error(`${area}: ${describirError(ultimoError)} (3 intentos)`);
}

const resultados = await Promise.all(fuentes.map(([area, tabla]) => contarConReintento(area, tabla)));

console.table(resultados);
console.log("Auditoría sólo lectura: Portal V2 consume las tablas activas; no se copiaron, reiniciaron ni modificaron filas.");
