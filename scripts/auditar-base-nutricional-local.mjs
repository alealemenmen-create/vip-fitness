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

function normalizar(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function numero(valor) {
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : null;
}

function diferenciaRelativa(a, b) {
  if (a === 0 && b === 0) return 0;
  return Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1);
}

const rutaFuente = process.argv[2] ?? "C:\\dev\\vipfitness_nutricion\\alimentos.json";
assert(fs.existsSync(rutaFuente), `No existe la fuente local: ${rutaFuente}`);

const locales = JSON.parse(fs.readFileSync(rutaFuente, "utf8"));
assert(Array.isArray(locales) && locales.length > 0, "La fuente local no contiene alimentos");

const camposRequeridos = [
  "name_es", "categoria", "tipo_producto", "marca", "porcion_g", "kcal",
  "proteina_g", "carbohidratos_g", "grasa_g", "origen", "fuente",
];
const incompletos = locales.filter((fila) => camposRequeridos.some((campo) => fila[campo] === null || fila[campo] === undefined || String(fila[campo]).trim() === ""));
const nombresRepetidos = [...Map.groupBy(locales, (fila) => normalizar(fila.name_es)).entries()]
  .filter(([, filas]) => filas.length > 1)
  .map(([nombre, filas]) => ({ nombre, filas: filas.length }));
const invalidos = locales.filter((fila) => {
  const valores = ["porcion_g", "kcal", "proteina_g", "carbohidratos_g", "grasa_g", "fibra_g", "azucar_g", "sodio_mg"]
    .map((campo) => numero(fila[campo]));
  return valores.some((valor) => valor === null || valor < 0) || numero(fila.porcion_g) <= 0;
});

const env = leerEnv(path.join(process.cwd(), ".env.local"));
assert(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY, "Faltan variables de Supabase en .env.local");
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

async function cargarCatalogo() {
  const filas = [];
  const pagina = 1000;
  for (let desde = 0; ; desde += pagina) {
    const { data, error } = await db
      .from("alimentos")
      .select("id,nombre,marca,categoria,porcion_base,unidad,kcal,prot,carb,grasa,fibra,azucares,sodio,origen,creado_por,aprobado,activo")
      .is("creado_por", null)
      .order("nombre")
      .range(desde, desde + pagina - 1);
    if (error) throw new Error(`No se pudo leer el catálogo activo: ${error.message}`);
    filas.push(...(data ?? []));
    if ((data ?? []).length < pagina) break;
  }
  return filas;
}

const catalogo = await cargarCatalogo();
const porNombre = new Map();
for (const fila of catalogo) {
  const clave = normalizar(fila.nombre);
  const grupo = porNombre.get(clave) ?? [];
  grupo.push(fila);
  porNombre.set(clave, grupo);
}

const nuevos = [];
const coincidencias = [];
const conflictos = [];
for (const local of locales) {
  const existentes = porNombre.get(normalizar(local.name_es)) ?? [];
  if (existentes.length === 0) {
    nuevos.push(local);
    continue;
  }
  const existente = existentes[0];
  const comparaciones = [
    ["kcal", numero(local.kcal), numero(existente.kcal)],
    ["proteína", numero(local.proteina_g), numero(existente.prot)],
    ["carbohidratos", numero(local.carbohidratos_g), numero(existente.carb)],
    ["grasa", numero(local.grasa_g), numero(existente.grasa)],
  ];
  const diferencias = comparaciones.filter(([, localValor, actualValor]) => diferenciaRelativa(localValor, actualValor) > 0.2);
  const registro = { local, existente, diferencias };
  coincidencias.push(registro);
  if (diferencias.length > 0) conflictos.push(registro);
}

const urls = locales.filter((fila) => /^https?:\/\//i.test(fila.fuente));
const resumen = {
  fuenteLocal: rutaFuente,
  filasLocales: locales.length,
  filasCatalogoCompartidoActual: catalogo.length,
  coincidenciasPorNombre: coincidencias.length,
  alimentosNuevos: nuevos.length,
  conflictosMacrosMayores20Pct: conflictos.length,
  fuentesConUrlEspecifica: urls.length,
  fuentesGenericas: locales.length - urls.length,
  filasIncompletas: incompletos.length,
  filasNumericamenteInvalidas: invalidos.length,
  nombresNormalizadosRepetidos: nombresRepetidos.length,
};

console.table([resumen]);
console.log("\nMuestra de alimentos nuevos:");
console.table(nuevos.slice(0, 20).map((fila) => ({ nombre: fila.name_es, categoria: fila.categoria, marca: fila.marca, tipo: fila.tipo_producto })));
console.log("\nMuestra de conflictos (>20% en al menos un macro):");
console.table(conflictos.slice(0, 30).map(({ local, existente, diferencias }) => ({
  nombre: local.name_es,
  actual: `${existente.kcal}/${existente.prot}/${existente.carb}/${existente.grasa}`,
  local: `${local.kcal}/${local.proteina_g}/${local.carbohidratos_g}/${local.grasa_g}`,
  diferencias: diferencias.map(([campo]) => campo).join(", "),
})));

assert.equal(incompletos.length, 0, "Hay filas incompletas en la fuente local");
assert.equal(invalidos.length, 0, "Hay filas con valores nutricionales inválidos");
assert.equal(nombresRepetidos.length, 0, "Hay nombres duplicados tras normalización");
console.log("\nAuditoría de solo lectura completada. No se insertaron ni modificaron alimentos.");
