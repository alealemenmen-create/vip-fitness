-- VIP FITNESS — esquema inicial
-- Etapa 1/2: perfiles, notas del entrenador, rutinas/sesiones, alimentacion,
-- pesos, fotos, documentos y seguimientos diarios.
-- Todas las tablas quedan con RLS activo: cada alumno ve solo lo suyo,
-- cada entrenador ve solo a sus alumnos asignados.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. Identidad
-- ---------------------------------------------------------------------

create table perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  rol text not null check (rol in ('alumno', 'entrenador', 'admin')),
  created_at timestamptz not null default now()
);

create table alumno_perfil (
  user_id uuid primary key references perfiles(id) on delete cascade,
  entrenador_id uuid references perfiles(id) on delete set null,
  objetivo text,
  fecha_ingreso date not null default current_date,
  proximo_control_fecha date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. Notas del entrenador
-- ---------------------------------------------------------------------

create table notas_entrenador (
  id uuid primary key default gen_random_uuid(),
  alumno_id uuid not null references perfiles(id) on delete cascade,
  entrenador_id uuid not null references perfiles(id) on delete cascade,
  texto text not null,
  fecha_inicio date not null default current_date,
  fecha_fin date,
  marcar_nueva boolean not null default true,
  importante boolean not null default false,
  leida_en timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notas_rango_fechas check (fecha_fin is null or fecha_fin >= fecha_inicio)
);

-- ---------------------------------------------------------------------
-- 3. Rutinas y ejecucion (Entrenar) — usado desde Etapa 3
-- ---------------------------------------------------------------------

create table rutinas (
  id uuid primary key default gen_random_uuid(),
  alumno_id uuid not null references perfiles(id) on delete cascade,
  nombre text not null,
  activa boolean not null default true,
  version int not null default 1,
  created_by uuid references perfiles(id),
  created_at timestamptz not null default now()
);

create table rutina_dias (
  id uuid primary key default gen_random_uuid(),
  rutina_id uuid not null references rutinas(id) on delete cascade,
  numero_dia int not null,
  nombre text not null,
  orden int not null
);

create table rutina_dia_ejercicios (
  id uuid primary key default gen_random_uuid(),
  dia_id uuid not null references rutina_dias(id) on delete cascade,
  orden int not null,
  nombre text not null,
  series_programadas int not null check (series_programadas > 0),
  reps_programadas text not null,
  descanso_segundos int,
  tecnica_tipo text,
  tecnica_instruccion text,
  observacion text
);

create table sesiones_entrenamiento (
  id uuid primary key default gen_random_uuid(),
  alumno_id uuid not null references perfiles(id) on delete cascade,
  rutina_id uuid references rutinas(id),
  dia_id uuid references rutina_dias(id),
  fecha date not null default current_date,
  hora_inicio timestamptz not null default now(),
  hora_fin timestamptz,
  estado text not null default 'en_progreso'
    check (estado in ('en_progreso', 'completada', 'finalizada_incompleta', 'abandonada')),
  comentario text
);

create table sesion_ejercicios (
  id uuid primary key default gen_random_uuid(),
  sesion_id uuid not null references sesiones_entrenamiento(id) on delete cascade,
  dia_ejercicio_id uuid not null references rutina_dia_ejercicios(id),
  completado boolean not null default false,
  completado_en timestamptz
);

create table series_realizadas (
  id uuid primary key default gen_random_uuid(),
  sesion_ejercicio_id uuid not null references sesion_ejercicios(id) on delete cascade,
  numero_serie int not null check (numero_serie > 0),
  peso_kg numeric(6, 2) check (peso_kg is null or peso_kg >= 0),
  es_peso_corporal boolean not null default false,
  reps_realizadas int check (reps_realizadas is null or reps_realizadas >= 0)
);

-- ---------------------------------------------------------------------
-- 4. Alimentacion — usado desde Etapa 5
-- ---------------------------------------------------------------------

create table alimentos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  categoria text,
  porcion_base numeric(8, 2) not null default 100,
  unidad text not null default 'g',
  kcal numeric(8, 2) not null default 0,
  prot numeric(8, 2) not null default 0,
  carb numeric(8, 2) not null default 0,
  grasa numeric(8, 2) not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table registros_diarios (
  id uuid primary key default gen_random_uuid(),
  alumno_id uuid not null references perfiles(id) on delete cascade,
  fecha date not null,
  unique (alumno_id, fecha)
);

create table comidas_registradas (
  id uuid primary key default gen_random_uuid(),
  registro_diario_id uuid not null references registros_diarios(id) on delete cascade,
  tipo_comida text not null,
  omitida boolean not null default false,
  observacion text
);

create table alimentos_consumidos (
  id uuid primary key default gen_random_uuid(),
  comida_id uuid not null references comidas_registradas(id) on delete cascade,
  alimento_id uuid not null references alimentos(id),
  cantidad numeric(8, 2) not null check (cantidad > 0),
  unidad text not null
);

-- ---------------------------------------------------------------------
-- 5. Progreso — peso y fotos
-- ---------------------------------------------------------------------

create table pesos_corporales (
  id uuid primary key default gen_random_uuid(),
  alumno_id uuid not null references perfiles(id) on delete cascade,
  peso_kg numeric(6, 2) not null check (peso_kg > 0),
  fecha date not null default current_date,
  hora time,
  registrado_por uuid references perfiles(id),
  observacion text,
  created_at timestamptz not null default now()
);

create table fotos_progreso (
  id uuid primary key default gen_random_uuid(),
  alumno_id uuid not null references perfiles(id) on delete cascade,
  storage_path text not null,
  fecha_foto date not null default current_date,
  fecha_carga timestamptz not null default now(),
  categoria text check (categoria in ('frontal', 'lateral', 'espalda', 'otra')),
  comentario text
);

-- ---------------------------------------------------------------------
-- 6. Documentos (PDFs de rutina / alimentacion)
-- ---------------------------------------------------------------------

create table documentos (
  id uuid primary key default gen_random_uuid(),
  alumno_id uuid not null references perfiles(id) on delete cascade,
  tipo text not null check (tipo in ('rutina', 'alimentacion')),
  nombre_archivo text not null,
  storage_path text not null,
  fecha_carga timestamptz not null default now(),
  fecha_asignacion date not null default current_date,
  entrenador_id uuid references perfiles(id),
  version int not null default 1,
  activo boolean not null default true
);

-- ---------------------------------------------------------------------
-- 7. Seguimiento diario
-- ---------------------------------------------------------------------

create table seguimientos_diarios (
  id uuid primary key default gen_random_uuid(),
  alumno_id uuid not null references perfiles(id) on delete cascade,
  fecha date not null default current_date,
  entreno_hoy boolean,
  cumplio_alimentacion boolean,
  agua_litros numeric(4, 1),
  horas_sueno numeric(4, 1),
  energia smallint check (energia is null or energia between 1 and 5),
  molestias text,
  comentario text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (alumno_id, fecha)
);

-- ---------------------------------------------------------------------
-- 8. Funciones helper para RLS
-- ---------------------------------------------------------------------

create or replace function rol_actual()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select rol from perfiles where id = auth.uid();
$$;

create or replace function es_admin_o_entrenador()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(rol_actual() in ('entrenador', 'admin'), false);
$$;

create or replace function es_entrenador_de(p_alumno_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from alumno_perfil ap
    where ap.user_id = p_alumno_id
      and (ap.entrenador_id = auth.uid() or rol_actual() = 'admin')
  );
$$;

-- ---------------------------------------------------------------------
-- 9. RLS
-- ---------------------------------------------------------------------

alter table perfiles enable row level security;
alter table alumno_perfil enable row level security;
alter table notas_entrenador enable row level security;
alter table rutinas enable row level security;
alter table rutina_dias enable row level security;
alter table rutina_dia_ejercicios enable row level security;
alter table sesiones_entrenamiento enable row level security;
alter table sesion_ejercicios enable row level security;
alter table series_realizadas enable row level security;
alter table alimentos enable row level security;
alter table registros_diarios enable row level security;
alter table comidas_registradas enable row level security;
alter table alimentos_consumidos enable row level security;
alter table pesos_corporales enable row level security;
alter table fotos_progreso enable row level security;
alter table documentos enable row level security;
alter table seguimientos_diarios enable row level security;

-- perfiles: cada quien ve su propio perfil; entrenador/admin ven los de sus alumnos.
create policy perfiles_select on perfiles for select
  using (id = auth.uid() or es_entrenador_de(id) or es_admin_o_entrenador());
create policy perfiles_update_propio on perfiles for update
  using (id = auth.uid());

-- alumno_perfil
create policy alumno_perfil_select on alumno_perfil for select
  using (user_id = auth.uid() or es_entrenador_de(user_id));
create policy alumno_perfil_write on alumno_perfil for all
  using (es_entrenador_de(user_id))
  with check (es_entrenador_de(user_id));

-- notas_entrenador: alumno solo lee las suyas; entrenador administra las de sus alumnos.
create policy notas_select on notas_entrenador for select
  using (alumno_id = auth.uid() or es_entrenador_de(alumno_id));
create policy notas_write on notas_entrenador for all
  using (es_entrenador_de(alumno_id))
  with check (es_entrenador_de(alumno_id));
create policy notas_alumno_marca_leida on notas_entrenador for update
  using (alumno_id = auth.uid())
  with check (alumno_id = auth.uid());

-- rutinas / dias / ejercicios
create policy rutinas_select on rutinas for select
  using (alumno_id = auth.uid() or es_entrenador_de(alumno_id));
create policy rutinas_write on rutinas for all
  using (es_entrenador_de(alumno_id))
  with check (es_entrenador_de(alumno_id));

create policy rutina_dias_select on rutina_dias for select
  using (exists (
    select 1 from rutinas r where r.id = rutina_dias.rutina_id
      and (r.alumno_id = auth.uid() or es_entrenador_de(r.alumno_id))
  ));
create policy rutina_dias_write on rutina_dias for all
  using (exists (
    select 1 from rutinas r where r.id = rutina_dias.rutina_id and es_entrenador_de(r.alumno_id)
  ))
  with check (exists (
    select 1 from rutinas r where r.id = rutina_dias.rutina_id and es_entrenador_de(r.alumno_id)
  ));

create policy rutina_dia_ejercicios_select on rutina_dia_ejercicios for select
  using (exists (
    select 1 from rutina_dias d join rutinas r on r.id = d.rutina_id
    where d.id = rutina_dia_ejercicios.dia_id
      and (r.alumno_id = auth.uid() or es_entrenador_de(r.alumno_id))
  ));
create policy rutina_dia_ejercicios_write on rutina_dia_ejercicios for all
  using (exists (
    select 1 from rutina_dias d join rutinas r on r.id = d.rutina_id
    where d.id = rutina_dia_ejercicios.dia_id and es_entrenador_de(r.alumno_id)
  ))
  with check (exists (
    select 1 from rutina_dias d join rutinas r on r.id = d.rutina_id
    where d.id = rutina_dia_ejercicios.dia_id and es_entrenador_de(r.alumno_id)
  ));

-- sesiones: el alumno crea/edita las suyas; el entrenador solo lee.
create policy sesiones_select on sesiones_entrenamiento for select
  using (alumno_id = auth.uid() or es_entrenador_de(alumno_id));
create policy sesiones_alumno_write on sesiones_entrenamiento for all
  using (alumno_id = auth.uid())
  with check (alumno_id = auth.uid());

create policy sesion_ejercicios_select on sesion_ejercicios for select
  using (exists (
    select 1 from sesiones_entrenamiento s where s.id = sesion_ejercicios.sesion_id
      and (s.alumno_id = auth.uid() or es_entrenador_de(s.alumno_id))
  ));
create policy sesion_ejercicios_alumno_write on sesion_ejercicios for all
  using (exists (
    select 1 from sesiones_entrenamiento s where s.id = sesion_ejercicios.sesion_id and s.alumno_id = auth.uid()
  ))
  with check (exists (
    select 1 from sesiones_entrenamiento s where s.id = sesion_ejercicios.sesion_id and s.alumno_id = auth.uid()
  ));

create policy series_select on series_realizadas for select
  using (exists (
    select 1 from sesion_ejercicios se join sesiones_entrenamiento s on s.id = se.sesion_id
    where se.id = series_realizadas.sesion_ejercicio_id
      and (s.alumno_id = auth.uid() or es_entrenador_de(s.alumno_id))
  ));
create policy series_alumno_write on series_realizadas for all
  using (exists (
    select 1 from sesion_ejercicios se join sesiones_entrenamiento s on s.id = se.sesion_id
    where se.id = series_realizadas.sesion_ejercicio_id and s.alumno_id = auth.uid()
  ))
  with check (exists (
    select 1 from sesion_ejercicios se join sesiones_entrenamiento s on s.id = se.sesion_id
    where se.id = series_realizadas.sesion_ejercicio_id and s.alumno_id = auth.uid()
  ));

-- alimentos: catalogo global, lectura para todos los autenticados, escritura solo entrenador/admin.
create policy alimentos_select on alimentos for select
  using (auth.uid() is not null);
create policy alimentos_write on alimentos for all
  using (es_admin_o_entrenador())
  with check (es_admin_o_entrenador());

-- registros_diarios / comidas / alimentos_consumidos: el alumno es dueño de su diario.
create policy registros_select on registros_diarios for select
  using (alumno_id = auth.uid() or es_entrenador_de(alumno_id));
create policy registros_alumno_write on registros_diarios for all
  using (alumno_id = auth.uid())
  with check (alumno_id = auth.uid());

create policy comidas_select on comidas_registradas for select
  using (exists (
    select 1 from registros_diarios rd where rd.id = comidas_registradas.registro_diario_id
      and (rd.alumno_id = auth.uid() or es_entrenador_de(rd.alumno_id))
  ));
create policy comidas_alumno_write on comidas_registradas for all
  using (exists (
    select 1 from registros_diarios rd where rd.id = comidas_registradas.registro_diario_id and rd.alumno_id = auth.uid()
  ))
  with check (exists (
    select 1 from registros_diarios rd where rd.id = comidas_registradas.registro_diario_id and rd.alumno_id = auth.uid()
  ));

create policy alimentos_consumidos_select on alimentos_consumidos for select
  using (exists (
    select 1 from comidas_registradas c join registros_diarios rd on rd.id = c.registro_diario_id
    where c.id = alimentos_consumidos.comida_id
      and (rd.alumno_id = auth.uid() or es_entrenador_de(rd.alumno_id))
  ));
create policy alimentos_consumidos_alumno_write on alimentos_consumidos for all
  using (exists (
    select 1 from comidas_registradas c join registros_diarios rd on rd.id = c.registro_diario_id
    where c.id = alimentos_consumidos.comida_id and rd.alumno_id = auth.uid()
  ))
  with check (exists (
    select 1 from comidas_registradas c join registros_diarios rd on rd.id = c.registro_diario_id
    where c.id = alimentos_consumidos.comida_id and rd.alumno_id = auth.uid()
  ));

-- pesos_corporales: alumno y entrenador pueden registrar (queda quien lo hizo).
create policy pesos_select on pesos_corporales for select
  using (alumno_id = auth.uid() or es_entrenador_de(alumno_id));
create policy pesos_write on pesos_corporales for all
  using (alumno_id = auth.uid() or es_entrenador_de(alumno_id))
  with check (
    (alumno_id = auth.uid() or es_entrenador_de(alumno_id))
    and registrado_por = auth.uid()
  );

-- fotos_progreso: privadas del alumno, visibles tambien para su entrenador.
create policy fotos_select on fotos_progreso for select
  using (alumno_id = auth.uid() or es_entrenador_de(alumno_id));
create policy fotos_alumno_write on fotos_progreso for all
  using (alumno_id = auth.uid())
  with check (alumno_id = auth.uid());

-- documentos: el entrenador sube/gestiona, el alumno solo lee los suyos.
create policy documentos_select on documentos for select
  using (alumno_id = auth.uid() or es_entrenador_de(alumno_id));
create policy documentos_write on documentos for all
  using (es_entrenador_de(alumno_id))
  with check (es_entrenador_de(alumno_id));

-- seguimientos_diarios: el alumno gestiona los suyos, el entrenador solo lee.
create policy seguimientos_select on seguimientos_diarios for select
  using (alumno_id = auth.uid() or es_entrenador_de(alumno_id));
create policy seguimientos_alumno_write on seguimientos_diarios for all
  using (alumno_id = auth.uid())
  with check (alumno_id = auth.uid());
