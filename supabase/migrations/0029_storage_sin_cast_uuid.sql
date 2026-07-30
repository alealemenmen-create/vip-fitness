-- Saca la conversion a uuid de TODAS las politicas de storage.objects.
--
-- POR QUE NO ALCANZO LA 0028
-- La 0028 quito el `::uuid` de las politicas del bucket `documentos`, pero
-- subir a `biblioteca/` seguia fallando con el mismo error:
--
--   invalid input syntax for type uuid: "biblioteca"
--
-- La culpable era `fotos_storage_select`, del bucket `fotos-progreso`:
--
--   bucket_id = 'fotos-progreso'
--   and ( ... or es_entrenador_de(((storage.foldername(name))[1])::uuid) )
--
-- Parece protegida por el `bucket_id = ...` de la izquierda, pero PostgreSQL
-- NO garantiza evaluar un AND de izquierda a derecha: el planificador reordena
-- por costo estimado. Al evaluar una fila del bucket `documentos` puede
-- intentar la conversion primero, y ahi aborta la sentencia entera.
--
-- Todas las politicas de select sobre storage.objects se combinan con OR, asi
-- que basta con que UNA reviente para tumbar la consulta, aunque sea de otro
-- bucket. Por eso una politica de fotos rompia la subida de documentos.
--
-- LA CORRECCION
-- Desde la migracion 0005, `es_entrenador_de(uuid)` ignora el argumento y solo
-- mira el rol de quien consulta. La conversion no restringia nada: solo era
-- una forma de fallar ante cualquier ruta que no empezara con un uuid. Se
-- reemplaza por `es_admin_o_entrenador()` en todos lados. Los permisos
-- efectivos no cambian.
--
-- Idempotente: se puede correr las veces que haga falta.

-- ---------------------------------------------------------------------
-- Bucket `documentos` (se repite lo de la 0028, por si no llego a correrse)
-- ---------------------------------------------------------------------

drop policy if exists documentos_storage_select on storage.objects;
create policy documentos_storage_select on storage.objects for select
  using (
    bucket_id = 'documentos'
    and (
      es_admin_o_entrenador()
      -- Convencion vieja: {alumno_id}/archivo.pdf
      or (storage.foldername(name))[1] = auth.uid()::text
      -- Convencion nueva: biblioteca/archivo.pdf, solo si lo tiene asignado.
      or exists (
        select 1
        from documento_asignaciones da
        join documentos d on d.id = da.documento_id
        where da.alumno_id = auth.uid()
          and d.storage_path = storage.objects.name
      )
    )
  );

drop policy if exists documentos_storage_write on storage.objects;
create policy documentos_storage_write on storage.objects for insert
  with check (
    bucket_id = 'documentos'
    and es_admin_o_entrenador()
  );

drop policy if exists documentos_storage_delete on storage.objects;
create policy documentos_storage_delete on storage.objects for delete
  using (
    bucket_id = 'documentos'
    and es_admin_o_entrenador()
  );

-- ---------------------------------------------------------------------
-- Bucket `fotos-progreso` — la que realmente estaba rompiendo todo
-- ---------------------------------------------------------------------

-- El alumno ve sus propias fotos; el entrenador, las de todos. Igual que
-- antes, pero sin convertir la ruta a uuid.
drop policy if exists fotos_storage_select on storage.objects;
create policy fotos_storage_select on storage.objects for select
  using (
    bucket_id = 'fotos-progreso'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or es_admin_o_entrenador()
    )
  );

-- Escritura y borrado de fotos: solo el propio alumno, en su carpeta. No
-- tenian cast, se redefinen igual para dejar las tres juntas y explicitas.
drop policy if exists fotos_storage_write on storage.objects;
create policy fotos_storage_write on storage.objects for insert
  with check (
    bucket_id = 'fotos-progreso'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists fotos_storage_delete on storage.objects;
create policy fotos_storage_delete on storage.objects for delete
  using (
    bucket_id = 'fotos-progreso'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
