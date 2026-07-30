-- Módulo de Torneos: el entrenador arma una competencia entre alumnos que él
-- elige, sobre una métrica, y al cerrarla el ganador le quita puntos al
-- perdedor (zero-sum) — esos puntos se suman al acumulado del ranking (ver
-- src/lib/ranking/data.ts).
--
-- Métricas automáticas (se calculan solas desde datos que ya existen):
--   peso_baja / peso_sube → diferencia de pesos_corporales entre el primer y
--     el último registro del alumno dentro del rango de fechas del torneo.
--   asistencia → sesiones de entrenamiento completadas en el rango.
-- Métrica manual: cada alumno no tiene un catálogo de ejercicios en común
-- (las rutinas son individuales, generadas por IA desde su propio PDF, con
-- nombres libres) — así que para "quién hace más repeticiones" o "quién
-- levanta más peso" en un ejercicio puntual, el entrenador carga el
-- resultado final de cada participante a mano.
create type torneo_metrica as enum ('peso_baja', 'peso_sube', 'asistencia', 'manual');

create table torneos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text,
  metrica torneo_metrica not null,
  -- Solo aplica a metrica='manual': por defecto gana el número más alto
  -- (reps, kg levantados); se marca true para métricas donde gana el más
  -- bajo (ej. tiempo).
  menor_es_mejor boolean not null default false,
  unidad_manual text,
  fecha_inicio date not null,
  fecha_fin date not null,
  puntos_en_juego integer not null default 1000 check (puntos_en_juego > 0),
  cerrado boolean not null default false,
  creado_por uuid references perfiles(id),
  created_at timestamptz not null default now(),
  cerrado_en timestamptz,
  check (fecha_fin >= fecha_inicio)
);

create table torneo_participantes (
  torneo_id uuid not null references torneos(id) on delete cascade,
  alumno_id uuid not null references perfiles(id) on delete cascade,
  -- Solo se llena si el torneo es de metrica='manual'.
  resultado_manual numeric,
  primary key (torneo_id, alumno_id)
);

-- Snapshot inmutable del resultado al cerrar (mismo patrón que
-- ranking_semanas): [{alumnoId, nombre, valor, puesto, puntosDelta}, ...].
-- Así, si después se cambia la fórmula de reparto de puntos, los torneos ya
-- cerrados no se recalculan con reglas nuevas.
create table torneo_resultados (
  torneo_id uuid primary key references torneos(id) on delete cascade,
  resultados jsonb not null,
  cerrada_en timestamptz not null default now()
);

alter table torneos enable row level security;
alter table torneo_participantes enable row level security;
alter table torneo_resultados enable row level security;

-- Es una competencia del gimnasio: cualquier alumno logueado puede ver qué
-- torneos hay, quién participa y los resultados ya cerrados (igual que la
-- tabla general del ranking, pensada para ser pública). Solo entrenador/admin
-- crean y modifican torneos; el cierre (insert en torneo_resultados) lo hace
-- siempre el servidor con service_role, no hace falta política de insert ahí.
create policy torneos_select on torneos for select using (auth.uid() is not null);
create policy torneos_write on torneos for all
  using (es_admin_o_entrenador())
  with check (es_admin_o_entrenador());

create policy torneo_participantes_select on torneo_participantes for select
  using (auth.uid() is not null);
create policy torneo_participantes_write on torneo_participantes for all
  using (es_admin_o_entrenador())
  with check (es_admin_o_entrenador());

create policy torneo_resultados_select on torneo_resultados for select
  using (auth.uid() is not null);
