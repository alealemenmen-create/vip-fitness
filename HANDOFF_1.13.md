# HANDOFF 1.13

## Punto de regreso

- Proyecto: VIP Fitness Portal.
- Carpeta: `C:\dev\vip-fitness`.
- Rama activa: `main`.
- Último commit funcional al comenzar este handoff: `324ac41 docs: agrega handoff 1.12`.
- Remoto: `https://github.com/alealemenmen-create/vip-fitness.git`.
- **Todo el trabajo de esta sesión está SIN COMMITEAR** — son cambios de
  working tree sobre `main`. No se hizo commit ni push porque la regla del
  proyecto es no hacerlo sin confirmar el alcance con Alejandro primero.
  Antes de seguir trabajando, correr `git status` y decidir junto a él si se
  commitea todo junto o se separa en bloques.
- Aplicación local: `http://localhost:3001` (`.claude/dev-preview.cmd`).
- El servidor de desarrollo tuvo cortes intermitentes durante toda la sesión
  por un problema de caché persistente de Turbopack (`Persisting failed:
  Another write batch or compaction is already active`) — visible en los
  logs, no es un bug de la app. Si vuelve a pasar: reiniciar el servidor
  (`preview_stop` + `preview_start`) suele bastar. No se investigó la causa
  raíz ni se tocó configuración de Turbopack — no estaba pedido.

Archivos locales que se conservaron sin subir al repositorio (sin cambios
respecto al handoff anterior):

```text
Rutinas Alejandro/
respaldo-cloud-ia-2026-08-09.bundle
tmp/
```

---

## ⚠️ Cambio de base de datos ya aplicado en producción

**Migración `0064_planes_entrenamiento_mensuales.sql` corrida por Alejandro
en el SQL Editor de Supabase durante esta sesión — ya está aplicada en la
base real** (`iowuocmxqwuddickiofi.supabase.co`). Agrega, de forma aditiva:

```text
alumno_perfil.plan_entrenamiento        text
alumno_perfil.sesiones_mensuales        smallint
alumno_perfil.dias_entrenamiento_semana smallint
alumno_perfil.plan_entrenamiento_pausado boolean not null default false
```

Antes de esta sesión estas columnas **no existían en la base real** aunque
la migración ya estaba en el repo desde antes y varias partes del código
(`PerfilAlumnoForm`, `admin/alumnos/data.ts`) ya las usaban — fallaban en
silencio (`data ?? []`) sin que nadie lo notara. Ver sección 3 más abajo.

**Backfill ya ejecutado sobre la base real** (una sola vez, no queda como
parte del código de la app): de 68 alumnos sin plan asignado, se clasificaron
60 según los días de entrenamiento de su rutina activa —

```text
3 días/semana → Access  (20 alumnos)
4 días/semana → Pro     ( 6 alumnos)
5+ días/semana → Élite  (34 alumnos)
0 días (sin rutina activa) → sin plan (8 alumnos, quedan para asignar a mano)
```

El criterio de "3 días = Access" es una asunción (Access y Select comparten
días/semana y sesiones mensuales, solo cambia precio) — Alejandro autorizó
Access por defecto y dijo que va a revisar y corregir caso por caso con el
editor rápido nuevo (sección 3). El script vive en el scratchpad de la sesión
(`backfill-planes.js`), no en el repo — si hace falta repetir un backfill
parecido más adelante, hay que rehacerlo, no está guardado como herramienta
reutilizable.

---

## 1. Generador: bíceps y tríceps en Distribución personalizada

El motor ya sabía separar bíceps de tríceps (lo usan las plantillas
automáticas VIP balanceada y PPL), pero el selector de "Distribución
personalizada" solo ofrecía "Brazos" combinado — no había forma de elegir
bíceps o tríceps por separado a mano, a diferencia de Piernas (que ya tenía
Glúteo/Cuádriceps/Femoral/Pantorrilla).

- `src/lib/generador-rutinas/tipos.ts`: nuevo tipo exportado `SubGrupoBrazo`
  (`"biceps" | "triceps"`), sumado a `EtiquetaDia`.
- `src/lib/generador-rutinas/motor.ts`: `esSubGrupoBrazo()` conectado en
  `cuposDelDia()` para la rama "personalizada".
- `src/components/admin/SelectorGruposDia.tsx`: fila nueva de botones
  Bíceps/Tríceps por día, mismo patrón que los sub-grupos de pierna.
- Verificado en vivo contra la base real: día "Pecho + Bíceps" trajo
  *Curl de bíceps en polea alta* (BÍCEPS) separado del press/flexiones
  (PECHO); día "Tríceps" solo trajo *Fondos de tríceps* (TRÍCEPS).

## 2. Vista previa del documento: ahora editable

Pedido explícito: "así yo mismo, desde la visualización del ejercicio, puedo
arreglar la rutina" — sin sacar el editor por día que ya existía.

- `src/components/admin/RutinaDraftEditor.tsx`: `VistaPreviaEstructurada`
  pasó de ser de solo lectura a interactiva:
  - **Lápiz** junto a la etiqueta de grupo muscular de cada tarjeta → abre
    el mismo `EjercicioForm` de siempre ahí mismo (reutilizado tal cual, sin
    duplicar campos ni validación).
  - **"+"** flotante entre cada tarjeta y la siguiente → inserta un
    ejercicio vacío en esa posición exacta y lo abre en modo edición para
    elegirlo de la biblioteca al toque.
  - Nueva función `insertarEjercicio(diaIdx, posicion)` en el componente
    principal — a diferencia de `agregarEjercicio` (que suma al final), esta
    inserta en cualquier punto del día.
- Verificado con inspección de DOM (no solo capturas) que el lápiz y el "+"
  renderizan correctamente por color de grupo muscular en una rutina real de
  5 días. **No se llegó a probar el clic en vivo** por los cortes del
  servidor — el patrón es idéntico al de la sección 3 (patrón de
  movimiento), que sí se probó completo con éxito.

## 3. Patrón de movimiento: editable en la galería (alcance acotado)

De los 11 campos que agregó la migración 0051 y que nunca se pudieron
editar, se resolvió solo el más importante — `patron_movimiento`, la
limitación estructural que ya señalaba HANDOFF_1.12 ("el motor usa
heurística por nombre porque esta columna está vacía").

- `src/lib/ejercicios/tipos.ts` + `src/lib/supabase/types.ts`: el tipo
  `Ejercicio` y los tipos de Supabase (que no tenían esta columna desde que
  se creó en 0051) ahora la incluyen.
- `src/lib/rutinas/patrones.ts`: `PATRONES_MOVIMIENTO_VALIDOS` exportado
  para validar en servidor.
- `src/app/admin/ejercicios/actions.ts`: Server Action nueva
  `actualizarPatronMovimiento`.
- `src/components/admin/GaleriaEjercicios.tsx`: selector nuevo en el modal
  de cada ejercicio, 28 opciones agrupadas por zona.
- **Importante: cargar este campo hoy NO cambia el comportamiento del
  generador todavía.** El motor sigue usando la heurística por nombre en
  sus ~6 puntos de uso; conectar el override es el paso siguiente, una vez
  que haya datos reales cargados para validar contra algo (ver "Próximos
  pasos").
- Verificado en vivo: guardar → recargar página completa → confirmar que
  persiste → revertido a "Sin clasificar" para no dejar clasificaciones
  reales sin que Alejandro las revise.

## 4. Auditoría del generador: hallazgos verificados contra la base real

Antes de tocar código se auditó a fondo el punto que preocupaba a Alejandro
("no vaya a ser que meta bíceps o tríceps donde no van"):

- **Trapecio y Antebrazo**: no se implementaron como grupos seleccionables
  porque la biblioteca real tiene **cero ejercicios** de cada uno (verificado
  con búsqueda en vivo). Agregar el botón ahora generaría un cupo vacío.
  Bloqueado por contenido, no por código — cuando Alejandro cargue esos
  ejercicios en `/admin/ejercicios`, se puede conectar con el mismo patrón
  que bíceps/tríceps.
- **Pantorrilla** (ya existente como sub-grupo de pierna) solo tiene
  **1 ejercicio real** en toda la biblioteca ("Gemelos en prensa").
- **Tope de ejercicios en grupos "chicos"** (gemelo/pantorrilla, trapecio,
  antebrazo — nunca bíceps, tríceps ni hombros, esos son principales para
  Alejandro): **no implementado todavía**. Aclaración explícita de
  Alejandro: el tope solo aplica cuando el grupo chico convive con una
  rutina completa tipo culturismo (pecho/espalda/pierna); si un día se arma
  a propósito solo con esos grupos, no corresponde ningún tope.
- **Límite de ejercicios por grupo muscular al generar** ("cuántos de
  pecho, cuántos de espalda…"): tampoco implementado. Es la pieza más
  grande de las tres, necesita UI nueva + campo del `BriefGenerador` +
  lógica de reparto en el motor.

## 5. Bug real encontrado y corregido: "Volumen tradicional" no hacía lo que decía

Al auditar "Inspiración de estilo" se encontró que el mensaje que lee el
entrenador para `volumen_tradicional` prometía "técnicas encadenadas
priorizadas", pero el código no tenía ninguna lógica para eso — las
biseries/superseries se armaban exactamente igual que con "Ninguna".

- `src/lib/generador-rutinas/motor.ts`: se extrajo `intentarEncadenada()`
  como función reutilizable, y ahora `volumen_tradicional` intenta una
  SEGUNDA encadenada sobre lo que quedó sin técnica, cuando el nivel/
  intensidad da lugar a una segunda familia (avanzado, o intermedio con
  intensidad no estándar).
- 2 tests nuevos en `motor.test.ts` confirman la diferencia real (4
  accesorios con Biserie contra 2 en el mismo escenario sin la inspiración).

## 6. Bug real encontrado y corregido: el motor podía generar rutinas que su propio validador rechazaba

Alejandro reportó un error real al probar: una rutina propia con Tríceps 30
series (máximo de publicación 24), Piernas 55 (tope crítico 50) y Hombros 37
(tope crítico 36) — bloqueada al momento de publicar por
`detectarDeficienciasRutina` (`src/lib/rutinas/validacion.ts`). El motor no
tenía NINGUNA noción del volumen semanal acumulado entre días: cada día se
armaba con su propio cupo de series sin mirar cuánto ya llevaba ese músculo
en días anteriores — fácil de disparar con Distribución personalizada
combinando el mismo grupo en varios días.

- `src/lib/generador-rutinas/motor.ts`: nueva función `ajustarVolumenCritico()`,
  corre al final de `generarRutinaPorReglas()` antes de devolver el borrador:
  - Agrupa todos los ejercicios de la semana por grupo (y sub-grupo de
    brazo), suma series.
  - Si un grupo supera su tope crítico (mismos números que
    `validacion.ts`: piernas 50, pecho/espalda/hombros/core 36, bíceps/
    tríceps 24), baja de a 1 serie por vuelta — **solo en accesorios**
    (reps en rango simple tipo "10-15"), **nunca en principales** con reps
    en pirámide (tipo "15-12-10-8-8", donde bajar las series sin tocar el
    texto dejaría un número de reps por serie que no coincide con las
    series reales). Piso de 2 series, nunca deja un ejercicio en 0 o 1.
  - Si ni bajando todos los accesorios al piso alcanza el tope (los
    principales solos ya lo superan), no fuerza nada inconsistente: deja una
    alerta clara para que el entrenador lo revise a mano.
- 2 tests nuevos en `motor.test.ts`: uno donde el recorte SÍ alcanza el tope
  (verifica series bajadas, principales intactos, piso de 2 respetado), y
  uno donde NO alcanza (verifica que avisa en vez de mentir).
- **No se probó en vivo** por los cortes del servidor — cubierto con tests
  contra la función real, mismo criterio que otras partes de esta sesión
  cuando el navegador no colaboró.

## 7. Alumnos: clasificación por plan contratado + editor rápido

- `src/app/admin/alumnos/data.ts`: `IndicadorAlumno` (y por lo tanto
  `ReporteAlumno`) ahora incluye `planCodigo`, `planDiasSemana`,
  `planSesionesMensuales`.
- `src/components/admin/ListaAlumnos.tsx`:
  - Fila nueva de chips "Plan contratado" (Todos/3 días/4 días/5 días/Sin
    plan), aparte del filtro de estado que ya existía.
  - Cada fila de la lista compacta muestra el plan con un lápiz al lado.
  - Editor inline: tocar el lápiz abre un `<select>` de plan + guardar/
    cancelar, sin salir de la lista ni abrir la ficha completa. La fila
    entera sigue siendo clicable para ir al perfil; el editor no dispara esa
    navegación (se restructuró de `<Link>` a un `<div>` navegable por
    `router.push`, con `stopPropagation` en el editor).
  - Server Action nueva `actualizarPlanRapido` (`admin/alumnos/actions.ts`)
    — toca SOLO las columnas del plan. No se reusó `actualizarPerfilAlumno`
    a propósito: ese formulario completo pisa `objetivo` y
    `proximo_control_fecha` a null si no vienen en el FormData.

## 8. Generador: el plan contratado ahora se ve y se respeta al generar

Pedido explícito y de fondo: "el alumno que contrata tres días a la semana
no puede terminar con una rutina de cinco" — la app ya distingue entre
alumnos del gimnasio físico (con plan Access/Select/Pro/Élite pagado) y una
futura versión vendible online (pospuesta, sin tocar todavía).

- `src/app/admin/generador/page.tsx`: trae el plan contratado en una
  consulta APARTE de la lista base de alumnos — importante: si se hubiera
  metido en la misma consulta (como se hizo por error al principio de esta
  sesión), un fallo ahí se llevaba abajo la lista ENTERA de alumnos del
  generador. Ya corregido y verificado (68 alumnos, no 0).
- `src/components/admin/GeneradorRutinasPanel.tsx`:
  - Nuevo componente `PlanContratadoAlumno`: muestra "Plan contratado:
    Access · 3 días/semana · 12 sesiones/mes" siempre que hay un alumno
    elegido (incluso si la ficha de entrenamiento no está completa, porque
    es dato de facturación, no del cuestionario).
  - Si el alumno no tiene plan asignado, alerta en amarillo pidiendo
    asignarlo antes de publicar.
  - Si el alumno declaró más/menos días en su propia ficha que los que
    paga, se resalta la discrepancia.
  - `aplicarSugerencias`: el campo "días/semana" del brief ahora se
    precarga del PLAN CONTRATADO (mínimo si hay varios alumnos con planes
    distintos), no del autoreporte de la ficha — con aviso claro cuando no
    coinciden. El entrenador sigue pudiendo forzarlo a mano en cualquier
    momento (no se le quitó ningún poder, solo se cambió el punto de
    partida).

## 9. Documentos: selector de ejercicios y vista previa fuera del generador

- `src/app/admin/documentos/page.tsx` + `src/components/admin/ArchivosManager.tsx`:
  ahora pasan la biblioteca real de ejercicios a `RutinaDraftEditor`, así que
  al importar/pegar una rutina desde Documentos el entrenador también puede
  tocar cada ejercicio y elegirlo de la biblioteca, igual que ya pasaba en
  el generador.

## 10. STNDRD (Chris Bumstead / CBUM) — qué se puede rescatar

Alejandro pidió explorar `stndrd.app` como inspiración del Método VIP y
quiere usarla próximamente. Se revisó **solo la landing pública y reseñas
públicas de tiendas de apps — sin login, sin token, sin credenciales**
(no se debe entrar ningún token ahí, es una regla dura, no una preferencia).

Fuentes consultadas:
- [stndrd.app](https://www.stndrd.app/) (landing oficial)
- [Independent Chris Bumstead Workout App Review — Dr. Muscle](https://dr-muscle.com/chris-bumstead-app-review/)
- [STNDRD en App Store](https://apps.apple.com/us/app/stndrd-bodybuilding-workouts/id1573298047)
- [STNDRD en Google Play](https://play.google.com/store/apps/details?id=uni.cbum&hl=en_US)

Qué tiene STNDRD que podría aplicarse a VIP Fitness (150.000+ miembros, app
coacheada por Chris Bumstead 6x Mr. Olympia):

1. **Programas con nombre propio y fases**, no genéricos — "Legacy PPL",
   "Road to Olympia" (la prep real de Chris Bumstead), "4 Week to Open".
   Splits rotativos con nivel principiante/intermedio/avanzado. VIP Fitness
   ya tiene planes mensuales (Access/Select/Pro/Élite); esto es un concepto
   distinto y complementario — programas con nombre e identidad, no solo
   niveles de cupo.
2. **Insignias con nombre por hábito**, no solo puntos — "Semana perfecta",
   rachas, etc. Encima de lo que ya hace Impulso VIP con puntos.
3. **Leaderboard segmentado por categorías/ligas**, no un ranking plano
   único — más variedad de a quién le vas ganando.
4. **Comunidad in-app**: compartir logros, apoyo entre alumnos,
   accountability real-time. Es la pieza más grande de las cuatro — necesita
   tablas nuevas (posts, comentarios, moderación), no es un ajuste chico.
5. Explícitamente NO es IA generando rutinas — es contenido estructurado por
   coaches reales, con fases y video guiado. Coincide con la decisión ya
   tomada en VIP Fitness: el motor de reglas decide, la IA solo audita.

Nada de esto se implementó todavía — es investigación para cuando Alejandro
decida qué priorizar.

---

## Verificación al cierre

```text
tsc --noEmit: limpio
Vitest: 22 archivos, 234 pruebas aprobadas (232 + 2 nuevas de esta sesión)
Navegador: parcialmente verificado — el servidor tuvo cortes intermitentes
  de Turbopack durante toda la sesión. Se confirmó en vivo: distribución
  personalizada con bíceps/tríceps (completo, con clic real), patrón de
  movimiento (completo, con clic real), filtro de plan contratado en
  Alumnos (visual, datos reales del backfill). NO se confirmó con clic real:
  editor rápido de plan en la lista, "+"/lápiz de la vista previa editable,
  recorte de volumen crítico — los tres quedaron cubiertos por tests contra
  la función real o por inspección de DOM, no por interacción de mouse.
```

---

## Próximos pasos recomendados

1. **Decidir con Alejandro si se commitea y sube todo lo de esta sesión** —
   nada se subió a git todavía. Es mucho cambio junto; puede convenir
   dividirlo en commits temáticos (bíceps/tríceps, vista previa editable,
   patrón de movimiento, plan contratado + backfill, volumen crítico,
   Documentos) en vez de uno solo gigante.
2. Retomar la verificación en vivo con clic real de los tres puntos que
   quedaron solo cubiertos por tests, cuando el servidor esté estable.
3. Revisar a mano los 8 alumnos que quedaron sin plan (sin rutina activa) y
   corregir con el editor rápido los casos donde el backfill asumió Access
   y en realidad era Select.
4. Tope de ejercicios en grupos "chicos" (gemelo/trapecio/antebrazo) — sin
   implementar, con la aclaración ya confirmada de que bíceps/tríceps/
   hombros nunca cuentan como "chicos" y que el tope no aplica a un día
   armado a propósito solo con esos grupos.
5. Límite de ejercicios por grupo muscular al generar ("máximo N de
   pecho...") — sin implementar, la pieza más grande de las pendientes del
   generador.
6. Cargar ejercicios de trapecio y antebrazo en la biblioteca para poder
   habilitarlos como grupos seleccionables.
7. Una vez que Alejandro clasifique varios ejercicios con "Patrón de
   movimiento" (sección 3), conectar ese dato como override real en el
   motor en vez de heurística por nombre — hoy cargarlo no cambia nada
   todavía.
8. STNDRD: decidir cuál de los 4 conceptos (programas con fase, insignias,
   leaderboard segmentado, comunidad) priorizar primero. Comunidad es la
   más grande — probablemente no la primera.
9. Investigar la causa raíz de los cortes de Turbopack si se vuelven a
   repetir seguido — no se tocó en esta sesión.

---

## Regla de continuidad

No rehacer lo ya terminado. Partir desde `main` (recordar que hay cambios
sin commitear de esta sesión — revisar `git status` antes de asumir que el
working tree está limpio), leer este handoff, y preservar siempre:

- Puntos históricos.
- Sesiones completadas.
- Planes activos — **incluidos los recién asignados por backfill, no
  recalcular ni tocar en masa sin revisar con Alejandro primero**.
- Rutinas publicadas.
- Documentos y fotografías.
- Carpeta local `Rutinas Alejandro/`.
- No aplicar migraciones ni escribir en masa sobre datos reales de alumnos
  sin autorización explícita — en esta sesión se aplicó una migración y un
  backfill de 60 alumnos, los dos con confirmación expresa de Alejandro
  antes de ejecutar, después de mostrar un dry run.
