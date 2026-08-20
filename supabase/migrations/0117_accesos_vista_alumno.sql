-- Auditoria del bloque 15.4: "ver como alumno" (entrarComoAlumno,
-- admin/alumnos/actions.ts) dejaba una cookie httpOnly de 8h para navegar
-- el portal como el alumno, pero no quedaba ningun registro de que eso
-- paso -- ese modo expone fotos de progreso, notas y datos personales, asi
-- que un entrenador/admin podia entrar a verlos sin que quede rastro de
-- quien, a quien ni cuando.
create table accesos_vista_alumno (
  id uuid primary key default gen_random_uuid(),
  entrenador_id uuid not null references perfiles(id) on delete cascade,
  alumno_id uuid not null references perfiles(id) on delete cascade,
  iniciado_en timestamptz not null default now(),
  -- Nulo mientras la vista sigue activa (o si nunca se cerro a mano y la
  -- cookie de 8h expiro sola) -- no se fuerza un cierre artificial.
  finalizado_en timestamptz
);

create index accesos_vista_alumno_alumno_idx on accesos_vista_alumno (alumno_id, iniciado_en desc);

alter table accesos_vista_alumno enable row level security;

-- Solo el dueno (admin) puede revisar quien entro a ver a quien -- es un
-- registro de supervision, no algo que el propio entrenador deba poder
-- filtrar u ocultar por si mismo.
create policy accesos_vista_alumno_select on accesos_vista_alumno for select
  using (rol_actual() = 'admin');

-- Cualquier entrenador/admin puede crear su PROPIO registro al entrar
-- (nunca a nombre de otro), y solo puede cerrar (finalizado_en) el suyo.
create policy accesos_vista_alumno_insert on accesos_vista_alumno for insert
  with check (entrenador_id = auth.uid() and es_admin_o_entrenador());
create policy accesos_vista_alumno_update on accesos_vista_alumno for update
  using (entrenador_id = auth.uid())
  with check (entrenador_id = auth.uid());

comment on table accesos_vista_alumno is
  'Registro de auditoria de "ver como alumno" -- quien entro, a que alumno, cuando entro y cuando salio. Solo el admin puede leerlo.';
