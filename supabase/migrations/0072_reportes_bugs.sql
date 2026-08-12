-- Botón flotante de reporte de fallas: el alumno lo presiona cuando algo se
-- ve mal, adjunta una captura del momento y una descripción corta, y le llega
-- al panel del entrenador. Mismo patrón que 0048_reportes_fotos_ejercicios.sql
-- (tabla + bucket privado + RLS), pero acá el alumno SUBE una imagen nueva
-- (la captura), no referencia una que ya existe — por eso hace falta bucket
-- propio.

insert into storage.buckets (id, name, public)
values ('reportes-bugs', 'reportes-bugs', false)
on conflict (id) do nothing;

create table if not exists reportes_bugs (
  id uuid primary key default gen_random_uuid(),
  alumno_id uuid not null references perfiles(id) on delete cascade,
  -- Ruta donde estaba el alumno al reportar (ej. "/alumno/entrenar/sesion/...").
  -- Sin esto, "algo se ve mal" no dice en qué pantalla.
  ruta text not null,
  descripcion text not null,
  -- Ruta dentro del bucket 'reportes-bugs'; null si la captura falló pero el
  -- alumno igual quiso mandar la descripción (mejor un reporte sin imagen que
  -- ninguno).
  captura_path text,
  -- User agent + tamaño de pantalla: para bugs que solo pasan en un
  -- dispositivo puntual (ej. "en iPhone no funciona").
  dispositivo text,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'resuelto')),
  creado_en timestamptz not null default now(),
  resuelto_en timestamptz,
  resuelto_por uuid references perfiles(id)
);

create index if not exists reportes_bugs_estado_fecha_idx
  on reportes_bugs (estado, creado_en desc);

alter table reportes_bugs enable row level security;

create policy reportes_bugs_select on reportes_bugs for select
  using (alumno_id = auth.uid() or es_entrenador_de(alumno_id) or es_admin_o_entrenador());

create policy reportes_bugs_alumno_insert on reportes_bugs for insert
  with check (alumno_id = auth.uid());

create policy reportes_bugs_entrenador_update on reportes_bugs for update
  using (es_admin_o_entrenador())
  with check (es_admin_o_entrenador());

-- reportes-bugs: el alumno sube a su propia carpeta ({alumno_id}/archivo,
-- mismo patrón que documentos/fotos-progreso). Lectura para el propio alumno,
-- su entrenador, o cualquier admin/entrenador (el panel de errores es de
-- todo el equipo, no de un entrenador puntual).
create policy reportes_bugs_storage_select on storage.objects for select
  using (
    bucket_id = 'reportes-bugs'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or es_entrenador_de(((storage.foldername(name))[1])::uuid)
      or es_admin_o_entrenador()
    )
  );

create policy reportes_bugs_storage_write on storage.objects for insert
  with check (
    bucket_id = 'reportes-bugs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
