-- Corrige alimentos que se cuentan por unidad en vez de pesarse en gramos.
-- Corre esto una sola vez en el SQL Editor de Supabase.

update alimentos set porcion_base = 1, unidad = 'unidad', kcal = 72, prot = 6.3, carb = 0.4, grasa = 4.8
  where nombre = 'Huevo entero de gallina';

update alimentos set porcion_base = 1, unidad = 'rebanada', kcal = 61, prot = 2.3, carb = 10.8, grasa = 0.9
  where nombre = 'Pan de molde integral';

update alimentos set porcion_base = 1, unidad = 'unidad', kcal = 105, prot = 1.3, carb = 26.9, grasa = 0.4
  where nombre = 'Platano / Banano (maduro)';

update alimentos set porcion_base = 1, unidad = 'unidad', kcal = 95, prot = 0.5, carb = 25.1, grasa = 0.4
  where nombre = 'Manzana (con cascara)';

update alimentos set porcion_base = 1, unidad = 'cucharada', kcal = 124, prot = 0, carb = 0, grasa = 14
  where nombre = 'Aceite de oliva extra virgen';

update alimentos set porcion_base = 1, unidad = 'cucharada', kcal = 96, prot = 4.0, carb = 3.2, grasa = 8.0
  where nombre = 'Mantequilla de mani 100% natural';
