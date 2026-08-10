-- Máquinas cargadas en la biblioteca que VIP Fitness no tiene.
--
-- El entrenador lo dijo directo: en la sala no hay caminadora, trotadora,
-- elíptica ni escaladora. Bicicleta estática sí hay. Estaban en el catálogo
-- de todos modos, así que el generador las podía elegir y la revisión de IA
-- las podía proponer — y el alumno terminaba leyendo una rutina con una
-- máquina que no existe, que es la forma más rápida de que deje de creerle al
-- plan.
--
-- Se desactivan, no se borran: `activo = false` las saca de la biblioteca
-- (que ya filtra por `activo`) sin romper las rutinas viejas que las tengan
-- asignadas — `rutina_dia_ejercicios.ejercicio_id` sigue apuntando a una fila
-- que existe. Si algún día el gimnasio compra una, se reactiva con un update.

update ejercicios
set activo = false
where activo
  and (
    lower(nombre) like '%caminadora%'
    or lower(nombre) like '%trotadora%'
    or lower(nombre) like '%cinta de correr%'
    or lower(nombre) like '%elíptica%'
    or lower(nombre) like '%eliptica%'
    or lower(nombre) like '%escaladora%'
    or lower(nombre) like '%escalador%'
  );
