-- El alumno puede crear un alimento que no está en el catálogo del gimnasio,
-- pero eso NO debe ensuciar el catálogo de todos.
--
-- Desde acá, cada alimento sabe quién lo creó y si el entrenador lo aceptó:
--
--   creado_por = null           -> catálogo del gimnasio (lo de siempre)
--   creado_por = <alumno>       -> lo creó ese alumno
--   aprobado   = true           -> lo ve todo el mundo
--   aprobado   = false          -> solo lo ve su autor (y entrenador/admin)
--
-- MIGRACIÓN ADITIVA. Todo lo que ya existe queda `creado_por = null` y
-- `aprobado = true`, o sea: el catálogo actual no cambia para nadie.

-- ── 1. Columnas nuevas ───────────────────────────────────────────────────

alter table alimentos add column if not exists creado_por uuid references perfiles(id) on delete set null;
alter table alimentos add column if not exists aprobado boolean not null default true;

-- "Los que están esperando aprobación", que es la consulta del entrenador.
create index if not exists alimentos_pendientes_idx
  on alimentos (creado_por) where not aprobado;

-- ── 2. El nombre único deja de ser global ────────────────────────────────
--
-- `alimentos_nombre_key` (migración 0004) es unique(nombre) sobre TODA la
-- tabla. Con alimentos de alumnos eso significa que el segundo alumno que
-- cree "Pan amasado de la feria" recibe un error de duplicado por culpa de
-- otro alumno al que ni conoce. Se parte en dos índices parciales:
--
--   - el catálogo del gimnasio sigue sin admitir nombres repetidos;
--   - cada alumno no puede repetirse a sí mismo, pero sí puede coincidir
--     con otro alumno.
--
-- El índice parcial `where creado_por is null` sigue sirviendo de destino
-- para el `on conflict (nombre)` de los scripts de siembra.

alter table alimentos drop constraint if exists alimentos_nombre_key;

create unique index if not exists alimentos_nombre_catalogo_key
  on alimentos (nombre) where creado_por is null;

create unique index if not exists alimentos_nombre_alumno_key
  on alimentos (nombre, creado_por) where creado_por is not null;

-- ── 3. RLS: lo pendiente solo lo ve su autor ─────────────────────────────
--
-- Entrenador/admin ven todo, y hace falta que así sea: si un alumno registra
-- una comida con un alimento suyo todavía pendiente, el entrenador tiene que
-- poder leer ese alimento para que las kcal del día le cuadren.

drop policy if exists alimentos_select on alimentos;
create policy alimentos_select on alimentos for select
  using (
    auth.uid() is not null
    and (aprobado or creado_por = auth.uid() or es_admin_o_entrenador())
  );

-- La escritura sigue siendo solo de entrenador/admin (política `alimentos_write`
-- de la 0001, intacta). El alta del alumno pasa por el servidor con cliente
-- admin, que valida sesión y fuerza `creado_por` + `aprobado = false`.
