-- El entrenador propone un torneo entre alumnos elegidos; cada uno tiene que
-- aceptar o rechazar antes de competir de verdad. El torneo se anuncia
-- públicamente a TODOS los alumnos apenas se crea (no hace falta aceptar
-- para que se sepa que existe) — solo los invitados ven los botones de
-- aceptar/rechazar. Al cerrar, solo se reparten puntos entre los que
-- aceptaron.
create type torneo_participante_estado as enum ('pendiente', 'aceptado', 'rechazado');

alter table torneo_participantes
  add column estado torneo_participante_estado not null default 'pendiente';

-- Hora (además de la fecha) de inicio/fin, para la cuenta regresiva que
-- ve el alumno — ambas opcionales, si no se cargan se muestra solo la fecha.
alter table torneos
  add column hora_inicio time,
  add column hora_fin time;
