-- Convierte notas_entrenador en un hilo simple de mensajes: el alumno ahora
-- puede responder, no solo leer. `autor` distingue quién escribió cada fila;
-- todo lo demás (fechas, importante, marcar_nueva) sigue funcionando igual
-- para las notas que ya escribe el entrenador.

alter table notas_entrenador
  add column autor text not null default 'entrenador' check (autor in ('entrenador', 'alumno'));

-- El alumno puede insertar sus propias respuestas (no editar ni borrar las
-- del entrenador — eso lo sigue manejando notas_write).
create policy notas_alumno_responde on notas_entrenador for insert
  with check (alumno_id = auth.uid() and autor = 'alumno');
