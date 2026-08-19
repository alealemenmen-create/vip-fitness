import assert from "node:assert/strict";
import crypto from "node:crypto";
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
const rutaQa = path.join(raiz, ".env.qa.local");
const envQa = leerEnv(rutaQa);
assert(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY && env.SUPABASE_SERVICE_ROLE_KEY, "Faltan variables Supabase");
assert(envQa.QA_ALUMNO_EMAIL, "Falta la cuenta QA principal; ejecuta primero configurar-y-verificar-qa-v2.mjs");

const emailAislado = "qa.portal.v2.aislado@vipfitness.test";
const claveVariable = "QA_ALUMNO_AISLADO_PASSWORD";
const passwordAislado = envQa[claveVariable] || `V2!${crypto.randomBytes(24).toString("base64url")}`;
if (!envQa[claveVariable]) fs.appendFileSync(rutaQa, `${claveVariable}=${passwordAislado}\n`, { encoding: "utf8", mode: 0o600 });

const opciones = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, opciones);
const publico = () => createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, opciones);

async function listarUsuarios() {
  const usuarios = [];
  for (let pagina = 1; ; pagina += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page: pagina, perPage: 1000 });
    if (error) throw error;
    usuarios.push(...data.users);
    if (data.users.length < 1000) return usuarios;
  }
}

const usuarios = await listarUsuarios();
const principal = usuarios.find((usuario) => usuario.email?.toLowerCase() === envQa.QA_ALUMNO_EMAIL.toLowerCase());
assert(principal, "No existe la cuenta QA principal");
let aislado = usuarios.find((usuario) => usuario.email?.toLowerCase() === emailAislado);
if (!aislado) {
  const { data, error } = await admin.auth.admin.createUser({ email: emailAislado, password: passwordAislado, email_confirm: true, user_metadata: { nombre: "QA Portal V2 · Alumno aislado", portal_qa: true } });
  if (error || !data.user) throw error ?? new Error("No se pudo crear la cuenta QA aislada");
  aislado = data.user;
} else {
  const { data, error } = await admin.auth.admin.updateUserById(aislado.id, { password: passwordAislado, email_confirm: true, user_metadata: { nombre: "QA Portal V2 · Alumno aislado", portal_qa: true } });
  if (error || !data.user) throw error ?? new Error("No se pudo actualizar la cuenta QA aislada");
  aislado = data.user;
}

const { error: errorPerfil } = await admin.from("perfiles").upsert({ id: aislado.id, nombre: "QA Portal V2 · Alumno aislado", rol: "alumno" }, { onConflict: "id" });
if (errorPerfil) throw errorPerfil;

const { data: foto, error: errorFoto } = await admin.from("fotos_progreso").select("storage_path").eq("alumno_id", principal.id).order("fecha_foto", { ascending: false }).limit(1).maybeSingle();
if (errorFoto) throw errorFoto;
assert(foto, "La cuenta QA principal no tiene una foto sintética para probar aislamiento");

const clienteAislado = publico();
const { error: errorLogin } = await clienteAislado.auth.signInWithPassword({ email: emailAislado, password: passwordAislado });
if (errorLogin) throw errorLogin;

const { data: filasAjenas, error: errorFilas } = await clienteAislado.from("fotos_progreso").select("id").eq("alumno_id", principal.id);
assert(!errorFilas, `La consulta RLS falló de forma inesperada: ${errorFilas?.message}`);
assert.equal(filasAjenas.length, 0, "Una cuenta QA pudo leer la fila privada de otra cuenta");

const { data: archivoAjeno, error: errorArchivo } = await clienteAislado.storage.from("fotos-progreso").download(foto.storage_path);
assert(errorArchivo || !archivoAjeno, "Una cuenta QA pudo descargar el archivo privado de otra cuenta");

console.log(JSON.stringify({
  cuentaQaAislada: true,
  filaPrivadaOculta: true,
  descargaPrivadaBloqueada: true,
  mutacionesSobreAlumnosActivos: 0,
}, null, 2));
