-- Índices de rendimiento.
--
-- Postgres crea índices solo para PRIMARY KEY y UNIQUE, nunca para las claves
-- foráneas. Casi todas las consultas de la app filtran por `alumno_id`, por
-- `sesion_id` o por otra FK, así que hasta ahora resolvían con recorrido
-- secuencial de la tabla. Con 10 alumnos no se nota (el costo real es la
-- latencia de red por consulta), pero `sesiones_entrenamiento`,
-- `sesion_ejercicios`, `series_realizadas` y `alimentos_consumidos` crecen
-- todas las semanas y son las que más se leen.
--
-- Todo va con `if not exists` para poder reaplicar la migración sin romper.
-- No se agregan índices donde un UNIQUE ya cubre el mismo prefijo:
--   registros_diarios(alumno_id, fecha)      -> unique ya existente
--   seguimientos_diarios(alumno_id, fecha)   -> unique ya existente
--   ranking_semanas(alumno_id, semana_inicio)-> unique ya existente
--   torneo_participantes(torneo_id, ...)     -> primary key ya existente

-- ── Entrenamiento ────────────────────────────────────────────────────────

-- Constancia de la semana, balance del mes y el desglose del ranking filtran
-- por alumno y rango de fechas.
create index if not exists sesiones_entrenamiento_alumno_fecha_idx
  on sesiones_entrenamiento (alumno_id, fecha);

-- La burbuja de "sesión en curso" del layout corre en CADA carga de CADA
-- pantalla de /alumno/*. Índice parcial: solo hay una fila en progreso por
-- alumno, así que queda diminuto.
create index if not exists sesiones_entrenamiento_en_progreso_idx
  on sesiones_entrenamiento (alumno_id)
  where estado = 'en_progreso';

create index if not exists sesion_ejercicios_sesion_idx
  on sesion_ejercicios (sesion_id);

create index if not exists series_realizadas_sesion_ejercicio_idx
  on series_realizadas (sesion_ejercicio_id);

-- Rutina activa del alumno: parcial, porque nunca se busca una inactiva.
create index if not exists rutinas_alumno_activa_idx
  on rutinas (alumno_id)
  where activa;

create index if not exists rutina_dias_rutina_idx
  on rutina_dias (rutina_id);

create index if not exists rutina_dia_ejercicios_dia_idx
  on rutina_dia_ejercicios (dia_id);

-- ── Alimentación ─────────────────────────────────────────────────────────

create index if not exists comidas_registradas_registro_idx
  on comidas_registradas (registro_diario_id);

-- La que más crece de todas: una fila por alimento, por comida, por día.
create index if not exists alimentos_consumidos_comida_idx
  on alimentos_consumidos (comida_id);

-- ── Progreso, notas y documentos ─────────────────────────────────────────

create index if not exists pesos_corporales_alumno_fecha_idx
  on pesos_corporales (alumno_id, fecha);

create index if not exists notas_entrenador_alumno_creada_idx
  on notas_entrenador (alumno_id, created_at desc);

create index if not exists fotos_progreso_alumno_fecha_idx
  on fotos_progreso (alumno_id, fecha_foto desc);

create index if not exists documentos_alumno_activo_idx
  on documentos (alumno_id)
  where activo;

-- Un alumno consulta "mis torneos" sin saber el torneo_id, y la PK
-- (torneo_id, alumno_id) no sirve para filtrar solo por alumno.
create index if not exists torneo_participantes_alumno_idx
  on torneo_participantes (alumno_id);

-- ── Buscador de alimentos ────────────────────────────────────────────────

-- El buscador del alumno hace `ilike '%texto%'` sobre un catálogo de miles de
-- items, y eso no puede usar un índice B-tree común: recorre la tabla entera
-- en cada tecleo. El índice de trigramas sí acelera ILIKE, tanto el que
-- empieza con el texto como el que lo contiene (ver buscarAlimentos, que hace
-- las dos pasadas).
create extension if not exists pg_trgm;

create index if not exists alimentos_nombre_trgm_idx
  on alimentos using gin (nombre gin_trgm_ops);
