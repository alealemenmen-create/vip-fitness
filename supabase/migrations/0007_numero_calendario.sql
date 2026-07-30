-- Rediseño de "Entrenar": en vez de que el día de rutina dependa de la fecha
-- real del calendario, cada sesión queda anclada a un número de calendario
-- "falso" y secuencial (1, 2, 3...). Ese número determina el día de rutina
-- por posición (número % cantidad de días de la rutina), sin importar cuándo
-- se entrene en la vida real. Permite que alguien con rutina de 3 días pero
-- que entrena 5 veces por semana simplemente siga avanzando el número.

alter table sesiones_entrenamiento
  add column numero_calendario int;

create unique index sesiones_entrenamiento_alumno_rutina_numero_key
  on sesiones_entrenamiento (alumno_id, rutina_id, numero_calendario)
  where numero_calendario is not null;
