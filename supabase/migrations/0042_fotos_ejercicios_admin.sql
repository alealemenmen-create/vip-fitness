-- Fotos de ejercicios subidas desde /admin/ejercicios (galeria del
-- entrenador), en vez de archivos estaticos en public/ que necesitan un
-- deploy nuevo para cambiar. Las columnas quedan NULL para los ejercicios
-- que siguen usando la ilustracion estatica de siempre (ilustracion_slug) —
-- el codigo prioriza estas URLs cuando existen y si no cae al archivo
-- estatico, asi no hace falta migrar los 127 de una.
--
-- foto_miniatura_url: la que se ve chica al lado del ejercicio.
-- foto_completa_url: la que se ve en el visor ampliado (sin recortar).
-- Las dos viven en el bucket publico `ejercicios-fotos` de Supabase Storage.
--
-- Idempotente.

alter table ejercicios
  add column if not exists foto_miniatura_url text,
  add column if not exists foto_completa_url text;

-- Bucket publico: son fotos de ejercicios de gimnasio, no datos personales
-- de ningun alumno — no hace falta URL firmada para mostrarlas.
insert into storage.buckets (id, name, public)
values ('ejercicios-fotos', 'ejercicios-fotos', true)
on conflict (id) do nothing;

-- Lectura: publica (el bucket ya es publico, pero la tabla storage.objects
-- igual necesita su propia policy de select para que funcione con RLS).
drop policy if exists ejercicios_fotos_select on storage.objects;
create policy ejercicios_fotos_select on storage.objects for select
  using (bucket_id = 'ejercicios-fotos');

-- Escritura y borrado: solo entrenador o admin.
drop policy if exists ejercicios_fotos_write on storage.objects;
create policy ejercicios_fotos_write on storage.objects for insert
  with check (bucket_id = 'ejercicios-fotos' and es_admin_o_entrenador());

drop policy if exists ejercicios_fotos_update on storage.objects;
create policy ejercicios_fotos_update on storage.objects for update
  using (bucket_id = 'ejercicios-fotos' and es_admin_o_entrenador());

drop policy if exists ejercicios_fotos_delete on storage.objects;
create policy ejercicios_fotos_delete on storage.objects for delete
  using (bucket_id = 'ejercicios-fotos' and es_admin_o_entrenador());
