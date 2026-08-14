-- El alumno puede elegir un número fijo de segundos de descanso que
-- reemplaza el descanso_segundos programado por el entrenador en TODOS sus
-- ejercicios (incluidas técnicas encadenadas con 0s explícito y cardio) —
-- decisión explícita de Alejandro después de que se le advirtiera el riesgo
-- con superseries. `null` = sin preferencia, usa siempre lo que programó el
-- entrenador (comportamiento de siempre, retrocompatible).

alter table alumno_perfil
  add column if not exists segundos_descanso_preferido integer
  check (segundos_descanso_preferido is null or segundos_descanso_preferido in (45, 60, 90, 120, 150));

comment on column alumno_perfil.segundos_descanso_preferido is
  'Si no es null, reemplaza el descanso_segundos de CADA ejercicio de la rutina activa del alumno (ver src/app/alumno/entrenar/data.ts). null = usa lo programado por el entrenador, por ejercicio.';
