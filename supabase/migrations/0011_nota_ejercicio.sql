-- Nota libre por ejercicio de la sesión (reemplaza la nota por serie de la
-- migración 0010: un solo comentario del alumno por ejercicio, no por serie).
alter table sesion_ejercicios
  add column nota text;
