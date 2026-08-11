-- Publicación Versionada VIP 2.0
--
-- Una publicación completa ocurre dentro de una única transacción de Postgres:
-- rutina, días, ejercicios, cambio de activa y trazabilidad. Si cualquier paso
-- falla, la versión anterior permanece activa. La reversión tampoco borra datos;
-- solo vuelve a activar una versión histórica y registra quién lo hizo.

create table if not exists rutina_version_eventos (
  id uuid primary key default gen_random_uuid(),
  alumno_id uuid not null references perfiles(id) on delete cascade,
  actor_id uuid not null references perfiles(id) on delete restrict,
  accion text not null check (accion in ('publicar', 'revertir')),
  rutina_origen_id uuid references rutinas(id) on delete set null,
  rutina_destino_id uuid not null references rutinas(id) on delete cascade,
  borrador_id uuid references borradores_generador_rutinas(id) on delete set null,
  detalle jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists rutina_version_eventos_alumno_idx
  on rutina_version_eventos (alumno_id, created_at desc);

alter table rutina_version_eventos enable row level security;

drop policy if exists rutina_version_eventos_select on rutina_version_eventos;
create policy rutina_version_eventos_select on rutina_version_eventos for select
  using (es_entrenador_de(alumno_id));

drop policy if exists rutina_version_eventos_insert on rutina_version_eventos;
create policy rutina_version_eventos_insert on rutina_version_eventos for insert
  with check (es_entrenador_de(alumno_id) and actor_id = auth.uid());

create or replace function publicar_borrador_rutina_v2(
  p_borrador_id uuid,
  p_confirmacion text
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_borrador borradores_generador_rutinas%rowtype;
  v_activa rutinas%rowtype;
  v_nueva_id uuid;
  v_dia_id uuid;
  v_ejercicio_id uuid;
  v_version int;
  v_series int;
  v_descanso int;
  v_grupo text;
  v_item record;
  v_item_ejercicio record;
begin
  if v_actor is null then
    raise exception 'Sesión no válida.';
  end if;
  if p_confirmacion is distinct from 'PUBLICAR' then
    raise exception 'Falta la confirmación exacta.';
  end if;

  select * into v_borrador
  from borradores_generador_rutinas
  where id = p_borrador_id
    and entrenador_id = v_actor
  for update;

  if not found or v_borrador.estado <> 'aprobado' then
    raise exception 'El borrador no está disponible o ya fue publicado.';
  end if;
  if not es_entrenador_de(v_borrador.alumno_id) then
    raise exception 'No tienes acceso a esta persona.';
  end if;
  if v_borrador.brief->>'motor' is distinct from 'vip_2_0'
     or coalesce((v_borrador.resultado->>'version')::int, 0) <> 1 then
    raise exception 'El borrador no pertenece a Publicación Versionada VIP 2.0.';
  end if;
  if jsonb_typeof(v_borrador.resultado->'dias') <> 'array'
     or jsonb_array_length(v_borrador.resultado->'dias') not between 1 and 7 then
    raise exception 'El borrador no contiene una semana válida.';
  end if;

  -- Serializa publicaciones y reversiones de una misma persona, incluso si
  -- dos pestañas confirman al mismo tiempo y todavía no existe rutina activa.
  perform pg_advisory_xact_lock(hashtextextended(v_borrador.alumno_id::text, 220));

  select * into v_activa
  from rutinas
  where alumno_id = v_borrador.alumno_id and activa
  order by created_at desc
  limit 1
  for update;

  if (v_borrador.brief->>'rutinaBaseId')::uuid is distinct from v_activa.id
     or (v_borrador.brief->>'rutinaBaseVersion')::int is distinct from v_activa.version then
    raise exception 'La rutina activa cambió desde que guardaste el borrador.';
  end if;

  select coalesce(max(version), 0) + 1 into v_version
  from rutinas
  where alumno_id = v_borrador.alumno_id;

  if coalesce((v_borrador.brief->>'versionPropuesta')::int, 0) <> v_version then
    raise exception 'La rutina activa cambió desde que guardaste el borrador.';
  end if;

  insert into rutinas (alumno_id, nombre, activa, version, created_by)
  values (
    v_borrador.alumno_id,
    left(coalesce(nullif(v_borrador.resultado->>'nombreRutina', ''), 'Rutina VIP 2.0'), 180),
    false,
    v_version,
    v_actor
  )
  returning id into v_nueva_id;

  for v_item in
    select value as dia, ordinality::int as orden
    from jsonb_array_elements(v_borrador.resultado->'dias') with ordinality
  loop
    if coalesce(nullif(btrim(v_item.dia->>'nombre'), ''), '') = ''
       or jsonb_typeof(v_item.dia->'ejercicios') <> 'array'
       or jsonb_array_length(v_item.dia->'ejercicios') not between 1 and 20 then
      raise exception 'Hay un día incompleto en el borrador.';
    end if;

    insert into rutina_dias (rutina_id, numero_dia, nombre, orden, tipo, descripcion)
    values (
      v_nueva_id,
      v_item.orden,
      left(v_item.dia->>'nombre', 120),
      v_item.orden,
      'entrenamiento',
      left(coalesce(v_item.dia->>'enfoque', ''), 500)
    )
    returning id into v_dia_id;

    for v_item_ejercicio in
      select value as ejercicio, ordinality::int as orden
      from jsonb_array_elements(v_item.dia->'ejercicios') with ordinality
    loop
      begin
        v_ejercicio_id := (v_item_ejercicio.ejercicio->>'ejercicioId')::uuid;
        v_series := (v_item_ejercicio.ejercicio->>'series')::int;
        v_descanso := (v_item_ejercicio.ejercicio->>'descansoSegundos')::int;
      exception when others then
        raise exception 'Hay una prescripción inválida en el borrador.';
      end;

      if not exists (select 1 from ejercicios where id = v_ejercicio_id and activo) then
        raise exception 'Un ejercicio del borrador ya no está activo en la biblioteca.';
      end if;
      if v_series not between 1 and 8 or v_descanso not between 30 and 300 then
        raise exception 'Hay una dosis fuera de los límites permitidos.';
      end if;
      if coalesce(nullif(btrim(v_item_ejercicio.ejercicio->>'repeticiones'), ''), '') = ''
         or coalesce(nullif(btrim(v_item_ejercicio.ejercicio->>'rir'), ''), '') = '' then
        raise exception 'Hay una prescripción incompleta en el borrador.';
      end if;

      v_grupo := case v_item_ejercicio.ejercicio->>'grupoDosis'
        when 'pecho' then 'pecho'
        when 'espalda' then 'espalda'
        when 'hombros' then 'hombros'
        when 'brazos' then 'brazos'
        when 'core' then 'core'
        when 'cuadriceps' then 'piernas'
        when 'femorales' then 'piernas'
        when 'gluteos' then 'piernas'
        when 'pantorrillas' then 'piernas'
        else null
      end;
      if v_grupo is null then
        raise exception 'Hay un grupo muscular inválido en el borrador.';
      end if;

      insert into rutina_dia_ejercicios (
        dia_id,
        orden,
        nombre,
        series_programadas,
        reps_programadas,
        descanso_segundos,
        observacion,
        grupo_muscular,
        ejercicio_id
      ) values (
        v_dia_id,
        v_item_ejercicio.orden,
        left(v_item_ejercicio.ejercicio->>'nombre', 180),
        v_series,
        left(v_item_ejercicio.ejercicio->>'repeticiones', 32),
        v_descanso,
        left('RIR ' || (v_item_ejercicio.ejercicio->>'rir') || ' · ' || coalesce(v_item_ejercicio.ejercicio->>'motivo', ''), 500),
        v_grupo,
        v_ejercicio_id
      );
    end loop;
  end loop;

  update rutinas
  set activa = false
  where alumno_id = v_borrador.alumno_id and activa;

  update rutinas set activa = true where id = v_nueva_id;

  update borradores_generador_rutinas
  set estado = 'publicado',
      rutina_publicada_id = v_nueva_id,
      publicado_en = now(),
      updated_at = now()
  where id = v_borrador.id;

  insert into rutina_version_eventos (
    alumno_id, actor_id, accion, rutina_origen_id, rutina_destino_id, borrador_id, detalle
  ) values (
    v_borrador.alumno_id,
    v_actor,
    'publicar',
    v_activa.id,
    v_nueva_id,
    v_borrador.id,
    jsonb_build_object('version', v_version, 'motor', 'vip_2_0')
  );

  return jsonb_build_object(
    'rutinaId', v_nueva_id,
    'version', v_version,
    'nombre', v_borrador.resultado->>'nombreRutina'
  );
end;
$$;

create or replace function revertir_rutina_versionada_v2(
  p_rutina_destino_id uuid,
  p_confirmacion text
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_destino rutinas%rowtype;
  v_origen rutinas%rowtype;
begin
  if v_actor is null then
    raise exception 'Sesión no válida.';
  end if;
  if p_confirmacion is distinct from 'REVERTIR' then
    raise exception 'Falta la confirmación exacta.';
  end if;

  select * into v_destino from rutinas where id = p_rutina_destino_id;
  if not found or not es_entrenador_de(v_destino.alumno_id) then
    raise exception 'La versión de destino no existe o no está disponible.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_destino.alumno_id::text, 220));
  select * into v_destino from rutinas where id = p_rutina_destino_id for update;
  select * into v_origen
  from rutinas
  where alumno_id = v_destino.alumno_id and activa
  order by created_at desc
  limit 1
  for update;

  if v_destino.activa then
    raise exception 'La versión elegida ya está activa.';
  end if;

  update rutinas set activa = false where alumno_id = v_destino.alumno_id and activa;
  update rutinas set activa = true where id = v_destino.id;

  insert into rutina_version_eventos (
    alumno_id, actor_id, accion, rutina_origen_id, rutina_destino_id, detalle
  ) values (
    v_destino.alumno_id,
    v_actor,
    'revertir',
    v_origen.id,
    v_destino.id,
    jsonb_build_object('version_origen', v_origen.version, 'version_destino', v_destino.version)
  );

  return jsonb_build_object(
    'rutinaId', v_destino.id,
    'version', v_destino.version,
    'nombre', v_destino.nombre
  );
end;
$$;

revoke all on function publicar_borrador_rutina_v2(uuid, text) from public;
revoke all on function revertir_rutina_versionada_v2(uuid, text) from public;
grant execute on function publicar_borrador_rutina_v2(uuid, text) to authenticated;
grant execute on function revertir_rutina_versionada_v2(uuid, text) to authenticated;

comment on table rutina_version_eventos is
  'Trazabilidad inmutable de publicaciones y reversiones de rutinas versionadas.';
