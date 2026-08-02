-- Progreso VIP: una fuente de verdad sencilla para todas las recompensas.
-- Cada accion relevante tiene una clave unica. Repetir, editar o reintentar una
-- accion actualiza el mismo movimiento en vez de duplicar puntos.
create table if not exists puntos_vip_movimientos (
  id uuid primary key default gen_random_uuid(),
  alumno_id uuid not null references perfiles(id) on delete cascade,
  clave text not null,
  categoria text not null check (categoria in ('entrenamiento', 'alimentacion', 'progreso', 'constancia', 'ajuste')),
  -- Puede ser negativo para una penalizacion visible. La aplicacion aplica el
  -- piso de cero al total del alumno, por lo que nunca se genera deuda.
  puntos integer not null default 0,
  titulo text not null,
  detalle text,
  fecha date not null default current_date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (alumno_id, clave)
);

create index if not exists puntos_vip_movimientos_alumno_fecha_idx
  on puntos_vip_movimientos (alumno_id, fecha desc);

create index if not exists puntos_vip_movimientos_fecha_puntos_idx
  on puntos_vip_movimientos (fecha desc, puntos desc);

alter table puntos_vip_movimientos enable row level security;

drop policy if exists puntos_vip_movimientos_select on puntos_vip_movimientos;
create policy puntos_vip_movimientos_select on puntos_vip_movimientos for select
  using (alumno_id = auth.uid() or es_admin_o_entrenador());

-- La escritura se hace exclusivamente desde acciones del servidor, despues de
-- validar la cuenta y la accion original. No se entrega INSERT/UPDATE al cliente.

-- Recupera las acciones reales ya realizadas por los alumnos de prueba. De
-- esta forma nadie vuelve a cero al estrenar Progreso VIP.
with sesiones as (
  select
    s.id,
    s.alumno_id,
    s.fecha,
    count(se.id)::int as total,
    count(se.id) filter (where se.completado)::int as completados
  from sesiones_entrenamiento s
  left join sesion_ejercicios se on se.sesion_id = s.id
  where s.estado in ('completada', 'finalizada_incompleta')
  group by s.id, s.alumno_id, s.fecha
), recompensas as (
  select *,
    case
      when total = 0 then 0
      else round(300.0 * completados / total)::int
    end as puntos_calculados
  from sesiones
)
insert into puntos_vip_movimientos
  (alumno_id, clave, categoria, puntos, titulo, detalle, fecha, metadata, created_at, updated_at)
select
  alumno_id,
  'entrenamiento:' || id,
  'entrenamiento',
  puntos_calculados,
  'Entrenamiento finalizado',
  completados || ' de ' || total || ' ejercicios completados',
  fecha,
  jsonb_build_object('sesionId', id, 'completados', completados, 'total', total),
  fecha::timestamptz,
  fecha::timestamptz
from recompensas
on conflict (alumno_id, clave) do nothing;

with planes as (
  select distinct on (alumno_id) alumno_id, kcal_objetivo
  from planes_alimentacion
  where activo
  order by alumno_id, created_at desc
), consumo as (
  select
    rd.alumno_id,
    rd.fecha,
    coalesce(sum((ac.cantidad / nullif(a.porcion_base, 0)) * a.kcal), 0)::numeric as kcal
  from registros_diarios rd
  join comidas_registradas cr on cr.registro_diario_id = rd.id and not cr.omitida
  join alimentos_consumidos ac on ac.comida_id = cr.id
  join alimentos a on a.id = ac.alimento_id
  group by rd.alumno_id, rd.fecha
), calculo as (
  select
    c.*,
    p.kcal_objetivo,
    case
      when p.kcal_objetivo is null or p.kcal_objetivo <= 0 then 0
      when c.kcal <= 0 then -150
      else greatest(
        -100,
        least(
          250,
          round(250 * (1 - abs(c.kcal / p.kcal_objetivo * 100 - 100) / 50))::int
        )
      )
    end as puntos_calculados
  from consumo c
  left join planes p on p.alumno_id = c.alumno_id
)
insert into puntos_vip_movimientos
  (alumno_id, clave, categoria, puntos, titulo, detalle, fecha, metadata, created_at, updated_at)
select
  alumno_id,
  'alimentacion:' || fecha,
  'alimentacion',
  puntos_calculados,
  'Progreso de alimentacion',
  case
    when kcal_objetivo is null or kcal_objetivo <= 0 then round(kcal) || ' kcal registradas'
    else round(kcal / kcal_objetivo * 100) || '% de la meta diaria'
  end,
  fecha,
  jsonb_build_object('kcal', round(kcal), 'objetivo', kcal_objetivo),
  fecha::timestamptz,
  fecha::timestamptz
from calculo
on conflict (alumno_id, clave) do nothing;

insert into puntos_vip_movimientos
  (alumno_id, clave, categoria, puntos, titulo, detalle, fecha, created_at, updated_at)
select
  alumno_id,
  'ingreso:' || fecha,
  'constancia',
  30,
  'Primera entrada del dia',
  'Ingreso diario confirmado',
  fecha,
  fecha::timestamptz,
  fecha::timestamptz
from seguimientos_diarios
on conflict (alumno_id, clave) do nothing;

with pesos_semana as (
  select distinct on (alumno_id, date_trunc('week', fecha::timestamp))
    alumno_id,
    fecha,
    date_trunc('week', fecha::timestamp)::date as semana
  from pesos_corporales
  order by alumno_id, date_trunc('week', fecha::timestamp), fecha desc
)
insert into puntos_vip_movimientos
  (alumno_id, clave, categoria, puntos, titulo, detalle, fecha, created_at, updated_at)
select
  alumno_id,
  'peso:' || semana,
  'progreso',
  75,
  'Peso semanal registrado',
  'Una recompensa por semana',
  fecha,
  fecha::timestamptz,
  fecha::timestamptz
from pesos_semana
on conflict (alumno_id, clave) do nothing;

with fotos_semana as (
  select distinct on (alumno_id, date_trunc('week', fecha_foto::timestamp))
    alumno_id,
    fecha_foto as fecha,
    date_trunc('week', fecha_foto::timestamp)::date as semana
  from fotos_progreso
  order by alumno_id, date_trunc('week', fecha_foto::timestamp), fecha_foto desc
)
insert into puntos_vip_movimientos
  (alumno_id, clave, categoria, puntos, titulo, detalle, fecha, created_at, updated_at)
select
  alumno_id,
  'foto:' || semana,
  'progreso',
  100,
  'Foto de progreso',
  'Seguimiento visual de la semana',
  fecha,
  fecha::timestamptz,
  fecha::timestamptz
from fotos_semana
on conflict (alumno_id, clave) do nothing;
