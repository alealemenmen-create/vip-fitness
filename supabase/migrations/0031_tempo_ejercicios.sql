-- Tempo por ejercicio, decidido por IA una sola vez.
--
-- El tempo (cuánto dura cada fase de la repetición) es de lo que más mueve la
-- aguja en hipertrofia, pero casi ninguna rutina que sube el entrenador lo
-- trae escrito. En vez de pedirle que lo complete a mano en 70 ejercicios, se
-- deduce del propio movimiento: la biblioteca ya sabe el grupo muscular, el
-- patrón, el equipo y el nivel de cada uno, que es exactamente lo que
-- determina el tempo ideal.
--
-- Vive en `ejercicios` (la biblioteca) y NO en `rutina_dia_ejercicios` a
-- propósito: el tempo es del movimiento, no de la rutina. Se calcula una vez
-- por ejercicio y lo reutilizan todas las rutinas de todos los alumnos —
-- ~70 llamadas a la IA en total, para siempre.
--
-- Si la rutina SÍ trae tempo escrito (en la observación del entrenador), ese
-- manda: ver src/lib/ejercicios/tempo.ts. Esta columna es solo el respaldo
-- para los ejercicios que no lo traen.

alter table ejercicios
  -- Las cuatro fases en notación estándar "excéntrica-pausa abajo-concéntrica-pausa arriba",
  -- en segundos. Ejemplo: "3-1-1-0" = bajar en 3s, 1s de pausa abajo, subir en
  -- 1s, sin pausa arriba. Null = todavía no calculado.
  add column if not exists tempo text,
  -- Una línea explicando por qué ese tempo para ese ejercicio, para que el
  -- alumno entienda qué está haciendo en vez de obedecer números.
  add column if not exists tempo_nota text,
  -- De dónde salió: 'ia' (deducido), 'entrenador' (escrito a mano). Sirve para
  -- no volver a pisar con IA algo que el entrenador ya corrigió.
  add column if not exists tempo_origen text
    check (tempo_origen is null or tempo_origen in ('ia', 'entrenador'));

comment on column ejercicios.tempo is
  'Tempo en segundos por fase: excentrica-pausa_abajo-concentrica-pausa_arriba (ej. "3-1-1-0").';
