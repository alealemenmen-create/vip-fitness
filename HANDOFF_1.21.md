# HANDOFF 1.21

Continúa el 1.20. Cubre el tramo del **12/08 (noche)**: las opciones del
registro de entrenamiento (corregir y pedir borrado) y **una regresión propia
que rompió "Iniciar rutina" en producción**.

Este handoff manda sobre el 1.20 en todo lo que se contradigan.

## ⚠️ Lo primero: hay trabajo sin subir y migraciones sin correr

**5 commits sin pushear.** `origin/main` está en `c19e4e8`; local en
`59f71f7`. Lo que falta subir:

```
59f71f7  fix(entrenar): una migracion sin correr ya no rompe "Iniciar rutina"
a94e74e  fix(entrenar): corregir un registro deja de reiniciar la rutina
afd10b6  feat(borrados): el alumno pide, el entrenador borra
4a9e341  feat(entrenar): eliminar registro, y los puntos que se quedaban al abandonar
ef36c4e  feat(entrenar): bloque de opciones al final del registro, tambien en abandonadas
```

### Migraciones

| Migración | Estado | Qué pasa sin ella |
|---|---|---|
| `0074_descansos_no_numeran` | **Corrida** (12/08) | — |
| `0075_borrar_sesion_sin_bloqueos` | **Pendiente** | Aprobar un pedido de borrado falla contra la base |
| `0076_solicitudes_borrado_sesion` | **Pendiente** | "Pedir que borren" no guarda nada (avisa en pantalla) |
| `0077_correccion_de_registro` | **Pendiente** | "Corregir registro" no hace nada (avisa en pantalla) |

Las tres pendientes **solo agregan estructura**: no tocan ni una fila. `0075`
cambia dos reglas de borrado a `set null`, `0076` crea una tabla nueva, `0077`
agrega una columna nullable. Correrlas en ese orden.

(La `0074` sí modificaba datos —renumeraba— y ya está aplicada. Su vista previa
de solo lectura quedó en `tmp/vista-previa-0074.sql`.)

## La regresión: lección que conviene no repetir

Alejandro lo reportó así: *"se dañó el botón iniciar rutina cuando entra un
entrenamiento que no ha hecho"*.

**Causa.** `obtenerSesionCompleta` (`alumno/entrenar/data.ts`) lee la sesión con
una cadena de respaldo, por si una migración todavía no corrió en el entorno.
Esa cadena tenía **dos escalones**, y se agregó `corrigiendo_desde` (0077) al
**mismo escalón** que `rutina_iniciada_en` (0040).

Sin la 0077 en la base, el primer select falla y el respaldo suelta **las dos
columnas de una**. Y sin `rutina_iniciada_en`, `bloqueadaPorIniciar` queda en
`true` para siempre: el alumno toca "Iniciar rutina", **la base sí se
actualiza**, pero al recargar se vuelve a leer `null` y el botón sigue ahí. Se
ve exactamente igual que un botón muerto.

Peor: `guardarSeries` y `guardarSeriesGrupo` consultaban esa columna **sin
respaldo**, así que sin la 0077 el alumno no podía guardar **ninguna serie**,
ni siquiera entrenando normal.

**Regla que quedó escrita en el código, y que hay que respetar:** cada escalón
del respaldo suelta **una sola columna, la de su propia migración**. Al agregar
una columna nueva a ese select, **agregar un escalón nuevo** — nunca sumarla a
uno que ya existe. Hoy la cadena es:

1. `COLUMNAS_SESION, rutina_iniciada_en, corrigiendo_desde`
2. `COLUMNAS_SESION, rutina_iniciada_en`
3. `COLUMNAS_SESION`

**Corolario general:** este proyecto acepta que el código llegue a producción
antes que la migración, y por eso los respaldos existen. Pero un respaldo mal
escalonado es peor que no tener ninguno, porque el fallo no se ve como un
error: se ve como un botón que no responde.

## Las dos opciones del registro

Van al final de la pantalla de una sesión ya cerrada, bajo el rótulo
"OPCIONES DE ESTE REGISTRO". Pedido textual: *"desde registro me aparezcan las
opciones al final, abajo"*.

### 1. Corregir registro — lo hace el alumno, al instante

**No vuelve a abrir la rutina.** Esto se equivocó una vez y hubo que
rehacerlo: la primera versión ponía la sesión en `en_progreso`, y el efecto no
era corregir sino **volver a entrenar** — la sesión pasaba a ser la activa
(bloqueando cualquier otra), reaparecía el cronómetro, el aviso al salir y el
"Entrenamiento en curso". Alejandro: *"corregir registro inicia nuevamente la
rutina, y no es la idea, es corregir el registro. Y si lo quiero hacer de
nuevo, le pido al entrenador que lo borre y la hago de nuevo"*.

Cómo funciona ahora: la columna `corrigiendo_desde` (0077) se marca y **la
sesión se queda cerrada**. Solo se habilita la escritura de series.
Consecuencias, todas buscadas:

- No ocupa el cupo de sesión activa → se puede corregir un registro viejo
  aunque haya otro entrenamiento en curso.
- No corre ningún reloj, no hay salida guiada ni cierre automático.
- No toca los Puntos VIP ni el cupo del mes.
- La pestaña Entrenar **no** se secuestra, porque la sesión nunca vuelve a
  "en progreso" (ver `obtenerSesionEnProgreso`).

Qué sesiones se pueden corregir sale de `lib/entrenamiento/estado-sesion.ts`,
**un solo lugar leído por la pantalla y por la acción**. Antes el criterio
estaba escrito dos veces y no coincidían: la pantalla dibujaba el botón con
`estado !== 'en_progreso'` y la acción solo aceptaba dos estados, así que en
una sesión abandonada el botón salía y no hacía nada. Las abandonadas ahora sí
entran, por decisión expresa de Alejandro — se abandona por error más seguido
de lo que parece. Reabrirlas **no** devuelve los puntos que `abandonarSesion`
retiró: se corrige lo registrado, no la recompensa.

### 2. Pedir que borren — lo aprueba el entrenador

Primero se hizo como borrado directo del alumno. Alejandro lo frenó al verlo:
*"ahora me di cuenta de que es un problema borrar el historial, porque si no,
cualquiera puede borrarla como si nada"*.

**Se evaluaron y descartaron** dos alternativas, para no volver a proponerlas:
tres avisos encadenados (se vuelven tres toques automáticos y no protegen
nada) y un código del entrenador (uno fijo se filtra —el primer alumno que lo
usa se lo aprende— y uno de un solo uso lo obliga a estar disponible en el
momento).

Quedó: el alumno **pide** con un motivo obligatorio, el entrenador resuelve en
**Más → Sistema → Pedidos de borrado** (`/admin/borrados`).

- Aprobar borra la sesión, sus series (cascada) y sus Puntos VIP.
- **Los puntos hay que borrarlos a mano**: viven en `puntos_vip_movimientos`
  indexados por clave, no por clave foránea, así que no se van solos.
- La solicitud **sobrevive al borrado** (`sesion_id` queda en null y guarda una
  foto del día, la fecha y el número). Es la única constancia que queda de que
  se destruyó historial y de quién lo aprobó.
- El número de calendario queda libre: el alumno puede volver a hacer esa
  sesión, que es el objetivo.

**Por qué hace falta la `0075`:** dos referencias a `sesion_ejercicios` estaban
sin `ON DELETE` (la trazabilidad de Impulso VIP y las alertas de dolor), y
hacían fallar el borrado justo en los casos más comunes — alguien que ya
entrenó de nuevo, o que reportó una molestia. Pasan a `set null`: son datos que
apuntan a la sesión, no que le pertenecen.

## Bug viejo encontrado de paso

`abandonarSesion` decía **en su propio comentario** que "le quita los puntos
que había sumado"… y nunca los quitaba: `abandonarEntrenamiento` no la llamaba
nadie. El alumno abandonaba la sesión, la veía marcada como abandonada en el
historial, y la seguía cobrando en el ranking. Ya quedó llamándose.

## Verificación

`tsc`, eslint, **376 pruebas** y `npm run build` limpios.

**Nada de esto pasó por un navegador.** El servidor de esta sesión no levanta
—el puerto lo tiene otra sesión de Claude— y el que responde pide inicio de
sesión, que un agente no debe completar. Las dos veces que Alejandro miró la
pantalla con sus ojos encontró algo que los chequeos no: el descanso de Diana
ocupando un número, y el botón de "Iniciar rutina" trabado. **Conviene pedirle
una captura antes de dar por bueno cualquier cambio de esta zona.**

Qué mirar cuando estén corridas las migraciones:

1. Un día sin hacer → "Ver entrenamiento" → adentro "Iniciar rutina" desbloquea
   de verdad y el botón desaparece.
2. Un día ya hecho → "Ver registro" → abajo las dos opciones.
3. "Corregir registro" → se editan los kilos **sin** cronómetro ni "sesión en
   curso" arriba.
4. "Pedir que borren" → aviso verde de que llegó, y el pedido aparece en
   `/admin/borrados`.

## Reglas de trabajo vigentes

- **Responder siempre en español.**
- **Preguntar el alcance antes de subir.** `main` despliega a producción.
- Verificar en el navegador antes de dar algo por hecho. Si no se puede,
  **decirlo explícitamente** en vez de dejarlo implícito.
- Postgres **no tiene `create policy if not exists`**: toda migración que cree
  políticas necesita `drop policy if exists` delante de cada `create`, o un
  intento a medias la deja imposible de reintentar (pasó con la 0072).
- `html2canvas` no sirve en este proyecto (no entiende `color-mix()`). La que
  funciona es `html-to-image`. Ver 1.19.
- Sin trackear y **sin tocar**, desde antes de estas sesiones:
  `Rutinas Alejandro/`, `respaldo-cloud-ia-2026-08-09.bundle`, `tmp/`.
