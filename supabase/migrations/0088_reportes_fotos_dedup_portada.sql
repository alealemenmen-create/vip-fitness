-- Un reporte de foto incorrecta enviado desde la portada (sin sesión) para un
-- ejercicio que no tiene ejercicio_id de biblioteca no quedaba cubierto por
-- ningún índice único: podía entrar repetido cada vez que el alumno tocaba
-- "reportar". Se agrega la referencia al ejercicio programado (dia_ejercicio_id)
-- y un tercer índice único para ese caso. Idempotente.

alter table reportes_fotos_ejercicios
  add column if not exists dia_ejercicio_id uuid references rutina_dia_ejercicios(id) on delete set null;

create unique index if not exists reportes_fotos_alumno_dia_pendiente_unique
  on reportes_fotos_ejercicios (alumno_id, dia_ejercicio_id)
  where estado = 'pendiente' and ejercicio_id is null and sesion_ejercicio_id is null and dia_ejercicio_id is not null;
