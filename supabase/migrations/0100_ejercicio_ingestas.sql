-- Instructivo de galería multimedia, Fase 2 (§8.1/§8.2, §12): sesiones de
-- ingesta persistentes. Hasta acá (Fase 1) la cola de "Subir y organizar"
-- vivía solo en memoria del navegador — un refresh, un corte de conexión o
-- cerrar el teléfono por accidente perdía todo el trabajo de asociación ya
-- hecho. Estas dos tablas son el lado servidor de la recuperación: el
-- detalle de cada archivo (bytes) sigue viviendo solo en el dispositivo
-- (IndexedDB, nunca acá), pero el estado — qué se subió, a qué ejercicio
-- quedó vinculado, qué falta — sí, y sobrevive a cualquiera de esos cortes.
--
-- `ejercicio_ingesta_items.clave_idempotente` es la pieza clave de "aplicar
-- seguros" sin duplicar nada: la genera el cliente una sola vez por archivo
-- (no por intento), así que reintentar una aplicación que a medias falló
-- nunca crea el ejercicio dos veces ni vincula el medio dos veces — el
-- server action de aplicación (ver ingestaActions.ts) primero busca por esa
-- clave y, si el item ya quedó 'aplicado', no repite nada.

create table if not exists ejercicio_ingestas (
  id uuid primary key default gen_random_uuid(),
  entrenador_id uuid not null references perfiles(id) on delete cascade,
  origen text not null default 'carga'
    check (origen in ('carga', 'camara', 'modo_gimnasio', 'pendiente', 'alta')),
  estado text not null default 'borrador'
    check (estado in ('borrador', 'cargando', 'requiere_revision', 'aplicando', 'completada', 'parcial', 'cancelada')),
  total_archivos int not null default 0,
  archivos_listos int not null default 0,
  archivos_error int not null default 0,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  completado_en timestamptz
);

create index if not exists ejercicio_ingestas_entrenador_estado_idx
  on ejercicio_ingestas (entrenador_id, estado);

create table if not exists ejercicio_ingesta_items (
  id uuid primary key default gen_random_uuid(),
  ingesta_id uuid not null references ejercicio_ingestas(id) on delete cascade,
  clave_idempotente text not null unique,
  nombre_archivo text not null,
  mime text,
  tamano_bytes bigint,
  tipo text not null check (tipo in ('imagen', 'video')),
  -- Nulo hasta que el archivo queda vinculado (a uno existente o a uno
  -- creado desde este mismo item) — ver on delete set null: si el ejercicio
  -- se borra después, el historial de la ingesta no debe romperse por eso.
  ejercicio_id uuid references ejercicios(id) on delete set null,
  nombre_candidato text,
  -- Mismo vocabulario de 3 niveles que usa la cola desde Fase 1 (ver
  -- `Confianza` en CargaMasivaFotos.tsx) — no el de 5 niveles del §9.1 del
  -- instructivo, que es del motor de coincidencias ampliado.
  confianza text check (confianza in ('alta', 'revisar', 'sin_match')),
  estado text not null default 'local'
    check (estado in ('local', 'subiendo', 'procesando', 'listo', 'error', 'aplicado')),
  error_detalle text,
  intentos int not null default 0,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists ejercicio_ingesta_items_ingesta_idx
  on ejercicio_ingesta_items (ingesta_id);

alter table ejercicio_ingestas enable row level security;
alter table ejercicio_ingesta_items enable row level security;

drop policy if exists ejercicio_ingestas_select on ejercicio_ingestas;
create policy ejercicio_ingestas_select on ejercicio_ingestas for select
  using (es_admin_o_entrenador());

drop policy if exists ejercicio_ingestas_write on ejercicio_ingestas;
create policy ejercicio_ingestas_write on ejercicio_ingestas for all
  using (es_admin_o_entrenador())
  with check (es_admin_o_entrenador());

drop policy if exists ejercicio_ingesta_items_select on ejercicio_ingesta_items;
create policy ejercicio_ingesta_items_select on ejercicio_ingesta_items for select
  using (es_admin_o_entrenador());

drop policy if exists ejercicio_ingesta_items_write on ejercicio_ingesta_items;
create policy ejercicio_ingesta_items_write on ejercicio_ingesta_items for all
  using (es_admin_o_entrenador())
  with check (es_admin_o_entrenador());
