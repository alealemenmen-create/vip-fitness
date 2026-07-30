-- Permite upsert de series por ejercicio de sesión (una fila por número de serie).
alter table series_realizadas
  add constraint series_realizadas_sesion_ejercicio_numero_key
  unique (sesion_ejercicio_id, numero_serie);
