-- Memoria adaptativa de Impulso VIP por alumno, ejercicio y tecnica.
-- Se actualiza una sola vez cuando una intervencion pasa a resuelta.

create table if not exists impulso_vip_memoria_tecnicas (
  id uuid primary key default gen_random_uuid(),
  alumno_id uuid not null references perfiles(id) on delete cascade,
  ejercicio_id uuid not null references ejercicios(id) on delete cascade,
  tecnica text not null check (tecnica in ('drop_set', 'rest_pause', 'fallo_controlado')),
  intentos int not null default 0 check (intentos >= 0),
  logradas int not null default 0 check (logradas >= 0),
  verificadas int not null default 0 check (verificadas >= 0),
  parciales int not null default 0 check (parciales >= 0),
  fallidas int not null default 0 check (fallidas >= 0),
  omitidas int not null default 0 check (omitidas >= 0),
  molestias int not null default 0 check (molestias >= 0),
  racha int not null default 0,
  confianza text not null default 'en_prueba'
    check (confianza in ('en_prueba', 'confiable', 'retroceder')),
  ultimo_resultado text,
  ultima_intervencion_id uuid references impulso_vip_intervenciones(id) on delete set null,
  ultima_intervencion_en timestamptz,
  updated_at timestamptz not null default now(),
  unique (alumno_id, ejercicio_id, tecnica)
);

create index if not exists impulso_vip_memoria_alumno_idx
  on impulso_vip_memoria_tecnicas (alumno_id, updated_at desc);

alter table impulso_vip_memoria_tecnicas enable row level security;

drop policy if exists impulso_vip_memoria_select on impulso_vip_memoria_tecnicas;
create policy impulso_vip_memoria_select on impulso_vip_memoria_tecnicas for select
  using (alumno_id = auth.uid() or es_entrenador_de(alumno_id));

drop policy if exists impulso_vip_memoria_entrenador_write on impulso_vip_memoria_tecnicas;
create policy impulso_vip_memoria_entrenador_write on impulso_vip_memoria_tecnicas for all
  using (es_entrenador_de(alumno_id))
  with check (es_entrenador_de(alumno_id));

create or replace function vip_aprender_de_intervencion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ejercicio_id uuid;
begin
  if new.estado <> 'resuelta'
     or old.estado = 'resuelta'
     or new.tipo not in ('drop_set', 'rest_pause', 'fallo_controlado')
     or new.resultado is null then
    return new;
  end if;

  select rde.ejercicio_id
    into v_ejercicio_id
  from sesion_ejercicios se
  join rutina_dia_ejercicios rde on rde.id = se.dia_ejercicio_id
  where se.id = new.sesion_ejercicio_id;

  if v_ejercicio_id is null then return new; end if;

  insert into impulso_vip_memoria_tecnicas (
    alumno_id, ejercicio_id, tecnica, intentos, logradas, verificadas,
    parciales, fallidas, omitidas, molestias, racha, confianza,
    ultimo_resultado, ultima_intervencion_id, ultima_intervencion_en
  ) values (
    new.alumno_id, v_ejercicio_id, new.tipo, 1,
    (new.resultado = 'lograda')::int,
    (new.resultado = 'lograda' and new.verificacion in ('datos', 'entrenador'))::int,
    (new.resultado = 'parcial')::int,
    (new.resultado = 'no_lograda')::int,
    (new.resultado = 'omitida')::int,
    (new.resultado = 'omitida_molestia')::int,
    case when new.resultado = 'lograda' then 1 when new.resultado = 'parcial' then 0 else -1 end,
    case when new.resultado = 'omitida_molestia' then 'retroceder' else 'en_prueba' end,
    new.resultado, new.id, coalesce(new.resuelta_en, now())
  )
  on conflict (alumno_id, ejercicio_id, tecnica) do update set
    intentos = impulso_vip_memoria_tecnicas.intentos + 1,
    logradas = impulso_vip_memoria_tecnicas.logradas + excluded.logradas,
    verificadas = impulso_vip_memoria_tecnicas.verificadas + excluded.verificadas,
    parciales = impulso_vip_memoria_tecnicas.parciales + excluded.parciales,
    fallidas = impulso_vip_memoria_tecnicas.fallidas + excluded.fallidas,
    omitidas = impulso_vip_memoria_tecnicas.omitidas + excluded.omitidas,
    molestias = impulso_vip_memoria_tecnicas.molestias + excluded.molestias,
    racha = case
      when new.resultado = 'lograda' then greatest(impulso_vip_memoria_tecnicas.racha, 0) + 1
      when new.resultado = 'parcial' then 0
      else least(impulso_vip_memoria_tecnicas.racha, 0) - 1
    end,
    confianza = case
      when new.resultado = 'omitida_molestia' then 'retroceder'
      when impulso_vip_memoria_tecnicas.intentos + 1 < 3 then 'en_prueba'
      when impulso_vip_memoria_tecnicas.fallidas + excluded.fallidas
           + impulso_vip_memoria_tecnicas.parciales + excluded.parciales
           >= ceil((impulso_vip_memoria_tecnicas.intentos + 1) * 0.5) then 'retroceder'
      when impulso_vip_memoria_tecnicas.verificadas + excluded.verificadas >= 2
           and (impulso_vip_memoria_tecnicas.logradas + excluded.logradas)::numeric
               / (impulso_vip_memoria_tecnicas.intentos + 1) >= 0.70 then 'confiable'
      else 'en_prueba'
    end,
    ultimo_resultado = new.resultado,
    ultima_intervencion_id = new.id,
    ultima_intervencion_en = coalesce(new.resuelta_en, now()),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists impulso_vip_aprender_intervencion on impulso_vip_intervenciones;
create trigger impulso_vip_aprender_intervencion
after update of estado, resultado on impulso_vip_intervenciones
for each row execute function vip_aprender_de_intervencion();

comment on table impulso_vip_memoria_tecnicas is
  'Evidencia acumulada que impide repetir a ciegas una tecnica y permite progresarla cuando el alumno demuestra dominio.';
