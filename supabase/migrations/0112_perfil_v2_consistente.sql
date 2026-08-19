-- Guarda los datos personales que viven en dos tablas como una sola operación.
-- Si cualquiera de las dos filas falta o una política rechaza el cambio,
-- PostgreSQL revierte todo: la interfaz nunca puede confirmar un guardado
-- parcial (por ejemplo, nombre nuevo con antecedentes antiguos).
create or replace function public.actualizar_mi_perfil_personal_v2(
  p_nombre text,
  p_fecha_nacimiento date,
  p_estatura_cm numeric,
  p_condicion_medica text,
  p_restriccion_alimenticia text,
  p_telefono text,
  p_sexo text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_filas integer;
begin
  if v_usuario_id is null then
    raise exception 'SIN_SESION';
  end if;
  if p_nombre is null or char_length(btrim(p_nombre)) not between 2 and 80 then
    raise exception 'NOMBRE_INVALIDO';
  end if;
  if p_fecha_nacimiento is not null and (p_fecha_nacimiento > current_date or p_fecha_nacimiento < date '1900-01-01') then
    raise exception 'FECHA_NACIMIENTO_INVALIDA';
  end if;
  if p_estatura_cm is not null and p_estatura_cm not between 80 and 260 then
    raise exception 'ESTATURA_INVALIDA';
  end if;
  if p_telefono is not null and (char_length(p_telefono) not between 8 and 20 or p_telefono !~ '^[0-9 +()\-]+$') then
    raise exception 'TELEFONO_INVALIDO';
  end if;
  if char_length(coalesce(p_condicion_medica, '')) > 2000 or char_length(coalesce(p_restriccion_alimenticia, '')) > 2000 then
    raise exception 'TEXTO_PERSONAL_DEMASIADO_LARGO';
  end if;
  if p_sexo is not null and p_sexo not in ('femenino', 'masculino', 'otro') then
    raise exception 'SEXO_INVALIDO';
  end if;

  update public.alumno_perfil
  set fecha_nacimiento = p_fecha_nacimiento,
      estatura_cm = p_estatura_cm,
      condicion_medica = p_condicion_medica,
      restriccion_alimenticia = p_restriccion_alimenticia,
      telefono = p_telefono,
      sexo = p_sexo,
      updated_at = now()
  where user_id = v_usuario_id;

  get diagnostics v_filas = row_count;
  if v_filas <> 1 then
    raise exception 'PERFIL_ALUMNO_NO_ENCONTRADO';
  end if;

  update public.perfiles
  set nombre = btrim(p_nombre)
  where id = v_usuario_id;

  get diagnostics v_filas = row_count;
  if v_filas <> 1 then
    raise exception 'CUENTA_NO_ENCONTRADA';
  end if;
end;
$$;

revoke all on function public.actualizar_mi_perfil_personal_v2(text, date, numeric, text, text, text, text) from public, anon;
grant execute on function public.actualizar_mi_perfil_personal_v2(text, date, numeric, text, text, text, text) to authenticated;
