-- Favoritos y recetas personales para la experiencia nutricional V2.

create table if not exists public.alimentos_favoritos (
  alumno_id uuid not null references public.perfiles(id) on delete cascade,
  alimento_id uuid not null references public.alimentos(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (alumno_id, alimento_id)
);

create table if not exists public.recetas_alumno (
  id uuid primary key default gen_random_uuid(),
  alumno_id uuid not null references public.perfiles(id) on delete cascade,
  nombre text not null check (char_length(nombre) between 2 and 60),
  porciones smallint not null default 1 check (porciones between 1 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.receta_ingredientes (
  receta_id uuid not null references public.recetas_alumno(id) on delete cascade,
  alimento_id uuid not null references public.alimentos(id) on delete restrict,
  cantidad numeric(10,2) not null check (cantidad > 0 and cantidad <= 100000),
  orden smallint not null default 0 check (orden >= 0),
  primary key (receta_id, alimento_id)
);

create index if not exists recetas_alumno_fecha_idx on public.recetas_alumno (alumno_id, updated_at desc);
create index if not exists receta_ingredientes_receta_idx on public.receta_ingredientes (receta_id, orden);

alter table public.alimentos_favoritos enable row level security;
alter table public.recetas_alumno enable row level security;
alter table public.receta_ingredientes enable row level security;

create policy alimentos_favoritos_select on public.alimentos_favoritos for select
  using (alumno_id = auth.uid() or es_admin_o_entrenador());
create policy recetas_alumno_select on public.recetas_alumno for select
  using (alumno_id = auth.uid() or es_admin_o_entrenador());
create policy receta_ingredientes_select on public.receta_ingredientes for select
  using (exists (
    select 1 from public.recetas_alumno r
    where r.id = receta_id and (r.alumno_id = auth.uid() or es_admin_o_entrenador())
  ));

revoke insert, update, delete on public.alimentos_favoritos from anon, authenticated;
revoke insert, update, delete on public.recetas_alumno from anon, authenticated;
revoke insert, update, delete on public.receta_ingredientes from anon, authenticated;
grant select on public.alimentos_favoritos, public.recetas_alumno, public.receta_ingredientes to authenticated;

comment on table public.recetas_alumno is 'Recetas privadas del alumno; macros derivados siempre de los ingredientes del catálogo.';
