@AGENTS.md

## Trabajo activo: Generador de Rutinas VIP

Antes de continuar este módulo, lee completo `HANDOFF_GENERADOR_RUTINAS_CLAUDE.md`.
Claude es el agente principal de continuidad. No reemplaces el motor de reglas
por un prompt libre ni publiques cambios en producción sin autorización expresa.

Si el usuario pide verificar y respaldar este trabajo en GitHub, sigue
`MENSAJE_PARA_CLAUDE_GITHUB.md` paso por paso.

## Revisión pendiente: Impulso VIP En Vivo

Antes de revisar, probar o continuar Impulso VIP, lee completo
`INSTRUCTIVO_CLAUDE_IMPULSO_VIP_V2_PUNTA_A_PUNTA.md`. Ese es el documento
maestro vigente y prevalece cuando una indicación anterior sea ambigua. Luego
lee `HANDOFF_IMPULSO_VIP_CLAUDE.md` como contexto histórico. Alejandro pidió
expresamente que Claude implemente y revise el flujo completo, ejecute las
pruebas y le deje la demostración abierta en pantalla porque le duelen las
manos. No hagas push, despliegue ni cambios destructivos en producción sin una
nueva autorización explícita.

## Resuelto: Galería multimedia / Carga masiva

El instructivo `INSTRUCTIVO_CLAUDE_GALERIA_MULTIMEDIA_CARGA_MASIVA.md` (2026-08-16)
ya está implementado completo (las 4 fases) desde ese mismo día, commit
`1cfc22a`. Verificado en el código el 2026-08-21: selector mixto foto+video,
"Crear ejercicio con este archivo" en filas sin match, alta con video como
archivo, alta reducida a nombre + sugerencias (`calidad_ficha`, migración
0099), ingestión persistente (migraciones 0100/0101), Modo gimnasio. No
retomar como si estuviera pendiente.

## Trabajo activo: Control VIP V2 (panel nuevo del entrenador)

Fases 0 a 6 de `docs/PROYECTO_CONTROL_VIP_V2.md` ya implementadas y en
producción, en `/control-vip/**`, detrás de la bandera
`perfiles.control_vip_v2_habilitado` (piloto por cuenta) — no reemplaza
`/admin/**`, que sigue funcionando exactamente igual. Antes de tocar nada
de esto, lee completo `docs/CONTROL_VIP_V2_INVENTARIO.md` (inventario de
rutas, permisos y contrato de conservación) y `docs/PROYECTO_CONTROL_VIP_V2.md`
(la visión original, para no reinterpretarla desde cero).

Pendiente si se retoma:

- Estudio VIP: restringir "publicar" a solo el propietario (hoy cualquier
  entrenador/admin con el piloto activado puede publicar) y agregar
  comparación visual entre versiones del historial.
- Capturas base del panel actual — necesita una sesión logueada real, no
  se puede automatizar sin credenciales.
- El comando global (`Ctrl/Cmd+K`) busca destinos y alumnos, no ejercicios
  ni rutinas guardadas todavía.
- `/admin/configuracion` y Notificaciones del entrenador siguen sin
  pantalla V2 — decisión deliberada (bajo valor), no un olvido.

## Resuelto: Estudio VIP (configuración global de portal-v2)

Ya está construido y en `main`: editor en `/admin/estudio-vip` (borrador,
publicación, portada global, navegación) y, desde el 2026-08-21, también un
editor de tres paneles en `/control-vip/estudio-vip` (Control VIP V2) con
vista previa usando el componente real de navegación e historial de
versiones con restauración. Ambos escriben al mismo borrador.json/
publicada.json en Supabase Storage. No queda "por retomar" — lo que sigue
pendiente, documentado en `docs/CONTROL_VIP_V2_INVENTARIO.md`, es acotar
quién puede publicar (hoy cualquier entrenador/admin puede, no solo el
propietario) y agregar comparación visual entre versiones.
