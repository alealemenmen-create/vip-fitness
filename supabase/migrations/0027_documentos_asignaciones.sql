-- Separa el ARCHIVO de la ASIGNACIÓN.
--
-- `documentos` mezclaba las dos cosas: `alumno_id` era obligatorio, así que una
-- fila era "este archivo, para este alumno". Por eso había que entrar al perfil
-- de cada alumno para subir algo, y el mismo PDF para 10 alumnos eran 10 filas.
-- Ya se había visto la fragilidad del modelo: cuando `subirGuiaCompleta` empezó
-- a registrar un mismo archivo con dos tipos, hubo que blindar el borrado para
-- que eliminar una fila no dejara la otra apuntando a un archivo inexistente.
--
-- Desde acá:
--   documentos             = el archivo (uno por archivo real)
--   documento_asignaciones = a qué alumnos está asignado
--
-- MIGRACIÓN ADITIVA A PROPÓSITO. `documentos.alumno_id` NO se borra, solo pasa
-- a aceptar null. Así el código viejo sigue funcionando después de correr esto,
-- y se puede aplicar la migración primero y desplegar el código después sin una
-- ventana en la que la app quede rota. La columna queda obsoleta: el código
-- nuevo no la lee. Se puede eliminar en una migración futura, una vez que en
-- producción no quede nada leyéndola.

-- ── 1. Tabla de asignaciones ─────────────────────────────────────────────

create table if not exists documento_asignaciones (
  documento_id uuid not null references documentos(id) on delete cascade,
  alumno_id uuid not null references perfiles(id) on delete cascade,
  fecha_asignacion date not null default current_date,
  asignado_por uuid references perfiles(id),
  created_at timestamptz not null default now(),
  primary key (documento_id, alumno_id)
);

-- La consulta más frecuente es "los documentos de este alumno".
create index if not exists documento_asignaciones_alumno_idx
  on documento_asignaciones (alumno_id);

-- ── 2. Copiar las asignaciones que ya existen ────────────────────────────
-- Cada fila actual de `documentos` es, por definición, una asignación.
-- `on conflict do nothing` la vuelve reaplicable sin duplicar.

insert into documento_asignaciones (documento_id, alumno_id, fecha_asignacion, asignado_por)
select id, alumno_id, fecha_asignacion, entrenador_id
from documentos
where alumno_id is not null
on conflict (documento_id, alumno_id) do nothing;

-- ── 3. El archivo deja de exigir alumno ──────────────────────────────────

alter table documentos alter column alumno_id drop not null;

-- ── 4. Un tercer tipo, para lo que no es rutina ni dieta ─────────────────

alter table documentos drop constraint if exists documentos_tipo_check;
alter table documentos add constraint documentos_tipo_check
  check (tipo in ('rutina', 'alimentacion', 'otro'));

-- ── 5. RLS ───────────────────────────────────────────────────────────────

alter table documento_asignaciones enable row level security;

-- El alumno ve sus propias asignaciones; el entrenador, las de sus alumnos.
drop policy if exists documento_asignaciones_select on documento_asignaciones;
create policy documento_asignaciones_select on documento_asignaciones for select
  using (alumno_id = auth.uid() or es_entrenador_de(alumno_id));

drop policy if exists documento_asignaciones_write on documento_asignaciones;
create policy documento_asignaciones_write on documento_asignaciones for all
  using (es_admin_o_entrenador())
  with check (es_admin_o_entrenador());

-- Las políticas viejas de `documentos` filtran por `alumno_id`, que ahora puede
-- ser null: con ellas, un archivo recién subido y todavía sin asignar sería
-- invisible incluso para quien lo subió. Se reescriben en términos de las
-- asignaciones.
drop policy if exists documentos_select on documentos;
create policy documentos_select on documentos for select
  using (
    es_admin_o_entrenador()
    or exists (
      select 1 from documento_asignaciones a
      where a.documento_id = documentos.id and a.alumno_id = auth.uid()
    )
  );

drop policy if exists documentos_write on documentos;
create policy documentos_write on documentos for all
  using (es_admin_o_entrenador())
  with check (es_admin_o_entrenador());
