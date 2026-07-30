-- Días de descanso/actividad libre dentro de una rutina: hasta ahora se
-- guardaban como un "ejercicio" más con series y repeticiones para llenar,
-- lo cual no tiene sentido para un día de descanso (ej. "salir a caminar").
-- Se agrega un tipo de día, y una descripción libre que deja el entrenador
-- (ej. "Caminata ligera 20-30 min") para mostrarla en vez de una lista de
-- ejercicios.

alter table rutina_dias
  add column tipo text not null default 'entrenamiento' check (tipo in ('entrenamiento', 'descanso')),
  add column descripcion text;
