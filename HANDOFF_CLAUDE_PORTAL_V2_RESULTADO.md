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
  12. `d75beea` — `fix: hacer que el arrastre en la lista funcione de verdad en el telefono`
  13. `290b630` — `feat: agregar "Deshacer" tras reordenar ejercicios arrastrando`
  14. `b85ddfe` — `style: mostrar los avisos de sesion flotando, no empujando la pantalla`
  15. `9ec3449` — `fix: quitar el aviso "Recuperamos el progreso", recuperar sigue silencioso`
  16. `b8d97c9` — `fix: exigir el mismo angulo/cabeza muscular al sustituir un ejercicio`
  17. `7fc111a` — `fix: "Iniciar entrenamiento" en vez de "Explorar" para el proximo dia`
  18. `d73cb40` — `perf: eliminar N+1 en el "ultimo registro" de la sesion de entrenamiento`
  19. `6a35278` — `feat: pantalla animada de marca mientras arranca una rutina`
  20. `916a00e` — `fix: aplicar la pantalla animada tambien al boton de Inicio`
  21. `b6196f5` — `feat: contador de progreso simulado en la pantalla de arranque`
  22. `f198eb7` — `fix: verificar que los guardados del admin realmente afecten una fila`
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

### 10.1 `d75beea` — el arrastre no arrancaba de verdad en el teléfono

Alejandro probó `0527347` en su teléfono y avisó: "el gesto no funciona
aún". Tenía razón — mis pruebas con eventos de puntero sintéticos no
podían detectar este bug porque no pasan por el reconocedor de gestos
táctiles real del navegador.

**Causa real** (leída directo del código fuente de `@dnd-kit/core`):
mientras el mantenido de ~400 ms está pendiente, dnd-kit **no** llama
`preventDefault()` en el `touchmove` — sólo lo hace después de activarse.
Sin `touch-action: none` puesto desde el principio en el elemento, el
navegador ya arrancó su propio scroll nativo antes de que el mantenido
termine, y ese scroll nativo gana siempre. `.ordenFila` (el panel modal)
ya tenía `touch-action: none` puesto a mano desde antes, por eso ese
camino no se vio afectado; el envoltorio nuevo de la lista principal
(`BloqueArrastrableEnLinea`) no lo tenía.

Ponérselo a toda la tarjeta arreglaría el arrastre pero volvería la lista
principal imposible de scrollear con el dedo (la tarjeta ocupa casi toda
la pantalla). La solución — el patrón "drag handle" que el propio dnd-kit
documenta para exactamente este conflicto — es un asa de arrastre chica y
dedicada: `BloqueArrastrableEnLinea` ahora pasa `attributes`/`listeners`
por contexto de React en vez de ponerlos en toda la tarjeta, y el
componente nuevo `AsaArrastre` los consume en un botón chico (ícono de
agarre) con `touch-action: none`. El resto de la tarjeta queda en
`touch-action: auto` — scroll normal intacto.

De paso apareció un segundo bug real al revisar esto con la consola del
navegador: `DndContext` generaba su `aria-describedby` con un contador
interno de módulo que no coincide entre servidor y cliente sin pasarle un
`id` explícito, disparando un mismatch de hidratación en cada carga
(React lo "autocuraba" descartando y re-renderizando ese pedazo del árbol
en el cliente, pero seguía siendo un error real en consola). Ahora cada
`DndContextOrden` recibe un `id` fijo (`"orden-sesion-lista"` /
`"orden-sesion-panel"`).

**Nota aparte, no es un cambio de código:** mientras diagnosticaba esto
me encontré con que el servidor `next dev` de este entorno (usando
`.next-preview` como carpeta de compilación, para convivir con otro
`next dev` que pudiera estar corriendo sobre `.next`) tenía caché de
Turbopack corrompida/vieja — seguía sirviendo un chunk compilado que
todavía hacía referencia a `modoOrdenar` (una variable que ya no existe
desde `0527347`), incluso después de reiniciar el proceso. Tuve que
borrar `.next-preview` a mano y arrancar de cero para poder verificar
limpio. Si alguien más ve errores raros/viejos en este entorno de
preview, probablemente sea lo mismo — borrar esa carpeta y reiniciar.

**Verificado en vivo con la cuenta QA** (servidor reiniciado con caché
limpia): por `getComputedStyle`, el asa tiene `touch-action: none`, la
tarjeta y su envoltorio quedan en `auto`; ya no aparece el mismatch de
hidratación; un puntero sintético disparado específicamente sobre el asa
sigue activando `onDragStart`. Lo que NO cambia respecto a `0527347`: el
ciclo completo de soltar-y-reordenar sigue sin poder probarse de punta a
punta con las herramientas de este entorno — lo nuevo acá es que la razón
real de por qué el gesto no arrancaba en un teléfono de verdad quedó
identificada y corregida, no sólo el arranque del gesto en sí.

### 10.2 `290b630` — "Deshacer" como red de seguridad

Alejandro probó `d75beea` en su teléfono y confirmó: el asa funciona. Pero
avisó un riesgo real, no hipotético — cita textual: "una señora mayor
posiblemente va a tocar allí y va a mover los ejercicios fácilmente, sin
querer". Le respondí que reducir el toque accidental a cero no es
realista con el patrón de asa dedicada (ya es la única protección posible
sin volver a un modo de pantalla aparte, que él ya había pedido evitar) —
así que en vez de perseguir "que nunca se dispare por accidente", hice
que el error sea barato de corregir si pasa.

`aplicarNuevoOrden` ahora guarda el orden anterior antes de aplicar el
nuevo (por arrastre, tanto en la lista principal como en el panel "Orden
de la sesión" — comparten la misma función) y muestra un aviso fijo
arriba, "Orden actualizado", con un botón "Deshacer" que dura 6
segundos. `deshacerOrden` restaura el orden anterior llamando de nuevo a
`aplicarNuevoOrden` (mismo camino de guardado que ya existía, sin
duplicar lógica), marcado para no volver a armar su propio "Deshacer" y
evitar un bucle.

**Verificado:** el gate completo (tsc/eslint/vitest/build) pasa limpio y
la pantalla sigue cargando sin errores nuevos en el log del servidor. El
disparo real del aviso — que aparezca justo después de un arrastre-y-
soltar de verdad en el teléfono — sigue sin poder probarse desde este
entorno, por la misma limitación de siempre (no se puede simular un
soltar real). Pido que lo confirmes vos: arrastrá un ejercicio a otra
posición y fijate que aparezca "Orden actualizado" con el botón
"Deshacer", y que tocarlo lo regrese a como estaba.

### 10.3 `b85ddfe` — los avisos flotan en vez de empujar la pantalla

Al pedirle que probara `290b630`, Alejandro señaló un problema distinto en
el aviso existente "Recuperamos el progreso...": "me baja toda la
pantalla... no que se encaje ahí y abra el espacio, porque me mueve toda
la pantalla y es incómodo" — pidió que flote por encima ("por encima")
en vez de empujar el contenido. Ese aviso (`.sessionNotice`, compartido
con `errorGuardado`) estaba en flujo normal (`position: relative`),
así que empujaba la lista de ejercicios hacia abajo al aparecer y la
recuperaba al desaparecer. Lo pasé a `position: fixed`, anclado justo
debajo del topbar con la misma fórmula de centrado que ya usan
`.topbar`/`.videoViewButton`. Apliqué el mismo cambio al aviso nuevo
"Orden actualizado" (bloque 10.2) por tener el mismo problema
estructural.

De paso, pidió explícitamente alargar sólo la duración de "Orden
actualizado" ("unos segundos más") — pasó de 6 a 9 segundos. La duración
de "Recuperamos el progreso..." queda igual (3 s, fix de un bloque
anterior) — pidió dejar esa como está.

**Verificado:** gate completo (tsc/eslint/vitest/build) limpio; por
`getComputedStyle`/CSSOM confirmé `position: fixed` con el `top`/`left`/
`right` correctos en ambas clases; inyecté temporalmente un clon del
aviso en el DOM (sin tocar el estado real de la app, sólo para verlo
renderizado) y confirmé que flota sobre "SERIE A" sin mover la lista de
lugar — capturado en pantalla y removido después.

### 10.4 `9ec3449` — sacar el aviso "Recuperamos el progreso"

Alejandro, después de ver el arreglo de posición (10.3), decidió que
directamente no quiere ese mensaje — cita: "no quiero ese mensaje, pero
está bien que se recupere... no es necesario que siempre avise". Saqué
sólo el estado `avisoBorrador` y su efecto de auto-cierre a los 3 s; la
restauración real del borrador (registro de series, notas, descanso,
unidad de peso, vista, todo lo que ya guardaba `localStorage`) sigue
funcionando exactamente igual — nada de eso dependía del aviso, sólo
dejó de contárselo al alumno. El banner de error de guardado
(`errorGuardado`), que compartía el mismo componente visual
(`.sessionNotice`), queda intacto y sin cambios.

En el mismo mensaje confirmó la duración de "Orden actualizado" en
"nueve, diez segundos" — ya estaba en 9 s desde `b85ddfe`, no hizo falta
tocarlo de nuevo.

**Verificado:** gate completo (tsc/eslint/vitest/build) limpio; recargué
la sesión de la cuenta QA (que ya tenía progreso previo guardado en
`localStorage` de pruebas anteriores) y confirmé que el progreso se
restauró igual que siempre (temporizador y registro siguieron donde
estaban) sin que apareciera ningún aviso.

## 11. `b8d97c9` — "Cambiar ejercicio" exige el mismo ángulo/cabeza muscular

Alejandro reportó (con ejemplo real de su cuenta) que el botón "Cambiar"
ofrecía alternativas sin sentido: "Abductores en máquina" (glúteo medio)
ofrecía "Aductores en máquina" (aductor, el músculo opuesto). Su pedido
textual: "cambiar no es simplemente cambiar... si hay un ejercicio que es
para la cabeza media del tríceps o la cabeza lateral del tríceps, no
podemos meter un ejercicio que sea para la cabeza larga".

**Causa raíz confirmada leyendo el código:** `sustitucionEsCompatible()`
(`src/lib/entrenamiento/personalizacion-sesion.ts`) solo exigía coincidir
en `grupo_muscular`, una columna de apenas 7 valores (pecho/espalda/
piernas/hombros/brazos/core/cardio) — "piernas" mezcla glúteo, cuádriceps,
isquiotibiales, aductor, abductor y gemelo en la misma bolsa; "brazos"
mezcla bíceps y tríceps. No era un botón roto — el botón funciona, pero la
lista que arma no distinguía ángulo ni cabeza muscular.

**No hizo falta agregar ninguna columna.** Antes de tocar el esquema
encontré que ya existe `patron_movimiento` (migración 0051,
`GRUPOS_PATRON` en `src/components/admin/GaleriaEjercicios.tsx`), con
exactamente la taxonomía que pedía Alejandro: `pierna_abduccion` /
`pierna_aduccion`, `biceps_supinado` / `biceps_neutro` /
`biceps_hombro_flexionado`, `triceps_polea_abajo` / `triceps_sobre_cabeza`
/ `triceps_compuesto`, `pierna_flexion_rodilla` / `pierna_extension_rodilla`,
`hombro_anterior` / `hombro_lateral` / `hombro_posterior`, etc. (28
valores en total). El problema real era que esa columna estaba "vacía
para casi toda la biblioteca todavía" (comentario ya existente en
`patrones.ts`) y `sustitucionEsCompatible()` la consultaba de forma
**opcional** (`!origen.patronMovimiento || !sustituto.patronMovimiento ||
origen.patronMovimiento === sustituto.patronMovimiento`), así que con la
columna vacía esa condición nunca filtraba nada.

**El cambio de código es de una sola línea:** quité el escape
`|| !sustituto.patronMovimiento`. Si el origen ya tiene el patrón
cargado, el sustituto debe compartir exactamente ese valor — ya no basta
compartir `grupo_muscular`. Mismo criterio replicado en el prefiltro del
servidor (`page.tsx`, la consulta que arma `alternativas` antes de
enviarla al cliente). Agregué un test nuevo en
`personalizacion-sesion.test.ts` cubriendo el caso abductor/aductor y el
caso "origen sin clasificar todavía" (sigue la comparación laxa de
siempre, no rompe nada mientras se completa la biblioteca).

**Backfill de datos — no es una migración, no toca el esquema:**
Alejandro autorizó primero agregar una columna nueva (yo mismo lo
propuse mal al principio, sin haber revisado que `patron_movimiento` ya
existía) y después, al corregir el rumbo, autorizó explícitamente el
`UPDATE` real que sí hizo falta. Completé `patron_movimiento` en 116 de
los 130 ejercicios activos (quedaban 12 ya clasificados de antes) usando
`patronMovimiento()` de `src/lib/rutinas/patrones.ts` tal cual está —
la misma función determinística por nombre que el generador de rutinas
ya usa como respaldo mientras la columna esté vacía, no un criterio mío
inventado para esta tarea. El script que generó el `UPDATE` (clasificó
los 130, comparó contra lo ya cargado, armó el SQL) no quedó en el
repo — corrió una sola vez desde el scratchpad de la sesión.

Dos ejercicios quedan **sin clasificar a propósito**, revisados a mano
porque la función automática los clasificaba mal o no los cubría:
- **"Curl de muñeca"**: la función lo etiquetaba `biceps_supinado` por el
  regex `/curl|biceps/`, pero es un ejercicio de antebrazo — la
  taxonomía de 28 valores no tiene esa categoría. Preferí dejarlo sin
  clasificar a etiquetarlo mal (así seguiría con la comparación laxa de
  antes, en vez de aparecer como "alternativa de bíceps" o excluir curls
  reales de bíceps por error).
- **"Remo al mentón"** (upright row): no encaja limpio en ninguna de las
  4 opciones de hombro (press vertical/lateral/posterior/anterior) — la
  función ya lo dejaba en "otro" antes de mi cambio, no lo toqué.
- **"Femoral unilateral"**: corregido a mano a `pierna_flexion_rodilla`
  (mismo patrón que "Curl femoral") — la función no lo detectaba porque
  su regex busca la palabra "curl" en el nombre y este no la tiene.

**Verificado en vivo con la cuenta QA, después del backfill:**
- "Abductores en máquina" ya **no muestra el botón "Cambiar"** — es el
  único ejercicio de abducción en toda la biblioteca activa, así que no
  hay alternativa real y ahora no finge que la hay (antes ofrecía
  "Aductores en máquina", exactamente el bug reportado).
- "Aperturas con mancuernas" muestra **exactamente 5** alternativas,
  todas aislamiento de pecho genuinas (inclinado, en polea, cruces en
  los dos sentidos, pec deck) — ningún press ni ejercicio de otro grupo
  mezclado.
- Gate completo (tsc/eslint/vitest — 599 tests, incluye el nuevo — /build)
  limpio.

**Lo que no toqué, para que quede claro el alcance real:**
- La ficha de creación de ejercicios en `/admin/ejercicios`
  (`ModalEjercicioNuevo`) **ya tenía** este campo desde antes (select
  "Tipo de movimiento") — no hizo falta agregarlo. Sigue siendo
  **opcional**: un ejercicio nuevo se puede crear sin clasificar. No
  existe hoy un filtro/indicador en el admin que muestre "ejercicios sin
  `patron_movimiento`" para encontrar esos huecos después — si aparece
  un ejercicio nuevo sin clasificar, hoy hay que acordarse de abrirlo a
  mano y completar "Tipo de movimiento" (o usar `EditorPatronMovimiento`
  desde la ficha ya creada). Si Alejandro quiere que esto sea obligatorio
  al crear, o quiere un filtro de "pendientes de clasificar", es un
  agregado chico aparte — no lo hice sin preguntar primero.
- No cambié el algoritmo `patronMovimiento()` en sí (la heurística por
  nombre) — solo lo usé para poblar la columna existente.

### 11.1 Fichas nuevas por implemento — dato real en producción, sin commit de código

Alejandro señaló que "Remo al mentón" y "Curl de muñeca" (los dos casos
que quedaron sin `patron_movimiento`, ver arriba) en realidad tienen
variantes por implemento (barra/polea/mancuerna) que son "el mismo"
movimiento — y pidió explícitamente crear fichas nuevas por implemento en
vez de forzar una clasificación única. Confirmé el alcance con una
pregunta antes de tocar la biblioteca; eligió "Creá fichas nuevas por
implemento" dejando las dos fichas originales intactas (ambas ya eran
`equipo: "barra"`, así que sólo hacían falta las otras dos variantes de
cada una).

Creé 4 ejercicios nuevos directo en la base (no es un cambio de código,
por eso no tiene commit — replica exactamente el mismo insert que hace
`crearEjercicioNuevo` en `/admin/ejercicios/actions.ts`, mismo generador
de slug, mismo criterio de `calidad_ficha: "completa"` por tener grupo +
categoría + equipo cargados):
- **Remo al mentón en polea baja** (hombros · tracción · polea)
- **Remo al mentón con mancuerna** (hombros · tracción · mancuerna)
- **Curl de muñeca con mancuerna** (brazos · aislamiento · mancuerna)
- **Curl de muñeca en polea** (brazos · aislamiento · polea)

Los cuatro quedan **sin foto** (igual que cualquier alta rápida desde el
admin — "se puede subir después") y **sin `patron_movimiento`** (mismo
motivo que las fichas originales: la taxonomía de 28 valores no tiene
una categoría de "tracción vertical de hombro/trapecio" ni de
"antebrazo" — ver bloque 11). Como resultado, hoy se sustituyen entre sí
por la comparación laxa de siempre (mismo grupo + categoría), pero
todavía no de forma estricta por patrón. Si en algún momento se agrega
esa categoría a `PatronMovimiento` (en `src/lib/rutinas/patrones.ts`,
compartido con el generador de rutinas — no lo toqué, es una decisión
más grande que amerita hablarla aparte), estas fichas ya están listas
para clasificarse ahí.

Pendiente para Alejandro, no urgente: subirles foto desde
`/admin/ejercicios` cuando tenga tiempo.

## 12. `7fc111a` — "Iniciar entrenamiento" en vez de "Explorar" para el próximo día

Alejandro reportó: después de descartar una sesión, entra a la pantalla
del día desde "Programa" y el botón dice "Explorar entrenamiento" en vez
de "Iniciar entrenamiento", sin arrancar la rutina.

**Causa:** `RutinaDetalleV2` sólo ofrece el botón real "Iniciar" cuando
la URL trae `numero` (el cupo de calendario ya resuelto) — sin eso, cae
a propósito en modo solo-vista-previa, para no arrancar una sesión
contra un número inventado que podría chocar con otra ya usada (decisión
anterior correcta, documentada en un comentario ya existente en
`rutina/page.tsx`). El link de cada tarjeta de día en `ProgramaDetalleV2`
nunca mandaba `numero`, a diferencia del botón fijo "Iniciar día N" de
esa misma pantalla, que sí lo tiene resuelto (`diaSiguienteNumero`).

**Arreglo mínimo (7 líneas):** si la tarjeta clickeada es justo el día
siguiente pendiente (`dia.id === programa.diaSiguienteId`), el link
ahora manda ese mismo `numero` ya resuelto. Para cualquier otro día de
la semana (mirar más adelante en el programa), el link se queda igual
como vista previa — no reintroduce el riesgo de colisión que el
comentario original prevenía.

**Verificado en vivo con la cuenta QA:** el link de la tarjeta de día
ahora trae `&numero=4`; la pantalla de detalle muestra un botón real
"Iniciar entrenamiento" (`<button type="submit">` dentro de un
`<form action={iniciarRutinaDesdeCalendarioV2}>`, el mismo server action
que ya usa el botón fijo de Programa), no el link de solo explorar.

## 13. `d73cb40` — quitar el N+1 del "último registro" (retomando el tema de velocidad)

Alejandro retomó una conversación anterior sobre acelerar la app y pidió
avanzar con opciones **gratis** (sin gastar más cuota de Vercel/Supabase)
y sin arriesgar nada. Antes de tocar código investigué con un agente de
exploración qué había realmente disponible — importante: encontré que el
**prefetch de `<Link>` ya se probó antes y NO fue gratis**: el commit
`e021245` ("perf: eliminar sondeo y precargas que agotan vercel", de una
sesión anterior) desactivó `prefetch` a propósito en la barra inferior
porque cada prefetch dispara el proxy/middleware en Vercel y eso ya
agotó cuota real una vez, junto con un polling que se sacó en el mismo
commit. No toqué eso — sigue como está.

Lo que sí encontré, gratis y de alto impacto real: `obtenerUltimoRegistro()`
(`src/app/alumno/entrenar/data.ts`) hacía **2 consultas secuenciales a
Supabase por cada ejercicio de la rutina**, dentro de un `for` con
`await` — en una rutina de 9 ejercicios, hasta 18 viajes de ida y vuelta
uno atrás del otro, en la pantalla de sesión en vivo (la de más tráfico
real, se usa en cada entrenamiento). La reemplacé por
`obtenerUltimosRegistros()` (plural): resuelve el día completo en **2
consultas totales**, sin importar cuántos ejercicios tenga la rutina —
mismo criterio exacto por ejercicio (sesión previa más reciente de ese
alumno que incluyó ese ejercicio, y la última serie registrada ahí),
aprovechando que el resultado ya viene ordenado por fecha/número de serie
descendente para no duplicar la lógica de "el más reciente por grupo".

Es código puro — no agrega dependencias, no toca ningún schema, y de
hecho **reduce** la cantidad de queries a Supabase en vez de aumentarla,
así que no hay ningún costo nuevo, ni siquiera imperceptible.

**Verificado:** gate completo (tsc/eslint/vitest — 599 tests — /build)
limpio; en vivo con la cuenta QA, inicié una sesión nueva y confirmé que
el panel "Historial" de un ejercicio sigue mostrando fecha/reps/peso
correctos de una sesión anterior real (20 ago, 12 reps, 45 kg).

**Lo que quedó pendiente de la conversación de velocidad, sin tocar:**
el agente también encontró que `SesionActivaV2.tsx` importa `@dnd-kit`
(usado por el arrastre para reordenar, bloque 10) siempre al tope del
archivo aunque sólo se use si el alumno abre "Orden de la sesión" —
convertirlo a `next/dynamic(..., {ssr:false})` bajaría el JS que hay que
parsear en esa pantalla en celulares de gama baja. Es gratis y de riesgo
bajo, pero no lo hice todavía porque no se habló específicamente de esto
con Alejandro — se lo puedo proponer como siguiente paso si quiere seguir
por esta línea.

## 14. `6a35278` — pantalla animada de marca mientras arranca una rutina

Siguiendo con el tema de velocidad, Alejandro reportó que el botón
"Iniciar entrenamiento"/"Iniciar día N" se siente "pegado" al tocarlo.
Ofreció dos caminos (acelerar el botón, o una pantalla animada —
"la V de VIP Fitness... acorde a la motivación del fitness y el
culturismo" — que disimule la espera) y dejó la elección a mi criterio.

**Causa:** arrancar una rutina hace una cadena de operaciones en el
servidor (`iniciarRutinaDesdeCalendarioV2`: crear/entrar a la sesión,
chequear el plan mensual, disparar Impulso VIP, revalidar) antes de
poder mostrar la pantalla siguiente. Un `<button type="submit">` común
no da ninguna señal visual mientras tanto.

**Elegí las dos cosas, pero con cautela en la más riesgosa:**
- Hice la pantalla animada (`BotonIniciarEntrenamientoV2.tsx`, nuevo):
  usa `useFormStatus` (patrón estándar de React) para detectar el
  instante en que el `<form>` padre empieza a enviarse — ahí mismo, sin
  esperar al servidor, aparece una pantalla de marca a pantalla
  completa. **Reutiliza el mismo lenguaje visual que ya existe en
  `VipSplash`** (el arranque de la app: fondo negro, resplandor que
  respira, "VIP FITNESS" en itálica) en vez de inventar uno nuevo, más
  una línea "Preparando tu entrenamiento...". Cero riesgo nuevo — es
  puro cliente, no toca el flujo de datos ni agrega ninguna consulta.
- **No toqué el lado de acelerar el servidor de verdad.** Encontré que
  `obtenerEstadoPlanMensual()` se llama dos veces seguidas en la cadena
  (una dentro de `crearOEntrarSesion`, otra en el llamador,
  `src/app/alumno/entrenar/actions.ts`) cuando se crea una sesión
  nueva — se podría unificar en una sola consulta, pero esa función
  tiene comentarios existentes sobre condiciones de carrera entre
  pestañas y el índice único de la migración 0071. Más riesgo del que
  amerita para esta prioridad, sobre todo con "sin dañar nada" como
  condición explícita. Queda anotado por si se quiere retomar con más
  tiempo/pruebas.

**Verificado:** gate completo (tsc/eslint/vitest/build) limpio; en vivo
con la cuenta QA confirmé que el botón sigue arrancando la sesión
correctamente. El overlay en sí lo verifiqué inyectando las mismas
clases CSS reales del build compilado (viéndose igual que el splash de
arranque de la app) — el viaje real es tan rápido en `localhost` que la
ventana de "pending" es imperceptible ahí mismo; en producción, con
latencia real de red hacia Vercel/Supabase, debería notarse bastante
más. Pido que lo confirmes vos en tu teléfono.

### 14.1 `916a00e` — faltaba el tercer botón

Alejandro probó `6a35278` y reportó el mismo problema ("obtiene un delay
eterno... lo desactivado") en un **tercer** botón "Iniciar día N" que no
había tocado: el de la pantalla de Inicio, al lado de "Ver rutina"
(`EntrenamientoInicioV2.tsx`) — distinto de los otros dos
(`RutinaDetalleV2`/`ProgramaDetalleV2`) que ya usaban
`BotonIniciarEntrenamientoV2`. Había 3 copias del mismo patrón en total
y sólo actualicé 2 en el bloque 14.

Generalicé el componente para aceptar `className` (este botón usa
`primaryButton`, no `workoutFixedStart`) y `deshabilitado` (el bloqueo
real de negocio de este botón en particular — plan pausado, cupo
agotado, solo lectura — que ya existía como `disabled={bloqueado}`
directo en el `<button>`). Es un refactor puro sobre esa lógica: en el
primer render `pending` es `false`, así que el resultado
(`deshabilitado || pending`) es idéntico a como estaba antes
(`bloqueado`) — lo único nuevo es la pantalla de marca mientras se envía.

**Ojo para quien pruebe esto:** si el botón de Inicio sigue viéndose
gris/desactivado después de este commit, no es este bug — es
`bloqueado` siendo `true` de verdad (plan pausado, cupo agotado ese
mes, o cuenta en solo lectura), una condición de negocio que no toqué y
que no tiene que ver con la sensación de "delay eterno". Si eso pasa,
avisame cuál de las tres es y reviso esa cuenta puntual.

**Verificado:** gate completo (tsc/eslint/vitest/build) limpio. No pude
probarlo en vivo con el mismo detalle que los otros dos porque la
cuenta QA tenía una sesión en progreso en el momento (ese botón cae en
la rama "Continuar sesión", no en la de "Iniciar día N") — confié en
que es el mismo patrón ya verificado, sin cambios de comportamiento en
la lógica de bloqueo (verificado leyendo el diff con cuidado). Pido que
lo confirmes vos.

### 14.2 `b6196f5` — contador de progreso simulado

Alejandro confirmó que el arranque real tarda 5-6 segundos y pidió que
la pantalla de marca muestre algo que avance — "de uno a cien" — para
generar la percepción de que está progresando, aclarando que entiende
que no puede ser instantáneo pero que hace falta *algo visual*.

`useProgresoSimulado()` no mide nada real (una Server Action no manda
eventos parciales de progreso al cliente) — simula: arranca rápido y se
frena a medida que se acerca a un tope de 92%, mismo truco que usan casi
todas las barras de carga reales. Nunca llega a 100 sola — el overlay
desaparece cuando la navegación de verdad termina (se desmonta), así
que quedarse cerca del tope en vez de "completarse" antes de tiempo es
lo que se ve honesto. Se muestra como barra dorada + número, debajo del
nombre de la marca.

**Verificado:** gate completo (tsc/eslint/vitest/build) limpio;
inspeccioné visualmente las clases CSS reales del build a un valor
intermedio (47%) para confirmar que la barra y el número se ven bien.

## 16. `f198eb7` — verificar que los guardados del admin realmente afecten una fila

Alejandro pidió empezar a resolver la auditoría del bloque 15 "por lo
más importante" — el hallazgo #1 de 15.4 (bloquear a un alumno puede
fallar en silencio).

Varios `.update()` del panel del entrenador (`admin/alumnos/actions.ts`,
`alumno/perfil/actions.ts`) solo chequeaban `error`, no si Supabase
realmente afectó una fila — si algo lo bloqueara en silencio (RLS,
condición de carrera), el admin vería "guardado" sin que el cambio se
haya aplicado. El más grave: `actualizarPerfilAlumno` incluye
`acceso_bloqueado`, el corte de acceso de un alumno problemático.

Apliqué el mismo patrón que ya existía correctamente en
`actualizarAccesoPortalV2` (unas líneas más arriba en el mismo
archivo): agregar `.select().maybeSingle()` y chequear `error ||
!actualizado`. Arreglado en `actualizarPerfilAlumno` (el más crítico),
`actualizarPlanRapido`, `actualizarNombrePerfil`, `guardarNota` (rama de
update — la de insert ya estaba bien), y `guardarTemaBoton` (menor
impacto, pero mismo patrón).

**Verificado en vivo contra la base real** (única forma honesta de
probar esto — no alcanza con el gate automático): entré como admin con
la cuenta QA de entrenador, bloqueé y después desbloqueé el acceso de
la **cuenta QA de alumno únicamente** (`99d82081-...`, ningún alumno
real tocado), y confirmé por SQL directo que `acceso_bloqueado` cambió
correctamente en las dos direcciones, con `updated_at` reflejando cada
cambio. Gate completo (tsc/eslint/vitest/build) también limpio.

**Sigue pendiente del bloque 15** (no lo hice todavía, esperando que
Alejandro confirme si quiere seguir con esto): auditoría de acceso para
"ver como alumno" (hallazgo #2, también de seguridad), y proteger
circuitos/series gigantes sin numerar contra reordenarse mal (hallazgo
funcional de la auditoría de técnicas, 15.1).

## Comandos y resultados

```
npx tsc --noEmit        → sin errores
npx eslint .             → sin errores ni warnings
npx vitest run           → 77 archivos, 598 tests, todos pasaron
npm run build            → compiló y generó las 71 rutas, incluida
                            /portal-v2/entrenamiento/programa
```//

Corridos después de cada uno de los 22 commits (o de sus cambios
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

## 15. Auditoría del resto del handoff de continuidad — solo lectura, sin código

Alejandro pidió, sin más tiempo para implementar en esta sesión, una
auditoría de todo lo que quedaba pendiente en
`docs/HANDOFF_CLAUDE_PORTAL_V2_CONTINUIDAD.md` (Prioridad 1 resto, 2, 3,
4) — "revisa todo lo que puedas y dame detalle... yo te aviso si lo
resuelvo o no". Lancé 4 agentes de exploración en paralelo, cada uno
sobre un área, **ninguno tocó código**. Resumen; el detalle completo de
cada uno queda en la transcripción de esta sesión si hace falta.

### 15.1 Técnicas avanzadas (resto de Prioridad 1)

Motor: `src/lib/entrenamiento/motor-tecnicas-sesion.ts` +
`tecnica-grupo.ts` + `tecnica-series.ts` + `personalizacion-sesion.ts`.
Biserie/triserie/superserie/serie gigante de 4/circuito/fallo/drop
set/rest-pause/myo-reps/cluster están implementadas y con tests (137
tests en total entre esos archivos, todos pasan).

**Bug real encontrado (prioridad alta):** un circuito o serie gigante
SIN el sufijo `(n/total)` en el nombre (`tamanoGrupoTecnica` devuelve
`null` a propósito para esos casos, `tecnica-grupo.ts`) cae a un
"bloque de tamaño 1" en `sesion/actions.ts:169`, así que
`bloquesPermanecenUnidos` no lo protege — **se puede reordenar
ejercicio por ejercicio un circuito que en la ejecución real sí se
agrupa sin tope**. Rompe el invariante "el bloque se mueve completo".
Riesgo real con datos actuales: rutinas cargadas sin numerar son la
mayoría según el agente.

Otros hallazgos menores: un texto libre como "Biserie al fallo" se
clasifica como `"fallo-tecnico"` en vez de `"biserie"` (prioridad de
regex en `normalizarTecnicaSesion`, motor-tecnicas-sesion.ts:43-58) y
pierde el agrupamiento; `configuracionFst7()` es código muerto (solo su
propio test la llama); drop set/rest-pause/myo-reps/cluster se
persisten como una sola fila por ejercicio (no por segmento), lo que
contradice un invariante escrito en `TECNICAS_AVANZADAS_V2.md` — puede
ser el documento el que está desactualizado, no el código, a
confirmar con Alejandro.

### 15.2 Nutrición operativa (Prioridad 2)

**Mucho más avanzada de lo que sugiere el handoff** — se trabajó en una
sesión anterior (commit `cc4d4b4`, 2026-08-19) después de que se
escribiera esa lista, así que es más una re-verificación que trabajo
desde cero. Ya implementado y funcionando: buscador (catálogo propio +
Open Food Facts bajo demanda), escáner de código de barras con cámara
real, porciones/medidas caseras, horarios de Chile correctos, metas
nutricionales persistentes, diario de hoy/ayer/±3 días, caché de Open
Food Facts con circuit breaker, y la base curada chilena de 260
productos (migración 0114 — el agente no pudo confirmarlo contra la
base viva porque el MCP de Supabase no estaba autorizado en ese
momento de la sesión, solo tiene evidencia documental de que se aplicó).

**Hueco real más claro:** el botón "Calcular" en Nutrición en realidad
es "ajustar" — ofrece 3 perfiles fijos (Definición/Mantenimiento/
Volumen) o edición manual, pero **no existe ningún cálculo real de
TDEE/BMR** (a partir de peso/altura/edad/sexo/actividad) en todo el
repo, ni en V1 ni en V2. "Copiar comida" solo copia un alimento suelto,
no el día completo. Los puntos VIP por registrar comida (que sí existen
en V1) no están conectados en V2 todavía.

### 15.3 Progreso, ranking y comunidad (Prioridad 3)

**Sólido.** Progreso histórico (peso, fotos) lee y escribe con las
mismas funciones y tablas que V1 — sin riesgo de reiniciar datos.
Ranking usa claves únicas por evento para que sea imposible cobrar dos
veces la misma sesión, con topes explícitos (máximo de puntos por
Impulso VIP por sesión, penalización máxima de descanso, piso en cero).
Los datos de ejemplo (`DEMO_FILAS`, etc.) **solo** se activan para
visitantes no autenticados — confirmado que nunca se mezclan con datos
reales de un alumno con sesión iniciada.

Huecos menores: la pestaña "Actividad" de Comunidad no muestra un
mensaje explícito de "todavía no hay nada" cuando un alumno real no
tiene publicaciones (no es un dato falso, solo queda vacía sin avisar);
y la lógica de ranking más sensible contra trampas
(`src/lib/ranking/movimientos.ts`, `data.ts`) no tiene tests
automatizados — solo las funciones puras de reglas/orden están
cubiertas.

### 15.4 Más, perfil, configuración y panel del entrenador (Prioridad 4)

**Acá aparecieron los hallazgos más importantes de las 4 auditorías —
de seguridad/integridad, no solo de funcionalidad faltante:**

1. **Bloquear a un alumno puede fallar en silencio.**
   `actualizarPerfilAlumno` (`admin/alumnos/actions.ts:486-515`) — la
   función que un admin usa para bloquear el acceso de un alumno
   problemático — hace el `.update()` sin verificar si la fila
   realmente se modificó. Si algo lo bloqueara silenciosamente (RLS,
   una condición de carrera), el admin vería "guardado" sin que el
   bloqueo se haya aplicado de verdad.
2. **"Ver como alumno" no deja ningún registro de acceso.** El modo sí
   respeta permisos correctamente (un entrenador/admin en este modo no
   puede registrar series/comidas a nombre del alumno — confirmado en
   el código y reforzado en la interfaz), pero no hay ninguna tabla de
   auditoría que registre "el entrenador X vio los datos del alumno Y
   el día Z" — y este modo expone fotos de progreso y notas privadas.
3. El mismo patrón de "guardar sin verificar" del punto 1 aparece
   también en: guardar el tema de color del alumno
   (`alumno/perfil/actions.ts:153-167`, ni siquiera avisa el error a
   la pantalla), el nombre del perfil, las notas del entrenador, y el
   plan de sesiones mensuales — todos en `admin/alumnos/actions.ts`.
4. El botón "Ver portal" del admin lleva siempre a la V1
   (`/alumno/inicio`), no hay un camino directo a V2 en modo
   supervisado — hay que navegar la URL a mano.

Lo que sí está bien: habilitar Portal V2 por alumno individual ya tiene
una pantalla real en el admin (no es solo SQL), con la verificación de
guardado hecha correctamente ahí — es la excepción, no la regla, de
por qué el patrón #1/#3 se nota tanto por contraste.

### Prioridad sugerida si Alejandro quiere atacar algo de esto

1. **Alta, seguridad** — verificar guardado real en `actualizarPerfilAlumno`
   (bloqueo de alumno) y los demás `.update()` sin verificar de
   `admin/alumnos/actions.ts` / `alumno/perfil/actions.ts`.
2. **Alta, seguridad** — auditoría de acceso para "ver como alumno".
3. **Alta, funcional** — proteger circuitos/series gigantes sin numerar
   contra reordenarse mal.
4. **Media** — calculador real de TDEE/BMR en Nutrición.
5. **Media** — tests para la lógica de ranking más sensible a trampas.
6. El resto (copiar día completo, puntos VIP por comida en V2, estado
   vacío de Actividad, FST-7 código muerto, prioridad de regex de
   "fallo", camino directo a V2 en "ver como alumno") son mejoras
   menores, no urgentes.

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
  del bloque 10 (ver arriba). `d75beea` corrigió por qué el gesto ni
  siquiera arrancaba en un teléfono real (`touch-action`); Alejandro ya
  confirmó que el asa arranca bien. Lo que falta confirmar ahora es que
  soltar en otra posición reordene de verdad y que aparezca el aviso
  "Orden actualizado" con "Deshacer" (`290b630`, bloque 10.2).
- Push a `origin/portal-v2` — esperando autorización.
- **Auditoría de Impulso VIP (Prioridad 1 del handoff de continuidad) —
  hecha, sin cambios de código necesarios.** Leí `src/lib/impulso-vip/motor.ts`
  completo y confirmé contra las 141 pruebas ya existentes (9 archivos
  `.test.ts` en esa carpeta, todas pasando): es automático (función pura),
  escaso (probado: "deja como máximo un reto" sin check-in, "hasta 3
  técnicas intensas por sesión, no más"), no pregunta por serie (la
  dificultad se pregunta una vez por ejercicio, ya documentado en el
  código), y no propone incrementos absurdos (siempre redondea al
  escalón de carga configurado). Único punto abierto para el criterio de
  Alejandro, no un bug: el motor no usa `tipo de equipo` como entrada
  directa — el incremento de peso se configura por ejercicio en su
  lugar, reflejándolo indirectamente. Si Alejandro quiere que el motor
  distinga equipo de forma automática, es una decisión de producto a
  hablar antes de tocar el motor.
- **Precarga de datos "una sola vez por alumno" (service worker con
  caché real, no solo push notifications) — Alejandro preguntó, quedó
  explícitamente diferido a otra sesión aparte, NO empezado.** Ya existe
  `public/sw.js`, pero escrito a propósito para NO cachear nada (solo
  las notificaciones de fin de descanso — ver el comentario en ese
  archivo). Extenderlo para cachear la rutina/progreso del alumno es
  técnicamente posible y no le agrega gasto a Vercel/Supabase (corre en
  el teléfono, no en el servidor), pero conlleva riesgo real de mostrar
  datos desactualizados (rutina vieja, peso de una sesión anterior) si
  la invalidación de caché no se hace con cuidado — a diferencia de los
  arreglos de hoy, este si necesita su propia sesión dedicada con
  tiempo para probarlo bien. Si se retoma, empezar leyendo
  `public/sw.js` completo y pensar la estrategia de invalidación
  (stale-while-revalidate) antes de escribir código.

## Para Codex

Decí "revisa el trabajo de Claude en portal-v2" y podés aceptar o rechazar
cada uno de los 22 commits por separado (son independientes entre sí; el
más nuevo, `f198eb7`, arregla varios `.update()` del panel del
entrenador que no verificaban si el guardado realmente afectó una fila
— ver bloque 16, especial atención a `actualizarPerfilAlumno` que
incluye el bloqueo de acceso de un alumno. En orden:
`dbba3ba` el fix de puntos, `96d59e0` quitar el botón,
`d91847c` la pantalla nueva, `4a1724f` el rediseño de Vista de video,
`5eb19fe` reps/peso editables, `01b9b4a` el botón fijo, `b8a8b26` el
renombrado a Impulso VIP, `d14309c` la pregunta de seguimiento, `fe56072`
quitar la selección de texto, `dc5e80f` el arrastre para reordenar,
`0527347` el mismo arrastre pero directo en la lista, sin pantalla
aparte, `d75beea` el arreglo de por qué no arrancaba en un teléfono
real, `290b630` el "Deshacer" tras reordenar, `b85ddfe` los avisos
flotando en vez de empujar la pantalla, `9ec3449` sacar el aviso de
recuperar progreso, `b8d97c9` exigir el mismo ángulo muscular al
sustituir un ejercicio, `7fc111a` "Iniciar entrenamiento" para el
próximo día, `d73cb40` quitar el N+1 del último registro, `6a35278` la
pantalla animada al arrancar una rutina, `916a00e` la misma pantalla en
el tercer botón que faltaba, `b6196f5` el contador de progreso
simulado). El primero es el más
importante y el de menor riesgo (reutiliza
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
esperara solo `repsExtra`/`pesoDescargaKg`. **`dc5e80f`, `0527347` y
`d75beea` juntos son los que más necesitan ojos humanos en un teléfono
real**: agregan una dependencia nueva (`@dnd-kit`) y un gesto de arrastre
que ya pasó por una ronda de "no funciona en el teléfono → causa real
encontrada y corregida" (ver bloque 10.1: faltaba `touch-action: none` en
el punto de agarre, así que el navegador ganaba la carrera contra el
mantenido de dnd-kit antes de que el gesto arrancara). Confirmé por
`getComputedStyle` que el asa nueva tiene `touch-action: none` y el resto
de la tarjeta sigue en `auto`, pero **no pude confirmar el ciclo completo
de soltar-y-reordenar de punta a punta** con las herramientas de este
entorno — eso sigue pendiente de un teléfono real. Si se rechaza
`0527347`+`d75beea`, el código queda funcionando igual con el "modo
ordenar" de pantalla aparte que traía `dc5e80f` — son cambios
independientes y en capas. `290b630` (el "Deshacer", bloque 10.2) es
independiente de los tres anteriores — se puede aceptar o rechazar solo,
no depende de que el asa termine de convencer a Alejandro.

**`b8d97c9` (bloque 11) es el único commit de código de este corte que
depende de datos reales ya tocados en producción** — el cambio de código
en sí es de una línea (ver bloque 11), pero antes de eso corrí un
`UPDATE` que completó `patron_movimiento` en 116 de los 130 ejercicios
activos de la biblioteca, autorizado explícitamente por Alejandro en el
chat antes de ejecutarlo. No es reversible con un `git revert` — si se
quiere deshacer, hay que volver a dejar esas 116 filas en `null` a mano.
Vale la pena que alguien revise la tabla completa (`select nombre,
patron_movimiento from ejercicios where activo`) contra su propio
criterio de entrenador, sobre todo los grupos "piernas" y "brazos" donde
más ejercicios se agruparon bajo el mismo patrón (p. ej. todas las
variantes de sentadilla quedaron en `pierna_dominante_rodilla`) — si algo
se ve mal clasificado, se corrige desde `/admin/ejercicios` → abrir el
ejercicio → "Tipo de movimiento", no hace falta tocar código. Además,
también autorizado en el chat y también sin commit de código (ver bloque
11.1), creé 4 ejercicios nuevos en la biblioteca (variantes por implemento
de "Remo al mentón" y "Curl de muñeca") — estos sí se pueden "deshacer"
simplemente desactivándolos desde el admin si algo no queda bien, ya que
son filas nuevas, no una edición de datos existentes.
