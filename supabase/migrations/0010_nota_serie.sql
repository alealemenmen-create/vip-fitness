-- Nota libre por serie registrada, para que el alumno deje comentarios
-- puntuales ("me costó", "sentí molestia en el hombro", etc.).
alter table series_realizadas
  add column nota text;
