-- Instructivo de galería multimedia (§11.4, problema H): reemplazar un clip
-- borraba el UID anterior de Cloudflare apenas se iniciaba la subida del
-- nuevo — antes incluso de que un solo byte viajara. Si la subida fallaba o
-- se cortaba, el ejercicio se quedaba sin video recuperable.
--
-- Ahora el UID anterior se guarda acá en vez de borrarse. Recién se elimina
-- de Cloudflare cuando el nuevo termina de procesar y queda "listo" (ver
-- sincronizarVideoCloudflare en actions.ts) — el reemplazo nunca deja al
-- ejercicio sin clip funcionando de por medio.

alter table ejercicios
  add column if not exists video_cloudflare_uid_anterior text;
