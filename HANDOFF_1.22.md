# HANDOFF 1.22

Continúa el 1.21. Cubre el tramo del **12 y 13/08**: una auditoría a fondo de
toda la pestaña Entrenar pedida por Alejandro ("que Opus cinco extremo
analice, en Ultracode... y saqué todos los errores"), más dos pedidos suyos
que salieron de esa misma sesión de prueba: ver un día sin empezarlo, y que
las metas de Impulso VIP no se queden mudas para siempre.

Este handoff manda sobre el 1.21 en todo lo que se contradigan.

## ⚠️ Hay trabajo sin subir y una migración sin correr

**Seis commits sin pushear.** `origin/main` sigue en `cfbbc35`; local en
`1851d88`:

```
1851d88  feat(impulso-vip): las metas que quedaron sin generar se rellenan solas
ad8d478  fix(entrenar): terminar de corregir tambien deja la marca
509cdae  feat(entrenar): ver un dia sin empezarlo, y las abandonadas corregidas cuentan
64a9419  perf(entrenar): "Ver entrenamiento" deja de pedir diez veces lo mismo
b739849  fix(entrenar): el pedido de borrado dejaba de mentir, y dos bombas menos
f302dfc  fix(entrenar): corregir un registro muestra la rutina entera y sin el boton de mas
```

### Migración

| Migración | Estado | Qué pasa sin ella |
|---|---|---|
| `0078_sesion_corregida.sql` | **Corrida** (13/08) | — |

Ya está aplicada y verificada contra la base. Solo agrega una columna
nullable (`sesiones_entrenamiento.corregida_en`); no toca ninguna fila. Las
0075/0076/0077 del 1.21 siguen corridas.

## La auditoría: qué se encontró y se arregló

Pedido textual: *"verifica una vez más la funcionalidad, la lógica, la
eficiencia... y saqué todos los errores... la pestaña entrenar y todo lo que
tiene dentro y todos los vínculos"*. `/code-review ultra` no lo puede lanzar
un agente —lo dispara el usuario, se factura aparte—; se hizo la pasada a
mano, archivo por archivo, con verificación en navegador de cada arreglo.

### 1. El pedido de borrado mentía

El comentario decía "upsert sobre el índice de una pendiente por sesión" y
el código hacía `insert`. El índice único de la 0076 (una pendiente por
sesión) rechazaba el segundo pedido, y como **cualquier** error de esa
acción se traducía al mismo aviso, el alumno que pedía dos veces —lo más
natural del mundo si no ve confirmación— leía *"Esta opción todavía no está
activa, avísale a tu entrenador"*. Mentira doble: la función estaba activa y
su pedido ya estaba guardado.

El fondo del problema no era el `insert`: la pantalla no mostraba nada. Se
pedía, no había ninguna señal, y se volvía a tocar el botón.
`tienePedidoDeBorradoPendiente` ahora lo lee, y en vez del botón aparece
*"Ya pediste que borren este registro"*. El motivo no se reescribe a
propósito: la solicitud es la única constancia de que se destruyó historial.

### 2. Aprobar un borrado podía costar los puntos sin borrar nada

En `aprobarBorradoSesion` los puntos se borraban **antes** que la sesión. Si
el `delete` fallaba —justo el caso que ese orden decía estar previniendo—
el alumno se quedaba sin los puntos de una sesión que seguía existiendo, sin
aviso y sin forma de recuperarlos salvo a mano. El comentario se defendía
con "se recalculan al volver a cerrarla", y eso no es cierto: una sesión ya
cerrada no se vuelve a cerrar nunca. Invertido el orden.

### 3. Un botón muerto que prometía borrar sesiones

`ReiniciarRutinaBoton` decía "se borran las N sesiones, esto no se puede
deshacer" y la acción detrás solo redirigía. No se renderizaba en ninguna
página —nadie lo sufrió—, pero era exactamente el bug que el 1.21 dio por
cerrado, esperando que alguien lo montara. Eliminados componente y acción.

### 4. "Ver entrenamiento" pedía diez veces lo mismo

Al crear la sesión, `alumno_perfil` se consultaba una vez por ejercicio
(diez consultas idénticas para la misma fila) y se buscaba una recomendación
previa que **no podía existir** (los ejercicios se acaban de insertar tres
líneas antes). Se descartó diferir todo con `after()` para redirigir al
instante: esos datos son las metas que el alumno ve al entrenar, y
diferirlos lo haría entrar sin ellas. Se sacó solo lo redundante.

## Ver un día sin empezarlo

Alejandro: *"me posiciono en la sesión seis... y le doy ver entrenamiento y
no lo veo, solo me lleva a la sesión que está abierta; debería dejarme
ver"*. Pantalla nueva, `/alumno/entrenar/dia/[id]`: los ejercicios del día,
series, reps, descanso y técnica — **sin crear sesión, sin tocar el cupo del
mes, sin ningún botón para arrancar** (pedido textual). Se entra desde el
modal de conflicto, que ahora tiene una tercera salida.

No muestra metas de Impulso VIP, y no es un descuido: se congelan al crear
la sesión, y ahí todavía no hay sesión.

## Las abandonadas corregidas cuentan para Impulso VIP

El motor solo miraba sesiones `completada`/`finalizada_incompleta`. El 1.21
le abrió "Corregir registro" a las abandonadas ("se abandona por error más
seguido de lo que parece"), y quedó la contradicción: se podían arreglar los
kilos a mano y el motor los seguía ignorando. Decisión de Alejandro:
"la 1 y la 3" (siguen sin contar por defecto, salvo que se hayan corregido).

`corregida_en` (0078) es la marca, y a propósito **no** se limpia nunca (a
diferencia de `corrigiendo_desde`, que es de trabajo en curso). Se escribe
en dos momentos —al abrir la corrección y al cerrarla, en updates
**separados** entre sí y del de `corrigiendo_desde`— porque en la prueba
real la sesión de Alejandro ya estaba en corrección desde antes de que la
migración existiera, y sin el segundo punto de escritura se hubiera quedado
afuera para siempre. Los puntos no vuelven: se recupera lo que se levantó,
no la recompensa.

## El punto flojo que se cerró: metas que se quedaban mudas

Verificando lo anterior en vivo apareció el problema real: las metas de
Impulso VIP se calculan **una sola vez, al crear la sesión**, y si en ese
momento un ejercicio no tenía historial utilizable, no se guarda ninguna
fila — ni siquiera una vacía. No hay ningún otro disparador que lo
reintente.

Le pasó a Alejandro en esta misma sesión de trabajo: creó la sesión 6 real
desde el celular un minuto antes de que la corrección de la sesión 1
terminara. Quedó congelada sin ninguna meta, para siempre, aunque el
historial mejoró casi enseguida. Reconstruir por qué llevó bastante — un
alumno real no tiene esa herramienta, solo ve una pantalla sin tarjetas
moradas y ninguna pista de que debería haberlas.

`refrescarRecomendacionesFaltantes` busca, dentro de una sesión, los
ejercicios sin fila en `impulso_vip_recomendaciones` y reintenta generarla
con el historial de **hoy**, reusando `generarYGuardarRecomendacion` tal
cual (ya es idempotente). Solo toca los que faltan — una meta ya generada no
se vuelve a tocar nunca por acá, sigue valiendo que no cambia por debajo del
alumno mientras entrena.

Se dispara sola: `RefrescarRecomendaciones` es un componente sin pantalla
propia, montado mientras la sesión sigue `en_progreso`, que llama la acción
una vez al entrar. Sin loading ni error visible — si no hay nada que
rellenar es un no-op instantáneo. Verificado de punta a punta contra la
cuenta real: se borró a mano una recomendación ya generada (simulando el
punto flojo), se entró a la sesión en el navegador sin tocar nada más, y la
tarjeta volvió sola en la carga siguiente.

## Verificación

`tsc`, eslint, **376 pruebas** y `npm run build` limpios en cada commit.
Todo lo de esta sesión sí pasó por navegador — servidor de preview levantado
y usado en cada paso, incluidos los dos casos de punta a punta (pedido de
borrado repetido, y el refresco de metas) contra datos reales de la cuenta
de prueba, no simulados aparte.

**Un aviso sobre cómo se probó Impulso VIP:** para verificar las cuatro
reglas del motor (subir peso, subir reps, reducir, mantener) sin esperar
semanas reales, se insertaron dos sesiones de entrenamiento falsas,
marcadas `[DEMO IMPULSO VIP]` en el comentario, con series inventadas. Antes
de escribir nada se corrió el motor puro (`calcularRecomendacion`) en
aislamiento con los mismos datos, para saber el resultado exacto antes de
tocar la base. Las dos sesiones falsas ya se borraron; las recomendaciones
que generaron en la sesión real de Alejandro quedaron (congeladas, no
dependen de los datos que las generaron).

Qué mirar:

1. Sesión con otro entrenamiento activo → modal de conflicto → "Ver qué toca
   este día" muestra la rutina sin crear nada.
2. Pedir que borren un registro dos veces → la segunda vez no duplica, avisa
   que ya hay uno pendiente.
3. Entrar a una sesión con una meta de Impulso VIP que faltaba → aparece
   sola, sin recargar a mano.

## Reglas de trabajo vigentes

- **Responder siempre en español.**
- **Preguntar el alcance antes de subir.** `main` despliega a producción.
- Verificar en el navegador antes de dar algo por hecho. Si no se puede,
  **decirlo explícitamente** en vez de dejarlo implícito.
- Cada escalón de una cadena de respaldo suelta **una sola columna**, la de
  su propia migración — nunca sumarla a un escalón que ya existe (1.21).
- Al agregar una marca nueva a una sesión (`corrigiendo_desde`,
  `corregida_en`), escribirla en un **update aparte** de cualquier otra
  columna de otra migración — mismo motivo.
- Antes de insertar datos de prueba que alimenten un motor de reglas,
  correr el motor puro en aislamiento con esos mismos datos primero. Evita
  adivinar y descubrir el resultado recién en pantalla.
- Postgres **no tiene `create policy if not exists`**: toda migración que cree
  políticas necesita `drop policy if exists` delante de cada `create`.
- `html2canvas` no sirve en este proyecto (no entiende `color-mix()`). La que
  funciona es `html-to-image`. Ver 1.19.
- Sin trackear y **sin tocar**, desde antes de estas sesiones:
  `Rutinas Alejandro/`, `respaldo-cloud-ia-2026-08-09.bundle`, `tmp/`.
