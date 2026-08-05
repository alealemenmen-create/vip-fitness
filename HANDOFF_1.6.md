# HANDOFF 1.6

**IMPORTANTE: NADA de esto está commiteado ni publicado todavía.** El usuario dijo explícitamente "no publiques todavía" — hay cambios sin commitear en 8 archivos (`git status`) esperando luz verde para `git add` + commit + push. No pushear sin que lo pida de nuevo.

Respaldo del punto de partida de esta sesión: tag `respaldo-2026-08-03-antes-inteligencia-entrenar` (ya en origin).

## Hecho en esta sesión, sin publicar

**Bugs (ya en main, publicados hace rato, commits `153dba8` y `a59e90c`):**
- Reloj de descanso que se pausaba en background (visibilitychange en SesionEjercicioCard.tsx)
- Kg/reps que se perdían: el borrador local se borraba antes de confirmar guardado real
- Botón "entrenar sin querer": nuevo `CancelarSesionBoton` ("Empecé este día por error")
- Puntos ranking vs perfil: etiqueta "pts totales" agregada
- Modal "Abandonar entrenamiento" recortado detrás del nav en iPhone → portal a `document.body`

**Sin publicar (pendiente confirmar y hacer push):**
- Feature: carga de macros directa (entrenador y alumno), sin PDF — `/alumno/macros` nueva pestaña en Configuración
- Feature: segundos en vez de reps para ejercicios "por tiempo" (detecta "seg"/"min" en el texto de reps, sin migración de DB)
- **Botón redundante "Iniciar entrenamiento"/"Ver entrenamiento" sacado** — un solo botón, no compromete a entrenar hasta tocar "Iniciar rutina" adentro
- **Semibloqueo de 3 toques** en series fuera de turno (SesionEjercicioCard.tsx): la serie en turno sigue en 1 toque, cualquier otra pide 3 toques con aviso "Tocá N veces más", reset a los 2s
- **Modal de conflicto** "Tenés un entrenamiento activo" cuando el alumno intenta empezar un día distinto al que tiene en curso — nueva acción `cancelarYEmpezarOtroDia` en `actions.ts`
- **Mismo bug de modal recortado en iPhone**, arreglado en 3 componentes más: `ReiniciarRutinaBoton.tsx`, `DocumentoConEliminar.tsx`, `SeguimientoDiario.tsx` (este último era el bug reportado de "Completar seguimiento diario" bugueado)
- Confirmado: sí hay puntos VIP por completar seguimiento diario
- Botón "Iniciar rutina" movido de la cabecera (chico, pasaba desapercibido) a un botón grande de ancho completo debajo de la barra de progreso, con resplandor pulsante (`.boton-entrenar-pulso`, nueva animación en globals.css, theme-aware vía `var(--color-vip)`)
- Barra de progreso de la sesión rediseñada: puntos arriba-izquierda, % arriba-derecha, barra más alta con resplandor propio en el relleno

## OJO: cambio pre-existente sin commitear, no es mío

`src/app/globals.css` ya tenía un cambio sin commitear ANTES de que empezara esta sesión: `transform: translateZ(0)` en `.pantalla-scroll` (fix de repintado de iOS Safari). Probablemente esta es la causa raíz real de todos los bugs de "modal recortado detrás del nav" que aparecieron esta sesión (un `transform` en el contenedor cambia el containing block de los `fixed` hijos). No lo toqué, sigue ahí sin commitear junto con mis cambios de CSS.

## Pendiente / en el aire

- **Publicar todo esto** (commit + push) — esperando confirmación explícita del usuario, se lo pregunté dos veces y dijo que no todavía / seguimos ajustando.
- Estaba en medio de: el usuario pidió centrar/mejorar mejor la cabecera de la sesión ("SESIÓN 2 · Espalda", pill "En progreso", pill "0 de 5 ejercicios" — dice que no se ve centrado ni acorde a las tarjetas de abajo). Lo interrumpió para pedir este handoff antes de que llegara a tocar código.
- Nueva idea del usuario, sin desarrollar: pestaña de "Metas personales" — le di opinión (buena idea, cuidado con pisarse con objetivo/Progreso/macros ya existentes), no se avanzó más.
- Pospuesto explícitamente: burbuja/robot flotante de recordatorios (análisis ya entregado en el chat, no implementado).
- Pendiente sin tocar: analizar si el admin puede ver cuántas veces/cuándo entra un alumno — pregunté qué métrica quería (días activos / último ingreso / conteo exacto) y el usuario cerró la pregunta sin responder. Dato ya existe parcialmente: tabla `puntos_vip_movimientos` con `clave = 'ingreso:{fecha}'` = un registro por día que el alumno entró (no cuenta aperturas múltiples el mismo día).
- Arrastrado de handoffs viejos, sin tocar: worktree viejo en `.claude/worktrees/vibrant-aryabhata-a3658a/`, dos acciones de Nutrición sin aviso de error, bug cosmético en `EliminarPerfilBoton`, `cancelarEliminacionDatos` sin botón, fotos verdes/rojas sin usar en `public/grupos-musculares/`.

## Verificación

Todo lo de arriba se probó en vivo en el navegador con la cuenta real de prueba del usuario (Alejandro Mendoza / admin viendo como alumno) — él autorizó explícitamente usarla las veces que hiciera falta. Cada prueba se limpió después (cancelar sesión / reiniciar rutina) para no dejar basura. `npx tsc --noEmit` limpio en cada paso.
