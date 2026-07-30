-- Medida práctica por alimento: un aceite se mide en cucharadas, la leche en
-- vasos y el huevo en unidades, no en gramos. La base nutricional sigue siendo
-- la de `porcion_base`/`unidad` (100 g del dataset USDA); esto agrega una
-- equivalencia para que el alumno registre en la medida que usa de verdad.
alter table alimentos
  add column if not exists medida_nombre text,
  add column if not exists medida_gramos numeric(8, 2)
    check (medida_gramos is null or medida_gramos > 0);

comment on column alimentos.medida_nombre is
  'Nombre de la medida casera: "cucharada", "unidad", "vaso", "taza"…';
comment on column alimentos.medida_gramos is
  'Cuántas unidades de porcion_base equivale 1 medida casera (ej. 1 cucharada de aceite = 14 g)';
