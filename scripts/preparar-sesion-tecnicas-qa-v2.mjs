import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function leerEnv(archivo) {
  if (!fs.existsSync(archivo)) return {};
  return Object.fromEntries(fs.readFileSync(archivo, "utf8")
    .split(/\r?\n/)
    .map((linea) => linea.trim())
    .filter((linea) => linea && !linea.startsWith("#") && linea.includes("="))
    .map((linea) => {
      const indice = linea.indexOf("=");
      return [linea.slice(0, indice), linea.slice(indice + 1).replace(/^["']|["']$/g, "")];
    }));
}

const raiz = process.cwd();
const env = leerEnv(path.join(raiz, ".env.local"));
const envQa = leerEnv(path.join(raiz, ".env.qa.local"));
const emailQa = envQa.QA_ALUMNO_EMAIL;
assert(emailQa, "Primero ejecuta configurar-y-verificar-qa-v2.mjs");
assert(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY, "Falta la configuración de Supabase");

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

async function exigir(resultado, contexto) {
  if (resultado.error) throw new Error(`${contexto}: ${resultado.error.message}`);
  return resultado.data;
}

const usuarios = await exigir(await db.auth.admin.listUsers({ page: 1, perPage: 1_000 }), "Usuarios QA");
const usuario = usuarios.users.find((item) => item.email?.toLowerCase() === emailQa.toLowerCase());
assert(usuario?.user_metadata?.portal_qa === true, "La identidad encontrada no está marcada como Portal QA");

const alumnoId = usuario.id;
const nombreRutina = "QA Portal V2 · Técnicas avanzadas";
let rutina = await exigir(await db.from("rutinas")
  .select("id,alumno_id,nombre")
  .eq("alumno_id", alumnoId)
  .eq("nombre", nombreRutina)
  .limit(1)
  .maybeSingle(), "Buscar rutina técnica QA");

if (!rutina) {
  rutina = await exigir(await db.from("rutinas").insert({
    alumno_id: alumnoId,
    nombre: nombreRutina,
    activa: false,
    version: 1,
  }).select("id,alumno_id,nombre").single(), "Crear rutina técnica QA");
}
assert(rutina.alumno_id === alumnoId && rutina.nombre === nombreRutina, "La rutina QA no coincide con el objetivo aislado");

let dia = await exigir(await db.from("rutina_dias")
  .select("id,rutina_id")
  .eq("rutina_id", rutina.id)
  .eq("numero_dia", 1)
  .limit(1)
  .maybeSingle(), "Buscar día técnico QA");

if (!dia) {
  dia = await exigir(await db.from("rutina_dias").insert({
    rutina_id: rutina.id,
    numero_dia: 1,
    orden: 1,
    nombre: "Laboratorio de técnicas V2",
    tipo: "entrenamiento",
    descripcion: "Sesión sintética aislada para verificar técnicas avanzadas sin alumnos activos.",
  }).select("id,rutina_id").single(), "Crear día técnico QA");
}
assert(dia.rutina_id === rutina.id, "El día QA no pertenece a la rutina aislada");

const rutinasQa = await exigir(await db.from("rutinas").select("id,nombre").eq("alumno_id", alumnoId).like("nombre", "QA Portal V2%"), "Rutinas QA");
const idsRutinasQa = rutinasQa.map((item) => item.id);
if (idsRutinasQa.length) {
  await exigir(await db.from("sesiones_entrenamiento").update({
    estado: "abandonada",
    hora_fin: new Date().toISOString(),
  }).eq("alumno_id", alumnoId).in("rutina_id", idsRutinasQa).eq("estado", "en_progreso"), "Cerrar sesiones QA anteriores");
}
await exigir(await db.from("sesiones_entrenamiento").delete().eq("alumno_id", alumnoId).eq("rutina_id", rutina.id), "Limpiar sesiones técnicas QA anteriores");

const biblioteca = await exigir(await db.from("ejercicios")
  .select("id,nombre,grupo_muscular")
  .eq("activo", true)
  .eq("calidad_ficha", "completa")
  .not("foto_miniatura_url", "is", null)
  .order("nombre")
  .limit(18), "Biblioteca para técnicas QA");
assert(biblioteca.length >= 18, "Se necesitan 18 fichas completas para la sesión QA");

await exigir(await db.from("rutina_dia_ejercicios").delete().eq("dia_id", dia.id), "Limpiar ejercicios sintéticos anteriores");

const definiciones = [
  { tecnica: "FST-7", series: 7, reps: "10-15", descanso: 30, tecnicaSeries: null },
  { tecnica: "Drop set", series: 3, reps: "10", descanso: 75, tecnicaSeries: [3] },
  { tecnica: "Rest-pause", series: 3, reps: "8", descanso: 90, tecnicaSeries: [3] },
  { tecnica: "Myo-reps", series: 3, reps: "12", descanso: 75, tecnicaSeries: [3] },
  { tecnica: "Cluster set", series: 3, reps: "8", descanso: 120, tecnicaSeries: [3] },
  { tecnica: "Fallo técnico", series: 3, reps: "10", descanso: 90, tecnicaSeries: [3] },
  { tecnica: "Superserie (1/2)", series: 2, reps: "10", descanso: 0, tecnicaSeries: null },
  { tecnica: "Superserie (2/2)", series: 2, reps: "12", descanso: 75, tecnicaSeries: null },
  { tecnica: "Triserie (1/3)", series: 2, reps: "10", descanso: 0, tecnicaSeries: null },
  { tecnica: "Triserie (2/3)", series: 2, reps: "12", descanso: 0, tecnicaSeries: null },
  { tecnica: "Triserie (3/3)", series: 2, reps: "15", descanso: 90, tecnicaSeries: null },
  { tecnica: "Serie gigante (1/4)", series: 1, reps: "12", descanso: 0, tecnicaSeries: null },
  { tecnica: "Serie gigante (2/4)", series: 1, reps: "12", descanso: 0, tecnicaSeries: null },
  { tecnica: "Serie gigante (3/4)", series: 1, reps: "15", descanso: 0, tecnicaSeries: null },
  { tecnica: "Serie gigante (4/4)", series: 1, reps: "15", descanso: 120, tecnicaSeries: null },
  { tecnica: "Circuito (1/3)", series: 2, reps: "12", descanso: 0, tecnicaSeries: null },
  { tecnica: "Circuito (2/3)", series: 2, reps: "12", descanso: 0, tecnicaSeries: null },
  { tecnica: "Circuito (3/3)", series: 2, reps: "12", descanso: 90, tecnicaSeries: null },
];

const ejercicios = await exigir(await db.from("rutina_dia_ejercicios").insert(definiciones.map((definicion, indice) => ({
  dia_id: dia.id,
  orden: indice + 1,
  nombre: biblioteca[indice].nombre,
  series_programadas: definicion.series,
  reps_programadas: definicion.reps,
  descanso_segundos: definicion.descanso,
  tecnica_tipo: definicion.tecnica,
  tecnica_series: definicion.tecnicaSeries,
  tecnica_instruccion: `QA controlada: ejecuta ${definicion.tecnica} respetando sus pasos y descansos.`,
  grupo_muscular: biblioteca[indice].grupo_muscular,
  ejercicio_id: biblioteca[indice].id,
}))).select("id,orden"), "Crear ejercicios técnicos QA");

const sesion = await exigir(await db.from("sesiones_entrenamiento").insert({
  alumno_id: alumnoId,
  rutina_id: rutina.id,
  dia_id: dia.id,
  numero_calendario: 9_001,
  estado: "en_progreso",
  rutina_iniciada_en: new Date().toISOString(),
}).select("id").single(), "Crear sesión técnica QA");

const ejerciciosSesion = await exigir(await db.from("sesion_ejercicios").insert(ejercicios
  .sort((a, b) => a.orden - b.orden)
  .map((ejercicio) => ({ sesion_id: sesion.id, dia_ejercicio_id: ejercicio.id })))
  .select("id,dia_ejercicio_id"), "Crear ejercicios de sesión QA");

const primerEjercicioSesion = ejerciciosSesion.find((item) => item.dia_ejercicio_id === ejercicios[0].id);
assert(primerEjercicioSesion, "No se pudo identificar el primer ejercicio de la sesión QA");
await exigir(await db.from("impulso_vip_intervenciones").insert({
  sesion_ejercicio_id: primerEjercicioSesion.id,
  alumno_id: alumnoId,
  serie_objetivo: 1,
  tipo: "repeticion_objetivo",
  origen: "metodo_ale",
  instruccion: "PRIMER RETO QA: COMPLETA 10 REPETICIONES LIMPIAS.",
  motivo: "Validación automática aislada del ciclo mostrar → guardar → verificar.",
  prescripcion: { repsObjetivo: 10 },
  decision_data: { portalQa: true },
}), "Crear intervención Alejandro QA");

process.stdout.write(sesion.id);
