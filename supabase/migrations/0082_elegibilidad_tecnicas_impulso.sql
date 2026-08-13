-- Perfil de seguridad de Impulso VIP por ejercicio de la biblioteca.
-- El motor no deduce tecnicas intensivas por el nombre: consulta estas
-- columnas estructuradas y, ante cualquier dato faltante, cae a trabajo
-- controlado sin tecnica intensa.

alter table ejercicios
  add column if not exists impulso_intensidad_maxima text not null default 'ninguna'
    check (impulso_intensidad_maxima in ('ninguna', 'baja', 'media', 'alta')),
  add column if not exists impulso_tecnicas_permitidas text[] not null default '{}',
  add column if not exists impulso_requiere_supervision boolean not null default true,
  add column if not exists impulso_perfil_revisado boolean not null default false;

alter table impulso_vip_intervenciones
  add column if not exists resultado_data jsonb not null default '{}'::jsonb;

create or replace function vip_tecnicas_impulso_validas(tecnicas text[])
returns boolean
language sql
immutable
parallel safe
as $$
  select tecnicas <@ array[
    'tempo_controlado',
    'pausa_isometrica',
    'serie_descarga',
    'drop_set',
    'rest_pause',
    'fallo_controlado'
  ]::text[]
  and cardinality(tecnicas) = cardinality(array(select distinct unnest(tecnicas)));
$$;

alter table ejercicios
  drop constraint if exists ejercicios_impulso_tecnicas_validas_ck;
alter table ejercicios
  add constraint ejercicios_impulso_tecnicas_validas_ck
  check (vip_tecnicas_impulso_validas(impulso_tecnicas_permitidas));

-- Base conservadora. `impulso_perfil_revisado` queda false: estas reglas
-- habilitan solo lo razonable por estructura; Alejandro sigue pudiendo
-- revisar cada ejercicio y subir o bajar su limite conscientemente.
update ejercicios
set
  impulso_intensidad_maxima = case
    when categoria = 'cardio' then 'ninguna'
    when categoria = 'aislamiento' or equipo in ('maquina', 'polea', 'banda') then 'media'
    when equipo in ('mancuerna', 'smith', 'peso_corporal', 'banco') then 'baja'
    else 'ninguna'
  end,
  impulso_tecnicas_permitidas = case
    when categoria = 'cardio' then '{}'::text[]
    when categoria = 'aislamiento' or equipo in ('maquina', 'polea', 'banda') then
      array['tempo_controlado', 'pausa_isometrica', 'serie_descarga', 'drop_set']::text[]
    when equipo in ('mancuerna', 'smith', 'peso_corporal', 'banco') then
      array['tempo_controlado', 'pausa_isometrica']::text[]
    else array['tempo_controlado']::text[]
  end,
  impulso_requiere_supervision = case
    when categoria = 'aislamiento' or equipo in ('maquina', 'polea', 'banda') then false
    else true
  end
where impulso_perfil_revisado = false;

comment on column ejercicios.impulso_intensidad_maxima is
  'Techo de intensidad que Impulso puede prescribir dinamicamente en este ejercicio.';
comment on column ejercicios.impulso_perfil_revisado is
  'True cuando Alejandro reviso manualmente la elegibilidad; false identifica el backfill conservador automatico.';
