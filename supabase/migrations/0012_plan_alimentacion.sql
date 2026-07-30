-- Meta calórica del alumno, extraída con IA del PDF de alimentación que sube
-- el entrenador (Tarea 5). Un plan activo por alumno; los anteriores quedan
-- guardados con activo = false, igual que las rutinas.

create table planes_alimentacion (
  id uuid primary key default gen_random_uuid(),
  alumno_id uuid not null references perfiles(id) on delete cascade,
  documento_id uuid references documentos(id) on delete set null,
  kcal_objetivo integer check (kcal_objetivo is null or kcal_objetivo > 0),
  prot_objetivo integer check (prot_objetivo is null or prot_objetivo >= 0),
  carb_objetivo integer check (carb_objetivo is null or carb_objetivo >= 0),
  grasa_objetivo integer check (grasa_objetivo is null or grasa_objetivo >= 0),
  activo boolean not null default true,
  created_by uuid references perfiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Las comidas del plan (nombre + hora + calorías), en el orden del día.
create table plan_comidas (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references planes_alimentacion(id) on delete cascade,
  orden integer not null,
  nombre text not null,
  hora time,
  kcal integer check (kcal is null or kcal >= 0),
  descripcion text
);

create index planes_alimentacion_alumno_idx on planes_alimentacion(alumno_id);
create index plan_comidas_plan_idx on plan_comidas(plan_id);

alter table planes_alimentacion enable row level security;
alter table plan_comidas enable row level security;

-- El alumno lee su plan; entrenador/admin leen y administran los de todos
-- (equipo de confianza, ver 0005_entrenador_acceso_total.sql).
create policy planes_alimentacion_select on planes_alimentacion for select
  using (alumno_id = auth.uid() or es_admin_o_entrenador());
create policy planes_alimentacion_write on planes_alimentacion for all
  using (es_admin_o_entrenador())
  with check (es_admin_o_entrenador());

create policy plan_comidas_select on plan_comidas for select
  using (
    exists (
      select 1 from planes_alimentacion p
      where p.id = plan_comidas.plan_id
        and (p.alumno_id = auth.uid() or es_admin_o_entrenador())
    )
  );
create policy plan_comidas_write on plan_comidas for all
  using (es_admin_o_entrenador())
  with check (es_admin_o_entrenador());
