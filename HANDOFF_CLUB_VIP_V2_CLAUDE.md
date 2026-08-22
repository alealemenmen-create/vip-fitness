# Handoff — Club VIP V2 vs. Impulso VIP En Vivo: por qué esperar y qué hacer primero

Fecha: 2026-08-22.
Autor: Claude (esta sesión), a pedido de Alejandro.

## Por qué existe este documento

Alejandro trajo `INSTRUCTIVO_CLAUDE_CLUB_VIP_V2.md` (propuesta ya aprobada,
33 secciones, ~1.550 líneas, escrita por otra sesión/herramienta) en medio de
una sesión donde yo estaba agregando una vista previa de XP en vivo sobre el
sistema de puntos actual. Antes de tocar una sola línea de ese instructivo
hay un problema de secuencia que hay que resolver, y Alejandro pidió dejarlo
por escrito en vez de decidir apurado dentro del chat.

**Si estás retomando esto: no empieces por la sección 21 del instructivo sin
leer primero la sección "El conflicto real" de acá abajo.**

## Estado de lo que YA está hecho (esta sesión, ya en `main`)

Encima del sistema de puntos **clásico** (`puntos_vip_movimientos`,
`src/lib/ranking/*`), sin tocar sus reglas:

- **Tarjeta Arena VIP + Comunidad en Entrenar**
  (`src/components/v2/PulsoArenaComunidadV2.tsx`, dato desde
  `src/app/portal-v2/progreso/comunidad/data.ts:obtenerPulsoComunidadV2`):
  puesto semanal propio + última publicación de un compañero, en la pantalla
  de Entrenar en vez de escondido en Progreso.
- **Contador de XP** (`src/components/v2/XpBadgeV2.tsx`), reubicado al
  encabezado de Entrenar junto a la marca (`VIP FITNESS`), tras probar y
  descartar una versión flotante (tapaba el botón de menú/volver en varias
  pantallas — ver commits `f986a17`, `758a21b`).
- **Vista previa de XP en vivo** (commit `81c458d`): al marcar/desmarcar una
  serie en `SesionActivaV2.tsx` y al agregar/quitar un alimento en
  `NutricionV2.tsx`, el número sube y baja al toque con la MISMA fórmula que
  usa el servidor (`calcularPuntosEntrenamiento`, `calcularPuntosAlimentacion`
  vía `recalcularAlimentacionDia`). **No escribe nada nuevo en la base** — el
  crédito real sigue naciendo solo al finalizar sesión / cerrar el día,
  exactamente igual que antes. Se investigó cómo resuelven esto Duolingo,
  Habitica (con su exploit documentado de farmeo por click repetido,
  `HabitRPG/habitica#8205`) y Fitbod/Strava antes de elegir este enfoque.
- Todo esto pasa `tsc --noEmit`, `eslint` y la suite de `vitest` (682 tests
  al cierre de esta sesión) y está pusheado a `origin/main`.

Esta parte queda perfectamente compatible con el instructivo nuevo: la
sección 3 de `INSTRUCTIVO_CLAUDE_CLUB_VIP_V2.md` ya lista
`XpBadgeV2.tsx` y `PulsoArenaComunidadV2.tsx` entre los archivos a
**adaptar** (no a descartar) cuando exista Club VIP V2.

## El conflicto real: dos sesiones tocando la misma liquidación

Mientras yo hacía este trabajo, **otra sesión** dejó sin commitear una
reescritura completa de `src/lib/impulso-vip/*` (Impulso VIP En Vivo) —
confirmado con `git status`, son ~15 archivos modificados más 2 nuevos, todos
sin commit. Ese trabajo tiene su propio documento maestro,
`INSTRUCTIVO_CLAUDE_IMPULSO_VIP_V2_PUNTA_A_PUNTA.md`, y CLAUDE.md ya advierte
que necesita que Alejandro lo revise en pantalla antes de darlo por bueno.

`INSTRUCTIVO_CLAUDE_CLUB_VIP_V2.md`, sección 22.2 ("Bonificación Impulso:
máximo 60 por sesión"), dice explícitamente que ese bono se liquida dentro
del **mismo libro contable nuevo** que Club VIP V2 quiere crear
(`club_vip_movimientos`, sección 26.1) junto con entrenamiento base y
técnica, en una única función transaccional (sección 23.3).

Es decir: **dos sesiones están por reescribir la misma pieza —el cierre de
sesión y su liquidación de puntos— desde dos ángulos distintos**, sin que una
sepa de la otra. Si alguien empieza el libro contable de Club VIP V2 ahora:

- el trabajo de Impulso VIP En Vivo puede quedar huérfano o duplicado;
- o peor, las dos reescrituras pueden pisarse en el mismo commit de cierre
  de sesión (`finalizarSesionInterna` en
  `src/app/alumno/entrenar/actions.ts`, el mismo archivo que ambas tocan).

## Qué NO hacer todavía

- No crear `club_vip_movimientos` ni ninguna tabla de la sección 28.
- No tocar `src/lib/ranking/reglas.ts` ni `src/lib/ranking/movimientos.ts`
  para adaptarlos a la economía nueva.
- No commitear los cambios sueltos de `src/lib/impulso-vip/*` que dejó la
  otra sesión — no son de esta sesión y ese trabajo tiene su propia regla de
  autorización explícita antes de darse por bueno (ver CLAUDE.md).
- No arrancar la sección 21 en adelante del instructivo de Club VIP V2 sin
  que Impulso VIP En Vivo esté commiteado y aprobado por Alejandro primero.

## Orden recomendado

1. Cerrar Impulso VIP En Vivo: que la sesión que lo tiene en curso lo termine,
   Alejandro lo pruebe y quede commiteado (según su propio instructivo
   maestro).
2. Recién ahí, empezar `INSTRUCTIVO_CLAUDE_CLUB_VIP_V2.md` desde su sección
   31 ("Nuevo orden de implementación obligatorio"), que ya prevé auditar y
   congelar las reglas legacy como paso 1 — en ese paso hay que incluir
   explícitamente el resultado final de Impulso VIP En Vivo, no la versión
   vieja.
3. Abrir la maqueta (`C:/Users/vipfi/.codex/visualizations/2026/08/22/
   01a0284b-91fc-7242-9a81-8a27d31ba693/club-vip-maqueta.html`) y recorrer
   las cuatro pestañas antes de escribir cualquier componente visual, como
   pide la sección 0 del instructivo.
4. Antes de cualquier escritura de la migración (sección 27), confirmar
   respaldo/PITR real del proyecto Supabase — es condición de salida
   explícita del propio instructivo, no opcional.

## Dónde está cada cosa

- `INSTRUCTIVO_CLAUDE_CLUB_VIP_V2.md` — el contrato funcional completo de
  Club VIP V2 (raíz del repo).
- `INSTRUCTIVO_CLAUDE_IMPULSO_VIP_V2_PUNTA_A_PUNTA.md` — el documento
  maestro vigente de Impulso VIP En Vivo (raíz del repo).
- `src/lib/impulso-vip/*` — trabajo en curso, sin commitear, de la otra
  sesión.
- Commits de esta sesión: `f986a17`, `758a21b`, `81c458d` (todos en
  `origin/main`).
