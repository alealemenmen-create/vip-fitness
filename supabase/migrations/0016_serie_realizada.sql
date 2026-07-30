-- Cada serie necesita su propio marcador de "la hice de verdad", separado de
-- si se cargó peso/reps: un alumno puede tipear un peso y no haber llegado a
-- hacer la serie, o hacerla sin cargar número. El ejercicio completo solo
-- cuenta como realizado cuando TODAS sus series están marcadas así — antes
-- un solo botón marcaba el ejercicio entero sin mirar serie por serie.
alter table series_realizadas
  add column realizada boolean not null default false;
