-- Caché compartida del catálogo externo. Open Food Facts limita las búsquedas
-- por IP; guardar el resultado evita que varios alumnos repitan la misma
-- consulta desde la IP del servidor y mantiene el buscador útil durante una
-- caída breve del proveedor.

create table if not exists public.open_food_facts_cache (
  consulta text not null check (char_length(consulta) between 2 and 120),
  pais text not null check (pais in ('chile', 'global')),
  productos jsonb not null default '[]'::jsonb check (jsonb_typeof(productos) = 'array'),
  expira_en timestamptz not null,
  actualizado_en timestamptz not null default now(),
  primary key (consulta, pais)
);

create index if not exists open_food_facts_cache_expira_idx
  on public.open_food_facts_cache (expira_en);

alter table public.open_food_facts_cache enable row level security;

-- La tabla se consulta y actualiza exclusivamente desde el servidor con la
-- service role. Ningún cliente puede sembrar macros falsos en la caché.
revoke all on public.open_food_facts_cache from anon, authenticated;

