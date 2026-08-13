-- Trazabilidad minima por serie para que Impulso VIP pueda decidir en vivo.
-- No convierte el entrenamiento en un cuestionario: RIR y calidad quedan
-- opcionales y se piden solo cuando el motor necesita calibrar una
-- intervencion. Los tiempos y el origen se registran automaticamente.

alter table series_realizadas
  add column if not exists realizada_en timestamptz,
  add column if not exists rir_estimado smallint
    check (rir_estimado is null or rir_estimado between 0 and 5),
  add column if not exists calidad_tecnica text
    check (calidad_tecnica is null or calidad_tecnica in ('limpia', 'forzada', 'rota')),
  add column if not exists origen_registro text not null default 'directo'
    check (origen_registro in ('directo', 'confirmado_sin_datos', 'corregido')),
  add column if not exists updated_at timestamptz not null default now();

comment on column series_realizadas.rir_estimado is
  'Repeticiones que el alumno sintio que aun podia realizar (0-5). Opcional y solicitada solo en series de calibracion.';
comment on column series_realizadas.origen_registro is
  'Calidad temporal del dato: directo, confirmado sin numeros o corregido posteriormente.';

create or replace function vip_trazar_serie_realizada()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at := now();

  if tg_op = 'INSERT' then
    if new.realizada and new.realizada_en is null then
      new.realizada_en := now();
    end if;
    if new.realizada and new.peso_kg is null and new.reps_realizadas is null
       and not new.es_peso_corporal then
      new.origen_registro := 'confirmado_sin_datos';
    end if;
    return new;
  end if;

  if new.realizada and not old.realizada and new.realizada_en is null then
    new.realizada_en := now();
  elsif not new.realizada then
    new.realizada_en := null;
  end if;

  -- Cambiar solo RIR/calidad no convierte el levantamiento en corregido.
  if old.realizada and (
    old.peso_kg is distinct from new.peso_kg
    or old.reps_realizadas is distinct from new.reps_realizadas
    or old.es_peso_corporal is distinct from new.es_peso_corporal
    or old.realizada is distinct from new.realizada
  ) then
    new.origen_registro := 'corregido';
  elsif new.realizada and new.peso_kg is null and new.reps_realizadas is null
        and not new.es_peso_corporal then
    new.origen_registro := 'confirmado_sin_datos';
  end if;

  return new;
end;
$$;

drop trigger if exists series_realizadas_trazabilidad on series_realizadas;
create trigger series_realizadas_trazabilidad
before insert or update on series_realizadas
for each row execute function vip_trazar_serie_realizada();

-- Las intervenciones preparadas todavia no fueron vistas: la calibracion de
-- la penultima serie puede ajustar su instruccion. Una vez mostradas quedan
-- congeladas para que el historial conserve exactamente lo que vio el alumno.
