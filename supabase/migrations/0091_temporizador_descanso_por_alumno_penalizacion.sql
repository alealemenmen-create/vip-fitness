-- El alumno ahora puede apagar su propio temporizador de descanso (antes
-- solo lo tocaba el entrenador desde el panel). Hace falta distinguir QUIÉN
-- lo apagó: si fue el entrenador (ej. razón médica), nunca penaliza — sigue
-- igual que hoy. Si lo apaga el propio alumno, terminar la sesión con el
-- temporizador apagado cambia el bono de "Entrenamiento finalizado" de
-- +300 a una penalización de -50 (ver src/lib/ranking/movimientos.ts).

alter table alumno_perfil
  add column if not exists temporizador_descanso_desactivado_por_alumno boolean not null default false;

comment on column alumno_perfil.temporizador_descanso_desactivado_por_alumno is
  'true solo cuando el ALUMNO apagó su propio temporizador de descanso (no el entrenador). Afecta los puntos de "Entrenamiento finalizado".';
