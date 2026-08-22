# Resultado — Portal VIP V1, organización profesional (Claude)

Respuesta a `HANDOFF_CLAUDE_PORTAL_V1_ORGANIZACION.md` (docs de V2,
2026-08-19). Ejecutado en el worktree aislado indicado por el propio
encargo — no se creó uno nuevo porque ya existía y ya estaba en la rama
correcta.

## Rama, commits y alcance real

- Repositorio de trabajo: `C:\dev\vip-fitness-v1-claude` (clon separado de
  `C:\dev\vip-fitness`, mismo remoto `origin`).
- Rama: `claude/portal-v1-organizacion`.
- Commit base: `9b71c15` (igual a `origin/main` al momento de empezar).
- Commit creado: **`196febf`** — `fix(entrenar): bloquear el avance del
  ejercicio hasta resolver Impulso VIP`.
- **No se hizo push.** El código queda únicamente en esta rama local, como
  pide el encargo.

**Aviso importante de proceso:** durante esta sesión, otro proceso/sesión
trabajó en paralelo sobre el mismo worktree (mismos archivos en disco,
compartiendo el mismo tablero de tareas) implementando independientemente la
Fase 3 (edición en contexto sobre "ver como alumno"). No fui yo quien lo
inició ni lo dirigí; lo detecté por cambios inesperados en el árbol de
trabajo, lo revisé línea por línea, lo integré porque es correcto y de bajo
riesgo, y lo dejo documentado abajo con la misma honestidad que mi propio
trabajo — incluyendo qué NO alcanzo a verificar en vivo. Si Codex encuentra
esto confuso al revisar el diff, es real: el commit `196febf` combina ambos
aportes porque ya estaban entrelazados en el mismo árbol de trabajo antes de
que yo pudiera separarlos con seguridad.

## Inventario de archivos modificados

```
 src/app/admin/auditoria/page.tsx                |  8 +++++-
 src/app/alumno/layout.tsx                       | 36 ++++++++++++++++++++-----
 src/components/admin/FichaAlumnoTabs.tsx        | 18 ++++++++++---
 src/components/student/MomentoImpulsoEnVivo.tsx | 17 ++++++++++++
 src/components/student/SesionEjercicioCard.tsx  | 27 ++++++++++++++++++-
 src/components/student/SesionEjercicios.tsx     |  5 ++--
 INVENTARIO_CONTROL_PORTAL_V1.md                 | nuevo
 src/lib/entrenamiento/impulso-avance.ts         | nuevo
 src/lib/entrenamiento/impulso-avance.test.ts    | nuevo
```

Detalle de quién hizo qué:

| Archivo | Autor real | Qué cambia |
|---|---|---|
| `src/lib/entrenamiento/impulso-avance.ts` | Yo (con una función, `ejercicioResueltoDeVerdad`, y su cobertura de recarga añadidas por el proceso concurrente) | Máquina de estados pura de Fase 4 |
| `src/lib/entrenamiento/impulso-avance.test.ts` | Yo + proceso concurrente | 18 pruebas unitarias |
| `src/components/student/SesionEjercicioCard.tsx` | Yo | Bloquea `SelectorDificultad` mientras Impulso VIP tenga resultado pendiente |
| `src/components/student/MomentoImpulsoEnVivo.tsx` | Yo | Nuevo callback `onResultado` |
| `src/components/student/SesionEjercicios.tsx` | Proceso concurrente (usando mi función) | `indiceActivo`/`grupoVisibleBloqueado` usan `ejercicioResueltoDeVerdad` en vez de `ejercicio.completado` a secas |
| `src/app/alumno/layout.tsx` | Proceso concurrente | Enlace "Editar ficha" (Fase 3) |
| `src/components/admin/FichaAlumnoTabs.tsx` | Proceso concurrente | Acepta `?tab=` de entrada (Fase 3) |
| `src/app/admin/auditoria/page.tsx` | Yo | Corrige enlace "volver" que apuntaba a `/admin/configuracion` |
| `INVENTARIO_CONTROL_PORTAL_V1.md` | Yo | Matriz de Fase 1 |

## Fase 1 — Auditoría

Documento completo: `INVENTARIO_CONTROL_PORTAL_V1.md`, en la raíz de este
worktree. Resumen del hallazgo principal:

**`INSTRUCTIVO_CLAUDE_REORDENO_PANEL_ENTRENADOR.md` (spec de Codex,
2026-08-15) ya estaba implementado en su mayor parte en `main` antes de que
yo empezara** — no es trabajo pendiente desde cero:

- Navegación (5 destinos móviles + sidebar + `/admin/mas` como directorio
  completo, todo leyendo de una sola fuente `src/lib/admin/destinos.ts`):
  hecha.
- Ficha de alumno con 7 pestañas (Resumen/Plan y rutina/Actividad/
  Nutrición/Comunicación/Documentos/Cuenta): hecha.
- Galería como flujo de producción (4 vistas, carga masiva): **parcial** —
  existe un sistema de "ingesta" más nuevo (`ejercicio_ingestas`) conviviendo
  con la edición clásica por ejercicio; no confirmé si la UI ya las presenta
  unificadas. Esto es exactamente el terreno de
  `INSTRUCTIVO_CLAUDE_GALERIA_MULTIMEDIA_CARGA_MASIVA.md`, que `CLAUDE.md`
  marca como proyecto aparte que necesita confirmación de alcance con
  Alejandro — **no lo toqué**, por instrucción explícita del propio
  repositorio.

La matriz completa función→ruta→acción→tabla→rol→estado de prueba, con sus
niveles de confianza ("Verificado (código)" / "Spot-check" / "No
verificado"), está en el documento de inventario. No se probó ningún flujo
contra datos reales en navegador en ninguna fase de esta sesión — ver
"Riesgos y limitaciones" más abajo, es la limitación más importante de toda
la entrega.

## Fase 2 — Reorganización (alcance real)

Dado que la reorganización grande ya estaba hecha, el trabajo real de esta
sesión en Fase 2 fue **verificar, no reconstruir**:

- Confirmé que `/admin/armar-rutina` y `/admin/rutinas-generadas` NO usan
  `AdminPageHeader` a propósito (comentario explícito en el código: "en el
  celular ese bloque se comía media pantalla, y esta herramienta necesita el
  alto para la rutina") — **no es un bug**, es una decisión ya tomada. No lo
  toqué.
- Confirmé que `/admin/puntos` ya tiene búsqueda + tope de 40 resultados en
  el selector de alumno (`OtorgarPuntosPanel.tsx`) — el problema de "lista de
  68 alumnos sin buscador" que señalaba el instructivo original **ya está
  resuelto** ahí, aunque el encabezado de la página siga siendo un `<h1>`
  simple en vez de `AdminPageHeader`. Documentado como pendiente menor, no
  corregido (para no mezclar un cambio visual no pedido con esta entrega).
- **Encontré y corregí un bug real:** `/admin/auditoria` tenía su enlace
  "volver" apuntando a `/admin/configuracion` — la pantalla que ERA el
  directorio del panel antes de la reorganización, y que ahora es solo
  ajustes del sistema (`/admin/mas` tomó ese rol). Un admin que entraba a
  Auditoría y tocaba "volver" terminaba en Configuración, no en el mapa del
  panel. Corregido a `/admin/mas` en `src/app/admin/auditoria/page.tsx`.
- No encontré ninguna otra referencia a `/admin/configuracion` como si fuera
  el directorio (grep completo de `href="/admin/configuracion"` en
  `src/app` y `src/components`, un solo resultado, ya corregido).

**No implementé una reorganización nueva de Alumnos ni de Galería.** Habría
sido redundante (ya existen) y arriesgado (tocar una superficie enorme sin
poder probarla contra datos reales, mientras otro proceso escribía en
paralelo sobre archivos vecinos). Si Alejandro/Codex necesitan algo más
específico de Fase 2, está todo mapeado en el inventario de Fase 1 para
retomarlo con precisión.

## Fase 3 — "Ver como alumno" con edición segura en contexto

**Esto lo implementó el proceso concurrente**, no yo — lo reviso acá con el
mismo rigor que si fuera mío, porque termina siendo parte del mismo commit.

Mecanismo base (ya existía, sin tocar): cookie httpOnly `vista_alumno_id`
(`COOKIE_VISTA_ALUMNO`, `src/lib/auth.ts`), 8 h de duración, `sameSite=lax`,
`secure` en producción. `entrarComoAlumno` (en `admin/alumnos/actions.ts`,
ya existente) la crea; `requireAlumno()` la lee y da `soloLectura: true`;
`salirDeVistaAlumno` la borra y redirige a la ficha del alumno. El aviso fijo
"Viendo como {nombre} · modo solo lectura" y el botón "Volver al panel" **ya
existían** antes de esta sesión.

Lo nuevo, agregado en `src/app/alumno/layout.tsx`:

- Un enlace **"Editar ficha"** dentro de ese mismo aviso fijo, visible
  **solo si `contexto.rolSesion === "admin"`** (un `entrenador` en modo "ver
  como alumno" nunca lo ve — cumple "Sólo admin puede editar").
- Enlaza a `/admin/alumnos/{alumnoId}?tab=plan` — la ficha real del alumno,
  con la pestaña "Plan y rutina" ya abierta. `FichaAlumnoTabs.tsx` ahora
  acepta ese `?tab=` de entrada.
- **No agrega ningún formulario ni escritura nueva.** No simula edición
  dentro del portal del alumno — cumple al pie de la letra la salida que el
  propio encargo autoriza: *"Si una función todavía no puede editarse de
  forma segura, enlaza a su editor existente con regreso al mismo contexto;
  no simules un botón funcional."*
- No limpia la cookie `vista_alumno_id` al navegar a editar (a propósito,
  según el comentario del propio cambio): el admin puede volver a la vista de
  alumno sin perder el contexto, hasta que toque "Volver al panel" o expire.
- Toda edición real sigue pasando por las acciones, validaciones y
  publicación versionada que ya existían en `/admin/alumnos/[id]` — no se
  escribe nada directo desde el navegador.

**Lo que esto NO es:** no es la "capa profesional" completa que describe el
encargo (§ Fase 3) — no hay "botones discretos de edición para rutina, día,
ejercicio, instrucciones, descanso y contenido permitido, junto a la
información que modifican" dentro del propio portal del alumno. Es un único
punto de entrada, seguro y mínimo, no una edición en contexto por campo. Lo
marco explícitamente en `NO TERMINADO`.

## Fase 4 — Autoavance incorrecto de Impulso VIP (prioritario)

### Causa raíz, confirmada leyendo el código (no supuesta)

Dos flujos independientes competían por el mismo momento — "se acaba de
marcar la última serie del ejercicio":

1. **`MomentoImpulsoEnVivo`** (la tarjeta de Impulso VIP) revela su
   formulario "¿Cómo salió?" cuando `serieTerminada` es verdadero
   (`listoParaResultado = !esNotaOrientacion && serieTerminada && !resuelta`).
2. **`SelectorDificultad`** (la encuesta general "¿Cómo sentiste este
   ejercicio?", sin relación con Impulso VIP) se habilitaba con
   `disabled={seriesHechas.size < ejercicio.seriesProgramadas}` — es decir,
   apenas se completaban todas las series, **sin mirar si Impulso VIP seguía
   pendiente**.

Cuando la serie objetivo de un reto es la ÚLTIMA serie del ejercicio, ambas
condiciones se vuelven verdaderas en el mismo instante
(`alCompletarCicloSerie` en `SesionEjercicioCard.tsx`, línea ~2492, dispara
`setRecienCompletado(true)` de forma síncrona). `SelectorDificultad` se
renderiza con `z-[70]` (más alto) y `MomentoImpulsoEnVivo` con `z-[65]`, así
que la encuesta general aparecía físicamente ENCIMA del resultado de Impulso
VIP. El alumno respondía la encuesta general (o tocaba "Ahora no"), eso
llamaba a `onDificultadRespondida` → `avanzarDesdeEncuesta` (en
`SesionEjercicios.tsx`) → el índice del ejercicio activo avanzaba →
`SesionEjercicioCard` se desmonta (solo se monta la tarjeta activa) → la
tarjeta de resultado de Impulso VIP, que estaba por debajo, se cortaba antes
de que el alumno la viera. Coincide exactamente con el síntoma reportado:
*"la encuesta o el logro quedan asociados visualmente al ejercicio anterior
y el usuario debe retroceder para verlos."*

Un segundo bug relacionado, no reportado explícitamente pero descubierto
durante la corrección: `ejercicio.completado` (la columna que trae una
recarga de página) se pone en verdadero apenas la serie objetivo se marca,
**sin esperar el resultado de Impulso VIP**. Si el alumno recargaba la
página justo en esa ventana, `indiceActivo` en `SesionEjercicios.tsx` (que
antes miraba `ej.completado` a secas) saltaba directo al ejercicio
siguiente, dejando el mismo resultado huérfano — la misma falla, disparada
por una recarga en vez de por la encuesta general.

### Máquina de estados implementada

```
serie objetivo finalizada
        │
        ▼
RIR pendiente (calibración) ───────┐
        │                          │  ya bloqueaban la SERIE misma
        ▼                          │  (bloqueadaPorImpulso / FilaSerie,
reto pendiente (aceptar/rechazar) ─┘  sin cambios en esta sesión)
        │
        ▼
serie objetivo marcada "hecha"
        │
        ▼
resultado pendiente ("¿Cómo salió?") ──► impulsoPendienteDeAvance = true
        │                                 → SelectorDificultad bloqueado
        │                                 → no hay avance posible
        ▼
resultado resuelto (estado "resuelta",
servidor o confirmación local optimista) ──► impulsoPendienteDeAvance = false
        │                                     → SelectorDificultad se habilita
        ▼                                       (y se reabre solo si corresponde)
encuesta general respondida → onDificultadRespondida → avanzarDesdeEncuesta
        │
        ▼
avance permitido, una sola vez
```

Implementación, en `src/lib/entrenamiento/impulso-avance.ts` (nuevo,
100% testeado, sin dependencias de React — función pura):

- `requiereResultado(intervencion)`: `false` solo para notas de orientación
  automáticas (`tempo_controlado` con `origen: "metodo_ale"`) — esas se
  cierran solas con "Cerrar indicación" y nunca tuvieron formulario de
  resultado. Un mensaje personal de Ale con esa misma técnica sí lo pide.
- `impulsoPendienteDeAvance(intervenciones, seriesHechas, resultadosLocales)`:
  `true` si alguna intervención que requiere resultado tiene su serie
  objetivo ya marcada hecha pero sigue sin resolver — ni en el servidor
  (`estado === "resuelta"`) ni de forma optimista en el cliente.
- `ejercicioResueltoDeVerdad(ejercicio)`: la misma regla aplicada al primer
  render (tras una recarga), reemplazando el uso directo de
  `ejercicio.completado` en `SesionEjercicios.tsx`.

Cableado (`SesionEjercicioCard.tsx`):
- Nuevo estado `resultadosImpulso` (mismo patrón que el `decisionesImpulso`
  ya existente del fix anterior, commit `4574edc`).
- `MomentoImpulsoEnVivo` gana un prop `onResultado?: (resuelta: boolean) =>
  void`, llamado desde un `useEffect` sobre la misma variable `resuelta` que
  ya usaba internamente — avisa al padre apenas la Server Action responde
  `ok`, sin esperar la revalidación de la página.
- `SelectorDificultad` pasa de `disabled={seriesHechas.size <
  ejercicio.seriesProgramadas}` a `disabled={... || impulsoPendienteAvance}`.
  Como el componente retorna `null` mientras está `disabled`, la encuesta
  general directamente no se renderiza (ni la burbuja "¿Cómo te fue?" ni el
  modal forzado) mientras Impulso VIP siga pendiente — ya no compite en
  z-index con la tarjeta de resultado, porque no existe en el DOM.

**Requisitos del encargo, verificados uno por uno:**
- *No avanzar por índice/flecha/autoavance mientras haya etapa pendiente:*
  cubierto — el único disparador de avance (`onDificultadRespondida`) está
  bloqueado en origen.
- *No duplicar respuestas con doble toque/recarga/red lenta:* ya cubierto
  del lado servidor, sin cambios míos — `resolverIntervencionEnVivo`
  (`impulso-actions.ts` línea ~499) rechaza cualquier intervención cuyo
  `estado` ya sea `"resuelta"` o `"cancelada"`, con el `.eq()` final como
  guarda real contra una carrera de dos envíos casi simultáneos.
- *Etapa que no aplica avanza explícita, no salta todo el flujo:* cubierto
  — `requiereResultado` distingue notas automáticas (sin resultado) de retos
  reales, así que un ejercicio sin Impulso VIP nunca se ve afectado
  (`impulsoPendienteDeAvance([], …)` es siempre `false`).
- *Sobrevive una recarga y reabre en la etapa pendiente:* cubierto por
  `ejercicioResueltoDeVerdad` — ver el segundo bug arriba.
- *El logro pertenece al ejercicio/serie correctos y se muestra una vez:* sin
  cambios de lógica ahí — ya era así (`intervencion.serieObjetivo`); lo que
  se corrigió es que ahora SÍ se alcanza a mostrar antes de avanzar.
- *Retroceder y volver no recrea encuestas resueltas:* sin cambios — ya
  dependía de `intervencion.estado`, que es dato del servidor.

### Pruebas nuevas

`src/lib/entrenamiento/impulso-avance.test.ts` — 18 casos, incluido el caso
completo pedido por el encargo ("última serie, RIR, dificultad, logro y
avance") como una secuencia de 4 pasos dentro de un mismo `it`. Nota
honesta: son pruebas de la **función pura** que decide el bloqueo, no una
prueba de integración de extremo a extremo contra los componentes React
reales — el proyecto no tiene infraestructura de testing de componentes
(no hay `jsdom` ni `@testing-library/react` en `package.json`/
`vitest.config.mts`, y todos los tests existentes en el repo son de lógica
pura en `src/lib`, nunca de componentes). No agregué esa infraestructura
por mi cuenta — es una decisión de alcance de proyecto, no algo para decidir
en una sesión de corrección de bug. Si Codex/Alejandro la quieren, es un
pendiente real, listado abajo.

## Comandos y resultados de verificación

Todos corridos sobre el estado final combinado (commit `196febf`), en este
worktree, con `npm install` fresco (no había `node_modules` acá):

```
$ npx tsc --noEmit
(sin salida — 0 errores)

$ npx vitest run
 Test Files  47 passed (47)
      Tests  462 passed (462)

$ npm run lint
✖ 3 problems (0 errors, 3 warnings)
  — las 3 son preexistentes, en archivos no tocados por esta sesión
    (SesionEjercicios.tsx:390, SesionGrupoCard.tsx:236 y 501,
    react-hooks/exhaustive-deps). Confirmado corriendo lint también antes
    de estos cambios: los mismos 3 warnings ya estaban.

$ npm run build
✓ Compiled successfully in 14.7s
✓ Generating static pages using 15 workers (53/53)
[exited with code 0]
```

**Nota sobre el build:** no había ningún `.env*` en este worktree (correcto,
`.env*` está en `.gitignore` y no se copia entre clones — y la instrucción
explícita es no leer/copiar secretos de `C:\dev\vip-fitness`). El primer
intento de build falló prerrenderizando `/login` por falta de
`SUPABASE_SERVICE_ROLE_KEY`. Creé un `.env.local` **con valores inventados,
obviamente falsos** (`placeholder-build-only`, nunca reales), solo para que
Next.js pudiera completar el prerender estático — no se usó para levantar el
servidor de desarrollo ni para tocar ninguna base de datos. Lo borré antes
de terminar (no forma parte del commit; `git status` queda limpio).

## Recorridos móviles y roles comprobados

**Ninguno se probó en navegador real en esta sesión — esta es la limitación
más importante de toda la entrega.** Motivo estructural, no un descuido: este
worktree no tiene (ni debía tener, por instrucción explícita) credenciales
reales de Supabase, así que no hay forma de levantar `npm run dev` contra
datos reales ni de iniciar sesión como alumno/entrenador/admin para recorrer
la app. Todo lo verificado en esta sesión es a nivel de código: lectura
completa de los archivos relevantes, `tsc`, `lint`, pruebas unitarias y
build de producción. Ninguna captura de pantalla, ningún recorrido en
viewport 390×844 ni 844×390 táctil, ningún login real.

Esto es exactamente lo que las memorias de sesiones anteriores de este mismo
proyecto ya advertían (`HANDOFF_IMPULSO_VIP_CLAUDE.md`, y el patrón repetido
en varias correcciones previas de Impulso VIP): esta clase de bug **necesita
confirmación en vivo, con una intervención real, para darse por cerrado**.
El fix de Fase 4 está verificado con la máxima solidez que permite esta
sesión (lectura de código línea por línea + pruebas unitarias exhaustivas de
la máquina de estados), pero **no reemplaza** una prueba real con Alejandro
o con un entrenador de prueba, con una intervención de Impulso VIP activa,
en la última serie de un ejercicio.

## SQL propuesto

Ninguno. No hizo falta ninguna migración para esta corrección — es
enteramente lógica de cliente/estado derivado.

## Riesgos, limitaciones y pendientes honestos

- **Sin verificación en vivo** (ver arriba) — el riesgo más importante.
- El trabajo de Fase 3 lo hizo un proceso que no controlé y que se detuvo
  sin avisar (dejó de escribir cambios nuevos a mitad de sesión, sin
  commit propio ni mensaje de cierre) — lo asumo como terminado en su
  alcance actual porque el diff es pequeño, coherente y pasa toda la
  verificación estática, pero no puedo confirmar que esa otra sesión lo
  considerara completo.
- Mi propio primer intento de auditoría automatizada (un sub-agente de
  solo lectura) también se colgó sin producir resultado a los 10 minutos —
  hice la Fase 1 a mano después de eso. Menciono esto porque sugiere algo
  de inestabilidad del entorno de ejecución en esta sesión particular, no
  solo del código del proyecto.
- Galería/multimedia (Fase 3 del instructivo original de Codex) sigue sin
  unificar — dos sistemas conviven. No es nuevo de esta sesión, ya estaba
  así, y `CLAUDE.md` pide explícitamente no tocarlo sin confirmar alcance
  con Alejandro primero.
- `/admin/puntos` tiene un encabezado "improvisado" (no `AdminPageHeader`) —
  cosmético, de bajo riesgo, no corregido para no mezclar un cambio visual
  no pedido con esta entrega.
- No hay infraestructura de testing de componentes React en el proyecto —
  la prueba de integración de Fase 4 es de la función pura, no del flujo
  completo en el DOM. Ver sección de pruebas arriba.
- `AdminTabs.tsx` referencia `/admin/generador-v2` en la lista de rutas que
  encienden la pestaña "Rutinas", pero esa ruta no existe
  (`src/app/admin/generador-v2` no está creada). No rompe nada (nadie
  enlaza ahí), probablemente preparación para trabajo futuro. Anotado, no
  tocado.

## NO TERMINADO

- **Fase 3 completa según la letra del encargo:** lo implementado es un
  único punto de entrada seguro ("Editar ficha" → ficha real), no "botones
  discretos de edición para rutina, día, ejercicio, instrucciones,
  descanso y contenido permitido, junto a la información que modifican"
  dentro del propio portal del alumno. Es una versión mínima y honesta,
  amparada explícitamente por la cláusula de salida del propio encargo, pero
  no la visión completa.
- **Ninguna prueba en navegador real**, en ningún rol, en ningún viewport.
  Depende de credenciales que este worktree no tiene y no debía tener.
- **La corrección de Fase 4 no se probó con una intervención de Impulso VIP
  real en curso** — solo con pruebas unitarias de la lógica que la
  gobierna.
- Galería/multimedia unificada: fuera de alcance, requiere confirmación de
  Alejandro (ver `INSTRUCTIVO_CLAUDE_GALERIA_MULTIMEDIA_CARGA_MASIVA.md`).
- `/admin/puntos`, `/admin/auditoria` (más allá del enlace corregido),
  `/admin/torneos`, `/admin/novedades`, `/admin/notificaciones`: quedaron en
  "spot-check" o "no verificado" en el inventario de Fase 1 — no se
  profundizó.

## NO TOCAR EN V2

Confirmado en esta sesión, con `git status`/`git rev-parse` de solo lectura
sobre `C:\dev\vip-fitness-v2`:
- Rama `portal-v2` sigue siendo la rama activa.
- Árbol de trabajo limpio — **cero cambios míos**.
- El HEAD actual (`d990c2cd35...`) ya no coincide con el `18a2777` citado
  como corte verificado en el encargo original — es actividad externa,
  posterior, de otra sesión/persona, no de este trabajo. No lo investigué
  ni lo toqué: solo lo señalo para que quede registrado que el corte de
  referencia del encargo quedó desactualizado por trabajo ajeno a esta
  sesión.

También confirmé (solo lectura) que `C:\dev\vip-fitness` (el repositorio
activo real) sigue en `main` en `9b71c15`, con un único cambio sin commit
preexistente en `PAGOS_SERVICIOS.md` que **no es mío** — no lo toqué, no lo
descarté, lo dejé exactamente como estaba.

## Instrucciones para que Codex audite e integre o rechace

1. Revisar el diff completo de `196febf` contra `9b71c15` — es el único
   commit de esta rama sobre esa base.
2. Empezar por `src/lib/entrenamiento/impulso-avance.ts` y su test: es
   lógica pura, fácil de auditar de forma aislada y es el corazón de la
   Fase 4.
3. Después revisar el cableado en `SesionEjercicioCard.tsx` (busca
   `impulsoPendienteAvance` y `resultadosImpulso`) y en `SesionEjercicios.tsx`
   (`ejercicioResueltoDeVerdad`) — confirmar que no quedó ningún otro punto
   que siga leyendo `ejercicio.completado` a secas para decidir avance (hice
   un `grep` completo de `.completado` en `SesionEjercicios.tsx` y solo
   quedan los dos usos ya corregidos, pero vale la pena que Codex lo
   reconfirme con su propia pasada).
4. Para Fase 3 (`src/app/alumno/layout.tsx`,
   `src/components/admin/FichaAlumnoTabs.tsx`): confirmar en un entorno con
   credenciales reales que el enlace "Editar ficha" solo aparece para
   `admin`, nunca para `entrenador`, con una cuenta de cada rol — esto no se
   pudo probar en esta sesión.
5. **Antes de dar por cerrada la Fase 4, pedirle a Alejandro (o a quien
   tenga una cuenta de prueba) que la ejecute en vivo**: activar una
   intervención de Impulso VIP en la última serie de un ejercicio, completar
   la serie, confirmar que la tarjeta de resultado se ve y se puede
   responder ANTES de que aparezca la encuesta general del ejercicio, y que
   recién después de responder el resultado el ejercicio avanza. Repetirlo
   recargando la página justo después de marcar la última serie, antes de
   responder el resultado — no debe saltar al ejercicio siguiente.
6. Si se acepta el trabajo, se puede mergear directo a `main` (no hay
   conflicto esperado, la base es la misma) o pedir que yo abra un PR desde
   acá — no lo hice porque el encargo no lo pidió y no hay autorización para
   push.
7. Si se rechaza, el inventario de Fase 1
   (`INVENTARIO_CONTROL_PORTAL_V1.md`) sigue siendo válido como mapa del
   estado actual del panel, independiente de qué se decida sobre el resto.
