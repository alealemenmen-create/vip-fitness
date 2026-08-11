-- Nuevo tipo de hallazgo: `series_sin_registro`.
--
-- Son series marcadas como hechas pero sin un solo dato cargado (ni kilos ni
-- repeticiones). Es lo que queda cuando se cierra un ejercicio con el boton
-- "Completar y guardar" teniendo series pendientes: la sesion puntua igual.
-- No se penaliza solo — se le muestra al entrenador para que decida, igual
-- que el resto de la auditoria.
--
-- Sin esto, descartar o penalizar el hallazgo nuevo falla con violacion de
-- restriccion (el check de 0046 solo acepta los dos tipos originales).
--
-- `rutina_activa_deficiente` se agrega tambien por prolijidad: hoy nunca
-- llega a insertarse porque `registrarRevision` lo bloquea antes a proposito
-- (las rutinas se corrigen reemplazandolas, no descartando el aviso), pero
-- dejar el check al dia evita una sorpresa si esa decision cambia.

alter table auditoria_revisiones drop constraint if exists auditoria_revisiones_tipo_check;

alter table auditoria_revisiones add constraint auditoria_revisiones_tipo_check
  check (tipo in (
    'sesion_duracion_imposible',
    'puntos_entrenamiento_huerfanos',
    'rutina_activa_deficiente',
    'series_sin_registro'
  ));
