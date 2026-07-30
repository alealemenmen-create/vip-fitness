-- Evita alimentos duplicados por nombre (pedido explicito del proyecto:
-- "evitar duplicados" en la gestion de alimentos). Tambien permite usar
-- "on conflict (nombre) do nothing" en los scripts de siembra/ampliacion.
alter table alimentos add constraint alimentos_nombre_key unique (nombre);
