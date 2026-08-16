-- Bandeja de notificaciones del entrenador — pedido de Alejandro
-- (2026-08-16): que lo importante de verdad le llegue con push y quede en
-- una bandeja que se va actualizando, sin mezclarse con la cola de trabajo
-- administrativo que ya es /admin/pendientes.
--
-- "Importante de verdad" no es un umbral fijo igual para todos: un alumno
-- que nunca registra comida no genera aviso por no registrar hoy, pero uno
-- que SIEMPRE lo hace y de repente paró, sí. Esa comparación contra el
-- patrón propio de cada alumno la calcula `detectarHabitosRotos`
-- (src/lib/notificaciones/habitos.ts), corrida por el cron diario.

create table if not exists notificaciones_entrenador (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('habito_comida', 'habito_entrenamiento', 'bug', 'resena', 'foto_reporte')),
  alumno_id uuid references perfiles(id) on delete cascade,
  titulo text not null,
  cuerpo text not null,
  -- 'alta' es la única que dispara push real (ver crearNotificacionEntrenador);
  -- 'normal' solo aparece en la bandeja.
  prioridad text not null default 'normal' check (prioridad in ('alta', 'normal')),
  ruta text,
  -- Para no duplicar el mismo aviso todos los días mientras el hábito sigue
  -- roto: se guarda una clave de deduplicación (ej. "habito_comida:<alumno_id>")
  -- y el detector no vuelve a insertar si ya hay una fila reciente sin
  -- resolver con la misma clave.
  clave_dedup text,
  leida_en timestamptz,
  creado_en timestamptz not null default now()
);

create index if not exists notificaciones_entrenador_fecha_idx
  on notificaciones_entrenador (creado_en desc);
create index if not exists notificaciones_entrenador_dedup_idx
  on notificaciones_entrenador (clave_dedup, creado_en desc) where clave_dedup is not null;
create index if not exists notificaciones_entrenador_sin_leer_idx
  on notificaciones_entrenador (leida_en) where leida_en is null;

alter table notificaciones_entrenador enable row level security;

drop policy if exists notificaciones_entrenador_todo on notificaciones_entrenador;
create policy notificaciones_entrenador_todo on notificaciones_entrenador for all
  using (es_admin_o_entrenador())
  with check (es_admin_o_entrenador());
