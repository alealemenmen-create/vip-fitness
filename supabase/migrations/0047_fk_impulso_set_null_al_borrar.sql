-- `impulso_vip_recomendaciones.basado_en_sesion_ejercicio_id` e
-- `impulso_vip_alertas.sesion_ejercicio_id` son referencias de trazabilidad
-- hacia `sesion_ejercicios`, no relaciones que deban impedir un borrado. Sin
-- "on delete set null" (quedaron con el default "no action" al crearse en
-- 0043), borrar una sesion vieja fallaba entero con violacion de foreign key
-- en cuanto una sesion mas nueva la referenciaba como "basada en" — visto dos
-- veces ya: una probando el borrado selectivo del historial (revertido) y de
-- nuevo limpiando sesiones de prueba a mano.
--
-- Se busca el nombre real de cada constraint por nombre de columna (no se
-- asume el nombre autogenerado) para no fallar si Postgres lo nombro distinto.
do $$
declare
  c record;
begin
  for c in
    select tc.table_name, tc.constraint_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
    where tc.constraint_type = 'FOREIGN KEY'
      and tc.table_schema = 'public'
      and (
        (tc.table_name = 'impulso_vip_recomendaciones' and kcu.column_name = 'basado_en_sesion_ejercicio_id')
        or
        (tc.table_name = 'impulso_vip_alertas' and kcu.column_name = 'sesion_ejercicio_id')
      )
  loop
    execute format('alter table public.%I drop constraint %I', c.table_name, c.constraint_name);
  end loop;
end $$;

alter table impulso_vip_recomendaciones
  add constraint impulso_vip_recomendaciones_basado_en_sesion_ejercicio_id_fkey
  foreign key (basado_en_sesion_ejercicio_id) references sesion_ejercicios(id) on delete set null;

alter table impulso_vip_alertas
  add constraint impulso_vip_alertas_sesion_ejercicio_id_fkey
  foreign key (sesion_ejercicio_id) references sesion_ejercicios(id) on delete set null;
