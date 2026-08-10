-- Un nombre por movimiento: se unifican los duplicados en el ejercicio original.
--
-- La biblioteca original que cargó el entrenador son los ejercicios que tienen
-- ilustración propia (`ilustracion_slug`, un .webp en public/ejercicios). Los
-- duplicados aparecieron después, al subir rutinas que llamaban al mismo
-- movimiento de otra forma: "Bench press" por "Press de banca", "Elevación
-- lateral en polea" por "Elevaciones laterales en polea". Ninguno tiene
-- ilustración, y ninguno lo usa ninguna rutina publicada (verificado: 0 filas
-- en rutina_dia_ejercicios para los diez), así que la unificación no rompe
-- nada de lo que ya está entregado.
--
-- Por qué importaba: el motor los veía como ejercicios DISTINTOS. Al repartir
-- la semana creía que estaba variando el estímulo cuando en realidad le estaba
-- dando al alumno la misma elevación lateral en polea tres veces con tres
-- nombres. La variedad era falsa.
--
-- El paso que evita que vuelva a pasar son los ALIAS, no la desactivación: el
-- emparejador de rutinas importadas busca por nombre y por alias, así que la
-- próxima vez que un PDF diga "Bench press" va a caer en "Press de banca" en
-- vez de quedar suelto.

-- 1. Cada nombre alternativo pasa a ser alias del ejercicio bueno.
update ejercicios set aliases = aliases || array['extensiones de tríceps en polea']
  where slug = 'extension-triceps-polea';

update ejercicios set aliases = aliases || array['jalón con cuerda', 'jalon con cuerda']
  where slug = 'pushdown-cuerda';

update ejercicios set aliases = aliases || array[
    'elevación lateral en polea', 'elevacion lateral en polea',
    'elevación lateral en polea unilateral', 'elevacion lateral en polea unilateral',
    'elevaciones laterales en polea unilateral',
    'elevación unilateral con cable', 'elevacion unilateral con cable'
  ]
  where slug = 'elevaciones-laterales-polea';

update ejercicios set aliases = aliases || array['bench press']
  where slug = 'press-banca';

update ejercicios set aliases = aliases || array['hack en super squat', 'super squat']
  where slug = 'sentadilla-hack';

update ejercicios set aliases = aliases || array['sentadilla sin peso', 'sentadilla peso corporal']
  where slug = 'sentadilla';

-- 2. Los duplicados salen de circulación. Se desactivan, no se borran: así el
--    historial queda intacto y se puede revertir con un update.
update ejercicios
set activo = false
where slug in (
  'extensiones-de-triceps-en-polea',
  'jalon-con-cuerda-2',
  'elevacion-lateral-en-polea',
  'elevacion-lateral-en-polea-2',
  'elevacion-lateral-en-polea-unilateral',
  'elevaciones-laterales-en-polea-unilateral',
  'elevacion-unilateral-con-cable',
  'bench-press',
  'hack-en-super-squat',
  'sentadilla-sin-peso'
);
