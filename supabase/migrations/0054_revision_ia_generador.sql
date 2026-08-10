-- Revisión de IA sobre el borrador del generador.
--
-- El motor de reglas sigue eligiendo los ejercicios; esta columna guarda la
-- auditoría posterior (veredicto, hallazgos y cambios propuestos) para poder
-- reconstruir después por qué se publicó una rutina con tal ajuste, o por qué
-- se ignoró una alerta. Es opcional: un borrador sin revisar la deja en null.

alter table borradores_generador_rutinas
  add column if not exists revision_ia jsonb;

comment on column borradores_generador_rutinas.revision_ia is
  'Auditoría de IA del borrador: veredicto, hallazgos y cambios sugeridos. La IA nunca genera la rutina, solo la revisa contra la ficha del alumno.';
