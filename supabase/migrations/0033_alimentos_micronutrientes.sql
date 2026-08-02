-- Fibra, azúcares y sodio: Open Food Facts los trae junto con kcal/prot/
-- carb/grasa, pero se estaban descartando al copiar el producto al catálogo
-- (0032_alimentos_open_food_facts.sql). El alumno necesita verlos al elegir
-- un alimento, no solo al buscarlo.
--
-- Quedan opcionales (null): el catálogo curado del gimnasio y los alimentos
-- personalizados no los piden, así que no hay con qué llenarlos ahí.

alter table alimentos add column if not exists fibra numeric(8, 2);
alter table alimentos add column if not exists azucares numeric(8, 2);
alter table alimentos add column if not exists sodio numeric(8, 2);
