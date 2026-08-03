-- Separa "la sesión existe" de "el alumno realmente empezó a entrenar".
-- Antes hora_inicio se ponía sola al crear la sesión (al tocar "Iniciar
-- entrenamiento" en el calendario), aunque el alumno todavía no hubiera
-- abierto la rutina. Ahora la rutina queda bloqueada (no se puede marcar
-- ningún ejercicio) hasta que se toca "Iniciar rutina" en la propia pantalla
-- de la sesión, momento que se guarda acá — y es lo que usa el cronómetro.

alter table sesiones_entrenamiento
  add column rutina_iniciada_en timestamptz;
