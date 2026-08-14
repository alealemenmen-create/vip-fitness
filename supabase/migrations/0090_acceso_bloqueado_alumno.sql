-- Bloqueo de acceso a la app por alumno (ej. membresía sin pagar). Distinto
-- de `plan_entrenamiento_pausado` (0067-ish, solo pausa iniciar sesiones de
-- entrenamiento dentro de un plan configurado): esto corta el acceso a TODA
-- la app, sin depender de si el alumno tiene un plan asignado.

alter table alumno_perfil add column if not exists acceso_bloqueado boolean not null default false;
alter table alumno_perfil add column if not exists acceso_bloqueado_motivo text;

comment on column alumno_perfil.acceso_bloqueado is
  'Corta el acceso del alumno a toda la app (ver requireAlumno en src/lib/auth.ts). No afecta la vista del entrenador viendo "como alumno".';
comment on column alumno_perfil.acceso_bloqueado_motivo is
  'Nota interna del entrenador (ej. "no pagó agosto"). No se le muestra al alumno.';
