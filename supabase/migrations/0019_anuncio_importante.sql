-- Anuncios marcados como importantes disparan una burbuja flotante en toda
-- la app (no solo el punto rojo del menú), para que el alumno no se los
-- pierda — pensado para avisos que de verdad hay que leer, no cualquier
-- novedad.
alter table anuncios add column importante boolean not null default false;
