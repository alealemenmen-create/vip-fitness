# HANDOFF 1.17

Continúa el 1.16. Leer los dos: el 1.16 tiene la cola de pendientes completa y
el porqué de cada decisión anterior; este cubre la sesión del 11/08 (tramo de
la tarde) y actualiza qué queda.

## Punto de regreso

- **`main` subido hasta `755b849`** (más lo de auditoría, ver abajo). `main`
  despliega solo a producción: lo que está subido **ya está en producción**.
- **Migración `0066_auditoria_tipos_hallazgo.sql` escrita y SIN CORRER.**
  Hasta que Alejandro la aplique, el hallazgo nuevo de auditoría se ve en el
  panel pero **descartarlo o penalizarlo va a fallar** (violación del check de
  0046). Detectar y mostrar funciona igual; lo que no funciona es la decisión
  del entrenador sobre ese hallazgo puntual.
- `tsc` limpio · **291 pruebas** (30 archivos) · lint limpio en todo lo tocado
  · build de producción OK. Siguen los 3 errores viejos de eslint en
  `SesionEjercicioCard.tsx` (`setState` en un efecto), no tocados.
- **Notificaciones push: confirmadas funcionando** por Alejandro ("tengo
  notificaciones del tiempo de descanso, funcionó"). Las claves VAPID están
  cargadas en producción, así que el recordatorio nuevo usa el mismo camino.
- Locales sin subir, intactos: `Rutinas Alejandro/`,
  `respaldo-cloud-ia-2026-08-09.bundle`, `tmp/`.

## Sesión del 11/08, tarde — la pantalla de entrenar del alumno

Pedido textual: *"cuando el alumno está ejecutando, actualmente se cometen
muchos errores… el error más común es salir o no finalizar la rutina"* y
*"pruébala de cien maneras distintas, intentando cometer errores"*.

### Los dos errores de fondo, corregidos

**1. La encuesta de dificultad bloqueaba revisar los ejercicios.** El modal
"¿Cómo sentiste este ejercicio?" se disparaba con solo RENDERIZAR un ejercicio
terminado y sin responder. Como el modo enfocado monta una tarjeta por vez,
moverse con Anterior/Siguiente lo volvía a plantar encima, adelante y atrás.
Y no tenía botón de cerrar: había que inventar una respuesta para poder seguir.

- Ahora solo se abre si el ejercicio se terminó **recién, ahí**
  (`recienCompletado`, arranca en `false` en cada montaje — navegar nunca la
  dispara). Mismo arreglo en `SesionGrupoCard` para biseries.
- Se agregó "Ahora no".
- Y un acceso chico con el disco VIP parpadeando ("¿Cómo te fue en este
  ejercicio?") que la reabre. Cubre dos casos: arrepentirse, y responder la de
  un ejercicio terminado en otro momento — antes no había forma.

**2. Salir de la sesión no avisaba nada.** Causa principal de sesiones
`en_progreso` eternas, sin puntos y tapándole el paso a la siguiente.
`SalidaGuiadaSesion.tsx` (nuevo) engancha las tres formas reales de irse de un
teléfono: clic en enlace (captura en `document`, antes que el router), gesto de
atrás (centinela en `history`) y cerrar/recargar (`beforeunload`). El mensaje
cambia según lo hecho: terminó todo / le falta / no tocó nada (ahí salir es
gratis y se lo dice). **Nunca bloquea** — siempre se puede salir igual.

### Lo automático que se agregó

- **Recordatorio push si se va sin cerrar**
  (`programarAvisoSesionSinCerrar`, en `push-actions.ts`). Mismo mecanismo que
  el aviso de descanso. La diferencia importante: **vuelve a mirar la base
  antes de mandar nada**, así que no llega si ya la cerró, y no molesta a quien
  no registró ni un ejercicio.
  **Ojo con `maxDuration`**: la espera NO puede pasar de 300s (el
  `maxDuration` de `sesion/[id]/page.tsx`), porque `after()` corre dentro de la
  misma invocación. Se programó a 12 minutos primero y la plataforma la habría
  cortado a los 5 — el aviso no habría salido nunca. Quedó en **240s**.
- **El cierre aparece solo al terminar el último ejercicio**
  (`CierreAutomaticoSesion.tsx`). NO cierra solo del todo, a propósito:
  acreditar puntos es irreversible desde el lado del alumno y hay gente que
  después de la última serie todavía corrige kilos. Lo automático es que la
  decisión aparezca, no que se tome sola.
- **Franja "tienes un entrenamiento sin cerrar" en TODAS las pantallas del
  alumno** (`AvisoSesionSinCerrar.tsx`, en el layout). El caso real es irse a
  Ranked y no volver. **No es burbuja flotante**: esa ya se probó y se sacó
  porque tapaba el buscador de Nutrición. Va en el flujo, ocupa una línea.

### Lo demás que cambió en esa pantalla

- **"Guardar" suelto se eliminó.** Eran dos toques para una intención y el
  segundo casi nunca llegaba. Ahora **"Completar y guardar"** (ámbar lleno, con
  pulso) hace las dos cosas. Además, **cambiar de ejercicio guarda al
  servidor**: solo se monta la tarjeta visible, así que moverse la desmontaba y
  lo escrito quedaba solo en el respaldo del teléfono.
- **El botón de completar desaparece cuando ya no hace falta.** El servidor
  YA marcaba `completado` solo al estar todas las series hechas
  (`guardarSeries`); el botón seguía ahí sugiriendo un paso inexistente.
- **Aviso al cerrar un ejercicio incompleto**: "te faltan N de M series…
  quedan marcadas como hechas y sin kilos". Aviso, no candado.
- **Barra de navegación nueva**: dobles flechas fluorescentes a los extremos
  (violeta atrás, verde VIP adelante, con animación) y la rutina entera en el
  medio — un casillero por ejercicio que **se reparte el ancho disponible**
  (`flex: 1 1 0` con tope 40px y piso 24px), violeta el que se mira, ámbar con
  flechitas el que toca, tilde verde el hecho. El rectángulo dejó de estar
  montado sobre los íconos: mismo material que `.panel-aero-inferior`.
- **La foto del instructivo salía cortada.** No era el encuadre: la foto
  grande usaba `fotoMiniaturaUrl` (el recorte cuadrado del servidor), que ya
  venía con la persona cortada. Ahora la grande usa la **original**
  (`srcCompleta`) y el relleno borroso de atrás tapa lo que sobra a los lados.
  Las miniaturas chicas siguen con el recorte.
- **Kilos y reps de 16 a 14px**: con tres dígitos se salían del recuadro.

### Lo que se probó rompiendo a propósito

Con clics reales, contra la cuenta de prueba:

- Falsificar `cantidad_series` de 3 a 1 desde el navegador → **no coló**: el
  servidor relee la cantidad real de la base. 0/7, nada completado.
- Apuntar el formulario a un `sesion_id` inexistente → **no coló**: "La sesión
  ya fue cerrada. No se sobrescribió ningún registro."
- Salida guiada completa: interceptó → "Seguir entrenando" se quedó →
  "Sí, salir" salió de verdad a `/alumno/ranked`. **No es una trampa.**
- Encuesta: cerrar ejercicio → sale → "Ahora no" → aparece el botoncito →
  reabre. Ciclo entero.
- La franja de "sin cerrar" siguiendo al alumno hasta Ranked.

**Efecto colateral de estas pruebas**: se finalizó la sesión 2 del alumno de
prueba (quedó con puntos acreditados) y se creó y borró la sesión 4. La 4 se
borró limpia; **los puntos de la 2 no se pueden devolver desde la app**
(reabrir conserva los puntos ya ganados, por diseño).

## El agujero de puntos y qué se hizo

`marcarEjercicioListo` fuerza las series pendientes como hechas, así que el
ejercicio cuenta entero y la sesión puntúa igual. No es una falla técnica: el
sistema hace lo que le pide el botón. Pero un alumno puede cerrar los 7
ejercicios sin levantar nada y cobrar completo.

**Decisión tomada: no quitar puntos automáticamente, mostrárselo al
entrenador.** El razonamiento: el problema real no son alumnos haciendo
trampa, son alumnos que no cierran; si cerrar incompleto además cuesta puntos,
se les da una razón más para no cerrar nada. Y castigaría igual a quien
legítimamente se saltó los descansos.

Implementado como hallazgo nuevo de la **Auditoría de Puntos VIP**
(`series_sin_registro` en `lib/auditoria/data.ts`): series `realizada = true`
con `peso_kg` Y `reps_realizadas` en `null`. Se exigen las dos vacías a
propósito — peso corporal no lleva kilos pero sí reps, y un ejercicio de tiempo
tampoco lleva kilos. Umbral: 3 o más por sesión, para no llenar el panel de
ruido. Severidad media. **Necesita la migración 0066.**

## Cola pendiente (actualizada desde el 1.16)

**Decidido por Alejandro en esta sesión** (ver también la memoria del
proyecto):

1. **La IA deja de ser obligatoria.** Textual: *"no tiene por qué ser
   obligatoria, además no ayuda tanto"*. El tema IA + costo **se hace al
   final**, después de todo lo demás.
2. **Auditoría del generador** (21 controles → ~8): confirmado, **después de
   todo lo demás**.
3. **Conocimiento de culturismo de alto nivel: lo busca él.** Va a pasar el
   material para guardarlo; recién ahí se define cómo aplicarlo. **No inventar
   el contenido ni tocar el motor antes de eso.**

**Sigue pendiente, sin cambios:**

4. **Unificar las tres puertas** (armar a mano / PDF / cuestionario),
   **plantillas y duplicar la semana anterior**, **los tres perfiles de
   entrenador**: siguen en "no les veo el sentido todavía", esperando su
   decisión.
5. **Reconciliar el costo de IA contra una factura real de Anthropic**: los
   ~US$0,24 del panel no cuadran con la fórmula actual (~US$0,71 con los mismos
   números). No confiar en el panel de saldo para decisiones de negocio hasta
   resolverlo.
6. **Antebrazo**: entra en cuanto Alejandro cargue ejercicios de antebrazo —
   hoy no hay ni uno en la biblioteca.
7. **Micrófono en iPhone**: sigue sin probarse ahí.
8. Los 3 errores viejos de eslint en `SesionEjercicioCard.tsx`.

**Nuevo, de esta sesión:**

9. **Correr la migración 0066** — sin ella el hallazgo nuevo no se puede
   descartar ni penalizar.
10. **Sin verificar con toque real**: el recordatorio push de sesión sin
    cerrar (hay que dejar una sesión abierta 4 minutos y esperar), el cierre
    automático al terminar el último ejercicio, y la barra de navegación con
    10+ ejercicios.
11. **Los puntos de la sesión 2 del alumno de prueba** quedaron acreditados
    por las pruebas. Si molesta, hay que ajustarlo desde el panel de auditoría
    o a mano en la base.

## Regla de continuidad

No rehacer lo terminado. Preservar puntos históricos, sesiones, rutinas
publicadas, documentos, fotos, planes activos y `Rutinas Alejandro/`. No
aplicar migraciones ni escribir en masa sobre datos de alumnos sin
autorización expresa. `main` despliega solo a producción.

Feedback explícito del 1.16, que sigue vigente: *"siento que todas las ideas
son mías y no me ayudas"*. Corresponde proponer, no solo ejecutar. Y verificar
con clic real antes de decir que algo anda.
