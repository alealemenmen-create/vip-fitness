-- Pedido de Alejandro (2026-08-22): al sacar el bloqueo de "cupo de
-- sesiones agotado" del lado del alumno (portal-v2 y clásico ya no impiden
-- iniciar un día nuevo aunque se acaben las sesiones del plan), el
-- entrenador tiene que enterarse igual para decidir a mano si bloquea o le
-- suma sesiones extra. Ver `crearNotificacionEntrenador` en
-- `finalizarSesion` (src/app/alumno/entrenar/actions.ts).

alter table notificaciones_entrenador drop constraint if exists notificaciones_entrenador_tipo_check;
alter table notificaciones_entrenador add constraint notificaciones_entrenador_tipo_check
  check (tipo in ('habito_comida', 'habito_entrenamiento', 'bug', 'resena', 'foto_reporte', 'cupo_agotado'));
