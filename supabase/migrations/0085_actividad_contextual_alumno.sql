-- Separa la actividad dentro de la app de la presencia probable en el gimnasio.
-- Un acceso general NO implica gimnasio. El gimnasio se deduce exclusivamente
-- de sesiones cuya rutina fue iniciada de forma explícita.

create table if not exists actividad_alumno_eventos (
  id uuid primary key default gen_random_uuid(),
  alumno_id uuid not null references alumno_perfil(user_id) on delete cascade,
  tipo text not null check (tipo in ('alimentacion_vista', 'alimentacion_cambio')),
  ocurrido_en timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists actividad_alumno_eventos_alumno_tipo_fecha_idx
  on actividad_alumno_eventos (alumno_id, tipo, ocurrido_en desc);

alter table actividad_alumno_eventos enable row level security;

drop policy if exists actividad_alumno_eventos_select on actividad_alumno_eventos;
create policy actividad_alumno_eventos_select on actividad_alumno_eventos for select
  using (rol_actual() in ('entrenador', 'admin'));

comment on table actividad_alumno_eventos is
  'Actividad contextual del alumno. La presencia en gimnasio se obtiene de sesiones_entrenamiento.rutina_iniciada_en, no de esta tabla.';
