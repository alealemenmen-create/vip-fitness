-- Biblioteca maestra de ejercicios.
--
-- Hasta ahora `rutina_dia_ejercicios.nombre` era texto libre que escribía la IA
-- al leer el PDF de la rutina: no había forma de saber que "Jalón al pecho" y
-- "Jalón amplio" son el mismo movimiento, ni de colgarles técnica, errores
-- comunes o una ilustración. Esta tabla es el catálogo central; las rutinas
-- pasan a apuntarle.
--
-- Decisiones de diseño que conviene no perder:
--
-- 1. `ilustracion_slug` va SEPARADO de `slug`. Varios ejercicios comparten
--    dibujo a propósito (press banca y press en Smith, curl con barra y curl
--    EZ, jalón amplio y jalón supino). Si la ilustración se dedujera del slug
--    del ejercicio harían falta ~80 dibujos en vez de ~45, todos casi iguales.
--
-- 2. `aliases` es lo que hace que el emparejado automático funcione. El PDF de
--    cada entrenador nombra distinto el mismo movimiento; acá se juntan todas
--    las formas conocidas de decirle.
--
-- 3. `rutina_dia_ejercicios.ejercicio_id` es NULLABLE y se conserva `nombre`.
--    Es deliberado: si fuera obligatorio, el día que la IA lea un nombre que no
--    está en la biblioteca la rutina entera no se podría publicar. Así el
--    ejercicio sin reconocer se publica igual con su nombre, y el entrenador lo
--    empareja cuando quiera. Además las 160 filas que ya existen siguen
--    funcionando sin migración de datos.

create table if not exists ejercicios (
  id uuid primary key default gen_random_uuid(),

  -- Identidad
  slug text not null unique,
  nombre text not null,
  -- Otras formas de nombrar el mismo movimiento, para el emparejado por PDF.
  aliases text[] not null default '{}',

  -- Clasificación
  grupo_muscular text not null
    check (grupo_muscular in ('pecho','espalda','piernas','hombros','brazos','core','cardio')),
  grupos_secundarios text[] not null default '{}',
  -- Patrón de movimiento: sirve para armar rutinas equilibradas y para filtrar.
  categoria text not null
    check (categoria in ('empuje','traccion','pierna','core','cardio','aislamiento','full_body')),
  equipo text not null
    check (equipo in ('barra','mancuerna','polea','maquina','smith','peso_corporal','kettlebell','banda','banco','otro')),
  nivel text not null default 'intermedio'
    check (nivel in ('principiante','intermedio','avanzado')),

  -- Contenido para el alumno
  descripcion_corta text,
  tecnica text,
  errores_comunes text[] not null default '{}',
  consejos text[] not null default '{}',

  -- Medios. La ilustración es un archivo estático servido desde /public
  -- (public/ejercicios/<ilustracion_slug>.svg), nunca se genera al vuelo.
  ilustracion_slug text,
  video_url text,

  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- El emparejador busca por nombre y por alias en cada importación de rutina.
create index if not exists ejercicios_slug_idx on ejercicios (slug);
create index if not exists ejercicios_grupo_idx on ejercicios (grupo_muscular) where activo;
create index if not exists ejercicios_aliases_idx on ejercicios using gin (aliases);

-- Enlace desde la rutina. Nullable a propósito (ver nota 3 arriba).
-- `on delete set null`: desactivar o borrar un ejercicio de la biblioteca no
-- puede romper rutinas ya publicadas — se cae al `nombre` que ya está guardado.
alter table rutina_dia_ejercicios
  add column if not exists ejercicio_id uuid references ejercicios(id) on delete set null;

create index if not exists rutina_dia_ejercicios_ejercicio_idx
  on rutina_dia_ejercicios (ejercicio_id);

-- RLS: catálogo global, mismo criterio que `alimentos` (migración 0001) —
-- cualquier autenticado lee, solo entrenador/admin escribe.
alter table ejercicios enable row level security;

drop policy if exists ejercicios_select on ejercicios;
create policy ejercicios_select on ejercicios for select
  using (auth.uid() is not null);

drop policy if exists ejercicios_write on ejercicios;
create policy ejercicios_write on ejercicios for all
  using (es_admin_o_entrenador())
  with check (es_admin_o_entrenador());
