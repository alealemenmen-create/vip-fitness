-- Comunidad social V2. Las fotos de progreso siguen siendo privadas hasta que
-- el propio alumno referencia una de ellas en una publicación.

create table if not exists public.comunidad_publicaciones (
  id uuid primary key default gen_random_uuid(),
  alumno_id uuid not null references public.perfiles(id) on delete cascade,
  foto_progreso_id uuid null references public.fotos_progreso(id) on delete set null,
  texto text not null default '' check (char_length(texto) <= 500),
  estado text not null default 'publicada' check (estado in ('publicada', 'oculta', 'eliminada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(trim(texto)) > 0 or foto_progreso_id is not null)
);

create table if not exists public.comunidad_reacciones (
  publicacion_id uuid not null references public.comunidad_publicaciones(id) on delete cascade,
  alumno_id uuid not null references public.perfiles(id) on delete cascade,
  tipo text not null default 'aplauso' check (tipo = 'aplauso'),
  created_at timestamptz not null default now(),
  primary key (publicacion_id, alumno_id)
);

create table if not exists public.comunidad_comentarios (
  id uuid primary key default gen_random_uuid(),
  publicacion_id uuid not null references public.comunidad_publicaciones(id) on delete cascade,
  alumno_id uuid not null references public.perfiles(id) on delete cascade,
  texto text not null check (char_length(trim(texto)) between 2 and 280),
  estado text not null default 'publicado' check (estado in ('publicado', 'oculto', 'eliminado')),
  created_at timestamptz not null default now()
);

create table if not exists public.comunidad_reportes (
  id uuid primary key default gen_random_uuid(),
  publicacion_id uuid not null references public.comunidad_publicaciones(id) on delete cascade,
  reportado_por uuid not null references public.perfiles(id) on delete cascade,
  motivo text not null check (char_length(trim(motivo)) between 3 and 160),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'revisado', 'descartado')),
  created_at timestamptz not null default now(),
  unique (publicacion_id, reportado_por)
);

create index if not exists comunidad_publicaciones_fecha_idx
  on public.comunidad_publicaciones (estado, created_at desc);
create index if not exists comunidad_comentarios_publicacion_idx
  on public.comunidad_comentarios (publicacion_id, created_at asc) where estado = 'publicado';
create index if not exists comunidad_reportes_estado_idx
  on public.comunidad_reportes (estado, created_at desc);

alter table public.comunidad_publicaciones enable row level security;
alter table public.comunidad_reacciones enable row level security;
alter table public.comunidad_comentarios enable row level security;
alter table public.comunidad_reportes enable row level security;

create policy comunidad_publicaciones_select on public.comunidad_publicaciones for select
  using (estado = 'publicada' or alumno_id = auth.uid() or es_admin_o_entrenador());
create policy comunidad_reacciones_select on public.comunidad_reacciones for select
  using (exists (
    select 1 from public.comunidad_publicaciones p
    where p.id = publicacion_id and p.estado = 'publicada'
  ) or es_admin_o_entrenador());
create policy comunidad_comentarios_select on public.comunidad_comentarios for select
  using (estado = 'publicado' or alumno_id = auth.uid() or es_admin_o_entrenador());
create policy comunidad_reportes_select on public.comunidad_reportes for select
  using (reportado_por = auth.uid() or es_admin_o_entrenador());

revoke insert, update, delete on public.comunidad_publicaciones from anon, authenticated;
revoke insert, update, delete on public.comunidad_reacciones from anon, authenticated;
revoke insert, update, delete on public.comunidad_comentarios from anon, authenticated;
revoke insert, update, delete on public.comunidad_reportes from anon, authenticated;
grant select on public.comunidad_publicaciones, public.comunidad_reacciones,
  public.comunidad_comentarios, public.comunidad_reportes to authenticated;

comment on table public.comunidad_publicaciones is
  'Publicaciones voluntarias. Referenciar foto_progreso_id constituye consentimiento explícito para mostrar esa foto en Comunidad.';
