-- Cierre semanal del ranking: una vez que la semana calendario terminó, se
-- guarda el puntaje final de cada alumno para que el rango (Bronze→Olympian
-- VIP) sea acumulado y persistente en el tiempo, en vez de recalcularse desde
-- cero cada lunes. No hay proceso 24/7 en dev que cierre a medianoche (mismo
-- límite que las tareas de Telegram pospuestas, ver HANDOFF.md): se cierra de
-- forma perezosa desde el servidor (service_role, ignora RLS) la primera vez
-- que cualquier alumno visita Inicio o Ranked después de que la semana
-- terminó. No se cierran semanas anteriores al lanzamiento de este sistema.
create table ranking_semanas (
  id uuid primary key default gen_random_uuid(),
  alumno_id uuid not null references perfiles(id) on delete cascade,
  semana_inicio date not null,
  puntos integer not null,
  desglose jsonb not null,
  cerrada_en timestamptz not null default now(),
  unique (alumno_id, semana_inicio)
);

alter table ranking_semanas enable row level security;

-- Solo lectura por RLS (cada quien ve su propio historial; staff ve todo).
-- El cierre (insert) lo hace siempre el servidor con la service_role key, que
-- ignora RLS — no hace falta política de insert para clientes normales.
create policy ranking_semanas_select on ranking_semanas for select
  using (alumno_id = auth.uid() or es_admin_o_entrenador());
