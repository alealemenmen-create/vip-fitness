-- Plan comercial y cupo mensual del alumno.
-- El reinicio mensual es lógico: las sesiones se cuentan por mes calendario,
-- por lo que nunca se elimina historial ni se recalculan Puntos VIP.

alter table public.alumno_perfil
  add column if not exists plan_entrenamiento text,
  add column if not exists sesiones_mensuales smallint,
  add column if not exists dias_entrenamiento_semana smallint,
  add column if not exists plan_entrenamiento_pausado boolean not null default false;

alter table public.alumno_perfil
  drop constraint if exists alumno_perfil_plan_entrenamiento_check,
  add constraint alumno_perfil_plan_entrenamiento_check
    check (plan_entrenamiento is null or plan_entrenamiento in ('access', 'select', 'pro', 'elite')),
  drop constraint if exists alumno_perfil_sesiones_mensuales_check,
  add constraint alumno_perfil_sesiones_mensuales_check
    check (sesiones_mensuales is null or sesiones_mensuales between 1 and 31),
  drop constraint if exists alumno_perfil_dias_entrenamiento_semana_check,
  add constraint alumno_perfil_dias_entrenamiento_semana_check
    check (dias_entrenamiento_semana is null or dias_entrenamiento_semana between 1 and 7);

comment on column public.alumno_perfil.plan_entrenamiento is
  'Plan vigente: Access, Select, Pro o Elite. El alumno ve el nombre, no el precio.';
comment on column public.alumno_perfil.sesiones_mensuales is
  'Cupo mensual congelado al asignar el plan; permite excepciones sin cambiar el catálogo.';
comment on column public.alumno_perfil.dias_entrenamiento_semana is
  'Frecuencia recomendada que agrupa la secuencia de sesiones en semanas.';
comment on column public.alumno_perfil.plan_entrenamiento_pausado is
  'Bloquea iniciar nuevas sesiones, sin borrar rutina, historial ni puntos.';
