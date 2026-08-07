-- Video de referencia subido de verdad a Cloudflare Stream, como alternativa
-- a solo pegar un link (YouTube o archivo directo, ver `video_url` en
-- 0026_biblioteca_ejercicios.sql). A diferencia de un link, acá el ARCHIVO
-- se sube — pero nunca pasa por nuestro servidor ni por el celular del
-- entrenador para procesarlo: Cloudflare da una URL de subida directa
-- (`direct creator upload`) y el navegador le manda el archivo directo a
-- Cloudflare, que lo codifica y lo sirve. Ver `src/lib/cloudflare/stream.ts`.
--
-- `video_cloudflare_uid`: el identificador que devuelve Cloudflare al pedir
-- la URL de subida — se guarda ANTES de que el archivo termine de subirse,
-- así el ejercicio ya queda vinculado al video aunque todavía esté
-- procesándose.
-- `video_cloudflare_listo`: Cloudflare procesa el video de forma asíncrona
-- (puede tardar); este campo lo pone en true el webhook
-- (`/api/webhooks/cloudflare-stream`) cuando Cloudflare avisa que ya está
-- listo para reproducirse. Mientras sea false, la app no debe ofrecerlo
-- para reproducir todavía (mostraría un error o una pantalla en blanco).
--
-- Es un campo aparte de `video_url`, no un reemplazo: un ejercicio puede
-- tener un link (YouTube) O un video de Cloudflare — la app prioriza
-- Cloudflare cuando está listo, y si no, cae al link, igual que ya prioriza
-- la foto subida sobre la ilustración estática.

alter table ejercicios
  add column if not exists video_cloudflare_uid text,
  add column if not exists video_cloudflare_listo boolean not null default false;

create index if not exists ejercicios_video_cloudflare_uid_idx
  on ejercicios (video_cloudflare_uid)
  where video_cloudflare_uid is not null;
