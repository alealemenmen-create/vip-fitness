-- Movimientos de cardio funcional que faltaban en la biblioteca.
--
-- El generador dejó de preguntar "cardio bajo/moderado/alto" (una intensidad
-- abstracta con la que no se arma nada) y ahora pide la modalidad concreta:
-- bicicleta de spinning, caminadora, steps o circuito funcional.
--
-- Las máquinas ya estaban cargadas (Bicicleta estática, Caminadora, Elíptica,
-- Escaladora, Step, Remo ergómetro), igual que Burpees, Salto a la cuerda y
-- Battle rope — esas NO se vuelven a insertar para no dejar duplicados en una
-- biblioteca que el gimnasio curó a mano. Acá van solo los que el entrenador
-- nombró y no existían.
--
-- `on conflict (slug) do nothing`: si alguno se cargó a mano mientras tanto,
-- gana el que ya está. Los `aliases` son para el emparejador de rutinas
-- importadas desde PDF, que busca por nombre y por alias.

insert into ejercicios
  (slug, nombre, aliases, grupo_muscular, categoria, equipo, nivel, descripcion_corta,
   impacto, requiere_salto, complejidad, posicion_sesion, apto_circuito)
values
  ('jumping-jacks', 'Jumping jacks', array['jumping jack','saltos de tijera','polichinelas'],
   'cardio', 'cardio', 'peso_corporal', 'principiante',
   'Saltos abriendo y cerrando piernas y brazos. Buena estación de entrada al circuito.',
   'alto', true, 'baja', 'cardio', true),

  ('sentadilla-con-salto', 'Sentadilla con salto', array['squat jump','jump squat','sentadilla salto'],
   'cardio', 'cardio', 'peso_corporal', 'intermedio',
   'Sentadilla explosiva terminando en salto. Exige rodilla y tobillo.',
   'alto', true, 'media', 'cardio', true),

  ('slam-ball', 'Slam ball', array['slamball','balón medicinal','balon medicinal','pelota al piso'],
   'cardio', 'cardio', 'otro', 'intermedio',
   'Lanzar el balón al piso con fuerza y recogerlo. Sin salto: apto para más gente.',
   'medio', false, 'media', 'cardio', true),

  ('wall-ball', 'Wall ball', array['wallball','balón a la pared','balon a la pared'],
   'cardio', 'cardio', 'otro', 'intermedio',
   'Sentadilla y lanzamiento del balón a la pared. Combina pierna y hombro.',
   'medio', false, 'media', 'cardio', true),

  ('mountain-climber', 'Mountain climber', array['mountain climbers','escaladores en plancha','rodillas al pecho'],
   'cardio', 'cardio', 'peso_corporal', 'principiante',
   'Desde plancha, alternar rodillas al pecho a ritmo alto. Exige core.',
   'medio', false, 'baja', 'cardio', true),

  ('trx-funcional', 'Circuito en TRX', array['trx','suspensión','suspension','entrenamiento en suspensión'],
   'cardio', 'cardio', 'otro', 'intermedio',
   'Trabajo continuo en TRX. La intensidad se regula con el ángulo del cuerpo.',
   'bajo', false, 'media', 'cardio', true)

on conflict (slug) do nothing;
