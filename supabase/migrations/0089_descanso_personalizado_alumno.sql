-- El alumno puede conservar el descanso indicado por su entrenador o elegir
-- una duración fija para sus propias sesiones. NULL significa "usar rutina".
alter table public.alumno_perfil
  add column if not exists descanso_personalizado_segundos integer null
  check (descanso_personalizado_segundos is null or descanso_personalizado_segundos in (40, 60, 90, 120));
