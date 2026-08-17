-- "Steel Fit" (masculino) existe en el selector de modo visual desde hace
-- rato (MenuAlumno.tsx, TEMAS_BOTON) y en toda la paleta de globals.css,
-- pero la migración 0024 nunca agregó 'masculino' a la restricción de la
-- columna — solo permitía 'espejo', 'vip', 'femenino'. Resultado: cualquier
-- alumno que elegía Steel Fit lo veía aplicarse un instante y volver al
-- tema anterior al recargar, porque el guardado fallaba contra esta
-- restricción y el error se tragaba en silencio (ver
-- src/app/alumno/perfil/actions.ts, guardarTemaBoton). Confirmado en vivo
-- el 2026-08-17. No toca filas existentes, solo amplía el valor permitido.
alter table alumno_perfil
  drop constraint if exists alumno_perfil_tema_boton_check;

alter table alumno_perfil
  add constraint alumno_perfil_tema_boton_check
  check (tema_boton is null or tema_boton in ('espejo', 'vip', 'femenino', 'masculino'));
