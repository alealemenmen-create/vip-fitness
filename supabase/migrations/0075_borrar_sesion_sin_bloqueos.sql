-- Que borrar un registro de entrenamiento no choque contra Impulso VIP.
--
-- Alejandro pidió un botón para eliminar una sesión registrada por error ("la
-- persona llegue y haga la rutina y la marque hecha sin querer"). Borrar la
-- fila de `sesiones_entrenamiento` arrastra en cascada sus `sesion_ejercicios`
-- y sus `series_realizadas` — eso ya estaba bien desde la 0001.
--
-- Pero hay dos referencias a `sesion_ejercicios` **sin `on delete`**, o sea con
-- el NO ACTION de Postgres, que hacen fallar el borrado entero:
--
--   1. `impulso_vip_recomendaciones.basado_en_sesion_ejercicio_id` — la
--      trazabilidad de "de qué sesión salió este cálculo". Si el alumno ya
--      entrenó de nuevo, la recomendación NUEVA apunta a la sesión vieja, y
--      borrar la vieja tira error de clave foránea.
--   2. `impulso_vip_alertas.sesion_ejercicio_id` — si reportó dolor en esa
--      sesión, la alerta la sostiene igual.
--
-- Sin esto, el botón "Eliminar registro" fallaría justo en los casos más
-- comunes (alguien que entrena seguido, alguien que reportó una molestia) y
-- quedaría muerto como el "Sí, corregir" de antes.
--
-- `set null` y no `cascade`: son datos que apuntan a la sesión, no que le
-- pertenecen. Una recomendación aprobada o una alerta de dolor no deben
-- desaparecer porque se borró el registro del que salieron — pierden la
-- referencia y se quedan. Las columnas ya son nulables.

do $$
declare
  v_nombre text;
begin
  -- Por nombre de columna y no por nombre de constraint: los nombres
  -- automáticos de Postgres se truncan a 63 caracteres y adivinarlos es
  -- pedirle a la migración que falle en silencio.
  select con.conname into v_nombre
  from pg_constraint con
  join pg_attribute att
    on att.attrelid = con.conrelid
   and att.attnum = con.conkey[1]
  where con.conrelid = 'impulso_vip_recomendaciones'::regclass
    and con.contype = 'f'
    and att.attname = 'basado_en_sesion_ejercicio_id';

  if v_nombre is not null then
    execute format(
      'alter table impulso_vip_recomendaciones drop constraint %I',
      v_nombre
    );
  end if;

  alter table impulso_vip_recomendaciones
    add constraint impulso_vip_recomendaciones_basado_en_fkey
    foreign key (basado_en_sesion_ejercicio_id)
    references sesion_ejercicios(id) on delete set null;
end $$;

do $$
declare
  v_nombre text;
begin
  select con.conname into v_nombre
  from pg_constraint con
  join pg_attribute att
    on att.attrelid = con.conrelid
   and att.attnum = con.conkey[1]
  where con.conrelid = 'impulso_vip_alertas'::regclass
    and con.contype = 'f'
    and att.attname = 'sesion_ejercicio_id';

  if v_nombre is not null then
    execute format('alter table impulso_vip_alertas drop constraint %I', v_nombre);
  end if;

  alter table impulso_vip_alertas
    add constraint impulso_vip_alertas_sesion_ejercicio_fkey
    foreign key (sesion_ejercicio_id)
    references sesion_ejercicios(id) on delete set null;
end $$;
