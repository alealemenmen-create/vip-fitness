-- Técnica aplicada a series puntuales, no a todo el ejercicio.
--
-- Hoy `tecnica_tipo` es un solo texto por ejercicio: si el entrenador pone
-- "Drop set", la app entiende que va en TODAS las series. Pero en la práctica
-- casi siempre va en una sola —la última— o en dos. Alejandro lo pidió así:
-- ver los numeritos de las series (1, 2, 3, 4) al lado del selector de técnica
-- y marcar con el dedo cuáles llevan la técnica.
--
-- Esta migración agrega SOLO el dato. No cambia ningún comportamiento por sí
-- sola: sin código que lea la columna, todo sigue funcionando exactamente
-- igual que antes.
--
-- Retrocompatibilidad (lo importante):
--   `tecnica_series` NULL  = la técnica va en todas las series.
--   Es el default, y es lo que tienen TODAS las filas que ya existen. Por eso
--   no hay backfill ni UPDATE masivo: ninguna rutina publicada cambia.
--   `tecnica_series` = '{4}' = la técnica va solo en la serie 4.
--
-- Por qué int[] y no una tabla aparte ni jsonb:
--   - Una tabla `rutina_dia_ejercicio_tecnicas` sería lo "correcto" si un
--     ejercicio pudiera llevar VARIAS técnicas distintas en series distintas
--     (drop set en la 4, rest-pause en la 3). Hoy no puede: `tecnica_tipo` es
--     uno solo. Modelar para un caso que no existe agrega un join a la
--     consulta más caliente de la app (la pantalla de entrenar) a cambio de
--     nada. Si algún día hacen falta varias técnicas, esta columna se migra a
--     esa tabla sin drama — el dato ya está normalizado por número de serie.
--   - jsonb no aporta nada acá y pierde el chequeo de tipos.
--
-- NO se toca `tecnica_tipo` ni `tecnica_instruccion`. En particular, las
-- técnicas encadenadas (superserie, biserie, circuito, giant set) siguen
-- viviendo en el texto libre con su "(n/total)" — ver
-- `src/lib/entrenamiento/tecnica-grupo.ts`. Esas encadenan EJERCICIOS entre
-- sí, no series adentro de un ejercicio, así que esta columna no las alcanza:
-- para ellas debe quedar en NULL. El chequeo de abajo no lo puede impedir
-- (haría falta parsear texto libre dentro de un CHECK, que es peor remedio
-- que la enfermedad), así que es responsabilidad del editor no ofrecerlo.

-- El CHECK necesita mirar `series_programadas` de la misma fila. Un CHECK no
-- admite subconsultas, así que la validación va en una función inmutable.
create or replace function vip_tecnica_series_valida(series int[], programadas int)
returns boolean
language sql
immutable
parallel safe
as $$
  select series is null
     or (
       -- Un array vacío significaría "en ninguna serie", que es lo mismo que
       -- no tener técnica: se guarda NULL, no '{}'. Una sola forma de decir
       -- cada cosa.
       cardinality(series) > 0
       -- Sin nulos adentro, sin repetidos, y todos dentro del rango real de
       -- series del ejercicio. Marcar la serie 5 de un ejercicio de 4 es un
       -- bug del editor, no un dato que haya que aceptar y después limpiar.
       and not exists (select 1 from unnest(series) s where s is null)
       and cardinality(series) = cardinality(array(select distinct unnest(series)))
       and (select min(s) from unnest(series) s) >= 1
       and (select max(s) from unnest(series) s) <= programadas
     );
$$;

comment on function vip_tecnica_series_valida(int[], int) is
  'Valida rutina_dia_ejercicios.tecnica_series contra series_programadas de la misma fila.';

alter table rutina_dia_ejercicios
  add column if not exists tecnica_series int[];

comment on column rutina_dia_ejercicios.tecnica_series is
  'Números de serie (base 1) donde se aplica tecnica_tipo. NULL = todas las series (comportamiento histórico). Debe quedar NULL en técnicas encadenadas (superserie/biserie/circuito/giant set).';

-- `not valid` a propósito: valida las filas nuevas desde ya, pero no bloquea
-- la migración recorriendo toda la tabla. Como la columna nace en NULL para
-- todo lo existente, no hay nada que pueda fallar — se valida abajo, ya sin
-- lock de escritura fuerte.
alter table rutina_dia_ejercicios
  drop constraint if exists rutina_dia_ejercicios_tecnica_series_ck;

alter table rutina_dia_ejercicios
  add constraint rutina_dia_ejercicios_tecnica_series_ck
  check (vip_tecnica_series_valida(tecnica_series, series_programadas))
  not valid;

alter table rutina_dia_ejercicios
  validate constraint rutina_dia_ejercicios_tecnica_series_ck;

-- Sin índice: no hay ninguna consulta que filtre por esta columna. Siempre se
-- lee junto con el resto del ejercicio, por `dia_id`, que ya está indexado.
-- RLS: se hereda de la tabla, que ya la tiene habilitada desde 0001. Las
-- políticas son por fila, no por columna, así que no hay nada que agregar.
