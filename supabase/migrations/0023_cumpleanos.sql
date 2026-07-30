-- Permite registrar el evento "hoy es el cumpleaños de este alumno" en la
-- misma tabla que ya usa "bienvenida" (noticias_sistema), reusando su
-- idempotencia por clave_origen (una fila por alumno y por año).

alter table noticias_sistema drop constraint noticias_sistema_tipo_check;
alter table noticias_sistema
  add constraint noticias_sistema_tipo_check check (tipo in ('bienvenida', 'cumpleanos'));
