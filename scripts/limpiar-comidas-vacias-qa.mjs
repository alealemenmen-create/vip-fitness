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
        const indice = linea.indexOf("=");
        return [linea.slice(0, indice), linea.slice(indice + 1).replace(/^["']|["']$/g, "")];
      }),
  );
}

const raiz = process.cwd();
const env = leerEnv(path.join(raiz, ".env.local"));
const envQa = leerEnv(path.join(raiz, ".env.qa.local"));
assert(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY, "Faltan variables Supabase");
assert(envQa.QA_ALUMNO_EMAIL, "Falta la cuenta QA principal");

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const usuarios = [];
for (let pagina = 1; ; pagina += 1) {
  const { data, error } = await admin.auth.admin.listUsers({ page: pagina, perPage: 1000 });
  if (error) throw error;
  usuarios.push(...data.users);
  if (data.users.length < 1000) break;
}

const usuarioQa = usuarios.find((usuario) =>
  usuario.email?.toLowerCase() === envQa.QA_ALUMNO_EMAIL.toLowerCase());
assert(usuarioQa, "No existe la cuenta QA principal");
assert(usuarioQa.user_metadata?.portal_qa === true, "La cuenta objetivo no está marcada como QA; limpieza cancelada");

const { data: registros, error: errorRegistros } = await admin
  .from("registros_diarios")
  .select("id")
  .eq("alumno_id", usuarioQa.id);
if (errorRegistros) throw errorRegistros;

const idsRegistros = (registros ?? []).map((fila) => fila.id);
if (idsRegistros.length === 0) {
  console.log(JSON.stringify({ cuentaQaVerificada: true, comidasVaciasEliminadas: 0 }));
  process.exit(0);
}

const { data: comidas, error: errorComidas } = await admin
  .from("comidas_registradas")
  .select("id, omitida, observacion")
  .in("registro_diario_id", idsRegistros);
if (errorComidas) throw errorComidas;

const idsComidas = (comidas ?? []).map((fila) => fila.id);
const { data: consumidos, error: errorConsumidos } = idsComidas.length
  ? await admin.from("alimentos_consumidos").select("comida_id").in("comida_id", idsComidas)
  : { data: [], error: null };
if (errorConsumidos) throw errorConsumidos;

const conAlimentos = new Set((consumidos ?? []).map((fila) => fila.comida_id));
const vacias = (comidas ?? [])
  .filter((comida) => !conAlimentos.has(comida.id) && !comida.omitida && !comida.observacion?.trim())
  .map((comida) => comida.id);

if (vacias.length > 0) {
  const { error } = await admin.from("comidas_registradas").delete().in("id", vacias);
  if (error) throw error;
}

console.log(JSON.stringify({
  cuentaQaVerificada: true,
  comidasVaciasEliminadas: vacias.length,
}));
