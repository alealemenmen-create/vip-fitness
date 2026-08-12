-- Un alumno puede tener varias vistas previas creadas, pero solo una sesión
-- realmente iniciada. Los descansos se marcan como iniciados al crearse para
-- que entren en la misma regla.

update sesiones_entrenamiento s
set rutina_iniciada_en = coalesce(s.rutina_iniciada_en, s.hora_inicio)
from rutina_dias d
where d.id = s.dia_id
  and d.tipo = 'descanso'
  and s.estado = 'en_progreso'
  and s.rutina_iniciada_en is null;

-- Si ya existen varias sesiones reales, conserva activa la de actividad más
-- reciente. Las demás quedan en el historial, con sus ejercicios y series
-- intactos; no se borran ni se adjudican puntos automáticamente.
with actividad as (
  select
    s.id,
    row_number() over (
      partition by s.alumno_id
      order by
        greatest(
          coalesce(max(se.completado_en), '-infinity'::timestamptz),
          coalesce(s.rutina_iniciada_en, '-infinity'::timestamptz),
          s.hora_inicio
        ) desc,
        s.id desc
    ) as posicion,
    greatest(
      coalesce(max(se.completado_en), '-infinity'::timestamptz),
      coalesce(s.rutina_iniciada_en, '-infinity'::timestamptz),
      s.hora_inicio
    ) as ultima_actividad
  from sesiones_entrenamiento s
  left join sesion_ejercicios se on se.sesion_id = s.id
  where s.estado = 'en_progreso'
    and s.rutina_iniciada_en is not null
  group by s.id
), duplicadas as (
  select id, ultima_actividad
  from actividad
  where posicion > 1
)
update sesiones_entrenamiento s
set
  estado = 'finalizada_incompleta',
  hora_fin = d.ultima_actividad,
  comentario = concat_ws(
    E'\n',
    nullif(s.comentario, ''),
    'Cierre automático: había otra sesión activa con actividad más reciente.'
  )
from duplicadas d
where s.id = d.id;

create unique index if not exists sesiones_una_real_en_progreso_por_alumno_idx
  on sesiones_entrenamiento (alumno_id)
  where estado = 'en_progreso' and rutina_iniciada_en is not null;
