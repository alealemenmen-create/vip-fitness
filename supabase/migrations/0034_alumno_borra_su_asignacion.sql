-- El alumno puede quitar un plan de "Mis planes" (solo su propia fila).
--
-- La política de escritura de 0027 (`documento_asignaciones_write`) es
-- `for all` y exige `es_admin_o_entrenador()`, así que un alumno normal no
-- podía borrar ni su propia asignación: el DELETE pasaba sin error pero sin
-- afectar filas (RLS lo filtra en silencio). Esta política nueva es aditiva
-- y solo cubre DELETE — el alumno sigue sin poder insertar ni actualizar
-- asignaciones, solo quitarse a sí mismo de una.

drop policy if exists documento_asignaciones_delete_propia on documento_asignaciones;
create policy documento_asignaciones_delete_propia on documento_asignaciones for delete
  using (alumno_id = auth.uid());
