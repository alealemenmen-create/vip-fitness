-- Rutina de prueba para validar la Etapa 3 (Entrenar) mientras no existe
-- todavía la importación de PDF (Etapa 4). Reemplaza ALUMNO-UID por el
-- User UID real del alumno antes de correr esto en el SQL Editor.

do $$
declare
  v_alumno_id uuid := 'ALUMNO-UID';
  v_rutina_id uuid;
  v_dia1_id uuid;
  v_dia2_id uuid;
begin
  insert into rutinas (alumno_id, nombre, activa)
  values (v_alumno_id, 'Bloque 1 — Fuerza general', true)
  returning id into v_rutina_id;

  insert into rutina_dias (rutina_id, numero_dia, nombre, orden)
  values (v_rutina_id, 1, 'Tren inferior', 1)
  returning id into v_dia1_id;

  insert into rutina_dias (rutina_id, numero_dia, nombre, orden)
  values (v_rutina_id, 2, 'Tren superior', 2)
  returning id into v_dia2_id;

  insert into rutina_dia_ejercicios
    (dia_id, orden, nombre, series_programadas, reps_programadas, descanso_segundos, tecnica_tipo, tecnica_instruccion, observacion)
  values
    (v_dia1_id, 1, 'Sentadilla trasera', 4, '8-10', 90, null, null, 'Bajar controlado, subir explosivo'),
    (v_dia1_id, 2, 'Peso muerto rumano', 3, '10-12', 90, null, null, null),
    (v_dia1_id, 3, 'Curl femoral', 3, '12-15', 60, null, null, null);

  insert into rutina_dia_ejercicios
    (dia_id, orden, nombre, series_programadas, reps_programadas, descanso_segundos, tecnica_tipo, tecnica_instruccion, observacion)
  values
    (v_dia2_id, 1, 'Press banca', 4, '6-8', 90, null, null, null),
    (v_dia2_id, 2, 'Remo con barra', 3, '10-12', 75, null, null, null),
    (v_dia2_id, 3, 'Curl de bíceps', 3, '12', 45, 'Biserie',
      'Ejercicio A: Curl de bíceps. Ejercicio B: Extensión de tríceps. Sin descanso entre ambos, 60s al terminar la pareja.',
      'Bájale una serie si sientes molestia en el codo');
end $$;
