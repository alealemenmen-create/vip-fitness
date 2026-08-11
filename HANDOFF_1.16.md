# HANDOFF 1.16

Continúa el 1.15 (misma sesión, tramo posterior). Leer los dos.

## Punto de regreso

- `main` a la par con `origin/main`. Último commit: `cae81af`.
- Producción al día. Sin cambios en la base de datos, ninguna migración aplicada.
- `tsc` limpio · eslint limpio · **242 pruebas**.
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
