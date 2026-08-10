-- Antifraude de entrenamiento.
--
-- Los alumnos siguen pudiendo LEER sus sesiones mediante RLS, pero ya no
-- pueden escribir directamente en las tablas con el token del navegador.
-- Toda mutación pasa por Server Actions que revalidan alumno, rutina activa,
-- sesión abierta, ejercicio asignado y límites numéricos antes de usar el
-- cliente service_role. No modifica ni recalcula ningún dato histórico.

revoke insert, update, delete on table public.sesiones_entrenamiento from authenticated;
revoke insert, update, delete on table public.sesion_ejercicios from authenticated;
revoke insert, update, delete on table public.series_realizadas from authenticated;
revoke insert, update, delete on table public.sesiones_entrenamiento from anon;
revoke insert, update, delete on table public.sesion_ejercicios from anon;
revoke insert, update, delete on table public.series_realizadas from anon;

grant select on table public.sesiones_entrenamiento to authenticated;
grant select on table public.sesion_ejercicios to authenticated;
grant select on table public.series_realizadas to authenticated;

comment on table public.puntos_vip_movimientos is
  'Fuente de verdad del ranking. Sin políticas de escritura para alumnos; las recompensas se registran exclusivamente en servidor.';
