-- Los descansos dejan de ocupar un número de sesión, también en el pasado.
--
-- El código ya no crea sesiones de descanso (ver `ciclo-sesiones.ts`), pero
-- las que quedaron registradas con la regla vieja siguen tomando un número y
-- le rompen la cuenta al alumno: en la rutina de Diana se ve
-- "SESIÓN 1, 2, 3, DESC., 5" — no hay sesión 4, y el mes le cierra en 19
-- clases en vez de 20.
--
-- Alejandro, textual: "son las veinte sesiones, son veinte clases que viene
-- realmente al gimnasio, no que descansa en su casa". El número de sesión
-- cuenta visitas al gimnasio. Un descanso no es una visita.
--
-- Qué hace, en dos pasos:
--   1. Les saca el número a las sesiones de descanso. La fila NO se borra:
--      el descanso registrado sigue en el historial del alumno, con su fecha
--      y su día. Solo deja de ocupar un casillero.
--   2. Compacta los números que quedan para que vuelvan a ser 1..N sin
--      huecos. Sin esto, a Diana le quedaría el 4 vacío y el 5 hecho, que se
--      lee peor que el problema original.
--
-- Qué NO cambia: `dia_id` de cada sesión queda intacto, y la pantalla ya
-- muestra el día guardado en la sesión y no el que calcularía la rueda (ver
-- `obtenerNumerosCalendario`). O sea, el historial sigue diciendo la verdad
-- de qué entrenó cada día.
--
-- Efecto esperado y aceptado: un alumno que tenía descansos registrados va a
-- ver su próxima sesión correr un lugar, una sola vez. Es el precio de
-- ordenar la numeración, y es lo que se pidió.

-- Paso 1. El índice único es parcial (`where numero_calendario is not null`,
-- migración 0007), así que dejar varios en null no choca entre sí.
update sesiones_entrenamiento s
set numero_calendario = null
from rutina_dias d
where d.id = s.dia_id
  and d.tipo = 'descanso'
  and s.numero_calendario is not null;

-- Paso 2. Compactar a 1..N por alumno y rutina, respetando el orden que ya
-- tenían.
--
-- Va en dos pasadas por el índice único: Postgres lo verifica fila por fila
-- dentro del UPDATE, así que asignar los definitivos de una sola vez puede
-- chocar contra un número que todavía no se movió (el 5 pasa a 4 mientras el
-- 4 sigue siendo 4). Primero se manda todo a negativos —que el índice acepta
-- igual y ninguna fila real usa— y después se les da vuelta el signo.
with orden as (
  select
    id,
    -row_number() over (
      partition by alumno_id, rutina_id
      order by numero_calendario
    ) as provisorio
  from sesiones_entrenamiento
  where numero_calendario is not null
)
update sesiones_entrenamiento s
set numero_calendario = orden.provisorio
from orden
where orden.id = s.id;

update sesiones_entrenamiento
set numero_calendario = -numero_calendario
where numero_calendario < 0;
