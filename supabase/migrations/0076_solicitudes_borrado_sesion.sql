-- Borrar un registro de entrenamiento deja de ser algo que el alumno hace solo.
--
-- Alejandro, al ver el botón terminado: "ahora me di cuenta de que es un
-- problema borrar el historial, porque si no, cualquiera puede borrarla como
-- si nada". Se evaluó pedir un código del entrenador y se descartó: un código
-- fijo se filtra (el primer alumno que lo usa se lo aprende) y uno de un solo
-- uso obliga al entrenador a estar disponible en el momento.
--
-- Queda así: el alumno PIDE, el entrenador borra desde su panel. Mismo patrón
-- que `reportes_bugs` (0072) — tabla + RLS, el alumno inserta y el entrenador
-- resuelve.
--
-- La fila sobrevive al borrado a propósito: `sesion_id` es `on delete set
-- null` y se guarda una foto de qué era esa sesión (día, fecha, número). Si
-- fuera `cascade`, aprobar el pedido borraría también la constancia de que se
-- pidió y de quién lo aprobó, que es justo lo que hay que conservar cuando se
-- destruye historial.

create table if not exists solicitudes_borrado_sesion (
  id uuid primary key default gen_random_uuid(),
  alumno_id uuid not null references perfiles(id) on delete cascade,
  sesion_id uuid references sesiones_entrenamiento(id) on delete set null,
  -- Foto de la sesión al momento del pedido: sobrevive al borrado y es lo que
  -- el entrenador ve en la lista.
  dia_nombre text not null,
  fecha_sesion date,
  numero_calendario int,
  -- Por qué la quiere borrar. Obligatorio: sin motivo, el entrenador no tiene
  -- con qué decidir y termina aprobando todo.
  motivo text not null,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'borrada', 'rechazada')),
  creado_en timestamptz not null default now(),
  resuelto_en timestamptz,
  resuelto_por uuid references perfiles(id)
);

create index if not exists solicitudes_borrado_estado_fecha_idx
  on solicitudes_borrado_sesion (estado, creado_en desc);

-- Un solo pedido pendiente por sesión: sin esto, tocar el botón tres veces le
-- deja tres avisos iguales al entrenador.
create unique index if not exists solicitudes_borrado_una_pendiente_por_sesion_idx
  on solicitudes_borrado_sesion (sesion_id)
  where estado = 'pendiente' and sesion_id is not null;

alter table solicitudes_borrado_sesion enable row level security;

-- `drop policy if exists` antes de cada `create`: Postgres no tiene
-- `create policy if not exists` y sin esto una corrida a medias deja la
-- migración imposible de reintentar (ver la nota de la 0072).
drop policy if exists solicitudes_borrado_select on solicitudes_borrado_sesion;
create policy solicitudes_borrado_select on solicitudes_borrado_sesion for select
  using (alumno_id = auth.uid() or es_entrenador_de(alumno_id) or es_admin_o_entrenador());

drop policy if exists solicitudes_borrado_alumno_insert on solicitudes_borrado_sesion;
create policy solicitudes_borrado_alumno_insert on solicitudes_borrado_sesion for insert
  with check (alumno_id = auth.uid());

-- Resolver es solo del entrenador. El alumno no puede marcar su propio pedido
-- como aprobado.
drop policy if exists solicitudes_borrado_entrenador_update on solicitudes_borrado_sesion;
create policy solicitudes_borrado_entrenador_update on solicitudes_borrado_sesion for update
  using (es_admin_o_entrenador())
  with check (es_admin_o_entrenador());

comment on table solicitudes_borrado_sesion is
  'Pedidos de los alumnos para borrar un registro de entrenamiento. Solo el entrenador los aprueba; la fila queda como constancia aunque la sesión ya no exista.';
