-- Personalización segura de una sesión V2.
--
-- La rutina publicada sigue siendo la prescripción del entrenador. Esta tabla
-- registra únicamente lo que el alumno ejecutó en una sesión concreta: una
-- sustitución compatible o un orden distinto. No se sobreescribe la rutina y
-- el historial puede distinguir el ejercicio prescrito del realmente hecho.

create table if not exists public.sesion_ejercicio_personalizaciones (
  sesion_ejercicio_id uuid primary key references public.sesion_ejercicios(id) on delete cascade,
  alumno_id uuid not null references public.perfiles(id) on delete cascade,
  ejercicio_sustituto_id uuid references public.ejercicios(id) on delete restrict,
  orden_ejecucion smallint check (orden_ejecucion is null or orden_ejecucion >= 0),
  motivo text check (motivo is null or char_length(motivo) <= 180),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sesion_personalizaciones_alumno_idx
  on public.sesion_ejercicio_personalizaciones (alumno_id, updated_at desc);
create index if not exists sesion_personalizaciones_sustituto_idx
  on public.sesion_ejercicio_personalizaciones (ejercicio_sustituto_id)
  where ejercicio_sustituto_id is not null;

alter table public.sesion_ejercicio_personalizaciones enable row level security;

drop policy if exists sesion_personalizaciones_select on public.sesion_ejercicio_personalizaciones;
create policy sesion_personalizaciones_select
  on public.sesion_ejercicio_personalizaciones for select
  using (alumno_id = auth.uid() or es_admin_o_entrenador());

-- Igual que las series: el navegador sólo lee. Toda escritura pasa por una
-- Server Action que confirma propietario, sesión abierta, compatibilidad y
-- ausencia de series realizadas antes de sustituir.
revoke insert, update, delete on table public.sesion_ejercicio_personalizaciones from anon;
revoke insert, update, delete on table public.sesion_ejercicio_personalizaciones from authenticated;
grant select on table public.sesion_ejercicio_personalizaciones to authenticated;

comment on table public.sesion_ejercicio_personalizaciones is
  'Diferencias por sesión entre la rutina prescrita y lo realmente ejecutado. No modifica la rutina publicada.';
comment on column public.sesion_ejercicio_personalizaciones.ejercicio_sustituto_id is
  'Ejercicio realmente ejecutado; NULL conserva el prescrito en rutina_dia_ejercicios.';
comment on column public.sesion_ejercicio_personalizaciones.orden_ejecucion is
  'Orden cero-based dentro de la sesión; grupos encadenados permanecen contiguos.';
