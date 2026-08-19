-- La tienda y los canjes pertenecen al espacio administrativo. La interfaz ya
-- exigía `requireAdmin`, pero las políticas y RPC de 0107 todavía aceptaban a
-- cualquier entrenador mediante `es_admin_o_entrenador()`. Un cliente podía
-- saltarse la interfaz e invocar esas capacidades directamente.

drop policy if exists recompensas_catalogo_select on public.recompensas_vip_catalogo;
create policy recompensas_catalogo_select on public.recompensas_vip_catalogo
for select using (
  activo = true
  or exists (
    select 1 from public.perfiles
    where id = auth.uid() and rol = 'admin'
  )
);

drop policy if exists recompensas_canjes_select on public.recompensas_vip_canjes;
create policy recompensas_canjes_select on public.recompensas_vip_canjes
for select using (
  alumno_id = auth.uid()
  or exists (
    select 1 from public.perfiles
    where id = auth.uid() and rol = 'admin'
  )
);

create or replace function public.resolver_canje_vip(
  p_canje_id uuid,
  p_estado text,
  p_nota text default null
)
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
  if v_actor is null or not exists (
    select 1 from public.perfiles where id = v_actor and rol = 'admin'
  ) then
    raise exception 'SIN_PERMISO';
  end if;
  if p_estado not in ('aprobado', 'entregado', 'rechazado') then
    raise exception 'ESTADO_INVALIDO';
  end if;

  select * into v_canje
  from public.recompensas_vip_canjes
  where id = p_canje_id
  for update;
  if not found then raise exception 'CANJE_NO_EXISTE'; end if;
  if v_canje.estado in ('rechazado', 'cancelado', 'entregado') then
    raise exception 'CANJE_YA_RESUELTO';
  end if;
  if p_estado = 'entregado' and v_canje.estado <> 'aprobado' then
    raise exception 'PRIMERO_APROBAR';
  end if;

  select nombre into v_nombre
  from public.recompensas_vip_catalogo
  where id = v_canje.recompensa_id;

  if p_estado = 'rechazado' then
    insert into public.puntos_vip_movimientos
      (alumno_id, clave, categoria, puntos, titulo, detalle, fecha, metadata)
    values
      (v_canje.alumno_id, 'canje-reintegro:' || v_canje.id::text,
       'competencia', v_canje.costo_congelado,
       'Reintegro · ' || coalesce(v_nombre, 'Recompensa VIP'),
       'Canje rechazado; puntos devueltos',
       (now() at time zone 'America/Santiago')::date,
       jsonb_build_object('canjeId', v_canje.id))
    on conflict (alumno_id, clave) do nothing;

    update public.recompensas_vip_catalogo
    set stock = case when stock is null then null else stock + 1 end,
        updated_at = now()
    where id = v_canje.recompensa_id;
  end if;

  update public.recompensas_vip_canjes
  set estado = p_estado,
      nota_admin = nullif(trim(p_nota), ''),
      actualizado_en = now(),
      resuelto_por = v_actor
  where id = v_canje.id;
end;
$$;

create or replace function public.ajustar_stock_recompensa_vip(
  p_recompensa_id uuid,
  p_delta integer,
  p_sin_limite boolean default false
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_stock integer;
begin
  if v_actor is null or not exists (
    select 1 from public.perfiles where id = v_actor and rol = 'admin'
  ) then
    raise exception 'SIN_PERMISO';
  end if;
  if p_delta is null or abs(p_delta) > 100000 then
    raise exception 'AJUSTE_INVALIDO';
  end if;

  update public.recompensas_vip_catalogo
  set stock = case
        when p_sin_limite then null
        else greatest(0, coalesce(stock, 0) + p_delta)
      end,
      updated_at = now()
  where id = p_recompensa_id
  returning stock into v_stock;
  if not found then raise exception 'RECOMPENSA_NO_EXISTE'; end if;
  return v_stock;
end;
$$;

revoke all on function public.resolver_canje_vip(uuid, text, text) from public, anon;
grant execute on function public.resolver_canje_vip(uuid, text, text) to authenticated;
revoke all on function public.ajustar_stock_recompensa_vip(uuid, integer, boolean) from public, anon;
grant execute on function public.ajustar_stock_recompensa_vip(uuid, integer, boolean) to authenticated;

comment on function public.resolver_canje_vip(uuid, text, text) is
  'Solo administradores: resuelve canjes y reintegra saldo/stock de forma idempotente.';
comment on function public.ajustar_stock_recompensa_vip(uuid, integer, boolean) is
  'Solo administradores: ajusta el inventario de recompensas VIP.';
