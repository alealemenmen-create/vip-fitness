-- Indicaciones que Alejandro deja preparadas para la proxima vez que un
-- ejercicio aparezca en una sesion. Al materializarse se convierten en una
-- fila normal de impulso_vip_intervenciones con origen personal_ale.

create table if not exists impulso_vip_indicaciones_programadas (
  id uuid primary key default gen_random_uuid(),
  alumno_id uuid not null references perfiles(id) on delete cascade,
  dia_ejercicio_id uuid not null references rutina_dia_ejercicios(id) on delete cascade,
  serie_objetivo int not null check (serie_objetivo > 0),
  tipo text not null check (tipo in (
    'cierre_controlado', 'repeticion_objetivo', 'tempo_controlado',
    'pausa_isometrica', 'serie_descarga', 'drop_set', 'rest_pause',
    'fallo_controlado'
  )),
  instruccion text not null check (char_length(instruccion) between 3 and 500),
  prescripcion jsonb not null default '{}'::jsonb,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'entregada', 'cancelada')),
  creada_por uuid not null references perfiles(id),
  creada_en timestamptz not null default now(),
  entregada_en timestamptz,
  intervencion_id uuid references impulso_vip_intervenciones(id) on delete set null
);

create unique index if not exists impulso_vip_indicacion_pendiente_unica_idx
  on impulso_vip_indicaciones_programadas (alumno_id, dia_ejercicio_id, serie_objetivo)
  where estado = 'pendiente';
create index if not exists impulso_vip_indicaciones_pendientes_idx
  on impulso_vip_indicaciones_programadas (alumno_id, creada_en desc)
  where estado = 'pendiente';

alter table impulso_vip_indicaciones_programadas enable row level security;

drop policy if exists impulso_vip_indicaciones_select on impulso_vip_indicaciones_programadas;
create policy impulso_vip_indicaciones_select on impulso_vip_indicaciones_programadas for select
  using (alumno_id = auth.uid() or es_entrenador_de(alumno_id));

drop policy if exists impulso_vip_indicaciones_entrenador_write on impulso_vip_indicaciones_programadas;
create policy impulso_vip_indicaciones_entrenador_write on impulso_vip_indicaciones_programadas for all
  using (es_entrenador_de(alumno_id))
  with check (es_entrenador_de(alumno_id));

comment on table impulso_vip_indicaciones_programadas is
  'Mensajes personales de Alejandro preparados antes de entrenar; se entregan una vez y conservan trazabilidad propia.';
