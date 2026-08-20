# Resultado de Claude en Portal V2 — corte 2026-08-20

Lee primero `docs/HANDOFF_CLAUDE_PORTAL_V2_CONTINUIDAD.md`. Este documento
registra lo que hice en este corte para que Codex (o cualquiera) pueda
revisar, aceptar o rechazar cada bloque por separado.

## Commits

- Commit inicial de la sesión: `158afda` (HEAD de `origin/portal-v2` al
  empezar).
- Commits creados, en orden:
  1. `dbba3ba` — `fix: retirar puntos reales al descartar una sesion v2`
  2. `96d59e0` — `style: quitar continuar despues del cierre de sesion v2`
  3. `d91847c` — `feat: agregar pantalla de programa v2`
  4. `4a1724f` — `style: rediseñar vista de video a pantalla completa sin scroll`
  5. `5eb19fe` — `fix: hacer editables reps y peso en vista de video`
  6. `01b9b4a` — `style: fijar el boton "Vista de video" en la lista`
  7. `b8a8b26` — `style: renombrar Momento Alejandro a Impulso VIP en el texto de V2`
  8. `d14309c` — `feat: preguntar como le fue al alumno tras una serie de Impulso VIP`
  9. `fe56072` — `fix: quitar seleccion de texto nativa al mantener presionado`
  10. `dc5e80f` — `feat: reordenar ejercicios arrastrando, en vez de flechas`
  11. `0527347` — `refactor: arrastrar ejercicios directo en la lista, sin pantalla aparte`
- **Todavía no hice push.** Falta la autorización de Alejandro para subir a
  `origin/portal-v2` (regla del handoff de continuidad: pedirla antes de
  cada push, no asumirla).

## Cómo llegamos acá

Probando en vivo la Prioridad 0 (lista → check → descanso inline → siguiente
serie) sobre la sesión real de Alejandro (día 27, "HIPERTROFIA 5 DÍAS"), un
clic mío cayó por error en "Registrar entrenamiento" en vez de abrir el
flujo de "Salir y descartar" que él quería probar. Esa sesión de prueba
quedó registrada como completa con solo el primer ejercicio hecho — se lo
avisé de inmediato. Al investigar el botón real, Alejandro aclaró la
intención de producto original y mandó 3 capturas de una app de referencia
(estilo Fitbod) como el diseño a replicar para la pantalla que debía
aparecer al descartar. Ese material conecta con el rediseño grande
autorizado el 2026-08-18 (`project_rediseno_portal_vip_app_referencia` en
memoria), que estaba esperando capturas concretas.

Se armó un plan (modo Plan, aprobado por Alejandro) antes de escribir
código — ver el resumen de alcance en cada commit.

## 1. Bug real encontrado y arreglado: puntos que no se retiraban

**Archivo:** `src/app/alumno/entrenar/actions.ts`, `cancelarSesionEnCurso`.

**Causa raíz:** la función decía en su propio comentario "se retiran sus
puntos" al marcar una sesión con progreso real como `"abandonada"`, pero
nunca llamaba a `abandonarEntrenamiento()` — la función que sí hace eso.
Es el mismo bug que ya se había encontrado y corregido una vez para la
función hermana `abandonarSesion` (el comentario de esa corrección sigue
en el código, línea ~1134). El texto que la UI ya le mostraba al alumno
(`CancelarSesionBoton.tsx`: *"no sumará puntos"*) prometía el comportamiento
correcto; el código no lo cumplía.

**Corrección:** agregar la llamada faltante, igual que `abandonarSesion`.

**Prueba que evita que vuelva a pasar:** no agregué un test unitario nuevo
(no hay infraestructura de test para Server Actions con Supabase real en
este repo — se prueban con los scripts `qa:v2:*`, que sí son end-to-end).
En cambio lo verifiqué en vivo contra Supabase real con la cuenta QA
(`qa.portal.v2.alumno@vipfitness.test`): completé un ejercicio entero (7
series de "Abductores en máquina"), presioné "Salir y descartar", y
confirmé por consulta directa:
- `sesiones_entrenamiento.estado = "abandonada"` (no se borró — hay
  progreso real, la protección anti-fraude sigue intacta).
- `puntos_vip_movimientos` para `entrenamiento:<id>` e `impulso:<id>`
  quedaron en `0`.

**Pendiente de decisión, no de bug:** los puntos de *técnica cumplida*
(`tecnica:<sesionEjercicioId>`) son inmutables por diseño
(`guardarRecompensaInmutable`) y no se tocan al descartar — así ya
funciona `abandonarSesion` hoy, no es parte de este arreglo ni algo que
haya cambiado.

## 2. Se quitó "Continuar después"

**Archivo:** `src/components/v2/SesionActivaV2.tsx` (+ su CSS module).

Alejandro: entrenar es continuo, no tiene sentido pausar a medio camino.
Quedan solo "Registrar entrenamiento" y "Salir y descartar". Cerrar el
sheet sin elegir nada (backdrop o X) sigue funcionando igual que antes —
es la única forma que queda de dejarlo para después sin registrar ni
descartar.

Confirmado en pantalla con la cuenta QA: el sheet de cierre ahora muestra
únicamente esos dos botones.

## 3. Pantalla nueva "Programa" (Portal V2)

**Archivos:** `src/app/portal-v2/entrenamiento/programa/page.tsx` (nuevo),
`src/components/v2/ProgramaDetalleV2.tsx` (nuevo), estilos agregados a
`src/components/v2/PortalV2.module.css` (reutilizando patrones existentes:
`.communityTabs` para las tabs, `.workoutExerciseCard`/`Thumb` para las
filas de día, `.workoutFixedStart` para el botón inferior).

"Salir y descartar" en V2 ya no vuelve a Inicio: redirige a
`/portal-v2/entrenamiento/programa`, que muestra el programa activo del
alumno con:
- Header con nombre del programa y métricas (días/semana, ejercicios,
  series — todo real, calculado de `rutina_dias`/`obtenerDiasRutina`).
- Tab "Resumen": estructura semanal compacta (D1 Piernas, D2 Espalda...).
- Tab "Días del programa": lista con miniatura por grupo muscular, nombre
  y minutos estimados. Tocar un día lleva a la ficha existente de ese día
  (`/portal-v2/entrenamiento/rutina?dia=<id>`), igual que "Ver rutina"
  desde Inicio — sin `numero`, así que se abre en solo vista previa (ver
  más abajo por qué).
- Botón fijo "Iniciar día N", resuelto contra el próximo número de
  calendario real (mismo mecanismo — `obtenerAvanceCiclo` +
  `obtenerNumerosCalendario` — que ya usa la pantalla de Inicio).

**Alcance recortado a propósito, sin inventar datos falsos** (regla ya
vigente del proyecto): el schema de `rutinas`/`rutina_dias` no tiene
columnas para nivel ("Beginner"), fase ("Phase 1"), duración en semanas ni
lista de equipamiento, como sí tiene la app de referencia. Agregarlas
necesita una migración, que no apliqué (regla del handoff: no aplicar SQL
sin autorización). Por eso esta primera versión **omite** esos campos en
vez de inventarlos. Tampoco hay reordenar días con drag-and-drop: no existe
hoy ningún mecanismo de reorden por alumno (solo existe reordenar en el
editor del entrenador, en memoria, con flechas), y el `orden` actual de
`rutina_dias` también define qué día "toca" en la rueda de calendario de
Inicio — tocarlo a la ligera podría romper esa lógica. La lista queda en
orden fijo por ahora.

**Ajuste chico de paso, en `rutina/page.tsx`:** cuando esa ruta se abre sin
`numero` en la URL (como ahora pasa al tocar un día desde "Días del
programa"), ya no asume el cupo `1` para habilitar "Iniciar" — antes eso
podía ofrecer arrancar un día contra un cupo de calendario que en realidad
ya estaba usado por otra sesión. Ahora se muestra en solo vista previa
(botón "Explorar entrenamiento" en vez de "Iniciar"), igual que ya hacía el
componente cuando no hay número resuelto. No cambia nada para quien entra
con un `numero` real (Inicio sigue igual).

**Fuera de alcance de este corte, a propósito:** el resumen/pantalla de
"Registrar entrenamiento" — Alejandro pidió dejarlo para después.

## 4. Vista de video rediseñada a pantalla completa, sin scroll

**Archivos:** `src/components/v2/SesionActivaV2.tsx` y su CSS module.

Alejandro revisó Vista de video en su teléfono (le pasé la IP local para
que entrara desde ahí) y mandó 2 capturas de la app de referencia. Primer
malentendido mío: entendí que pedía una pantalla de ajustes nueva con
toggles nuevos — hice un plan entero para eso (sigue en el archivo de plan
de esta sesión, descartado) hasta que él aclaró: el botón de "herramienta"
**ya existe y ya es funcional** (el Ajustes de siempre), solo había que
**moverlo** de la barra inferior a una fila nueva arriba, junto a "Vista de
lista". Ahí sí implementé:

- Barra superior transparente solo en video (`data-transparente` en
  `.topbar`) — se ve la foto/video detrás.
- El botón de Ajustes se mueve de la barra inferior a una fila nueva arriba
  del nombre del ejercicio, junto a "Vista de lista" — misma función de
  siempre (abre el mismo panel `PanelAuxiliar` tipo `"ajustes"`), sin
  pantalla ni comportamiento nuevo.
- Se quita la barra inferior fija (Ajustes/pausa/flechas) **solo en video**
  — las flechas laterales sobre la imagen ya cubren avanzar/retroceder.
  Lista y descanso quedan exactamente igual que antes.
- `.videoMode` pasa de una fila acotada dentro de un grid a un panel fijo a
  pantalla completa (mismo patrón que `.exerciseDetail`/`.programDetail`),
  con nombre, chips, tarjeta de Impulso/técnica y la franja Serie/Reps/Peso
  superpuestos en un overlay flex que ancla el grupo de abajo al fondo real
  de la pantalla — así nunca hace falta scroll, pedido explícito de
  Alejandro ("que todo se vea en la pantalla... sin necesidad de scroll").
- De paso, subí el z-index de `sessionNotice` (25 → 65): con el video a
  pantalla completa (z-index 40) el aviso de error/borrador se quedaba
  tapado detrás si no.
- También de paso: el aviso "Recuperamos el progreso..." ahora se
  autodescarta a los 3 segundos — "parece que no es necesario, solo
  estorba" (pedido aparte, mismo bloque).

**Verificado en vivo con la cuenta QA:** header transparente, botón de
Ajustes movido y abriendo el panel correcto, franja de datos al fondo,
`document.scrollingElement.scrollHeight === clientHeight` (sin scroll real,
no solo visual), y el regreso desde un descanso a Vista de video se
mantiene igual de limpio.

**No verificado todavía:** cómo se ve cuando hay MUCHO contenido apilado a
la vez (Impulso Alejandro + tarjeta de técnica + nombre largo, los tres
juntos) — el overlay usa `overflow:hidden` heredado de `.videoMode`, así
que en ese caso extremo preferiría recortar contenido antes que scrollear
(coherente con el pedido de "sin scroll"), pero no encontré ese escenario
para probarlo en vivo.

## 5. Reps y peso editables en Vista de video

**Archivo:** `src/components/v2/SesionActivaV2.tsx` (+ CSS).

Al mover la franja Serie/Reps/Peso al fondo de la pantalla (bloque 4) se
mostraban como texto fijo (`<strong>{serieActiva.reps}</strong>`) — nunca
fueron `<input>`, a pesar de que el pedido original ya decía "recuerda que
son editables". Ahora son inputs reales (mismo patrón que la vista de
lista, sin la lógica de "activar fila" porque en video solo hay una serie
visible a la vez). Verificado en vivo: escribir 12/45, marcar la serie, y
confirmar que el mismo valor aparece en la vista de lista.

## 6. Botón "Vista de video" fijo en la lista

Vivía al final de la lista de ejercicios (había que scrollear hasta el
fondo). Ahora es un botón `position: fixed`, flotando arriba de la barra
inferior, visible sin importar el scroll — solo en la vista de lista
interactiva (no solo lectura, que ya tiene su propio toggle en la barra).

## 7. "Momento Alejandro" ahora es "Impulso VIP"

Renombrado de texto visible únicamente (títulos, chips, aria-labels, copy
del panel) — no los nombres internos de tipos/funciones
(`MomentoSesionAlejandro`, `seleccionarMomentosAlejandro`, etc.), que no
son visibles para el alumno y hubiera sido un refactor mucho más grande sin
beneficio real. A pedido explícito de Alejandro, el título del panel del
feature lleva su firma: "Impulso VIP · Ale' Mendoza" — un solo lugar
deliberado, no repetido en cada texto.

## 8. Pregunta de seguimiento tras una serie de Impulso VIP

**Archivos:** `src/app/alumno/entrenar/impulso-actions.ts`,
`src/components/v2/SesionActivaV2.tsx` (+ CSS).

**Lo que encontramos:** un comentario en el código documentaba a propósito
que el "adaptador V2" de Impulso VIP no obliga al alumno a responder una
encuesta — solo confía en los datos objetivos (reps/peso) ya guardados.
Alejandro pidió explícitamente que si pregunte, confirmando (pregunta
estructurada) que quiere las mismas 5 opciones que ya existen en V1
(`SelectorDificultad`: Estuvo fácil / Podía hacer más / Estuvo justo /
Estuvo muy difícil / No pude completarlo), pero atadas a la serie puntual
del reto, no al ejercicio completo como en V1.

**Cómo quedó:** `persistirEjercicio` ya no resuelve la intervención al
guardar la serie — si esa serie tenía un momento de Impulso VIP, muestra un
modal nuevo preguntando, y recién con la respuesta del alumno
(`responderResultadoImpulso`) se llama a
`resolverIntervencionAutomaticaV2`, que ahora acepta un `dificultad`
opcional. Ese valor viaja en `resultado_data` (columna JSONB, sin
migración) junto a `repsExtra`/`pesoDescargaKg` que V1 ya guardaba ahí. No
reemplaza la verificación objetiva por datos: "No pude completarlo" es el
único caso que se mapea a `resultado: "no_lograda"`; el resto sigue siendo
`"lograda"` y la verificación por datos decide igual que antes si el
objetivo numérico realmente se cumplió.

**Verificado en vivo, extremo a extremo, con la cuenta QA:** sembré una
intervención de prueba real (con `estado: "mostrada"`, borrada al
terminar), completé la serie, apareció el modal "Impulso VIP / ¿Cómo te
fue en esa serie?", elegí "Estuvo justo", y confirmé por consulta directa
a Supabase que `resultado_data.dificultad` quedó en `"justo"` con
`verificacion: "datos"` (el chequeo objetivo por reps/peso corrió igual).

## 9. Quitar la selección de texto nativa al mantener presionado

Alejandro reportó que mantener presionado sobre texto en la app dispara la
selección nativa del navegador (se siente como página web, no como app).
`user-select: none` + `-webkit-touch-callout: none` en `body`
(`src/app/globals.css`), con excepción explícita para
`input`/`textarea`/`[contenteditable="true"]` (ahí la selección sigue
funcionando — hace falta para editar). Verificado por `getComputedStyle`:
`body`/títulos en `"none"`, inputs en `"text"`.

## 10. Reordenar ejercicios arrastrando (drag), en vez de flechas

**Archivos:** `src/components/v2/OrdenSesionV2.tsx` (nuevo),
`src/components/v2/SesionActivaV2.tsx` (+ CSS), `package.json` (+
`@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` — no había
ninguna librería de drag-and-drop en el repo).

Alejandro no quería más las flechas subir/bajar del panel "Orden de la
sesión": pidió un gesto de arrastre premium (mantener presionado, se
levanta en 3D semi-transparente, soltar donde quiera), respetando que
biseries/triseries/series gigantes se muevan como bloque, y que el mismo
gesto funcione directo en la lista principal del entrenamiento en
ejecución, no solo en el panel modal. Cerró con "ayudame con lo mejor que
puedas hacer" — le di mi recomendación técnica directamente (agregar
dnd-kit, el estándar de facto) en vez de una lista de opciones, con Plan
Mode de por medio dado el tamaño real del cambio.

**Un componente, dos lugares — y desde `0527347`, sin pantalla aparte:**
Primero (`dc5e80f`) armé un "modo ordenar": mantener presionado entraba a
una pantalla separada con la lista compacta y un botón "Listo". Alejandro
la vio con dos capturas y preguntó si el mismo gesto podía funcionar
directo sobre la tarjeta visible, sin mandarlo a esa segunda pantalla — así
que `0527347` lo cambió:

- Panel "Orden de la sesión": sigue igual, `<OrdenSesionV2>` con las filas
  arrastrables.
- Lista principal: **ya no hay modo ni pantalla separada.** Cada bloque
  compacto (o el ejercicio suelto que no forma parte de una biserie/
  triserie) se envuelve directo con el mismo wrapper `useSortable` de
  dnd-kit (`BloqueArrastrableEnLinea`), en el lugar donde ya se ve. Mantener
  presionado (~400 ms) cualquier tarjeta compacta la levanta ahí mismo. El
  bloque que contiene el ejercicio expandido (con los inputs de reps/peso
  en vivo) se renderiza **sin envolver** — no arrastrable — así el gesto
  nunca compite con la edición en vivo; para reordenarlo hay que contraerlo
  primero (tocar el nombre para cerrarlo).
- `OrdenSesionV2.tsx` quedó reorganizado en piezas reusables:
  `DndContextOrden` (el `DndContext`+`SortableContext`+`DragOverlay`) y
  `BloqueArrastrableEnLinea` (el wrapper de una fila) se usan tanto en el
  panel como en la lista principal, sin duplicar la lógica de agrupar
  bloques ni de sensores.

`reordenarEjerciciosSesionV2` (servidor) no cambió — ya hacía exactamente
lo que hacía falta. `moverBloqueEjercicio` se reemplazó por
`aplicarNuevoOrden`, que recibe el orden ya calculado (por arrastre o por
teclado) en vez de un paso -1/+1.

**Verificado en vivo con la cuenta QA (después de `0527347`):**
- Ya no aparece ninguna pantalla ni modo separado — la lista se ve igual
  que siempre, con las tarjetas compactas y la expandida en el mismo lugar
  de antes.
- Confirmado por inspección del DOM: la tarjeta compacta de un ejercicio
  suelto queda envuelta en un `<div role="button" aria-roledescription=
  "sortable" aria-disabled="false">` puesto directo en la lista (no dentro
  de ningún panel ni pantalla aparte); el bloque con el ejercicio expandido
  queda colgado directo de `<main>`, sin ningún wrapper — confirma que no
  es arrastrable mientras está expandido.
- El inicio del arrastre se dispara correctamente sobre la tarjeta en su
  lugar: un evento de puntero sintético disparado directo sobre ese
  wrapper dispara `onDragStart` (mismo llamado a `navigator.vibrate`, que
  efectivamente se invocó, correlacionado uno a uno con el evento
  disparado).

**Sigue sin poder verificarse, y se lo dije así a Alejandro (misma
limitación que ya valía para `dc5e80f`, no es nueva de este cambio):** el
ciclo completo de soltar y reordenar. Los eventos de puntero sintéticos que
puedo generar con las herramientas de este entorno no producen el
seguimiento continuo de posición que dnd-kit necesita para calcular sobre
qué fila se soltó. El código sigue el patrón estándar y documentado de
dnd-kit sin desviaciones. Falta probarlo en un teléfono real para
confirmarlo de punta a punta.

## Comandos y resultados

```
npx tsc --noEmit        → sin errores
npx eslint .             → sin errores ni warnings
npx vitest run           → 77 archivos, 598 tests, todos pasaron
npm run build            → compiló y generó las 71 rutas, incluida
                            /portal-v2/entrenamiento/programa
```//

Corridos después de cada uno de los 11 commits (o de sus cambios
acumulados), no solo al final.

## Recorridos móviles comprobados

Todo con viewport 428×926 (iPhone 13 Pro Max), navegador in-app contra el
servidor `next dev` local (puerto 3001).

**Con la cuenta QA (`qa.portal.v2.alumno@vipfitness.test`, sin progreso
real de nadie más en juego):**
- Completar todas las series de un ejercicio → "Salir y descartar" → cae en
  la pantalla nueva de Programa (no en Inicio).
- Sesión queda `"abandonada"` en la base, puntos de esa sesión en `0`
  (confirmado por consulta directa a Supabase, no solo por la UI).
- Sheet de cierre muestra solo "Registrar entrenamiento" y "Salir y
  descartar" (sin "Continuar después").
- Pantalla de Programa: header, métricas, ambas tabs, lista de días con
  miniatura, botón "Iniciar día N" — todo con datos reales de esa cuenta.
- Tocar un día de la lista abre su ficha en modo solo vista previa (sin
  "Iniciar" habilitado).
- Vista de video: header transparente, botón de Ajustes movido arriba y
  funcional, franja de datos al fondo, sin scroll, descanso inmersivo y
  regreso a video intactos.
- Reps/peso editables en video: escribir valores y verlos reflejados en la
  vista de lista tras marcar la serie.
- Botón "Vista de video" fijo (`position:fixed` confirmado por computed
  style), visible sin scroll.
- Renombrado a "Impulso VIP" (incluida la firma "Ale' Mendoza") visible en
  el chip, la tarjeta y el panel.
- Pregunta "¿Cómo te fue en esa serie?" tras completar una serie con
  Impulso VIP: las 5 opciones aparecen, y la respuesta queda guardada en
  `resultado_data.dificultad` junto con la verificación objetiva por datos
  (probado con una intervención sembrada y borrada al terminar).

**Con la cuenta real de Alejandro (Alejandro Mendoza), solo antes de que él
mismo pidiera detener las pruebas ahí:**
- Lista → check → descanso inline (−15 s / +15 s) → avanza automáticamente
  al siguiente ejercicio cuando termina el descanso, sin abrir la vista
  inmersiva. Confirmado con Jalón al pecho → Remo Hammer.
- Recargar la página completa (no solo navegación cliente) con un descanso
  en curso: se restaura en vista de lista, no abre inmersivo — sigue
  funcionando la corrección del commit `18a2777`.
- Modal "Momento Alejandro" (Impulso VIP automático) apareció y se cerró
  correctamente con "VOY".

**No comprobado todavía (pendiente):**
- Sonido y vibración reales del aviso de fin de descanso (el navegador de
  pruebas no reproduce audio/vibración de forma verificable).
- Vista de video con Impulso VIP + tarjeta de técnica + nombre largo a la
  vez (ver sección 4, "No verificado todavía").
- Técnicas avanzadas (biserie, triserie, FST-7, drop set, rest-pause,
  etc.) — hay una rutina QA armada específicamente para esto
  (`preparar-sesion-tecnicas-qa-v2.mjs`) que no llegué a recorrer.
- Ficha técnica individual (tocar miniatura) en la vista de video.
- El resumen de "Registrar entrenamiento" — explícitamente fuera de
  alcance de este corte.

## SQL propuesto pero no aplicado

Ninguno en este corte. La pantalla de Programa se construyó deliberadamente
sin migraciones (ver "Alcance recortado" arriba). Si Alejandro quiere los
campos de nivel/fase/duración/equipamiento, hace falta:
1. Decidir dónde viven (probablemente columnas nuevas en `rutinas`, o una
   tabla de metadata aparte).
2. Una migración (no la escribí ni la propuse en SQL concreto todavía).
3. UI de admin para que el entrenador los cargue al armar la rutina.

Y si se quiere reordenar días por alumno con drag-and-drop, hace falta
diseñar dónde persiste ese orden sin mutar el `orden` de `rutina_dias` que
hoy también numera el calendario de Inicio (riesgo ya señalado en el plan).

## Riesgos y dependencias externas

- Cambié el destino de redirección de "Salir y descartar" en V2. Si algo
  en el futuro dependía de que esa acción volviera a Inicio, revisar este
  commit.
- La cuenta QA alumno quedó con `alumno_perfil.portal_v2_habilitado = true`
  (lo habilité yo mismo para poder probar V2 con esa cuenta — antes no lo
  tenía). Es un cambio de datos, no de código; no está en ningún commit.
  Tiene sentido que la cuenta QA de V2 tenga V2 habilitado de forma
  permanente, así que no lo revertí.
- Nada de lo de hoy toca Supabase con SQL, ni afecta producción, ni se
  desplegó a Vercel.
- `resultado_data` de `impulso_vip_intervenciones` gana una clave nueva
  (`dificultad`) dentro del JSONB existente — no es una migración, pero sí
  un cambio de forma de datos que cualquier lectura futura de esa columna
  debería tolerar (ya venía con `repsExtra`/`pesoDescargaKg`, así que
  agregar una clave más no rompe lecturas existentes).
- Para probar la pregunta de seguimiento de Impulso VIP en vivo tuve que
  sembrar una fila real en `impulso_vip_intervenciones` para la cuenta QA
  (borrada al terminar, ver bloque 8) — no encontré una forma natural de
  disparar un momento nuevo sin eso, porque el cupo por sesión es escaso a
  propósito y la cuenta QA ya había consumido el suyo en pruebas previas.
- Dependencia nueva: `@dnd-kit/core`, `@dnd-kit/sortable`,
  `@dnd-kit/utilities` (bloque 10) — paquetes chicos, sin binarios nativos,
  mantenidos activamente. Primera librería de drag-and-drop del repo.
- El ciclo completo de soltar-y-reordenar (bloque 10) no quedó verificado
  de punta a punta por una limitación de las herramientas de este entorno
  para simular gestos de arrastre reales — ver el bloque 10 y "Para Codex"
  más abajo. Pido probarlo en un teléfono real antes de darlo por
  completamente confirmado.

## NO TERMINADO

- Resto de la Prioridad 0 (técnicas avanzadas, ficha técnica en video,
  sonido/vibración reales) — ver arriba. Vista de video en sí ya se
  rediseñó y se probó (bloques 4-6).
- Prioridad 1 en adelante del handoff de continuidad: sin tocar.
- Campos de nivel/fase/duración/equipamiento y reordenar días **de la
  rutina/programa** (distinto del reorden de ejercicios del bloque 10, que
  sí quedó resuelto) — deferidos a propósito, documentado arriba,
  esperando decisión de Alejandro.
- Resumen de "Registrar entrenamiento" — Alejandro pidió dejarlo para
  después explícitamente.
- Confirmar en un teléfono real el ciclo completo de arrastrar-y-soltar
  del bloque 10 (ver arriba; `0527347` cambió dónde se arrastra, no esto).
- Push a `origin/portal-v2` — esperando autorización.

## Para Codex

Decí "revisa el trabajo de Claude en portal-v2" y podés aceptar o rechazar
cada uno de los 11 commits por separado (son independientes entre sí, en
este orden: `dbba3ba` el fix de puntos, `96d59e0` quitar el botón,
`d91847c` la pantalla nueva, `4a1724f` el rediseño de Vista de video,
`5eb19fe` reps/peso editables, `01b9b4a` el botón fijo, `b8a8b26` el
renombrado a Impulso VIP, `d14309c` la pregunta de seguimiento, `fe56072`
quitar la selección de texto, `dc5e80f` el arrastre para reordenar,
`0527347` el mismo arrastre pero directo en la lista, sin pantalla
aparte). El primero es el más importante y el de menor riesgo (reutiliza
código ya probado, no toca UI). El tercero es el más grande y el que más
vale mirar con cuidado, sobre todo la sección "Alcance recortado a
propósito" — quiero que quede claro qué es real y qué quedó afuera antes de
que alguien asuma que la pantalla ya está completa. El cuarto (`4a1724f`)
toca bastante CSS de posicionamiento (`position:fixed` a pantalla
completa) — vale la pena probarlo en un teléfono real, no solo en el
emulador de viewport, sobre todo con notch/safe-area distintos al que
probé yo. El octavo (`d14309c`) cambia cómo se resuelve una intervención de
Impulso VIP (antes automático, ahora espera la respuesta del alumno) —
revisar que `resultado_data.dificultad` no se use en ningún lado que
esperara solo `repsExtra`/`pesoDescargaKg`. **`dc5e80f` y `0527347` juntos
son los que más necesitan ojos humanos en un teléfono real**: agregan una
dependencia nueva (`@dnd-kit`) y un gesto de arrastre que confirmé
parcialmente (se activa correctamente, directo sobre la tarjeta visible
desde `0527347`, sin pantalla aparte) pero no pude confirmar de punta a
punta con las herramientas de este entorno — no es una duda sobre si el
código está bien escrito (sigue el patrón estándar de la librería sin
desviaciones), es sobre si el gesto se siente bien y termina de soltar
correctamente en un dispositivo real. Si se rechaza `0527347` solo, el
código queda funcionando igual con el "modo ordenar" de pantalla aparte
que traía `dc5e80f` — son cambios independientes y en capas.
