-- Impulso VIP En Vivo — intervenciones puntuales dentro de un ejercicio.
--
-- La recomendacion de 0043 sigue siendo la meta general, congelada, de todo
-- el ejercicio. Esta tabla no la reemplaza: registra un momento concreto
-- (por ejemplo, la ultima serie), que instruccion vio el alumno y como
-- termino. Separarlas permite varias intervenciones futuras sin reescribir el
-- historial ni fingir que Alejandro envio personalmente un mensaje automatico.

create table if not exists impulso_vip_intervenciones (
  id uuid primary key default gen_random_uuid(),
  sesion_ejercicio_id uuid not null references sesion_ejercicios(id) on delete cascade,
  alumno_id uuid not null references perfiles(id) on delete cascade,
  serie_objetivo int not null check (serie_objetivo > 0),
  tipo text not null check (tipo in (
    'cierre_controlado',
    'repeticion_objetivo',
    'tempo_controlado',
    'pausa_isometrica',
    'serie_descarga',
    'drop_set',
    'rest_pause',
    'fallo_controlado'
  )),
  -- metodo_ale: regla automatica creada a partir del metodo del entrenador.
  -- preparada_por_ale/personal_ale se reservan para el panel humano: solo
  -- esas pueden hablar como una indicacion enviada personalmente por el.
  origen text not null default 'metodo_ale'
    check (origen in ('metodo_ale', 'preparada_por_ale', 'personal_ale')),
  firma text not null default 'Metodo de Ale Mendoza',
  instruccion text not null,
  motivo text not null,
  prescripcion jsonb not null default '{}'::jsonb,
  estado text not null default 'preparada'
    check (estado in ('preparada', 'mostrada', 'resuelta', 'cancelada')),
  resultado text check (resultado is null or resultado in (
    'lograda', 'parcial', 'no_lograda', 'omitida', 'omitida_molestia'
  )),
  verificacion text check (verificacion is null or verificacion in (
    'datos', 'declarada', 'entrenador'
  )),
  motor_version text not null default 'en_vivo_v1',
  decision_data jsonb not null default '{}'::jsonb,
  mostrada_en timestamptz,
  resuelta_en timestamptz,
  created_at timestamptz not null default now(),
  unique (sesion_ejercicio_id, serie_objetivo)
);

create index if not exists impulso_vip_intervenciones_alumno_fecha_idx
  on impulso_vip_intervenciones (alumno_id, created_at desc);
create index if not exists impulso_vip_intervenciones_pendientes_idx
  on impulso_vip_intervenciones (alumno_id, estado)
  where estado in ('preparada', 'mostrada');

alter table impulso_vip_intervenciones enable row level security;

drop policy if exists impulso_vip_intervenciones_select on impulso_vip_intervenciones;
create policy impulso_vip_intervenciones_select on impulso_vip_intervenciones for select
  using (alumno_id = auth.uid() or es_entrenador_de(alumno_id));

-- El alumno no actualiza la fila directamente desde el cliente: responde por
-- una Server Action que vuelve a comprobar propiedad y limita las columnas.
-- Asi no puede cambiar `instruccion`, `origen` o `motor_version` llamando a
-- PostgREST por fuera de la interfaz.
drop policy if exists impulso_vip_intervenciones_alumno_update on impulso_vip_intervenciones;

drop policy if exists impulso_vip_intervenciones_entrenador_write on impulso_vip_intervenciones;
create policy impulso_vip_intervenciones_entrenador_write on impulso_vip_intervenciones for all
  using (es_entrenador_de(alumno_id))
  with check (es_entrenador_de(alumno_id));

comment on table impulso_vip_intervenciones is
  'Momentos concretos de Impulso VIP durante una sesion. La firma distingue reglas del Metodo de Ale de mensajes realmente enviados por Alejandro.';
