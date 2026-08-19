-- Cierra una omision de autorizacion en el canje de recompensas.
-- La interfaz solo ofrece el catalogo al alumno, pero una funcion RPC debe
-- validar el rol por si alguien autenticado intenta invocarla directamente.

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
  if not exists (
    select 1 from public.perfiles
    where id = v_alumno and rol = 'alumno'
  ) then
    raise exception 'SIN_PERMISO';
  end if;

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

revoke all on function public.solicitar_canje_vip(uuid) from public, anon;
grant execute on function public.solicitar_canje_vip(uuid) to authenticated;

comment on function public.solicitar_canje_vip(uuid) is
  'Solo alumnos: reserva stock y descuenta saldo real en una unica transaccion serializada por alumno.';
