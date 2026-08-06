-- Auditoria de Puntos VIP: la deteccion de sospechas corre en TypeScript
-- contra los datos existentes (no hace falta una tabla para eso), pero la
-- decision del entrenador sobre cada hallazgo (descartar o penalizar) si hay
-- que persistirla — sin esto, el mismo hallazgo reaparece cada vez que se
-- recarga la pantalla aunque ya se haya revisado.

create table auditoria_revisiones (
  id uuid primary key default gen_random_uuid(),
  tipo text not null
    check (tipo in ('sesion_duracion_imposible', 'puntos_entrenamiento_huerfanos')),
  -- Id de lo que origino el hallazgo (normalmente una sesion) — texto y no
  -- uuid porque futuros tipos de hallazgo podrian usar una clave compuesta.
  referencia_id text not null,
  alumno_id uuid not null references perfiles(id) on delete cascade,
  estado text not null check (estado in ('descartado', 'penalizado')),
  puntos_ajustados integer,
  nota text,
  revisor_id uuid not null references perfiles(id),
  creado_en timestamptz not null default now(),
  unique (tipo, referencia_id)
);

create index auditoria_revisiones_alumno_idx on auditoria_revisiones (alumno_id);

alter table auditoria_revisiones enable row level security;

create policy auditoria_revisiones_staff on auditoria_revisiones for all
  using (es_admin_o_entrenador())
  with check (es_admin_o_entrenador());
