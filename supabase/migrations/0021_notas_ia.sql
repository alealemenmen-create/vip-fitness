-- Notas privadas generadas automáticamente por IA (ej. mensaje de motivación
-- cuando el peso del alumno se mueve en contra de su objetivo del mes). Usan
-- el mismo canal que las notas manuales del entrenador — el alumno ya las ve
-- en su panel — pero quedan marcadas para poder distinguirlas y filtrarlas.
-- clave_origen las vuelve idempotentes: no se duplica el mismo mensaje en el
-- mismo mes aunque el cron corra más de una vez.

alter table notas_entrenador
  add column generado_con_ia boolean not null default false,
  add column clave_origen text unique;
