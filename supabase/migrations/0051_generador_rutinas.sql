-- Generador de rutinas VIP: perfil estructurado, metadatos de prescripcion,
-- tecnicas y trazabilidad de borradores. La IA propone; el entrenador publica.

create table if not exists perfiles_entrenamiento (
  alumno_id uuid primary key references perfiles(id) on delete cascade,
  objetivo_principal text check (objetivo_principal in
    ('perdida_grasa','hipertrofia','fuerza','recomposicion','condicion_fisica','rendimiento','mantencion')),
  objetivo_secundario text,
  dias_disponibles int check (dias_disponibles between 1 and 7),
  minutos_sesion int check (minutos_sesion between 20 and 180),
  experiencia text check (experiencia in ('principiante','intermedio','avanzado')),
  cardio_nivel text check (cardio_nivel in ('bajo','medio','alto')),
  preferencia_equipo text check (preferencia_equipo in ('maquinas','peso_libre','indistinto')),
  actividades_adicionales text,
  ejercicios_preferidos text,
  ejercicios_no_deseados text,
  molestias text,
  lesiones_diagnosticadas text,
  operaciones_previas text,
  condiciones_medicas text,
  medicamentos_relevantes text,
  autorizacion_medica boolean not null default false,
  declaracion_veracidad boolean not null default false,
  requiere_revision boolean not null default false,
  revisado_por uuid references perfiles(id) on delete set null,
  revisado_en timestamptz,
  version int not null default 1,
  completado_en timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tecnicas_entrenamiento (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  slug text not null unique,
  descripcion text,
  tipo text not null check (tipo in ('individual','encadenada')),
  cantidad_ejercicios int check (cantidad_ejercicios is null or cantidad_ejercicios between 2 and 10),
  nivel_minimo text not null default 'intermedio'
    check (nivel_minimo in ('principiante','intermedio','avanzado')),
  objetivos_compatibles text[] not null default '{}',
  fatiga text not null default 'media' check (fatiga in ('baja','media','alta')),
  requiere_supervision boolean not null default false,
  descanso_interno_seg int not null default 0 check (descanso_interno_seg >= 0),
  descanso_final_seg int not null default 90 check (descanso_final_seg >= 0),
  maximo_por_sesion int not null default 1 check (maximo_por_sesion >= 0),
  activa boolean not null default true,
  created_at timestamptz not null default now()
);

insert into tecnicas_entrenamiento
  (nombre, slug, tipo, cantidad_ejercicios, nivel_minimo, fatiga, requiere_supervision, descanso_final_seg)
values
  ('Biserie', 'biserie', 'encadenada', 2, 'intermedio', 'media', false, 90),
  ('Triserie', 'triserie', 'encadenada', 3, 'intermedio', 'alta', true, 120),
  ('Superserie', 'superserie', 'encadenada', 2, 'intermedio', 'media', false, 90),
  ('Circuito', 'circuito', 'encadenada', 4, 'principiante', 'alta', true, 120),
  ('Drop set', 'drop-set', 'individual', null, 'intermedio', 'alta', true, 120),
  ('Rest-pause', 'rest-pause', 'individual', null, 'avanzado', 'alta', true, 150),
  ('Tempo controlado', 'tempo-controlado', 'individual', null, 'principiante', 'media', false, 90),
  ('Isometria', 'isometria', 'individual', null, 'principiante', 'media', false, 90)
on conflict (slug) do nothing;

alter table ejercicios
  add column if not exists patron_movimiento text,
  add column if not exists articulaciones text[] not null default '{}',
  add column if not exists impacto text not null default 'bajo'
    check (impacto in ('bajo','medio','alto')),
  add column if not exists requiere_salto boolean not null default false,
  add column if not exists lateralidad text not null default 'bilateral'
    check (lateralidad in ('bilateral','unilateral','indistinto')),
  add column if not exists complejidad text not null default 'media'
    check (complejidad in ('baja','media','alta')),
  add column if not exists requiere_supervision boolean not null default false,
  add column if not exists tiempo_montaje text not null default 'bajo'
    check (tiempo_montaje in ('bajo','medio','alto')),
  add column if not exists apto_circuito boolean not null default true,
  add column if not exists posicion_sesion text not null default 'accesorio'
    check (posicion_sesion in ('activacion','principal','accesorio','finalizador','cardio')),
  add column if not exists etiquetas_precaucion text[] not null default '{}',
  add column if not exists sustitutos_ids uuid[] not null default '{}';

create table if not exists borradores_generador_rutinas (
  id uuid primary key default gen_random_uuid(),
  alumno_id uuid not null references perfiles(id) on delete cascade,
  entrenador_id uuid not null references perfiles(id) on delete cascade,
  estado text not null default 'borrador'
    check (estado in ('borrador','aprobado','publicado','descartado')),
  brief jsonb not null,
  perfil_snapshot jsonb not null default '{}',
  resultado jsonb not null,
  reglas_aplicadas jsonb not null default '[]',
  alertas jsonb not null default '[]',
  origen text not null default 'motor_reglas'
    check (origen in ('motor_reglas','ia_con_reglas','manual')),
  modelo_ia text,
  rutina_publicada_id uuid references rutinas(id) on delete set null,
  aprobado_en timestamptz,
  publicado_en timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists perfiles_entrenamiento_revision_idx
  on perfiles_entrenamiento (requiere_revision) where requiere_revision;
create index if not exists borradores_generador_alumno_idx
  on borradores_generador_rutinas (alumno_id, created_at desc);

alter table perfiles_entrenamiento enable row level security;
alter table tecnicas_entrenamiento enable row level security;
alter table borradores_generador_rutinas enable row level security;

create policy perfiles_entrenamiento_select on perfiles_entrenamiento for select
  using (alumno_id = auth.uid() or es_entrenador_de(alumno_id));
create policy perfiles_entrenamiento_alumno_insert on perfiles_entrenamiento for insert
  with check (alumno_id = auth.uid());
create policy perfiles_entrenamiento_alumno_update on perfiles_entrenamiento for update
  using (alumno_id = auth.uid()) with check (alumno_id = auth.uid());
create policy perfiles_entrenamiento_entrenador_write on perfiles_entrenamiento for all
  using (es_entrenador_de(alumno_id)) with check (es_entrenador_de(alumno_id));

create policy tecnicas_entrenamiento_select on tecnicas_entrenamiento for select
  using (auth.uid() is not null);
create policy tecnicas_entrenamiento_write on tecnicas_entrenamiento for all
  using (es_admin_o_entrenador()) with check (es_admin_o_entrenador());

create policy borradores_generador_select on borradores_generador_rutinas for select
  using (es_entrenador_de(alumno_id));
create policy borradores_generador_write on borradores_generador_rutinas for all
  using (es_entrenador_de(alumno_id) and entrenador_id = auth.uid())
  with check (es_entrenador_de(alumno_id) and entrenador_id = auth.uid());

