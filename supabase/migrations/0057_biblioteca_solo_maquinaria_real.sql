-- La biblioteca, ajustada a la maquinaria que de verdad hay en VIP Fitness.
--
-- Inventario que pasó el entrenador (ver src/lib/gimnasio/inventario.ts):
-- multiestación (crossover, dos poleas ajustables, pull down, polea alta de
-- tríceps, remo con polea baja), bicicleta de spinning, banco romano, set de
-- barras 10-35 kg rectas y Z, jaula de sentadilla libre, Smith, belt squat,
-- super squat, femoral tumbado, prensa de piernas 45°, abductora/aductora
-- dual, paralelas, extensiones de cuádriceps, multihip, banco de abdominales,
-- press de pecho sentado doble agarre, press de hombro sentado doble agarre,
-- remo con pecho apoyado, hip thrust, bancos planos e inclinados, cable de
-- TRX, mancuernas 2,5-35 kg (más una de 50), colchonetas, mancuernas rusas,
-- cajones de step up y barras de dominadas de múltiples agarres.
--
-- Todo lo que exige una máquina fuera de esa lista sale de circulación. Se
-- desactiva, no se borra: las rutinas ya publicadas que lo tengan asignado
-- siguen enteras (`rutina_dia_ejercicios.ejercicio_id` sigue apuntando a una
-- fila que existe), y si el gimnasio compra la máquina se reactiva con un
-- update en vez de volver a cargarla desde cero.

-- 1. El TRX se llama como lo llama el entrenador. El nombre no es decorativo:
--    es el que lee el alumno en su rutina y el que escucha en la sala.
update ejercicios
set nombre = 'TRX profundo',
    aliases = array['trx', 'trx profundo', 'suspensión', 'suspension']
where slug = 'trx-funcional';

-- 2. Máquinas que no están en la sala.
update ejercicios
set activo = false
where activo
  and nombre in (
    -- Confirmado por el entrenador: no está.
    'Remo ergómetro',
    -- No hay máquina de crunch abdominal; el abdomen se trabaja en el banco
    -- de abdominales y en colchoneta.
    'Crunch en máquina',
    -- No hay pec deck ni su versión invertida. El pecho en máquina se hace en
    -- el press de pecho sentado, y el posterior de hombro en poleas.
    'Pec deck',
    'Reverse pec deck',
    -- No hay remo en T ni una segunda máquina de remo: está el remo con pecho
    -- apoyado ("Remo en máquina") y el remo en polea baja.
    'Remo en T',
    -- No hay máquina de press inclinado. El inclinado se hace con barra en la
    -- jaula, o con mancuernas en los bancos inclinados.
    'Press inclinado en máquina',
    -- No hay máquinas de gemelos. Quedan los gemelos en prensa.
    'Elevación de gemelos de pie',
    'Elevación de gemelos sentado',
    -- El femoral que hay es tumbado. No hay sentado ni de pie.
    'Curl femoral sentado',
    'Curl femoral de pie'
  );
