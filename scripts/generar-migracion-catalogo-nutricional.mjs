import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const fuente = process.argv[2] ?? "C:\\dev\\vipfitness_nutricion\\alimentos.json";
const destino = path.join(process.cwd(), "supabase", "migrations", "0114_catalogo_nutricional_vip_local.sql");

const acentos = new Map(Object.entries({
  platano: "plátano", sandia: "sandía", melon: "melón", pina: "piña", limon: "limón",
  arandano: "arándano", maracuya: "maracuyá", pimenton: "pimentón", brocoli: "brócoli",
  esparrago: "espárrago", rabano: "rábano", champinones: "champiñones", rucula: "rúcula",
  cebollin: "cebollín", maiz: "maíz", semola: "sémola", cuscus: "cuscús", jamon: "jamón",
  higado: "hígado", salmon: "salmón", atun: "atún", camaron: "camarón", mani: "maní",
  castanas: "castañas", caju: "cajú", chia: "chía", generica: "genérica", cafe: "café",
  te: "té", isotonica: "isotónica", azucar: "azúcar", charquican: "charquicán", aji: "ají",
  choripan: "choripán", tequenos: "tequeños", bunuelos: "buñuelos", chuno: "chuño",
  sandwich: "sándwich", porcion: "porción", proteina: "proteína", caseina: "caseína",
  colageno: "colágeno", multivitaminico: "multivitamínico", capsula: "cápsula",
  lacteos: "lácteos", tipicos: "típicos",
}));

function acentuar(texto) {
  return String(texto).replace(/[A-Za-z]+/g, (palabra) => {
    const corregida = acentos.get(palabra.toLowerCase());
    if (!corregida) return palabra;
    return palabra[0] === palabra[0].toUpperCase()
      ? corregida[0].toUpperCase() + corregida.slice(1)
      : corregida;
  });
}

function slug(texto) {
  return String(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function tipo(cadena) {
  if (cadena === "Alimento natural") return "alimento_natural";
  if (cadena === "Suplemento generico") return "suplemento_generico";
  if (cadena === "Suplemento de marca") return "suplemento_marca";
  throw new Error(`Tipo de producto desconocido: ${cadena}`);
}

assert(fs.existsSync(fuente), `No existe ${fuente}`);
const origen = JSON.parse(fs.readFileSync(fuente, "utf8"));
assert.equal(origen.length, 260, "La fuente cambió: se esperaban 260 productos");

const datos = origen.map((fila) => {
  const esUrl = /^https?:\/\//i.test(fila.fuente);
  const nombre = acentuar(fila.name_es);
  const registro = {
    fuente_clave: `vip_local_2026:${slug(nombre)}`,
    nombre,
    categoria: acentuar(fila.categoria),
    tipo_producto: tipo(fila.tipo_producto),
    marca: fila.marca === "Generico" ? null : fila.marca,
    porcion_base: Number(fila.porcion_g),
    kcal: Number(fila.kcal),
    prot: Number(fila.proteina_g),
    carb: Number(fila.carbohidratos_g),
    grasa: Number(fila.grasa_g),
    fibra: Number(fila.fibra_g),
    azucares: Number(fila.azucar_g),
    // La aplicación almacena sodio en gramos; la fuente lo expresa en mg.
    sodio: Math.round((Number(fila.sodio_mg) / 1000) * 1_000_000) / 1_000_000,
    pais_origen: String(fila.origen),
    fuente_datos: esUrl ? "Ficha pública del producto o distribuidor" : acentuar(String(fila.fuente)),
    fuente_url: esUrl ? String(fila.fuente) : null,
    verificacion_fuente: esUrl ? "url_producto" : "referencia_compuesta",
  };
  for (const campo of ["porcion_base", "kcal", "prot", "carb", "grasa", "fibra", "azucares", "sodio"]) {
    assert(Number.isFinite(registro[campo]) && registro[campo] >= 0, `${nombre}: ${campo} inválido`);
  }
  assert(registro.porcion_base > 0, `${nombre}: porción inválida`);
  return registro;
});

assert.equal(new Set(datos.map((fila) => fila.fuente_clave)).size, datos.length, "Hay claves de fuente duplicadas");

const json = JSON.stringify(datos);
const sql = `-- Catálogo nutricional complementario entregado por VIP Fitness (agosto 2026).
-- No sobreescribe el catálogo histórico: sólo añade nombres que aún no existen
-- tras normalizar mayúsculas, espacios y tildes. Sodio se convierte de mg a g.
-- 251 filas provienen de una referencia compuesta USDA/INTA y quedan marcadas
-- como tales; 9 suplementos incluyen URL específica del fabricante.

alter table public.alimentos
  add column if not exists tipo_producto text,
  add column if not exists pais_origen text,
  add column if not exists fuente_datos text,
  add column if not exists fuente_url text,
  add column if not exists fuente_clave text,
  add column if not exists verificacion_fuente text not null default 'sin_especificar';

alter table public.alimentos drop constraint if exists alimentos_tipo_producto_check;
alter table public.alimentos add constraint alimentos_tipo_producto_check
  check (tipo_producto is null or tipo_producto in ('alimento_natural', 'suplemento_generico', 'suplemento_marca', 'producto_envasado'));

alter table public.alimentos drop constraint if exists alimentos_verificacion_fuente_check;
alter table public.alimentos add constraint alimentos_verificacion_fuente_check
  check (verificacion_fuente in ('sin_especificar', 'referencia_compuesta', 'url_producto', 'openfoodfacts', 'personalizado'));

create unique index if not exists alimentos_fuente_clave_key
  on public.alimentos (fuente_clave) where fuente_clave is not null;

update public.alimentos
set fuente_datos = coalesce(fuente_datos, 'Open Food Facts'),
    verificacion_fuente = 'openfoodfacts',
    tipo_producto = coalesce(tipo_producto, 'producto_envasado')
where origen = 'openfoodfacts';

update public.alimentos
set fuente_datos = coalesce(fuente_datos, 'Creado por un alumno'),
    verificacion_fuente = 'personalizado'
where origen = 'personalizado';

with fuente as (
  select *
  from jsonb_to_recordset($vip_nutricion$${json}$vip_nutricion$::jsonb) as fila(
    fuente_clave text,
    nombre text,
    categoria text,
    tipo_producto text,
    marca text,
    porcion_base numeric,
    kcal numeric,
    prot numeric,
    carb numeric,
    grasa numeric,
    fibra numeric,
    azucares numeric,
    sodio numeric,
    pais_origen text,
    fuente_datos text,
    fuente_url text,
    verificacion_fuente text
  )
), candidatos as (
  select fila.*
  from fuente fila
  where not exists (
    select 1
    from public.alimentos actual
    where actual.creado_por is null
      and translate(
        lower(regexp_replace(trim(actual.nombre), '\\s+', ' ', 'g')),
        'áàäâéèëêíìïîóòöôúùüûñ',
        'aaaaeeeeiiiioooouuuun'
      ) = translate(
        lower(regexp_replace(trim(fila.nombre), '\\s+', ' ', 'g')),
        'áàäâéèëêíìïîóòöôúùüûñ',
        'aaaaeeeeiiiioooouuuun'
      )
  )
)
insert into public.alimentos (
  nombre, categoria, porcion_base, unidad, kcal, prot, carb, grasa,
  activo, medida_nombre, medida_gramos, creado_por, aprobado, origen,
  off_id, marca, imagen_url, fibra, azucares, sodio, tipo_producto,
  pais_origen, fuente_datos, fuente_url, fuente_clave, verificacion_fuente
)
select
  nombre, categoria, porcion_base, 'g', kcal, prot, carb, grasa,
  true, null, null, null, true, 'catalogo', null, marca, null, fibra,
  azucares, sodio, tipo_producto, pais_origen, fuente_datos, fuente_url,
  fuente_clave, verificacion_fuente
from candidatos
on conflict do nothing;

comment on column public.alimentos.fuente_datos is 'Descripción de la procedencia nutricional; no implica validación clínica.';
comment on column public.alimentos.fuente_url is 'URL puntual del producto cuando la fuente la entrega.';
comment on column public.alimentos.verificacion_fuente is 'Nivel de trazabilidad disponible para mostrar y auditar el dato.';
`;

fs.writeFileSync(destino, sql, "utf8");
console.log(`Migración generada: ${destino}`);
console.log(`Productos fuente: ${datos.length}; URL específica: ${datos.filter((fila) => fila.fuente_url).length}`);
