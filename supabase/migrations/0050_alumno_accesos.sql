-- Registro de ingresos a la app del alumno, para que el entrenador pueda ver
-- quien esta activo y quien no. No se guarda cada carga de pantalla (serian
-- miles de filas por alumno activo): la accion server (`registrarAccesoApp`)
-- solo inserta una fila nueva si pasaron mas de 2 horas desde el ultimo
-- ingreso registrado de ese alumno. Si el alumno esta entrenando y usa la app
-- seguido, todo eso cuenta como UN solo ingreso hasta que se aleje 2+ horas.

create table if not exists alumno_accesos (
  id uuid primary key default gen_random_uuid(),
  alumno_id uuid not null references alumno_perfil(user_id) on delete cascade,
  ingreso_en timestamptz not null default now()
);

-- Para "ultimo ingreso de este alumno" (chequeo de la ventana de 2h) y para
-- listar/agrupar por alumno ordenado del mas reciente al mas antiguo.
create index if not exists alumno_accesos_alumno_id_ingreso_en_idx
  on alumno_accesos (alumno_id, ingreso_en desc);

alter table alumno_accesos enable row level security;

-- Solo el entrenador/admin lo consulta desde el panel. La escritura siempre
-- pasa por el cliente con service role (ver registrarAccesoApp), asi que no
-- hace falta policy de insert para el alumno.
drop policy if exists alumno_accesos_select on alumno_accesos;
create policy alumno_accesos_select on alumno_accesos for select
  using (rol_actual() in ('entrenador', 'admin'));
