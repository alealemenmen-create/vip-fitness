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

## Pendiente por retomar: Estudio VIP (configuración global de portal-v2)

Alejandro pidió el 2026-08-20 poder configurar pantallas/fotos/nombres/botones
de portal-v2 para todos los alumnos a la vez, no uno por uno. Ya estaba
previsto desde el inicio del proyecto con el nombre "Estudio VIP" (ver
`docs/PORTAL_VIP_V2_VISION.md`, sección 4 y Etapa 5) pero nunca se construyó.
Alcance y preguntas abiertas quedaron en `HANDOFF_ESTUDIO_VIP_ALCANCE.md` —
léelo completo y resolvé el alcance con Alejandro (rol, qué es configurable,
dónde vive) antes de escribir código.
