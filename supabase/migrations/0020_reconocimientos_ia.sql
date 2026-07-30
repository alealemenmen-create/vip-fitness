-- Reconocimientos semanales con IA.
--
-- La selección parte de métricas agregadas que ya calcula el ranking. La IA
-- nunca recibe peso, calorías, datos médicos ni identificadores personales.
-- La restricción única vuelve el proceso idempotente: aunque el cron o el
-- entrenador lo ejecuten dos veces, no se duplica una felicitación.

create table configuracion_gimnasio (
  id boolean primary key default true check (id),
  reconocimientos_activos boolean not null default true,
  max_reconocimientos_semana integer not null default 3
    check (max_reconocimientos_semana between 1 and 5),
  min_puntaje_reconocimiento integer not null default 55
    check (min_puntaje_reconocimiento between 0 and 100),
  incluir_entrenamiento boolean not null default true,
  incluir_alimentacion boolean not null default true,
  incluir_ranking boolean not null default true,
  incluir_constancia boolean not null default true,
  dias_sin_entrenar_alerta integer not null default 7
    check (dias_sin_entrenar_alerta between 1 and 30),
  pct_entrenamiento_atencion integer not null default 50
    check (pct_entrenamiento_atencion between 0 and 100),
  pct_entrenamiento_destacado integer not null default 85
    check (pct_entrenamiento_destacado between 1 and 200),
  dias_comida_atencion integer not null default 2
    check (dias_comida_atencion between 0 and 6),
  dias_comida_destacado integer not null default 5
    check (dias_comida_destacado between 1 and 7),
  updated_by uuid references perfiles(id),
  updated_at timestamptz not null default now(),
  check (pct_entrenamiento_atencion < pct_entrenamiento_destacado),
  check (dias_comida_atencion < dias_comida_destacado)
);

insert into configuracion_gimnasio (id) values (true)
on conflict (id) do nothing;

create table reconocimientos_semanales (
  id uuid primary key default gen_random_uuid(),
  semana_inicio date not null,
  alumno_id uuid not null references perfiles(id) on delete cascade,
  categoria text not null
    check (categoria in ('entrenamiento', 'alimentacion', 'ranking', 'constancia')),
  titulo text not null,
  mensaje text not null,
  puntaje integer not null check (puntaje between 0 and 100),
  metricas jsonb not null default '{}'::jsonb,
  generado_con_ia boolean not null default false,
  modelo text,
  created_at timestamptz not null default now(),
  unique (semana_inicio, alumno_id)
);

-- Eventos automáticos pequeños (por ahora, bienvenida de nuevos alumnos).
-- Se crean en el momento del evento: no se reconstruyen desde datos antiguos,
-- evitando publicar de golpe la incorporación de alumnos preexistentes.
create table noticias_sistema (
  id uuid primary key default gen_random_uuid(),
  clave_origen text not null unique,
  tipo text not null check (tipo in ('bienvenida')),
  alumno_id uuid references perfiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index reconocimientos_semanales_fecha_idx
  on reconocimientos_semanales (created_at desc);
create index noticias_sistema_fecha_idx on noticias_sistema (created_at desc);

alter table configuracion_gimnasio enable row level security;
alter table reconocimientos_semanales enable row level security;
alter table noticias_sistema enable row level security;

-- La configuración solo es visible y editable por el equipo del gimnasio.
create policy configuracion_gimnasio_select on configuracion_gimnasio for select
  using (es_admin_o_entrenador());

create policy configuracion_gimnasio_write on configuracion_gimnasio for all
  using (es_admin_o_entrenador())
  with check (es_admin_o_entrenador());

-- Los reconocimientos son noticias internas para usuarios autenticados.
create policy reconocimientos_semanales_select on reconocimientos_semanales for select
  using (auth.uid() is not null);

create policy reconocimientos_semanales_write on reconocimientos_semanales for all
  using (es_admin_o_entrenador())
  with check (es_admin_o_entrenador());

create policy noticias_sistema_select on noticias_sistema for select
  using (auth.uid() is not null);

create policy noticias_sistema_write on noticias_sistema for all
  using (es_admin_o_entrenador())
  with check (es_admin_o_entrenador());
