-- Ancho/alto reales del clip que procesó Cloudflare (input.width/height de su
-- API). Sirven para que el reproductor calcule cuánto hay que agrandarlo y
-- recortarlo (mismo criterio que object-fit: cover en las fotos) cuando un
-- video vertical de celular se muestra en el cuadro 16:9 del ejercicio
-- activo — sin esto, Cloudflare deja franjas transparentes a los costados
-- que dejan ver el relleno borroso de fondo pensado para fotos, no para un
-- video reproduciéndose encima.

alter table ejercicios
  add column if not exists video_cloudflare_ancho integer,
  add column if not exists video_cloudflare_alto integer;
