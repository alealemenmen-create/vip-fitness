# HANDOFF 1.16

Continúa el 1.15 (misma sesión, tramo posterior). Leer los dos.

> **Actualizado el 11/08/2026.** El tramo nuevo está en la sección
> «Sesión del 11/08» más abajo; el resto del documento quedó como estaba, como
> registro de por qué se decidió cada cosa.

## Punto de regreso

- `main` a la par con `origin/main`. Último commit **subido**: `ee374c1`.
- **Hay trabajo local SIN COMMITEAR** (toda la sesión del 11/08). Ver esa
  sección: son 3 bugs arreglados y 7 funciones nuevas, más una migración
  escrita y sin correr.
- Producción al día y sin tocar. **Ninguna migración aplicada.**
- `tsc` limpio · **277 pruebas** (28 archivos) · build OK con **42 rutas**.
- eslint: 0 errores en todo lo tocado. Quedan 3 errores viejos en
  `src/components/student/SesionEjercicioCard.tsx` (`setState` dentro de un
  efecto), que ya estaban y no se tocaron en esta sesión.
- Leer también la ADENDA al final: ahí están los bugs reportados con un alumno
  real y las decisiones de última hora, que son el punto de partida real.
- Locales sin subir, intactos: `Rutinas Alejandro/`, `respaldo-cloud-ia-2026-08-09.bundle`, `tmp/`.

## Lo que se hizo después del 1.15

- `1396359` + `2ff4019` — **Navegación.** La herramienta manual solo se
  alcanzaba escribiendo la URL. Primero se la puso en el menú y en la barra del
  celular **sacando "Generar"** — error propio: "Más" apunta a Configuración,
  no a un índice, así que el generador quedaba inalcanzable desde el teléfono,
  y además no era lo pedido. Corregido: "Generar" volvió a la barra, y dentro
  del generador hay ahora una fila con las tres formas de llegar a una rutina
  (armar a mano · subir documento · con cuestionario, marcada "estás acá").
  "Armar rutina" queda además en el menú lateral.
- `554faea` — **Varios alumnos para la misma rutina.** El motor ya lo soportaba
  (`alumnoIds`); faltaba la pantalla. Días y minutos se calibran con el MÁS
  CONSERVADOR del grupo. Se muestran TODAS las fichas, una por alumno.
  Bug encontrado y corregido en la prueba: `alternar` copiaba el estado de
  arriba, así que dos toques rápidos leían el mismo valor viejo y el segundo
  pisaba al primero. Ahora usa actualización funcional.
  Verificado en vivo: Plan Access (3 días) + Plan Élite (5) → quedó en 3.
- `cae81af` — **Series y descanso por grupo, de un toque.** En el encabezado de
  cada día, una fila con los grupos que entrena ese día y dos selectores
  (series 2-6, descanso 30-180 s) que cambian todos los ejercicios de ese grupo
  a la vez. Bíceps y tríceps van separados. **NO probado con clic real** —
  typecheck y lint limpios, nada más.

## La IA: Alejandro dice que ya no le sirve, y tiene razón

Textual: *"el tema de la IA ya no me está siendo muy útil, parece que es mejor
yo mismo actualizar manual lo que me genera el documento"*.

Los números lo respaldan: tarda ~2 minutos, llega al final del trabajo, cuesta
~US$0,24 por revisión, y **desde que la ficha del alumno está arriba de la mesa
de trabajo, los antecedentes ya se ven MIENTRAS se elige el ejercicio** — le
sacamos su mejor argumento sin querer.

Recomendación dada (sin implementar): no borrarla, pero que deje de parecer un
paso obligatorio antes de publicar y pase a ser un botón de segunda opinión
para casos complicados. Si con el tiempo no se usa, sacarla.

## Recomendación de fondo (dada y aceptada: "si vamos")

1. **Una sola puerta.** Hay tres formas de llegar a una rutina y eso es el
   problema de raíz. El manual ganó. La encuesta debería dejar de ser una
   pantalla y pasar a ser un botón "precargar desde su ficha" dentro del
   manual; el PDF, un botón de importar.
2. **Regla anti-colapso: por cada control nuevo en la mesa de trabajo, uno
   sale.** El generador viejo no llegó a 91 campos de golpe: se agregaron de a
   uno y cada uno tenía sentido. La herramienta manual va camino a lo mismo.
3. **Invertir en operaciones de a muchos, no en más perillas.** Con 68 alumnos
   el cuello de botella es el tiempo por rutina: series/descanso por grupo
   (hecho), plantillas guardadas, duplicar la semana anterior, una rutina para
   varios alumnos (hecho).
4. **La preparación de Alejandro para competir es otro producto** (fases,
   picos, descargas, peso corporal semanal). No una opción del generador.
5. **Decidir la IA** en vez de dejarla lenta y para todos.

Orden acordado: **descansos/series por grupo (hecho) + achicar los cuadros para
el celular** → unificar las tres puertas → plantillas y duplicar la anterior.
Micrófono, zoom y contador de saldo después: son comodidad, no tiempo ahorrado.

## Cola pendiente

1. **Achicar cuadros y campos para el celular.** Reportado concreto: al editar
   un ejercicio, series/repeticiones/descanso se ven apretados y no se alcanza
   a leer el número completo.
2. **Zoom de pantalla**: tres tamaños (normal, más chico, más chico ×2), con el
   control arriba, al lado del toggle claro/oscuro.
3. **Unificar las tres puertas** en pestañas reales dentro de una pantalla.
4. **Plantillas propias** ("Pecho pesado de Alejandro") y **duplicar la rutina
   anterior** cambiando solo accesorios.
5. **Micrófono** en cada campo de escritura. Aviso dado: en iPhone el soporte
   es irregular, probar ahí antes de ponerlo en todos lados.
6. **"Rutinas generadas"**: elegir persona, ver sus rutinas, abrir una, editarla
   en armar-a-mano y republicar. Ya se guardan en
   `borradores_generador_rutinas`.
7. **Los tres perfiles de entrenador de verdad** (élite de Olympia / personas
   mayores / sala vieja y nueva escuela). Hoy están aproximados con las
   perillas del brief; hacerlo bien implica tocar el motor.
8. **Auditoría del generador** (21 controles → ~8). El detalle campo por campo
   está en el HANDOFF 1.15.
9. **Contador de consumo y saldo.** Decisiones ya tomadas: saldo cargado a mano
   en Configuración (la API no expone el saldo de la cuenta), contando todo lo
   que usa IA. Necesita migración → escribirla y que la corra Alejandro.
10. **Conocimiento de culturismo de alto nivel**: Alejandro quiere aprovecharlo
    sin colapsar la pantalla. Propuesta: que el nivel Competitivo lo APLIQUE
    sin preguntar, y que el "por qué" se consulte solo si se pide.

**Propuesta mía todavía sin respuesta**: avisar en rojo EN EL MOMENTO cuando un
ejercicio elegido choca con la ficha del alumno, sin esperar los 2 minutos de
la IA. Los datos ya están cargados.

## Regla de continuidad

No rehacer lo terminado. Preservar puntos históricos, sesiones, rutinas
publicadas, documentos, fotos, planes activos y `Rutinas Alejandro/`. No
aplicar migraciones ni escribir en masa sobre datos de alumnos sin
autorización expresa. `main` despliega solo a producción.

Feedback explícito, a no olvidar: *"siento que todas las ideas son mías y no me
ayudas"*. Corresponde proponer, no solo ejecutar. Y verificar con clic real
antes de decir que algo anda.

---

# Sesión del 11/08 — lo que se hizo

Se atacó la cola de arriba en el orden de prioridad que dio el entrenador:
primero los tres bugs de la adenda, después su lista de «importantes».

## Los tres bugs con el alumno real — los tres arreglados

**1. "Continuar" mandaba a la sesión equivocada.**
Diagnóstico confirmado en el código: Inicio elegía la sesión de mayor
`numero_calendario`. Tocar "Ver entrenamiento" en un día **ya inserta la fila
en `en_progreso`** aunque nunca se haya tocado "Iniciar rutina", así que una
vista previa del día 7 le ganaba a la sesión 6 que estaba corriendo de verdad.
El resto de la app ya distinguía las dos cosas (`obtenerSesionEnProgreso` en
`entrenar/data.ts`); Inicio era el único que no.

- Regla nueva aislada y probada en `src/lib/entrenamiento/sesion-actual.ts`
  (`elegirSesionDeHoy`): manda la que se está ejecutando, aunque haya otra con
  número mayor. **8 pruebas**, una de ellas reproduce el caso exacto que él
  reportó (6 arrancada + 7 en vista previa → gana la 6).
- Mismo criterio aplicado al anillo de "hoy" (`obtenerResumenEntrenamientoDias`),
  que tenía el mismo desvío.

**2. Las fotos no sumaban puntos.**
No era el bug que parecía. `guardarMovimiento` hace *upsert* y **siempre
devolvía los puntos completos**, aunque la fila ya existiera: la pantalla
anunciaba "+X Puntos VIP" y el total del alumno no se movía. La recompensa de
foto es una por semana **por diseño** (clave `foto:<lunes>`) y eso se respeta.

- `guardarMovimientoConDelta` devuelve lo que realmente cambió el saldo.
- Cuando no acredita nada se dice por qué, en criollo: *"Ya tenías la
  recompensa de foto de esta semana"*. Antes entraba en silencio.
- El peso tenía exactamente el mismo defecto y se corrigió igual.

**3. No se podía poner la fecha real de una foto vieja.**
El campo de fecha existía en el formulario, pero el servidor rechazaba
cualquier cosa anterior a ayer (`fechaEnVentanaValida`) y el campo estaba sin
rótulo, así que parecía decoración.

- `fechaPasadaValida` (nueva) acepta hoy y hasta 10 años atrás, nunca el futuro.
- El campo ahora pregunta **"¿Qué día te sacaste esta foto?"**.
- **La fecha vieja NO fabrica puntos**: se guarda con su fecha real y se avisa
  que la recompensa es solo por la foto de la semana en curso. Sin eso, fechar
  fotos hacia atrás habría reabierto el agujero que cerró `fechaEnVentanaValida`.

## Su lista de "importantes"

| Pedido | Estado |
|---|---|
| Guardar el progreso al armar | **Hecho** |
| Reordenar ejercicios | **Hecho** |
| Achicar los cuadros para el celular | **Hecho** |
| Zoom de tamaño | **Hecho** |
| Micrófono | **Hecho** (sin probar en iPhone) |
| Rutinas generadas por alumno | **Hecho** |
| Contador de consumo y saldo | **Hecho**, falta correr la migración |
| Arreglar los subgrupos de brazo | **Hecho a medias** — ver abajo |
| Conocimiento de culturismo sin colapsar la pantalla | **No se tocó** |

**Guardar el progreso al armar** (`src/lib/generador-rutinas/borrador-local.ts`).
Una rutina de 5 días son 25-30 ejercicios elegidos de a uno, y todo eso vivía
solo en el estado de React. Ahora se guarda solo en el teléfono cada 800 ms.
Al volver a entrar aparece *"Tenías una rutina a medio armar (18 ejercicios,
hace 25 minutos) · Retomarla / Descartar"* — **no se restaura sola**: puede
haber abierto la pantalla para armar otra cosa. Se borra al publicar. Abajo
del botón de publicar dice "Guardado en este dispositivo hace X" para que se
vea que existe. **8 pruebas.**

**Reordenar ejercicios.** Dos flechas apiladas en cada fila de la mesa de
trabajo (apiladas para gastar alto y no ancho, que es lo que escasea en el
teléfono). Renumera `orden`, que es lo que consume la publicación.

**Achicar los cuadros.** El reporte concreto era el editor de un ejercicio.
Dos cambios: la fila de series/reps/descanso **perdió la sangría de 22 px** que
la alineaba con el nombre (esos 22 px eran justo lo que faltaba) y las columnas
pasaron de anchos mínimos en píxeles a fracciones del ancho disponible. La caja
además es más alta (h-10) y con letra más grande (15 px).

**Zoom** (`ZoomPanel.tsx`, al lado del claro/oscuro, en el celular y en la barra
lateral). Tres tamaños: 100% · 85% · 75%. No es una hoja de estilos nueva:
reusa la variable `--escala-texto` que el **alumno** ya usa para AGRANDAR la
letra. Se amplió el rango permitido de `[1, 1.3]` a `[0.75, 1.3]`.

**Micrófono** (`BotonDictado.tsx`), en los dos campos libres del ejercicio
(instrucción de la técnica y observación). Usa el reconocimiento del propio
navegador: no sube audio, no cuesta, no hay clave nueva. **Si el navegador no lo
soporta, el botón no se dibuja** — antes que un micrófono que al tocarlo no hace
nada, ninguno. **Falta probarlo en iPhone**, tal como se avisó.

**Rutinas hechas** (`/admin/rutinas-generadas`, en el menú, en "Más" del celular
y en la fila del generador). Elegir persona → ver sus rutinas → abrir una →
seguir trabajándola en la misma mesa de armado → republicar.
**Ojo con un supuesto del handoff anterior**: decía que sirven los borradores de
`borradores_generador_rutinas`, pero ahí **solo** cae lo que salió del generador
automático — lo armado a mano y lo importado de PDF nunca pasa por esa tabla, y
es la mayor parte de lo que él arma. La fuente es `rutinas` (lo publicado), que
cubre las tres puertas. Se arrastra el `ejercicio_id` real para no perder
ilustraciones ni progresión. Abrir **no toca** la rutina vieja: se edita una
copia y al publicar se crea una nueva.

**Contador de consumo y saldo.** Ya existía media pieza (`asistente_uso_ia`,
migración 0037) pero solo escribían las herramientas del Asistente: **la
revisión de rutinas, que es lo más caro (~US$0,24), no figuraba en ningún lado**.

- `src/lib/ai/consumo.ts`: registro único y cálculo de costo que **sí cuenta la
  caché** (escribirla cuesta más que la entrada normal, leerla mucho menos).
  Contar solo `input_tokens` subestimaba justo la llamada más cara. **6 pruebas.**
- Conectado a la revisión de rutinas y a la lectura de PDF.
- `SaldoIAPanel` en Configuración: saldo cargado a mano (Anthropic no lo
  expone), cuánto queda, y **el desglose "en qué se fue"** por herramienta.
- **Migración `0065_saldo_y_consumo_ia.sql` escrita y SIN CORRER.** Hasta que
  Alejandro la aplique, el panel dice qué falta en vez de romperse, y el
  registro de consumo degrada en silencio.

**Subgrupos de brazo — hecho a medias, a propósito.** Se aplicó el modelo que
él definió: los enfoques de bíceps pasaron a *cabeza larga · cabeza corta ·
braquial* y los de tríceps a *cabeza larga · lateral · medial*. Lo que estaba
antes mezclaba subgrupos con implementos ("Polea") y formas de ejecución
("Compuesto"). Los enfoques ahora se guardan calificados por grupo
("Bíceps · Cabeza larga") porque bíceps y tríceps comparten "cabeza larga" y
si no, marcar uno marcaba los dos.
**Antebrazo NO se agregó**: se confirmó que **no hay un solo ejercicio de
antebrazo cargado en la biblioteca** (`grep` sobre todo el repo: cero
resultados). Ofrecerlo daría un día vacío. Entra en cuanto él cargue los
ejercicios — es lo único que falta de ese punto.

## Sin verificar con clic real

Se corrió `tsc`, eslint, las 277 pruebas y el build de producción, pero **no se
pudo abrir la app**: otra sesión de trabajo tenía tomado el servidor de
desarrollo (PID 30196 en el puerto 3001) y no se lo mató para no interrumpirla.

Lo que conviene tocar de verdad antes de dar por cerrado cada punto:

1. Que "Continuar" retome la sesión en curso con un alumno real que tenga una
   vista previa abierta más adelante.
2. Subir una foto con fecha vieja y ver el aviso de que no suma puntos.
3. Armar media rutina, recargar la página y retomar el borrador.
4. Las flechas de reordenar.
5. El micrófono **en iPhone**.
6. Abrir una rutina vieja desde "Rutinas hechas" y republicarla.

## Lo que sigue pendiente

- **Conocimiento de culturismo sin colapsar la pantalla.** No se tocó. La
  propuesta anotada (que el nivel Competitivo lo aplique sin preguntar y que el
  "por qué" se consulte solo si se pide) implica **tocar el motor**, y el 1.15
  ya la había calificado como trabajo de una sesión completa. Necesita una
  conversación con él antes de codear, no una interpretación.
- **Unificar las tres puertas**, **plantillas / duplicar la semana anterior** y
  **los tres perfiles de entrenador**: siguen en el casillero de "no les ve el
  sentido todavía", esperando su decisión.
- **Auditoría del generador** (21 controles → ~8): sigue después de todo lo demás.
- **Decidir la IA.** Sin resolver. Con la ficha del alumno ya arriba de la mesa
  de trabajo, la recomendación anotada sigue en pie: que deje de parecer un paso
  obligatorio y pase a ser un botón de segunda opinión.
- **Propuesta mía todavía sin respuesta**: avisar en rojo EN EL MOMENTO cuando
  un ejercicio elegido choca con la ficha del alumno, sin esperar los 2 minutos
  de la IA. Los datos ya están cargados. Con el contador de consumo andando,
  ahora además se puede mostrar cuánto ahorraría.

## Nada de esto se subió

No hay commit ni push: **`main` despliega solo a producción** y hace falta que
él autorice el alcance. La migración 0065 tampoco se aplicó.

---

# Adenda — decisiones y bugs reportados al cierre

## Bugs reportados probando con un alumno real (Alejandro José Arroyave)

**Sin verificar todavía en el código. Son reportes del entrenador, no
diagnósticos.**

1. **Fotos de progreso — no se puede poner la fecha real.** Cuando el alumno
   sube fotos "de antes" desde la galería privada, no tiene dónde indicar la
   fecha en que fueron tomadas: quedan con la fecha de subida. Subió dos y
   **las dos quedaron con la misma fecha**.
2. **Fotos — no sumaron puntos.** Al subir esas dos fotos no se le acreditó
   nada. Revisar `registrarFoto` / `recalcularFotoSemana` en
   `lib/ranking/movimientos.ts`: puede estar ligado al bug de fecha (si las dos
   caen en la misma semana, la segunda no suma — habría que confirmar si eso
   es correcto o no).
3. **"Continuar" manda a la sesión equivocada.** El alumno estaba ejecutando la
   **sesión 6**; volvió a Inicio, tocó "Continuar" y lo mandó a la **sesión 7**.
   Pedido explícito: *"siempre tiene que estar sobrepuesta la rutina que se
   está ejecutando"* — el botón debe retomar la sesión EN CURSO, no la
   siguiente del plan. **Le pasa con varios alumnos**, no es un caso aislado.

## Modelo de brazos (decisión del entrenador, confirmarla antes de codear)

Lo que hoy existe mezcla subgrupos con enfoques. Como lo quiere él:

- **Subgrupos de brazo, solo tres**: bíceps · tríceps · **antebrazo**.
- **Enfoque** (dentro de cada subgrupo, NO es un subgrupo):
  - Bíceps: cabeza larga · cabeza corta · braquial
  - Tríceps: cabeza larga · lateral · medial
- Lo que aparezca como "supino neutro", "polea sobre cabeza" o "compuesto" no
  es subgrupo: es enfoque, o sobra.
- **Antebrazo no existe todavía** como grupo con ejercicios cargados.

## Cerrado, no volver a tocar

- **Karin**: resuelto por el entrenador con la pantalla nueva de otorgar puntos.
- **Penalización por descanso excedido**: se queda como está. No es un bug —
  le sirve para que los alumnos no se eternicen entre series y para controlar
  el tiempo en sala. Yo la había marcado como sospechosa; él la confirmó.

## Prioridad actualizada (palabras del entrenador)

**Importantes**: guardar el progreso al armar · reordenar ejercicios ·
achicar los cuadros para el celular · zoom de tamaño · micrófono (si no es
complejo) · rutinas generadas por alumno para reabrir y editar · contador de
consumo y saldo (si no es complicado) · conocimiento de culturismo sin
colapsar la pantalla · arreglar los subgrupos de brazo.

**Después**: auditoría del generador.

**No las recordaba / no les ve el sentido todavía** — explicadas, esperando su
decisión de si valen la pena: unificar las tres puertas en pestañas;
plantillas y duplicar la semana anterior; los tres perfiles de entrenador.
