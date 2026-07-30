-- Grupo muscular por ejercicio, para mostrar un ícono liviano (sin costo de IA
-- por vista — se clasifica una sola vez, en el mismo análisis de IA del PDF).
alter table rutina_dia_ejercicios
  add column grupo_muscular text
  check (grupo_muscular is null or grupo_muscular in (
    'pecho', 'espalda', 'piernas', 'hombros', 'brazos', 'core', 'cardio'
  ));
