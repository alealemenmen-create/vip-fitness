-- Historial de fusiones de ejercicios duplicados, con capacidad de deshacer.
--
-- `combinarEjerciciosDuplicados` (app/admin/ejercicios/actions.ts) ya fusiona
-- duplicados hace tiempo: reasigna las rutinas al original, junta los alias y
-- desactiva el duplicado (nunca lo borra). Lo que faltaba, pedido en la
-- sección 8.7 del instructivo de reorganización del panel ("Versionado y
-- recuperación"): registrar quién y cuándo, y poder restaurar si el
-- entrenador se equivocó de par.
--
-- Se guardan los IDs exactos de `rutina_dia_ejercicios` que se reasignaron
-- (no solo la cantidad) — es lo que permite deshacer con precisión: sin esa
-- lista, "restaurar" no podría saber cuáles filas eran del duplicado y
-- cuáles ya apuntaban al original por otro motivo.

create table if not exists ejercicio_fusiones (
  id uuid primary key default gen_random_uuid(),
  original_id uuid not null references ejercicios(id) on delete cascade,
  -- Nombre en el momento de la fusión: si el original se renombra después, el
  -- historial sigue siendo legible tal como pasó.
  original_nombre text not null,
  -- El duplicado NO tiene `on delete cascade` a propósito: sigue existiendo
  -- desactivado (activo=false) para poder restaurarlo. Si algún día se borra
  -- de verdad, el historial se queda sin el link pero conserva el nombre.
  duplicado_id uuid references ejercicios(id) on delete set null,
  duplicado_nombre text not null,
  -- Alias que tenía el original ANTES de esta fusión — para poder quitar
  -- exactamente los que se agregaron acá y no los que ya existían.
  aliases_antes text[] not null default '{}',
  -- Filas de rutina_dia_ejercicios reasignadas del duplicado al original.
  rutina_dia_ejercicios_ids uuid[] not null default '{}',
  fusionado_por uuid not null references perfiles(id),
  fusionado_en timestamptz not null default now(),
  deshecho_en timestamptz,
  deshecho_por uuid references perfiles(id)
);

create index if not exists ejercicio_fusiones_fecha_idx
  on ejercicio_fusiones (fusionado_en desc);

alter table ejercicio_fusiones enable row level security;

drop policy if exists ejercicio_fusiones_select on ejercicio_fusiones;
create policy ejercicio_fusiones_select on ejercicio_fusiones for select
  using (es_admin_o_entrenador());

drop policy if exists ejercicio_fusiones_write on ejercicio_fusiones;
create policy ejercicio_fusiones_write on ejercicio_fusiones for all
  using (es_admin_o_entrenador())
  with check (es_admin_o_entrenador());
