import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const raiz = process.cwd();

function leerEnv(archivo) {
  if (!fs.existsSync(archivo)) return {};
  return Object.fromEntries(
    fs.readFileSync(archivo, "utf8")
      .split(/\r?\n/)
      .map((linea) => linea.trim())
      .filter((linea) => linea && !linea.startsWith("#") && linea.includes("="))
      .map((linea) => {
        const indice = linea.indexOf("=");
        return [linea.slice(0, indice), linea.slice(indice + 1).replace(/^["']|["']$/g, "")];
      }),
  );
}

const envAplicacion = leerEnv(path.join(raiz, ".env.local"));
const rutaEnvQa = path.join(raiz, ".env.qa.local");
let envQa = leerEnv(rutaEnvQa);

const cuentas = [
  { clave: "ALUMNO", email: "qa.portal.v2.alumno@vipfitness.test", nombre: "QA Portal V2 · Alumno", rol: "alumno" },
  { clave: "ENTRENADOR", email: "qa.portal.v2.entrenador@vipfitness.test", nombre: "QA Portal V2 · Entrenador", rol: "entrenador" },
  { clave: "ADMIN", email: "qa.portal.v2.admin@vipfitness.test", nombre: "QA Portal V2 · Administrador", rol: "admin" },
];

let credencialesNuevas = false;
for (const cuenta of cuentas) {
  const nombreVariable = `QA_${cuenta.clave}_PASSWORD`;
  if (!envQa[nombreVariable]) {
    envQa[nombreVariable] = `V2!${crypto.randomBytes(24).toString("base64url")}`;
    credencialesNuevas = true;
  }
}

if (credencialesNuevas || !fs.existsSync(rutaEnvQa)) {
  const contenido = [
    "# Credenciales locales para pruebas RLS de Portal VIP V2. No versionar.",
    ...cuentas.flatMap((cuenta) => [
      `QA_${cuenta.clave}_EMAIL=${cuenta.email}`,
      `QA_${cuenta.clave}_PASSWORD=${envQa[`QA_${cuenta.clave}_PASSWORD`]}`,
    ]),
    "",
  ].join("\n");
  fs.writeFileSync(rutaEnvQa, contenido, { encoding: "utf8", mode: 0o600 });
  envQa = leerEnv(rutaEnvQa);
}

const url = envAplicacion.NEXT_PUBLIC_SUPABASE_URL;
const clavePublica = envAplicacion.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const claveServidor = envAplicacion.SUPABASE_SERVICE_ROLE_KEY;
assert(url && clavePublica && claveServidor, "Faltan variables Supabase en .env.local");

const opcionesAuth = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin = createClient(url, claveServidor, opcionesAuth);

async function listarUsuarios() {
  const usuarios = [];
  for (let pagina = 1; ; pagina += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page: pagina, perPage: 1000 });
    if (error) throw error;
    usuarios.push(...data.users);
    if (data.users.length < 1000) return usuarios;
  }
}

async function asegurarCuenta(cuenta, usuarios) {
  const password = envQa[`QA_${cuenta.clave}_PASSWORD`];
  const existente = usuarios.find((usuario) => usuario.email?.toLowerCase() === cuenta.email);
  if (existente) {
    const { data, error } = await admin.auth.admin.updateUserById(existente.id, {
      password,
      email_confirm: true,
      user_metadata: { nombre: cuenta.nombre, portal_qa: true },
    });
    if (error || !data.user) throw error ?? new Error(`No se pudo actualizar ${cuenta.clave}`);
    return data.user.id;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: cuenta.email,
    password,
    email_confirm: true,
    user_metadata: { nombre: cuenta.nombre, portal_qa: true },
  });
  if (error || !data.user) throw error ?? new Error(`No se pudo crear ${cuenta.clave}`);
  return data.user.id;
}

async function clienteAutenticado(cuenta) {
  const cliente = createClient(url, clavePublica, opcionesAuth);
  const { error } = await cliente.auth.signInWithPassword({
    email: cuenta.email,
    password: envQa[`QA_${cuenta.clave}_PASSWORD`],
  });
  if (error) throw new Error(`No se pudo autenticar ${cuenta.clave}: ${error.message}`);
  return cliente;
}

function exigirSinError(resultado, contexto) {
  if (resultado.error) throw new Error(`${contexto}: ${resultado.error.message}`);
  return resultado.data;
}

function exigirDenegado(resultado, contexto) {
  assert(resultado.error, `${contexto}: la operación debía ser rechazada`);
}

const idsTemporales = { sesiones: [], rutinas: [] };

try {
  const usuarios = await listarUsuarios();
  const ids = {};
  for (const cuenta of cuentas) ids[cuenta.clave] = await asegurarCuenta(cuenta, usuarios);

  exigirSinError(await admin.from("perfiles").upsert(
    cuentas.map((cuenta) => ({ id: ids[cuenta.clave], nombre: cuenta.nombre, rol: cuenta.rol })),
    { onConflict: "id" },
  ), "Perfiles QA");

  exigirSinError(await admin.from("alumno_perfil").upsert({
    user_id: ids.ALUMNO,
    entrenador_id: ids.ENTRENADOR,
    objetivo: "Validación integral Portal VIP V2",
  }, { onConflict: "user_id" }), "Perfil QA del alumno");

  let { data: rutinaQa, error: errorRutina } = await admin
    .from("rutinas")
    .select("id")
    .eq("alumno_id", ids.ALUMNO)
    .eq("nombre", "QA Portal V2 · Flujo real")
    .limit(1)
    .maybeSingle();
  if (errorRutina) throw errorRutina;
  if (!rutinaQa) {
    const creada = await admin.from("rutinas").insert({
      alumno_id: ids.ALUMNO,
      nombre: "QA Portal V2 · Flujo real",
      activa: true,
      version: 1,
      created_by: ids.ENTRENADOR,
    }).select("id").single();
    rutinaQa = exigirSinError(creada, "Rutina QA");
  }

  let { data: diaQa, error: errorDia } = await admin
    .from("rutina_dias")
    .select("id")
    .eq("rutina_id", rutinaQa.id)
    .eq("numero_dia", 1)
    .limit(1)
    .maybeSingle();
  if (errorDia) throw errorDia;
  if (!diaQa) {
    const creado = await admin.from("rutina_dias").insert({
      rutina_id: rutinaQa.id,
      numero_dia: 1,
      nombre: "Entrenamiento QA completo",
      orden: 1,
      tipo: "entrenamiento",
      descripcion: "Datos sintéticos para validar Portal VIP V2 sin utilizar alumnos activos.",
    }).select("id").single();
    diaQa = exigirSinError(creado, "Día QA");
  }

  const { count: cantidadEjercicios, error: errorCantidad } = await admin
    .from("rutina_dia_ejercicios")
    .select("id", { head: true, count: "exact" })
    .eq("dia_id", diaQa.id);
  if (errorCantidad) throw errorCantidad;
  if ((cantidadEjercicios ?? 0) === 0) {
    const biblioteca = exigirSinError(await admin
      .from("ejercicios")
      .select("id,nombre,grupo_muscular")
      .eq("activo", true)
      .eq("calidad_ficha", "completa")
      .not("foto_miniatura_url", "is", null)
      .order("nombre")
      .limit(3), "Biblioteca QA");
    assert(biblioteca.length >= 3, "La biblioteca no tiene tres ejercicios completos con imagen");
    exigirSinError(await admin.from("rutina_dia_ejercicios").insert(
      biblioteca.map((ejercicio, indice) => ({
        dia_id: diaQa.id,
        orden: indice + 1,
        nombre: ejercicio.nombre,
        series_programadas: 3,
        reps_programadas: indice === 0 ? "10-12" : "12",
        descanso_segundos: 60,
        grupo_muscular: ejercicio.grupo_muscular,
        ejercicio_id: ejercicio.id,
      })),
    ), "Ejercicios QA");
  }

  const [alumno, entrenador, administrador] = await Promise.all([
    clienteAutenticado(cuentas[0]),
    clienteAutenticado(cuentas[1]),
    clienteAutenticado(cuentas[2]),
  ]);

  const anonimo = createClient(url, clavePublica, opcionesAuth);
  const lecturaAnonima = await anonimo.from("rutinas").select("id,alumno_id");
  assert(!lecturaAnonima.error && lecturaAnonima.data.length === 0, "Anon no debe leer rutinas");

  const rutinasAlumno = exigirSinError(await alumno.from("rutinas").select("id,alumno_id"), "Lectura alumno");
  assert(rutinasAlumno.length >= 1 && rutinasAlumno.every((rutina) => rutina.alumno_id === ids.ALUMNO), "El alumno leyó rutinas ajenas");

  exigirDenegado(await alumno.from("rutinas").insert({
    alumno_id: ids.ALUMNO,
    nombre: "QA temporal prohibida alumno",
    activa: false,
  }), "Alumno creando una rutina");

  const sesionPropia = exigirSinError(await alumno.from("sesiones_entrenamiento").insert({
    alumno_id: ids.ALUMNO,
    rutina_id: rutinaQa.id,
    dia_id: diaQa.id,
    estado: "en_progreso",
  }).select("id").single(), "Alumno creando su sesión");
  idsTemporales.sesiones.push(sesionPropia.id);
  exigirSinError(await alumno.from("sesiones_entrenamiento").delete().eq("id", sesionPropia.id), "Alumno eliminando su sesión QA");
  idsTemporales.sesiones = idsTemporales.sesiones.filter((id) => id !== sesionPropia.id);

  exigirDenegado(await alumno.from("sesiones_entrenamiento").insert({
    alumno_id: ids.ENTRENADOR,
    rutina_id: rutinaQa.id,
    dia_id: diaQa.id,
    estado: "en_progreso",
  }), "Alumno escribiendo para otra cuenta");

  const perfilesEntrenador = exigirSinError(await entrenador.from("perfiles").select("id"), "Lectura entrenador");
  assert(perfilesEntrenador.length >= 3, "El entrenador no recibió el acceso global definido por el producto");

  const rutinaEntrenador = exigirSinError(await entrenador.from("rutinas").insert({
    alumno_id: ids.ALUMNO,
    nombre: `QA temporal entrenador ${crypto.randomUUID()}`,
    activa: false,
    created_by: ids.ENTRENADOR,
  }).select("id").single(), "Entrenador creando rutina QA");
  idsTemporales.rutinas.push(rutinaEntrenador.id);
  exigirSinError(await entrenador.from("rutinas").delete().eq("id", rutinaEntrenador.id), "Entrenador eliminando rutina QA");
  idsTemporales.rutinas = idsTemporales.rutinas.filter((id) => id !== rutinaEntrenador.id);

  exigirDenegado(await entrenador.from("sesiones_entrenamiento").insert({
    alumno_id: ids.ALUMNO,
    rutina_id: rutinaQa.id,
    dia_id: diaQa.id,
    estado: "en_progreso",
  }), "Entrenador registrando una sesión del alumno");

  const perfilesAdmin = exigirSinError(await administrador.from("perfiles").select("id"), "Lectura administrador");
  assert(perfilesAdmin.length >= perfilesEntrenador.length, "El administrador perdió visibilidad esperada");

  const rutinaAdmin = exigirSinError(await administrador.from("rutinas").insert({
    alumno_id: ids.ALUMNO,
    nombre: `QA temporal admin ${crypto.randomUUID()}`,
    activa: false,
    created_by: ids.ADMIN,
  }).select("id").single(), "Administrador creando rutina QA");
  idsTemporales.rutinas.push(rutinaAdmin.id);
  exigirSinError(await administrador.from("rutinas").delete().eq("id", rutinaAdmin.id), "Administrador eliminando rutina QA");
  idsTemporales.rutinas = idsTemporales.rutinas.filter((id) => id !== rutinaAdmin.id);

  for (const [tabla, fila] of [
    ["recetas_alumno", { alumno_id: ids.ALUMNO, nombre: "QA escritura directa", porciones: 1 }],
    ["comunidad_publicaciones", { alumno_id: ids.ALUMNO, texto: "QA escritura directa" }],
    ["recompensas_vip_canjes", { alumno_id: ids.ALUMNO, recompensa_id: crypto.randomUUID(), costo_congelado: 1 }],
    ["sesion_ejercicio_personalizaciones", { sesion_ejercicio_id: crypto.randomUUID(), alumno_id: ids.ALUMNO }],
  ]) {
    exigirDenegado(await alumno.from(tabla).insert(fila), `Escritura directa bloqueada en ${tabla}`);
  }

  console.log(JSON.stringify({
    cuentasQa: 3,
    rutinaSintetica: true,
    rls: {
      anonimoSinRutinas: true,
      alumnoAislado: true,
      alumnoGestionaSoloSuSesion: true,
      entrenadorAccesoGlobalSegunProducto: true,
      entrenadorNoRegistraSesionesAjenas: true,
      administradorOperativo: true,
      escriturasV2SoloServidor: true,
    },
    credenciales: ".env.qa.local (local, ignorado por Git)",
  }, null, 2));
} finally {
  if (idsTemporales.sesiones.length) {
    await admin.from("sesiones_entrenamiento").delete().in("id", idsTemporales.sesiones);
  }
  if (idsTemporales.rutinas.length) {
    await admin.from("rutinas").delete().in("id", idsTemporales.rutinas);
  }
}
