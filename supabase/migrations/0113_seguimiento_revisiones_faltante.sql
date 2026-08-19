-- Recupera la pieza de seguimiento integral que no llegó al proyecto activo.
-- Las revisiones son evidencia histórica: desde el cliente se pueden leer y
-- crear, pero no editar ni borrar. Service role conserva su acceso operativo.
create table if not exists public.seguimiento_revisiones (
  id uuid primary key default gen_random_uuid(),
  alumno_id uuid not null references public.perfiles(id) on delete cascade,
  entrenador_id uuid not null references public.perfiles(id),
  desde date not null,
  hasta date not null,
  dias_periodo integer not null check (dias_periodo in (7, 14, 30)),
  adherencia_general integer check (adherencia_general is null or adherencia_general between 0 and 100),
  resumen jsonb not null default '{}'::jsonb,
  observacion text not null check (char_length(observacion) between 3 and 2000),
  decision_siguiente_plan text check (
    decision_siguiente_plan is null or char_length(decision_siguiente_plan) <= 1000
  ),
  creado_en timestamptz not null default now(),
  check (desde <= hasta)
);

create index if not exists seguimiento_revisiones_alumno_fecha_idx
  on public.seguimiento_revisiones (alumno_id, creado_en desc);

alter table public.seguimiento_revisiones enable row level security;

drop policy if exists seguimiento_revisiones_select on public.seguimiento_revisiones;
create policy seguimiento_revisiones_select
  on public.seguimiento_revisiones
  for select
  to authenticated
  using (alumno_id = auth.uid() or public.es_entrenador_de(alumno_id));

drop policy if exists seguimiento_revisiones_insert on public.seguimiento_revisiones;
create policy seguimiento_revisiones_insert
  on public.seguimiento_revisiones
  for insert
  to authenticated
  with check (
    entrenador_id = auth.uid()
    and public.es_entrenador_de(alumno_id)
  );

revoke all on table public.seguimiento_revisiones from public, anon, authenticated;
grant select, insert on table public.seguimiento_revisiones to authenticated;
