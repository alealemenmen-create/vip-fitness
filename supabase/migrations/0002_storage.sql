-- Buckets privados para documentos (PDF) y fotos de progreso.
-- Ambos bucket son NO publicos: todo acceso pasa por URLs firmadas + RLS.
-- Convencion de rutas: {alumno_id}/{archivo}, asi las policies pueden
-- comparar el primer segmento de la ruta contra auth.uid().

insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('fotos-progreso', 'fotos-progreso', false)
on conflict (id) do nothing;

-- documentos: el alumno lee las suyas, el entrenador lee/escribe las de sus alumnos.
create policy documentos_storage_select on storage.objects for select
  using (
    bucket_id = 'documentos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or es_entrenador_de(((storage.foldername(name))[1])::uuid)
    )
  );

create policy documentos_storage_write on storage.objects for insert
  with check (
    bucket_id = 'documentos'
    and es_entrenador_de(((storage.foldername(name))[1])::uuid)
  );

create policy documentos_storage_delete on storage.objects for delete
  using (
    bucket_id = 'documentos'
    and es_entrenador_de(((storage.foldername(name))[1])::uuid)
  );

-- fotos-progreso: privadas del alumno, visibles tambien para su entrenador.
create policy fotos_storage_select on storage.objects for select
  using (
    bucket_id = 'fotos-progreso'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or es_entrenador_de(((storage.foldername(name))[1])::uuid)
    )
  );

create policy fotos_storage_write on storage.objects for insert
  with check (
    bucket_id = 'fotos-progreso'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy fotos_storage_delete on storage.objects for delete
  using (
    bucket_id = 'fotos-progreso'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
