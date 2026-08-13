-- Puente humano de Impulso VIP: el alumno puede avisar a Ale desde un
-- Momento Impulso y el entrenador ve una solicitud contextual y temporal.

create table if not exists impulso_vip_solicitudes_asistencia (
  id uuid primary key default gen_random_uuid(),
  intervencion_id uuid not null unique
    references impulso_vip_intervenciones(id) on delete cascade,
  alumno_id uuid not null references perfiles(id) on delete cascade,
  sesion_ejercicio_id uuid not null references sesion_ejercicios(id) on delete cascade,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'voy', 'atendida', 'no_disponible', 'vencida')),
  mensaje_alumno text,
  respuesta_entrenador text,
  solicitada_en timestamptz not null default now(),
  vence_en timestamptz not null default (now() + interval '10 minutes'),
  respondida_en timestamptz,
  respondida_por uuid references perfiles(id)
);

create index if not exists impulso_vip_asistencia_pendiente_idx
  on impulso_vip_solicitudes_asistencia (estado, solicitada_en desc)
  where estado in ('pendiente', 'voy');
create index if not exists impulso_vip_asistencia_alumno_idx
  on impulso_vip_solicitudes_asistencia (alumno_id, solicitada_en desc);

alter table impulso_vip_solicitudes_asistencia enable row level security;

drop policy if exists impulso_vip_asistencia_select on impulso_vip_solicitudes_asistencia;
create policy impulso_vip_asistencia_select on impulso_vip_solicitudes_asistencia for select
  using (alumno_id = auth.uid() or es_entrenador_de(alumno_id));

-- Inserciones y cambios pasan por acciones del servidor: el alumno no puede
-- fabricar una solicitud para otro ejercicio y el entrenador no puede
-- responder sin volver a validar su rol.

comment on table impulso_vip_solicitudes_asistencia is
  'Solicitudes breves de supervision nacidas desde un Momento Impulso. Vencen para no presentar como actual una necesidad vieja.';
