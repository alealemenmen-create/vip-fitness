# HANDOFF 1.18

Continúa el 1.17. Leer los dos: el 1.17 tiene el detalle de la sesión de
entrenar del alumno y la cola larga; este cubre la sesión del 11-12/08 (tramo
de la noche) y deja el punto de regreso al día.

## Punto de regreso

- **`main` subido hasta `0ca5f62`.** `main` despliega solo a producción: todo
  lo listado abajo **ya está en producción**.
- `tsc` limpio · **317 pruebas** · lint limpio en lo tocado · build OK.
- **Migraciones pendientes de correr, en este orden de importancia:**
  - `0068_tema_vip_predeterminado.sql` — la escribió Codex, pone el tema VIP
    como predeterminado. **Sin correr.**
  - `0067_publicacion_versionada_vip_2.sql` — **YA NO SIRVE.** Era del Motor
    VIP 2.0, que se eliminó (ver abajo). No correrla. Se puede borrar el
    archivo.
  - `0066_auditoria_tipos_hallazgo.sql` — **ya corrida** por Alejandro.
- **Notificaciones push confirmadas funcionando** en el teléfono de un alumno.

## ⚠️ Dos agentes trabajando a la vez

Claude y Codex están editando el mismo repo. **Ya pasó dos veces que Codex
deshizo trabajo de Claude** (el botón del panel lateral) y una vez que el
proyecto no compiló por un cambio suyo a medias.

**Zona de Codex ahora mismo: "Armar rutina" del panel del entrenador**
(`ArmarRutinaPanel.tsx`, `RutinaDraftEditor.tsx`, `niveles-armado.ts`). Tiene
cambios sin commitear ahí. **No tocar esos archivos.**

Ojo aparte: `globals.css` lo tocan los dos. Hacer ediciones cortas y commitear
rápido.

## Lo que se hizo en este tramo

### Sesión de entrenar del alumno (ver 1.17 para el detalle)
Ya está todo en producción: salida guiada, recordatorio push, cierre
automático al terminar, franja de "sin cerrar", botón único de completar y
guardar, foto del instructivo completa.

### Arreglos en vivo, con un alumno real (`b1fc996`)
- **La notificación abría "como enlace externo".** El `notificationclick` del
  service worker enfocaba cualquier ventana e IGNORABA la URL, y con
  `openWindow` usaba una ruta relativa que puede resolverse fuera del alcance
  de la app instalada. Ahora resuelve la URL absoluta y navega la ventana
  existente.
- **"El botón de confirmar 300 pts está pegado".** No estaba colgado:
  `finalizarSesion` escribe la sesión, calcula puntos, resuelve el bono de
  Impulso y rehace el ranking — varios segundos con el wifi del gimnasio — y
  el botón no cambiaba en nada. Nuevo `BotonFinalizarSesion` con
  `useFormStatus`: gira, dice "Guardando…" y se deshabilita. En los tres
  caminos que cierran sesión.
- **`skipWaiting` + `clients.claim`** en el service worker: sin eso el arreglo
  no le llegaba al alumno hasta cerrar la app por completo.

### Niveles de Armar rutina (`bf4b52d`)
Cuatro niveles: Principiante · Intermedio · Avanzado · Olympia.
**"Profesional" salió** de las opciones (era casi igual a Avanzado); sigue en
el tipo `NivelArmado` para que los borradores viejos abran.
**Ojo**: Claude fijó `ejerciciosPorSesion` a 5/6/8/10 y **Codex después lo
reescribió** para expresar la dosis como *series totales por grupo muscular
por sesión*, que es lo que Alejandro había pedido. Manda la versión de Codex.

### Tema VIP en el panel del entrenador (`d57c3c4`, `a201d8f`, `0a1db98`)
- La cabecera y la barra de íconos del panel usan las mismas placas de cristal
  del alumno (`panel-aero-superior` / `panel-aero-inferior`).
- **Cristal más transparente y con tinte azul de mar** (`--cristal-azul`).
  **Trampa para el próximo**: `.panel-aero-superior` y `.panel-aero-inferior`
  PISAN el `background` de la regla compartida — cambiar solo la compartida no
  se ve en pantalla.
- La barra de íconos traía `bg-bg/95`, que **tapaba su propio cristal**: por
  eso abajo se veía negro y arriba no. Pasó a `navegacion-aero`.

### Teléfono acostado y barra lateral (`9d7cdbf`, `fa74c11`, `a201d8f`)
- Botón de **mostrar/ocultar barra lateral** (`AlternarPanelLateral.tsx`), con
  la preferencia guardada por aparato.
- **En horizontal la lateral ya no es columna**: se superponía como columna
  fija comiéndose 288px de ancho y su contenido no entraba en 390px de alto.
  Ahora, con alto ≤560px, flota como cajón y el contenido conserva el ancho
  completo.
- **Los íconos vuelven cuando la lateral está cerrada.** Antes no quedaba
  NINGUNA navegación en pantalla grande con la lateral cerrada.
- Verificado en 1280×800, 844×390, 926×428 y 412×915.

### Auditoría (`01225ab`, `3456673`)
- Hallazgo nuevo **`series_sin_registro`**: series marcadas como hechas sin
  kilos NI repeticiones (3+ por sesión). Necesita la migración 0066 (ya
  corrida).
- **El panel se partió en dos**: arriba lo que espera decisión, abajo y
  plegadas las rutinas con observaciones — que **no se pueden descartar** a
  propósito (se corrigen reemplazándolas), así que la lista nunca llegaba a
  cero y enterraba lo importante.
- **Se le quitó el tono acusatorio.** Había sesiones marcadas "Sospecha alta —
  31 series en 1 minuto". Alejandro explicó que eso es gente que entrena SIN
  el teléfono y después abre la sesión para dejarla registrada. Bajó a
  severidad media y las etiquetas pasaron a "Revisar pronto" / "Solo para
  mirar". **El panel informa, no imputa.**

### Motor VIP 2.0/2.1 — ELIMINADO (`2c6680f`)
Codex construyó un generador aparte completo (~5.200 líneas). Alejandro lo
probó y **decidió sacarlo**: prefiere la herramienta manual de "Armar rutina"
con la varita VIP. Todo queda intacto en el historial, en **`dad0d06`**, por
si algún día se retoma.

### Inicio del alumno (`316727b`)
- "Comidas de hoy" y "Sesiones del mes" **pasaron debajo de la Arena VIP**.
- **El aviso de entrenamiento sin cerrar ahora es rojo y parpadea**, con un
  punto que late a contratiempo. Es el ÚNICO elemento de la app con ese
  tratamiento, a propósito: si mañana algo más parpadea, este deja de
  significar nada. Respeta `prefers-reduced-motion`.

### Apuestas de Arena VIP — SOLO EL MOTOR (`0ca5f62`)
`src/lib/torneos/apuestas.ts` + 17 pruebas. **Aritmética pura: no toca base ni
UI.** Nada de esto funciona todavía en la app.

Pedido de Alejandro: *"hice un torneo y fue fome"*. Diagnóstico: un duelo
entre dos personas le importa a dos personas; los otros 66 alumnos ni se
enteran. Modelo elegido: **carrera de caballos — apuesta el que NO compite.**

Reglas ya implementadas y probadas:
- Un competidor **no puede apostar en su propio duelo** (si no, tendría motivo
  para perder a propósito). Innegociable.
- **Pari-mutuel**: los que aciertan recuperan lo suyo y se reparten lo de los
  que fallaron, en proporción a lo arriesgado. Sin casa que gane.
- **Se devuelve todo** si nadie acertó, si acertaron todos, o si hubo empate /
  torneo anulado. Sin esto los puntos desaparecerían del gimnasio.
- Tope 200 y mínimo 10 por apuesta.
- Probado: lo pagado nunca supera lo apostado; el sobrante del redondeo no se
  pierde.

**Decisión de Alejandro, ya tomada**: *"que le cueste su saldo al alumno está
bien, lo hace más competitivo"*. Esto invierte la regla anterior del sistema
(hoy dice literal "VIP Fitness aporta la bolsa… nadie pierde puntos
acumulados" y la tarjeta dice "sin apostar tu saldo"). **Hay que actualizar
esos textos** cuando se conecte.

## Lo que sigue — en orden

1. **Terminar las apuestas.** Es lo que está a medio camino. Falta:
   migración (tabla `torneo_apuestas` con `unique(torneo_id, alumno_id)`),
   Server Actions que descuenten al apostar y paguen al cerrar, UI del alumno
   para apostar, **aviso a TODOS al abrir un torneo**, **celebración a TODOS
   al haber ganador**, y el panel del entrenador para ver qué reparte y por
   qué. Actualizar los textos de "sin apostar tu saldo".
2. **Zoom que achique TODO, no solo la letra.** Pedido repetido tres veces y
   **todavía sin hacer** — no se alcanzó a tocar ni un archivo.
   *Diagnóstico ya hecho*: hoy `--escala-texto` solo multiplica la escala
   tipográfica, por eso las tarjetas quedan igual de grandes con la letra
   chica adentro. *Camino recomendado*: aplicar `zoom: var(--zoom-pantalla)`
   sobre `:root` (refluye el layout, a diferencia de `transform`, y respeta
   `position: fixed`), dejar `--escala-texto` fijo en 1 para que no escale dos
   veces, y migrar la clave vieja `vip-escala-texto`. Tocar `ZoomPanel.tsx`,
   `MenuAlumno.tsx` y el script inline de `app/layout.tsx`. Alejandro quiere
   cuatro tamaños: grande · normal · pequeña · más pequeña.
3. **Rediseño de la pestaña Ranked.** Pedido: cristal tipo diamante, aire de
   casino/premios, muy competitivo, "que provoque participar". Sin empezar.
4. **Preguntar qué falla en el teléfono.** Alejandro dijo "en ordenador
   funciona bien, el teléfono no", pero el arreglo del horizontal se subió
   DESPUÉS de ese comentario. Puede estar ya resuelto: hay que confirmarlo
   antes de tocar nada.

## Cola que viene del 1.17, sin cambios

- **Decidido**: la IA no es obligatoria y su tema se hace **al final**; la
  auditoría del generador (21 controles → ~8) va **después de todo lo demás**;
  el material de culturismo **lo trae Alejandro**.
- **Antebrazo**: iba a cargar los ejercicios "mañana" (12/08). Sin eso no se
  puede agregar el grupo — no hay ni un ejercicio en la biblioteca.
- **Reconciliar el costo de IA contra una factura real de Anthropic**: el
  panel dice ~US$0,24 y la fórmula da ~US$0,71. **No usar ese panel para
  decisiones de plata** hasta resolverlo.
- Dos sesiones `en_progreso` a la vez siguen siendo posibles
  (`cancelarYEmpezarOtroDia` no cierra la vieja si tiene progreso). Importa
  más ahora: la franja de "sin cerrar" muestra solo una.
- Micrófono **sin probar en iPhone**.
- 3 errores viejos de eslint en `SesionEjercicioCard.tsx`.
- Sin verificar con toque real: el recordatorio push de sesión sin cerrar (hay
  que dejar una abierta 4 min) y el cierre automático al terminar.

## Datos tocados en pruebas

- Sesión 2 del alumno de prueba quedó finalizada **con puntos acreditados**.
  No se puede deshacer desde la app (reabrir conserva los puntos por diseño).
- Sesión 4 del alumno de prueba: creada y **borrada limpia**, sin rastro.

## Regla de continuidad

No rehacer lo terminado. Preservar puntos históricos, sesiones, rutinas
publicadas, documentos, fotos, planes activos y `Rutinas Alejandro/`. No
aplicar migraciones ni escribir en masa sobre datos de alumnos sin
autorización expresa. `main` despliega solo a producción.

Feedback vigente desde el 1.16: *"siento que todas las ideas son mías y no me
ayudas"*. Corresponde proponer, no solo ejecutar. Y verificar con clic real
antes de decir que algo anda.
