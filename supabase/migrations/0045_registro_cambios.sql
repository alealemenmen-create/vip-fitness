-- Novedades de la app: una linea corta por cada arreglo/funcion nueva que
-- se sube a produccion, para que el entrenador pueda llevar el control de
-- que fue cambiando sin tener que preguntar cada vez ("si algo no me
-- gusto, lo veo y lo revertimos"). La agrega Claude via script despues de
-- cada deploy — no hay formulario en la app para escribir una todavia,
-- es de solo lectura desde /admin/configuracion.

create table if not exists registro_cambios (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  resumen text not null,
  categoria text not null default 'mejora'
    check (categoria in ('arreglo', 'mejora', 'funcion_nueva')),
  creado_en timestamptz not null default now()
);

create index if not exists registro_cambios_creado_en_idx on registro_cambios (creado_en desc);

alter table registro_cambios enable row level security;

-- Solo el entrenador/admin lo ve — es informacion interna del control del
-- portal, no algo que el alumno necesite.
drop policy if exists registro_cambios_select on registro_cambios;
create policy registro_cambios_select on registro_cambios for select
  using (rol_actual() in ('entrenador', 'admin'));
