-- Reseña de la app: estrellas + sugerencia libre, pedido de Alejandro
-- (2026-08-16) — "así como lo hacen las demás aplicaciones". Vive en
-- /alumno/perfil, siempre accesible, sin popups que interrumpan.
--
-- Un alumno puede mandar más de una reseña con el tiempo (no hay unique):
-- la opinión de hace tres meses no tiene por qué ser la de hoy, y no vale
-- la pena bloquear un envío nuevo por uno viejo.

create table if not exists resenas_app (
  id uuid primary key default gen_random_uuid(),
  alumno_id uuid not null references perfiles(id) on delete cascade,
  estrellas smallint not null check (estrellas between 1 and 5),
  sugerencia text,
  ruta text,
  creado_en timestamptz not null default now()
);

create index if not exists resenas_app_fecha_idx on resenas_app (creado_en desc);

alter table resenas_app enable row level security;

drop policy if exists resenas_app_insert on resenas_app;
create policy resenas_app_insert on resenas_app for insert
  with check (auth.uid() = alumno_id);

drop policy if exists resenas_app_select on resenas_app;
create policy resenas_app_select on resenas_app for select
  using (auth.uid() = alumno_id or es_admin_o_entrenador());
