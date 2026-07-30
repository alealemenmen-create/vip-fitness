-- Politicas de Storage para la carpeta comun `biblioteca/`.
--
-- EL BUG QUE ARREGLA
-- La seccion Documentos (migracion 0027) sube los archivos a `biblioteca/`,
-- una carpeta compartida, porque el mismo PDF puede quedar asignado a varios
-- alumnos sin duplicarse. Pero las politicas de la 0002 asumian la convencion
-- vieja `{alumno_id}/archivo.pdf` y convertian el primer segmento de la ruta
-- a uuid:
--
--   es_entrenador_de(((storage.foldername(name))[1])::uuid)
--
-- Con una ruta como `biblioteca/rutina-1753908000.pdf` ese primer segmento es
-- el texto "biblioteca", la conversion a uuid falla y Postgres aborta la
-- sentencia entera. En la app se veia como "No fue posible subir el archivo.
-- Revisa tu conexion e intenta nuevamente", que apuntaba a la red y mandaba a
-- buscar el problema al lugar equivocado.
--
-- Rompia las DOS puntas de la funcion:
--   * la subida del entrenador (insert), y
--   * el enlace del alumno, porque `createSignedUrl` necesita permiso de select.
--
-- POR QUE LA CONVERSION SE VA DEL TODO
-- Desde la migracion 0005, `es_entrenador_de(uuid)` ignora el argumento que
-- recibe y solo mira el rol de quien consulta. O sea que ese `::uuid` no
-- aportaba ninguna restriccion desde entonces: solo era una forma de fallar.
-- Se reemplaza por `es_admin_o_entrenador()`, que dice lo mismo sin tocar la
-- ruta. Los permisos efectivos no cambian.
--
-- Idempotente: se puede correr las veces que haga falta.

-- Lectura: el entrenador ve todo el bucket; el alumno, lo suyo — tanto por la
-- convencion vieja de carpeta como por asignacion en la biblioteca.
drop policy if exists documentos_storage_select on storage.objects;
create policy documentos_storage_select on storage.objects for select
  using (
    bucket_id = 'documentos'
    and (
      es_admin_o_entrenador()
      -- Convencion vieja: {alumno_id}/archivo.pdf
      or (storage.foldername(name))[1] = auth.uid()::text
      -- Convencion nueva: biblioteca/archivo.pdf. El alumno lo ve solo si
      -- tiene una asignacion que apunta a ese archivo.
      or exists (
        select 1
        from documento_asignaciones da
        join documentos d on d.id = da.documento_id
        where da.alumno_id = auth.uid()
          and d.storage_path = storage.objects.name
      )
    )
  );

-- Escritura y borrado: solo entrenador o admin, en cualquier ruta del bucket.
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
