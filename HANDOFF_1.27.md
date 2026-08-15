# Handoff 1.27 — cierre de entrenamiento activo

Fecha: 2026-08-15  
Rama integrada: `main`  
Último commit: `f1fb29c` — `fix(entrenar): fusionar señal de impulso con su objetivo`

## Estado entregado

La experiencia de entrenamiento activo quedó integrada en `main` y publicada
en `origin/main`.

- Ejercicios individuales, biseries/superseries y series encadenadas usan la
  composición compacta de entrenamiento.
- Peso y repeticiones conservan lectura grande; RIR, descanso y flechas se
  mantienen como controles secundarios.
- Impulso VIP ya no usa un rayo/cuadro separado: cuando está pendiente se
  muestra una única cápsula centrada `Impulso VIP · sube a N kg`, que abre la
  indicación al tocarla y pulsa al mismo ritmo que la barra morada de la serie
  especial. Al aceptar el reto, queda fija.
- El halo de pantalla de Impulso se redujo a un único borde morado–dorado;
  no debe haber capas duplicadas ni brillo sobre el contenido.
- La selección de ejercicios para Impulso combina prioridad del ejercicio
  (compuesto/foco del día) con cupo adaptativo: uno por defecto y dos solo
  tras cuatro resultados consecutivos logrados y verificados con datos.

## Descanso personalizado

La preferencia se guarda a nivel de alumno y aplica a toda la rutina:

- opciones: libre, tiempo del entrenador, 40 s, 60 s, 90 s o 120 s;
- la fuente actual es `alumno_perfil.segundos_descanso_preferido`;
- `temporizador_descanso_desactivado_por_alumno` distingue cuando el alumno
  lo apagó de una configuración del entrenador.

Para una base nueva deben existir las migraciones `0091` y `0092`. La
migración `0092` acepta 40 s (no 45 s), de acuerdo con el flujo aprobado.

## Verificación realizada

- `npx tsc --noEmit`: correcto.
- Tests específicos de Impulso y descanso: 21/21 correctos.
- `npm run build`: correcto después de integrar `origin/main`.
- Validación visual en `localhost:3001`: cápsula fusionada de Impulso,
  barra morada de serie 4 y halo de pantalla legibles.

## Nota para retomar

Si el navegador local muestra el rayo antiguo aislado, el problema es un
bundle de desarrollo en caché. Abrir la misma sesión en una pestaña nueva
con una query temporal (por ejemplo `?revision=impulso-fusion`) carga la
versión actual. No revertir la cápsula fusionada ni volver a añadir un botón
de rayo separado.

Antes de tocar la composición, validar siempre tanto el ejercicio individual
como una biserie: el individual intenta evitar scroll cuando cabe, mientras
que los grupos conservan scroll y centrado del ejercicio activo.
