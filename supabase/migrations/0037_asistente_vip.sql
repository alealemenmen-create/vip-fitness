-- Base segura del Asistente VIP.
-- Los reportes siguen calculándose en Postgres/TypeScript. Estas tablas solo
-- controlan el gasto, auditan las llamadas y guardan borradores confirmables.

alter table configuracion_gimnasio
  add column asistente_ia_activo boolean not null default true,
  add column presupuesto_ia_mensual_usd numeric(8, 2) not null default 10
    check (presupuesto_ia_mensual_usd between 0 and 1000);

create table asistente_uso_ia (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references perfiles(id) on delete cascade,
  herramienta text not null
    check (herramienta in ('atencion', 'nutricion', 'entrenamiento', 'progreso', 'noticia', 'alumno')),
  modelo text not null,
  tokens_entrada integer not null default 0 check (tokens_entrada >= 0),
  tokens_salida integer not null default 0 check (tokens_salida >= 0),
  costo_usd numeric(12, 6) not null default 0 check (costo_usd >= 0),
  created_at timestamptz not null default now()
);

create index asistente_uso_ia_mes_idx on asistente_uso_ia (created_at desc);

create table borradores_noticias (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(titulo) between 5 and 90),
  mensaje text not null check (char_length(mensaje) between 20 and 500),
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'publicado', 'descartado')),
  creado_por uuid not null references perfiles(id) on delete cascade,
  generado_con_ia boolean not null default false,
  publicado_en timestamptz,
  created_at timestamptz not null default now()
);

create index borradores_noticias_estado_idx
  on borradores_noticias (estado, created_at desc);

-- Hora real para los registros creados a partir de esta versión. Los registros
-- históricos permanecen nulos: nunca se inventa una hora retroactiva.
alter table comidas_registradas add column registrado_en timestamptz;

create table medidas_corporales (
  id uuid primary key default gen_random_uuid(),
  alumno_id uuid not null references perfiles(id) on delete cascade,
  fecha date not null default current_date,
  cintura_cm numeric(6, 2) check (cintura_cm is null or cintura_cm > 0),
  cadera_cm numeric(6, 2) check (cadera_cm is null or cadera_cm > 0),
  pecho_cm numeric(6, 2) check (pecho_cm is null or pecho_cm > 0),
  brazo_cm numeric(6, 2) check (brazo_cm is null or brazo_cm > 0),
  muslo_cm numeric(6, 2) check (muslo_cm is null or muslo_cm > 0),
  observacion text,
  registrado_por uuid references perfiles(id),
  created_at timestamptz not null default now()
);

create index medidas_corporales_alumno_fecha_idx
  on medidas_corporales (alumno_id, fecha desc);

alter table asistente_uso_ia enable row level security;
alter table borradores_noticias enable row level security;
alter table medidas_corporales enable row level security;

create policy asistente_uso_select on asistente_uso_ia for select
  using (es_admin_o_entrenador());
create policy asistente_uso_insert on asistente_uso_ia for insert
  with check (es_admin_o_entrenador() and usuario_id = auth.uid());

create policy borradores_noticias_access on borradores_noticias for all
  using (es_admin_o_entrenador())
  with check (es_admin_o_entrenador());

create policy medidas_corporales_select on medidas_corporales for select
  using (alumno_id = auth.uid() or es_admin_o_entrenador());
create policy medidas_corporales_write on medidas_corporales for all
  using (es_admin_o_entrenador())
  with check (es_admin_o_entrenador());
