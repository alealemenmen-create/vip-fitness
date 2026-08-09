# Continuidad del proyecto VIP Fitness

Actualizado: 2026-08-09 (America/Santiago)

## Vista previa activa

- URL estable: https://vip-fitness-stream-preview.vercel.app
- Proyecto Vercel: `vip-fitness-center`
- Entorno utilizado: **Preview**
- Producción no fue modificada.

## Cloudflare Stream terminado

- Cloudflare Stream está contratado y activo.
- La subida directa desde iPhone funciona (MP4, MOV o WebM; máximo 30 segundos y 100 MB).
- Los archivos viajan directamente del navegador a Cloudflare.
- La app vincula el UID del video con el ejercicio en Supabase.
- Se retiró la opción de agregar nuevos enlaces de YouTube.
- Los enlaces antiguos se pueden eliminar y también se borran automáticamente al subir un clip nuevo.
- Se aplicó en Supabase la migración `0049_video_cloudflare_stream.sql`.
- Si el webhook no actualiza el estado, la app consulta Cloudflare y cambia de `procesando` a `listo` o `error`.
- Se verificó la reproducción del clip horizontal en la vista del alumno.
- Para la biblioteca definitiva se recomienda grabar con el iPhone horizontal, 1080p/30 fps, cuerpo completo y cámara estable.

## Configuración sensible

Estas variables existen únicamente en Vercel Preview y no deben copiarse a Git:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_STREAM_API_TOKEN`
- `CLOUDFLARE_STREAM_CUSTOMER_CODE`

No se subieron `.env.local`, tokens ni claves secretas.

## Pendiente prioritario al regresar

Optimizar batería y datos en la pantalla de entrenamiento:

1. Reproducir solamente el video del ejercicio activo y visible.
2. Pausarlo al cambiar de ejercicio, ocultar la pestaña, bloquear el teléfono o salir de la pantalla.
3. No cargar todos los clips de la rutina al mismo tiempo.
4. Mantener reproducción silenciosa y en bucle para el ejercicio activo.
5. Considerar un modo de ahorro que reproduzca solo al tocar.
6. Mejorar el refresco visual para que `Procesando` cambie a `Listo` sin recargar manualmente.

## Mejora visual opcional

- Los videos horizontales ya ocupan correctamente el marco 16:9.
- Para videos verticales, se puede mantener el cuerpo completo y rellenar los laterales con una copia desenfocada del mismo video.
- No implementar esta mejora si toda la biblioteca se grabará horizontalmente.

## Pagos

Consultar `PAGOS_SERVICIOS.md`. Existe un recordatorio mensual para revisar pagos de VIP Fitness.
