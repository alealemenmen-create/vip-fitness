-- Catálogo y canje transaccional de recompensas VIP.
-- Los puntos se descuentan dentro de la misma transacción que reserva stock.

create table if not exists public.recompensas_vip_catalogo (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(trim(nombre)) between 2 and 80),
  descripcion text not null default '' check (char_length(descripcion) <= 500),
  tipo text not null check (tipo in ('digital', 'servicio', 'fisica')),
  costo_puntos integer not null check (costo_puntos between 1 and 1000000),
  stock integer null check (stock is null or stock >= 0),
  requiere_aprobacion boolean not null default true,
  imagen_url text null,
  activo boolean not null default true,
  vigente_desde timestamptz not null default now(),
  vigente_hasta timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (vigente_hasta is null or vigente_hasta > vigente_desde)
);

create table if not exists public.recompensas_vip_canjes (
  id uuid primary key default gen_random_uuid(),
  alumno_id uuid not null references public.perfiles(id) on delete cascade,
  recompensa_id uuid not null references public.recompensas_vip_catalogo(id) on delete restrict,
  costo_congelado integer not null check (costo_congelado > 0),
  estado text not null default 'solicitado' check (estado in ('solicitado', 'aprobado', 'entregado', 'rechazado', 'cancelado')),
  nota_admin text null check (nota_admin is null or char_length(nota_admin) <= 500),
  solicitado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  resuelto_por uuid null references public.perfiles(id) on delete set null
);

create index if not exists recompensas_vip_catalogo_activas_idx
  on public.recompensas_vip_catalogo (activo, costo_puntos, nombre);
create index if not exists recompensas_vip_canjes_alumno_idx
  on public.recompensas_vip_canjes (alumno_id, solicitado_en desc);
create index if not exists recompensas_vip_canjes_estado_idx
  on public.recompensas_vip_canjes (estado, solicitado_en asc);

alter table public.recompensas_vip_catalogo enable row level security;
alter table public.recompensas_vip_canjes enable row level security;

create policy recompensas_catalogo_select on public.recompensas_vip_catalogo for select
  using (activo = true or es_admin_o_entrenador());
create policy recompensas_canjes_select on public.recompensas_vip_canjes for select
  using (alumno_id = auth.uid() or es_admin_o_entrenador());

revoke insert, update, delete on public.recompensas_vip_catalogo from anon, authenticated;
revoke insert, update, delete on public.recompensas_vip_canjes from anon, authenticated;
grant select on public.recompensas_vip_catalogo, public.recompensas_vip_canjes to authenticated;

create or replace function public.solicitar_canje_vip(p_recompensa_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alumno uuid := auth.uid();
  v_recompensa public.recompensas_vip_catalogo%rowtype;
  v_saldo integer;
  v_canje uuid;
begin
  if v_alumno is null then raise exception 'NO_AUTENTICADO'; end if;
  perform pg_advisory_xact_lock(hashtext('canje-vip:' || v_alumno::text));

  select * into v_recompensa from public.recompensas_vip_catalogo
  where id = p_recompensa_id and activo = true
    and vigente_desde <= now()
    and (vigente_hasta is null or vigente_hasta > now())
  for update;
  if not found then raise exception 'RECOMPENSA_NO_DISPONIBLE'; end if;
  if v_recompensa.stock is not null and v_recompensa.stock <= 0 then raise exception 'SIN_STOCK'; end if;

  select coalesce(sum(puntos), 0)::integer into v_saldo
  from public.puntos_vip_movimientos where alumno_id = v_alumno;
  if v_saldo < v_recompensa.costo_puntos then raise exception 'SALDO_INSUFICIENTE'; end if;

  insert into public.recompensas_vip_canjes (alumno_id, recompensa_id, costo_congelado)
  values (v_alumno, v_recompensa.id, v_recompensa.costo_puntos)
  returning id into v_canje;

  insert into public.puntos_vip_movimientos
    (alumno_id, clave, categoria, puntos, titulo, detalle, fecha, metadata)
  values
    (v_alumno, 'canje:' || v_canje::text, 'competencia', -v_recompensa.costo_puntos,
     'Canje VIP · ' || v_recompensa.nombre, 'Reserva de recompensa',
     (now() at time zone 'America/Santiago')::date,
     jsonb_build_object('canjeId', v_canje, 'recompensaId', v_recompensa.id));

  if v_recompensa.stock is not null then
    update public.recompensas_vip_catalogo set stock = stock - 1, updated_at = now()
    where id = v_recompensa.id;
  end if;
  return v_canje;
end;
$$;

create or replace function public.resolver_canje_vip(p_canje_id uuid, p_estado text, p_nota text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_canje public.recompensas_vip_canjes%rowtype;
  v_nombre text;
begin
  if v_actor is null or not public.es_admin_o_entrenador() then raise exception 'SIN_PERMISO'; end if;
  if p_estado not in ('aprobado', 'entregado', 'rechazado') then raise exception 'ESTADO_INVALIDO'; end if;

  select * into v_canje from public.recompensas_vip_canjes where id = p_canje_id for update;
  if not found then raise exception 'CANJE_NO_EXISTE'; end if;
  if v_canje.estado in ('rechazado', 'cancelado', 'entregado') then raise exception 'CANJE_YA_RESUELTO'; end if;
  if p_estado = 'entregado' and v_canje.estado <> 'aprobado' then raise exception 'PRIMERO_APROBAR'; end if;

  select nombre into v_nombre from public.recompensas_vip_catalogo where id = v_canje.recompensa_id;
  if p_estado = 'rechazado' then
    insert into public.puntos_vip_movimientos
      (alumno_id, clave, categoria, puntos, titulo, detalle, fecha, metadata)
    values
      (v_canje.alumno_id, 'canje-reintegro:' || v_canje.id::text, 'competencia', v_canje.costo_congelado,
       'Reintegro · ' || coalesce(v_nombre, 'Recompensa VIP'), 'Canje rechazado; puntos devueltos',
       (now() at time zone 'America/Santiago')::date,
       jsonb_build_object('canjeId', v_canje.id))
    on conflict (alumno_id, clave) do nothing;
    update public.recompensas_vip_catalogo set stock = case when stock is null then null else stock + 1 end, updated_at = now()
    where id = v_canje.recompensa_id;
  end if;

  update public.recompensas_vip_canjes
  set estado = p_estado, nota_admin = nullif(trim(p_nota), ''), actualizado_en = now(), resuelto_por = v_actor
  where id = v_canje.id;
end;
$$;

create or replace function public.ajustar_stock_recompensa_vip(p_recompensa_id uuid, p_delta integer, p_sin_limite boolean default false)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_stock integer;
begin
  if auth.uid() is null or not public.es_admin_o_entrenador() then raise exception 'SIN_PERMISO'; end if;
  if p_delta is null or abs(p_delta) > 100000 then raise exception 'AJUSTE_INVALIDO'; end if;
  update public.recompensas_vip_catalogo
  set stock = case when p_sin_limite then null else greatest(0, coalesce(stock, 0) + p_delta) end,
      updated_at = now()
  where id = p_recompensa_id
  returning stock into v_stock;
  if not found then raise exception 'RECOMPENSA_NO_EXISTE'; end if;
  return v_stock;
end;
$$;

revoke all on function public.solicitar_canje_vip(uuid) from public, anon;
grant execute on function public.solicitar_canje_vip(uuid) to authenticated;
revoke all on function public.resolver_canje_vip(uuid, text, text) from public, anon;
grant execute on function public.resolver_canje_vip(uuid, text, text) to authenticated;
revoke all on function public.ajustar_stock_recompensa_vip(uuid, integer, boolean) from public, anon;
grant execute on function public.ajustar_stock_recompensa_vip(uuid, integer, boolean) to authenticated;

comment on function public.solicitar_canje_vip(uuid) is
  'Reserva stock y descuenta saldo real en una única transacción serializada por alumno.';
