-- Una sesión abandonada que el alumno corrigió vuelve a contar para Impulso VIP.
--
-- El motor arma sus metas mirando solo sesiones `completada` o
-- `finalizada_incompleta` (ver ESTADOS_HISTORIAL_VALIDOS): una abandonada no
-- cuenta, igual que no cuenta para los puntos. Eso está bien como regla
-- general — se abandonó, no se cobra.
--
-- Pero el 1.21 abrió las abandonadas a "Corregir registro", justamente porque
-- "se abandona por error más seguido de lo que parece". Quedó la
-- contradicción: el alumno podía arreglar los kilos de una sesión abandonada y
-- el motor seguía ignorándolos. Los datos estaban ahí, corregidos a mano, y no
-- servían para nada.
--
-- `corrigiendo_desde` (0077) no alcanza para esto: es una marca de trabajo en
-- curso, se limpia al terminar la corrección y no deja rastro de que pasó.
-- Esta columna sí es histórica — se pone al abrir la corrección y no se borra.
--
-- `null` = nunca se corrigió, que es el estado de todas las filas de hoy y
-- deja el comportamiento anterior intacto. Sigue sin devolver los puntos que
-- `abandonarSesion` retiró: se recupera lo que el alumno levantó, no la
-- recompensa.

alter table sesiones_entrenamiento
  add column if not exists corregida_en timestamptz;

comment on column sesiones_entrenamiento.corregida_en is
  'Cuándo el alumno corrigió este registro por primera vez. A diferencia de corrigiendo_desde, no se limpia: es la constancia de que los números se revisaron a mano. Una sesión abandonada con esta marca vuelve a contar como historial para Impulso VIP.';
