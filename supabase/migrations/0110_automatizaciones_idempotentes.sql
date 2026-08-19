-- Dos garantías para automatizaciones de producción:
-- 1) el webhook de Stream no puede aplicar un evento firmado más antiguo que
--    el último aceptado;
-- 2) dos ejecuciones concurrentes del cron no duplican una notificación ni su
--    push. La exclusión se hace dentro de PostgreSQL, no en memoria.

alter table public.ejercicios
  add column if not exists video_cloudflare_webhook_en timestamptz;

create or replace function public.crear_notificacion_entrenador_dedup(
  p_tipo text,
  p_alumno_id uuid,
  p_titulo text,
  p_cuerpo text,
  p_prioridad text,
  p_ruta text,
  p_clave_dedup text,
  p_desde timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'NO_AUTORIZADO';
  end if;

  if p_clave_dedup is not null then
    perform pg_advisory_xact_lock(hashtextextended('notificacion:' || p_clave_dedup, 0));

    select id into v_id
    from public.notificaciones_entrenador
    where clave_dedup = p_clave_dedup
      and creado_en >= p_desde
    order by creado_en desc
    limit 1;

    if found then
      return null;
    end if;
  end if;

  insert into public.notificaciones_entrenador (
    tipo, alumno_id, titulo, cuerpo, prioridad, ruta, clave_dedup
  ) values (
    p_tipo, p_alumno_id, p_titulo, p_cuerpo, p_prioridad, p_ruta, p_clave_dedup
  ) returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.crear_notificacion_entrenador_dedup(
  text, uuid, text, text, text, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.crear_notificacion_entrenador_dedup(
  text, uuid, text, text, text, text, text, timestamptz
) to service_role;

