-- Hash de contenido de la foto de cada ejercicio — item 6 del audit de
-- Galería (instructivo 8.5, "duplicado exacto"). Se calcula sobre la
-- miniatura ya procesada (500x500 webp) en el momento de subirla, así que
-- dos fotos visualmente idénticas subidas por separado a dos ejercicios
-- distintos generan el mismo hash aunque terminen en archivos y URLs
-- distintas de Storage — algo que comparar URLs (ver Calidad → "foto
-- compartida") no puede detectar.
--
-- Nula en toda foto subida antes de esta migración: no hay backfill
-- retroactivo con las ~92 fotos ya existentes, a propósito — recalcularlas
-- exigiría volver a descargar y procesar cada una. Se va completando sola a
-- medida que cada foto se reemplaza de ahí en más.

alter table ejercicios
  add column if not exists foto_hash text;

create index if not exists ejercicios_foto_hash_idx
  on ejercicios (foto_hash) where foto_hash is not null;
