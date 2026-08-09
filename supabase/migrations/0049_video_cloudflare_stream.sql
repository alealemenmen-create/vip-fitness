-- Videos cortos de referencia alojados en Cloudflare Stream.
-- `video_url` se conserva como respaldo para enlaces antiguos de YouTube o
-- archivos directos. Cuando el video de Cloudflare está listo, tiene prioridad.

alter table ejercicios
  add column if not exists video_cloudflare_uid text,
  add column if not exists video_cloudflare_estado text
    check (video_cloudflare_estado in ('subiendo', 'procesando', 'listo', 'error')),
  add column if not exists video_cloudflare_duracion_seg numeric,
  add column if not exists video_cloudflare_miniatura_url text,
  add column if not exists video_cloudflare_error text;

create unique index if not exists ejercicios_video_cloudflare_uid_idx
  on ejercicios (video_cloudflare_uid)
  where video_cloudflare_uid is not null;

