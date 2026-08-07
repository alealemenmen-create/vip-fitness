-- Reemplaza el booleano `video_cloudflare_listo` (migración 0048) por un
-- estado granular: la subida ahora es reanudable (TUS, puede tardar) y el
-- procesamiento de Cloudflare puede fallar — un solo booleano no distinguía
-- "subiendo", "procesando" (Cloudflare todavía lo codifica) y "falló", así
-- que la UI no podía avisar del error ni ofrecer reintentar, y un video que
-- fallaba quedaba mostrando "procesando" para siempre.
--
-- `video_cloudflare_estado`: 'subiendo' apenas se pide la URL de subida
-- (`iniciarSubidaVideoCloudflare`), después lo actualiza el webhook
-- (`/api/webhooks/cloudflare-stream`) a 'procesando' | 'listo' | 'error'
-- según lo que reporte Cloudflare. Null cuando el ejercicio no tiene ningún
-- video de Cloudflare (mismo caso que `video_cloudflare_uid` null).
-- `video_cloudflare_duracion_seg`, `video_cloudflare_miniatura_url`,
-- `video_cloudflare_error`: informativos, los llena el webhook una vez que
-- Cloudflare los conoce (duración y miniatura solo si terminó bien; el
-- mensaje de error solo si terminó mal).

alter table ejercicios
  add column if not exists video_cloudflare_estado text
    check (video_cloudflare_estado in ('subiendo', 'procesando', 'listo', 'error')),
  add column if not exists video_cloudflare_duracion_seg numeric,
  add column if not exists video_cloudflare_miniatura_url text,
  add column if not exists video_cloudflare_error text;

update ejercicios
  set video_cloudflare_estado = case when video_cloudflare_listo then 'listo' else 'procesando' end
  where video_cloudflare_uid is not null;

alter table ejercicios drop column if exists video_cloudflare_listo;
