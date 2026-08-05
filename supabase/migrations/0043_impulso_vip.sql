-- Impulso VIP — Fase 1: motor de progresion basico (doble progresion).
--
-- Cuatro piezas nuevas:
-- 1. `rutina_dia_ejercicio_progresion`: configuracion que pone el entrenador
--    sobre una asignacion concreta (no sobre el ejercicio de la biblioteca —
--    la misma maquina puede pedir progresion distinta en dos rutinas). Fila
--    ausente = motor desactivado para ese ejercicio, sin cambiar nada del
--    comportamiento actual.
-- 2. `sesion_ejercicios.dificultad_percibida`: como sintio el alumno el
--    ejercicio completo, en lenguaje simple (no un RIR crudo). Se pregunta
--    una vez por ejercicio, no por serie, para no volver lenta la sesion.
-- 3. `impulso_vip_recomendaciones`: la propuesta calculada para un
--    `sesion_ejercicio_id`, mas si el alumno la cumplio. Se genera UNA sola
--    vez (la aplicacion nunca la recalcula sobre una fila existente, salvo
--    accion explicita del entrenador) — es una meta congelada, no algo que
--    se mueva bajo el alumno a mitad de ejercicio.
-- 4. `impulso_vip_alertas`: lo que dispara la Regla E (dolor, estancamiento,
--    caida de rendimiento) para que el entrenador lo revise. El dolor guarda
--    zona/intensidad/momento, no solo un checkbox suelto.

-- ---------------------------------------------------------------------
-- 1. Configuracion de progresion por ejercicio asignado
-- ---------------------------------------------------------------------

create table if not exists rutina_dia_ejercicio_progresion (
  dia_ejercicio_id uuid primary key references rutina_dia_ejercicios(id) on delete cascade,
  apto_progresion boolean not null default true,
  tipo_progresion text not null default 'doble'
    check (tipo_progresion in ('doble', 'solo_peso', 'solo_reps', 'manual')),
  -- Salto minimo de carga disponible para este ejercicio (mancuerna par,
  -- placas de la maquina, etc.) — el motor nunca sugiere un peso que no
  -- exista de verdad en la sala.
  incremento_kg numeric not null default 2.5 check (incremento_kg > 0),
  -- Si es true, una recomendacion de subir peso (Regla B) nace en estado
  -- 'propuesta' en vez de 'aprobada': el alumno no la ve como meta hasta que
  -- el entrenador la confirme.
  requiere_autorizacion boolean not null default false,
  rir_objetivo int check (rir_objetivo is null or rir_objetivo between 0 and 10),
  creado_por uuid references perfiles(id),
  updated_at timestamptz not null default now()
);

alter table rutina_dia_ejercicio_progresion enable row level security;

drop policy if exists rutina_dia_ejercicio_progresion_select on rutina_dia_ejercicio_progresion;
create policy rutina_dia_ejercicio_progresion_select on rutina_dia_ejercicio_progresion for select
  using (exists (
    select 1 from rutina_dia_ejercicios rde
    join rutina_dias d on d.id = rde.dia_id
    join rutinas r on r.id = d.rutina_id
    where rde.id = rutina_dia_ejercicio_progresion.dia_ejercicio_id
      and (r.alumno_id = auth.uid() or es_entrenador_de(r.alumno_id))
  ));

drop policy if exists rutina_dia_ejercicio_progresion_write on rutina_dia_ejercicio_progresion;
create policy rutina_dia_ejercicio_progresion_write on rutina_dia_ejercicio_progresion for all
  using (exists (
    select 1 from rutina_dia_ejercicios rde
    join rutina_dias d on d.id = rde.dia_id
    join rutinas r on r.id = d.rutina_id
    where rde.id = rutina_dia_ejercicio_progresion.dia_ejercicio_id and es_entrenador_de(r.alumno_id)
  ))
  with check (exists (
    select 1 from rutina_dia_ejercicios rde
    join rutina_dias d on d.id = rde.dia_id
    join rutinas r on r.id = d.rutina_id
    where rde.id = rutina_dia_ejercicio_progresion.dia_ejercicio_id and es_entrenador_de(r.alumno_id)
  ));

-- ---------------------------------------------------------------------
-- 2. Dificultad percibida por ejercicio (una vez al terminarlo, no por serie)
-- ---------------------------------------------------------------------

alter table sesion_ejercicios
  add column if not exists dificultad_percibida text
    check (dificultad_percibida is null or dificultad_percibida in
      ('muy_facil', 'facil', 'justo', 'dificil', 'fallo'));

-- ---------------------------------------------------------------------
-- 3. Recomendaciones generadas
-- ---------------------------------------------------------------------

create table if not exists impulso_vip_recomendaciones (
  id uuid primary key default gen_random_uuid(),
  sesion_ejercicio_id uuid not null references sesion_ejercicios(id) on delete cascade,
  dia_ejercicio_id uuid not null references rutina_dia_ejercicios(id),
  alumno_id uuid not null references perfiles(id) on delete cascade,
  regla text not null
    check (regla in ('A_subir_reps', 'B_subir_peso', 'C_mantener', 'D_reducir', 'E_consultar')),
  peso_sugerido_kg numeric check (peso_sugerido_kg is null or peso_sugerido_kg >= 0),
  reps_objetivo_min int check (reps_objetivo_min is null or reps_objetivo_min > 0),
  reps_objetivo_max int check (reps_objetivo_max is null or reps_objetivo_max > 0),
  es_peso_corporal boolean not null default false,
  justificacion text not null,
  -- De que sesion anterior salio el calculo, para trazabilidad.
  basado_en_sesion_ejercicio_id uuid references sesion_ejercicios(id),
  -- 'E_consultar' siempre nace 'bloqueada': no es una meta, es una pausa.
  -- 'B_subir_peso' nace 'propuesta' si el ejercicio requiere autorizacion.
  -- Todo lo demas nace 'aprobada' directamente.
  estado text not null default 'propuesta'
    check (estado in ('propuesta', 'aprobada', 'bloqueada', 'modificada')),
  -- Se resuelve al guardar las series de esta sesion, comparando lo
  -- realizado contra lo sugerido. Null para 'E_consultar' — no se evalua.
  cumplimiento text
    check (cumplimiento is null or cumplimiento in ('cumplida', 'superada', 'parcial', 'no_cumplida')),
  -- Version del motor que la calculo, para poder mejorar la logica despues
  -- sin perder la trazabilidad de recomendaciones viejas.
  motor_version text not null default 'v1',
  -- Snapshot de los datos con los que se decidio (rango, peso/reps
  -- anteriores, motivos) — si el entrenador cambia despues el rango o el
  -- incremento, la recomendacion historica sigue siendo interpretable.
  decision_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  resuelto_en timestamptz,
  unique (sesion_ejercicio_id)
);

create index if not exists impulso_vip_recomendaciones_alumno_idx
  on impulso_vip_recomendaciones (alumno_id, created_at desc);

alter table impulso_vip_recomendaciones enable row level security;

drop policy if exists impulso_vip_recomendaciones_select on impulso_vip_recomendaciones;
create policy impulso_vip_recomendaciones_select on impulso_vip_recomendaciones for select
  using (alumno_id = auth.uid() or es_entrenador_de(alumno_id));

-- El alumno inserta/actualiza las suyas: el calculo lo hace el servidor (el
-- motor de reglas puro), pero la escritura viaja con la sesion normal del
-- alumno, igual que `series_realizadas` — no es una tabla de puntaje. La
-- aplicacion nunca sobrescribe una fila ya creada por su cuenta (ver
-- `generarYGuardarRecomendacion` en data.ts): inserta solo si no existe.
drop policy if exists impulso_vip_recomendaciones_alumno_write on impulso_vip_recomendaciones;
create policy impulso_vip_recomendaciones_alumno_write on impulso_vip_recomendaciones for all
  using (alumno_id = auth.uid())
  with check (alumno_id = auth.uid());

-- El entrenador solo necesita poder actualizar (aprobar/bloquear/modificar
-- una recomendacion pendiente), no crearlas.
drop policy if exists impulso_vip_recomendaciones_entrenador_update on impulso_vip_recomendaciones;
create policy impulso_vip_recomendaciones_entrenador_update on impulso_vip_recomendaciones for update
  using (es_entrenador_de(alumno_id))
  with check (es_entrenador_de(alumno_id));

-- ---------------------------------------------------------------------
-- 4. Alertas (Regla E)
-- ---------------------------------------------------------------------

create table if not exists impulso_vip_alertas (
  id uuid primary key default gen_random_uuid(),
  alumno_id uuid not null references perfiles(id) on delete cascade,
  dia_ejercicio_id uuid not null references rutina_dia_ejercicios(id),
  tipo text not null check (tipo in ('dolor', 'estancamiento_3_sesiones', 'caida_rendimiento')),
  -- Contexto minimo para que la alerta de dolor sea util, no solo un
  -- checkbox suelto. Quedan null para los otros dos tipos de alerta.
  zona text,
  intensidad int check (intensidad is null or intensidad between 1 and 5),
  momento text check (momento is null or momento in ('antes', 'durante', 'despues')),
  detuvo_ejercicio boolean,
  detalle text,
  sesion_ejercicio_id uuid references sesion_ejercicios(id),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'vista', 'resuelta')),
  creado_en timestamptz not null default now(),
  resuelto_en timestamptz,
  resuelto_por uuid references perfiles(id)
);

create index if not exists impulso_vip_alertas_alumno_estado_idx
  on impulso_vip_alertas (alumno_id, estado);
create index if not exists impulso_vip_alertas_estado_fecha_idx
  on impulso_vip_alertas (estado, creado_en desc);

-- Red de seguridad real contra duplicados concurrentes (ver
-- asegurarAlertaImpulso en src/lib/impulso-vip/congelar.ts): la app ya evita
-- duplicar con una consulta previa, pero esto es lo que garantiza que dos
-- inserciones simultaneas para la misma sesion y tipo no puedan coexistir,
-- sin importar el estado de la alerta.
create unique index if not exists impulso_vip_alertas_sesion_tipo_unique
  on impulso_vip_alertas (sesion_ejercicio_id, tipo)
  where sesion_ejercicio_id is not null;

alter table impulso_vip_alertas enable row level security;

drop policy if exists impulso_vip_alertas_select on impulso_vip_alertas;
create policy impulso_vip_alertas_select on impulso_vip_alertas for select
  using (alumno_id = auth.uid() or es_entrenador_de(alumno_id));

drop policy if exists impulso_vip_alertas_alumno_insert on impulso_vip_alertas;
create policy impulso_vip_alertas_alumno_insert on impulso_vip_alertas for insert
  with check (alumno_id = auth.uid());

drop policy if exists impulso_vip_alertas_entrenador_update on impulso_vip_alertas;
create policy impulso_vip_alertas_entrenador_update on impulso_vip_alertas for update
  using (es_entrenador_de(alumno_id))
  with check (es_entrenador_de(alumno_id));
