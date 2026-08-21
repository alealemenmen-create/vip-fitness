@AGENTS.md

## Trabajo activo: Generador de Rutinas VIP

Antes de continuar este módulo, lee completo `HANDOFF_GENERADOR_RUTINAS_CLAUDE.md`.
Claude es el agente principal de continuidad. No reemplaces el motor de reglas
por un prompt libre ni publiques cambios en producción sin autorización expresa.

Si el usuario pide verificar y respaldar este trabajo en GitHub, sigue
`MENSAJE_PARA_CLAUDE_GITHUB.md` paso por paso.

## Revisión pendiente: Impulso VIP En Vivo

Antes de revisar, probar o continuar Impulso VIP, lee completo
`HANDOFF_IMPULSO_VIP_CLAUDE.md`. Alejandro pidió expresamente que Claude haga
la revisión técnica y visual, ejecute las pruebas y le deje la demostración
abierta en pantalla porque le duelen las manos. No hagas push sin una nueva
autorización explícita.

## Pendiente por retomar: Galería multimedia / Carga masiva

Hay un instructivo completo en `INSTRUCTIVO_CLAUDE_GALERIA_MULTIMEDIA_CARGA_MASIVA.md`
(dejado por Codex, revisado con Alejandro el 2026-08-16) para un rediseño grande
de `/admin/ejercicios` — carga masiva de foto y video mezclados, sesiones de
ingesta persistentes, Modo gimnasio. Es un proyecto de varias sesiones, no de
una tarde: si Alejandro pide retomarlo, léelo completo primero y confirmá con
él el alcance (¿toda la Fase 1 nomás, o el instructivo completo?) antes de
escribir código — no asumas que hay que implementarlo entero de una.

## Pendiente por retomar: Estudio VIP (configuración global de portal-v2)

Alejandro pidió el 2026-08-20 poder configurar pantallas/fotos/nombres/botones
de portal-v2 para todos los alumnos a la vez, no uno por uno. Ya estaba
previsto desde el inicio del proyecto con el nombre "Estudio VIP" (ver
`docs/PORTAL_VIP_V2_VISION.md`, sección 4 y Etapa 5) pero nunca se construyó.
Alcance y preguntas abiertas quedaron en `HANDOFF_ESTUDIO_VIP_ALCANCE.md` —
léelo completo y resolvé el alcance con Alejandro (rol, qué es configurable,
dónde vive) antes de escribir código.

## Pendiente por retomar: Rediseño del portal clásico ("Entrenar")

Alejandro pidió el 2026-08-21 un rediseño de la pantalla de sesión activa del
portal clásico ("Entrenar"), más claro y de nivel profesional, usando el
portal v2 como referencia de calidad SIN fusionar los dos sistemas. Primera
sesión (rama `feature/rediseno-entrenar-clasico`, sin PR ni publicar todavía)
arregló el selector de series y el descanso que "desaparecía" visualmente —
ver `HANDOFF_REDISENO_PORTAL_CLASICO.md` para la causa raíz encontrada, las
decisiones de diseño tomadas y qué falta (el resto del portal clásico, cuyo
alcance todavía no está definido con Alejandro).
