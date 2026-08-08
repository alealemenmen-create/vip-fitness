-- Reportes de alumnos cuando la imagen de referencia no corresponde al
-- ejercicio. El entrenador los resuelve reemplazando la foto global desde
-- /admin/ejercicios. Idempotente.

-- Encuadres independientes para la vista panorámica y la cuadrada. Son
-- porcentajes CSS object-position (0..100) editables con el dedo.
alter table ejercicios
  add column if not exists foto_panorama_x real not null default 50 check (foto_panorama_x between 0 and 100),
  add column if not exists foto_panorama_y real not null default 50 check (foto_panorama_y between 0 and 100),
  add column if not exists foto_cuadrada_x real not null default 50 check (foto_cuadrada_x between 0 and 100),
  add column if not exists foto_cuadrada_y real not null default 50 check (foto_cuadrada_y between 0 and 100);

create table if not exists reportes_fotos_ejercicios (
  id uuid primary key default gen_random_uuid(),
  alumno_id uuid not null references perfiles(id) on delete cascade,
  ejercicio_id uuid references ejercicios(id) on delete set null,
  sesion_ejercicio_id uuid references sesion_ejercicios(id) on delete set null,
  nombre_ejercicio text not null,
  foto_url_reportada text,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'resuelto')),
  creado_en timestamptz not null default now(),
  resuelto_en timestamptz,
  resuelto_por uuid references perfiles(id)
);

create index if not exists reportes_fotos_estado_fecha_idx
  on reportes_fotos_ejercicios (estado, creado_en desc);
create index if not exists reportes_fotos_ejercicio_estado_idx
  on reportes_fotos_ejercicios (ejercicio_id, estado);

-- Un alumno no necesita enviar la misma alerta repetidamente mientras sigue
-- pendiente. Se admiten reportes de otros alumnos para confirmar el problema.
create unique index if not exists reportes_fotos_alumno_ejercicio_pendiente_unique
  on reportes_fotos_ejercicios (alumno_id, ejercicio_id)
  where estado = 'pendiente' and ejercicio_id is not null;
create unique index if not exists reportes_fotos_alumno_sesion_pendiente_unique
  on reportes_fotos_ejercicios (alumno_id, sesion_ejercicio_id)
  where estado = 'pendiente' and ejercicio_id is null and sesion_ejercicio_id is not null;

alter table reportes_fotos_ejercicios enable row level security;

drop policy if exists reportes_fotos_select on reportes_fotos_ejercicios;
create policy reportes_fotos_select on reportes_fotos_ejercicios for select
  using (alumno_id = auth.uid() or es_entrenador_de(alumno_id));

drop policy if exists reportes_fotos_alumno_insert on reportes_fotos_ejercicios;
create policy reportes_fotos_alumno_insert on reportes_fotos_ejercicios for insert
  with check (alumno_id = auth.uid());

drop policy if exists reportes_fotos_entrenador_update on reportes_fotos_ejercicios;
create policy reportes_fotos_entrenador_update on reportes_fotos_ejercicios for update
  using (es_entrenador_de(alumno_id))
  with check (es_entrenador_de(alumno_id));
