-- Dos técnicas que el entrenador pidió explícitamente y no estaban en el
-- seed original de 0051: "fallo muscular" (llevar la última serie al fallo,
-- sin necesidad de bajar peso ni pausar) y "cluster set" (pausas cortas
-- DENTRO de la misma serie, no entre series).

insert into tecnicas_entrenamiento
  (nombre, slug, tipo, cantidad_ejercicios, nivel_minimo, fatiga, requiere_supervision, descanso_final_seg)
values
  ('Fallo muscular', 'fallo-muscular', 'individual', null, 'intermedio', 'media', false, 90),
  ('Cluster set', 'cluster-set', 'individual', null, 'avanzado', 'alta', true, 150)
on conflict (slug) do nothing;
