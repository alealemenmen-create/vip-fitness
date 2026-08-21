# Recuperación posterior a `d20a18b`

Fecha de registro: 2026-08-21

Este documento reúne las solicitudes realizadas después del punto de recuperación
`d20a18b`. Alejandro revisó y autorizó el alcance indicado a continuación. La
implementación puede probarse localmente, pero todavía no está autorizada su
publicación.

## Alcance aprobado por Alejandro

- Aprobados los puntos 1 al 8 de la lista resumida presentada en el chat.
- El punto 9, alineación de `Serie`, `Reps` y `Peso`, debe conservarse exactamente
  como funciona en la recuperación actual; no se rediseña.
- Aprobado el punto 10: sustituir `N · trabajo` por el número `N`.
- Los puntos 11 al 15 se consideran consecuencias de la regresión de la franja y
  no forman parte de esta implementación.
- Continúa vigente la regla más reciente de mostrar y probar localmente antes de
  cualquier publicación.

## Base que no se debe dañar

- Punto de partida exacto: `d20a18b` (`fix: asegurar teclado movil en campos de sesion`).
- La franja o espacio negro inferior está corregida en este punto, según la
  comprobación física actual.
- Los botones y su respuesta están corregidos en este punto, según la
  comprobación física actual.
- La pausa de la sesión y el cambio entre lista y video no deben volver a
  mezclarse accidentalmente.
- Se debe conservar toda la lógica probada de sesión, series, pesos, descanso,
  autoguardado, Impulso VIP y progreso.
- No se debe traer en bloque ninguno de los nueve commits posteriores. El usuario
  identificó `92c7637` como el punto después del cual comenzaron las regresiones.
- Todo cambio se mostrará y probará localmente antes de publicarlo.

## Estado visual pendiente en este punto

- El video se corta en la parte superior.
- Falta el difuminado superior: la zona negra del encabezado debe integrarse poco
  a poco con el video y pasar desapercibida, sin convertirse en una franja negra
  dura.
- El encuadre debe preservar correctamente cabeza, cuerpo y piernas en el teléfono.

## Cronología fiel del chat después de `d20a18b`

Esta sección conserva el orden en que Alejandro dio las instrucciones. No intenta
resolver contradicciones: cuando una instrucción posterior cambió una anterior,
se registran ambas para que Alejandro decida cuál queda vigente.

### 1. Igualar el posicionamiento de la imagen de referencia

- Alejandro entregó dos capturas: la primera era la referencia correcta y la
  segunda era la pantalla de VIP Fitness que debía corregirse.
- Indicó que en la referencia el video llegaba hasta arriba y el encabezado negro
  terminaba con un difuminado discreto.
- Señaló que la persona estaba perfectamente posicionada en la referencia, pero
  no en VIP Fitness.
- Pidió corregir la ubicación del botón `Vista de lista`.
- Pidió optimizar los demás botones.
- Advirtió expresamente que no se debía dañar la lógica existente.

### 2. Segunda corrección: en el iPhone el video todavía se veía mal

- Confirmó que los botones ya habían quedado mejor ordenados, pero el video no.
- Informó que el problema se veía específicamente en su iPhone 13 Pro Max.
- Dijo que todavía aparecía un encabezado negro que no debía verse de esa forma.
- Describió un salto al abrir la vista: parecía aparecer primero una foto o un
  tamaño incorrecto y después el video se ajustaba.
- Pidió que el video llegara hasta arriba y conservara el difuminado profesional.
- Informó que en el navegador del computador se veía bien, pero en el teléfono se
  cortaba el encabezado o la parte superior.
- Indicó que los rótulos `Serie`, `Reps` y `Peso (kg)` no estaban alineados en la
  misma línea.
- Pidió eliminar el botón grande de reproducción situado en el centro, porque el
  video debía reproducirse automáticamente en la vista principal.
- En ese momento pidió dejar un botón pequeño y bien ubicado para pausar el video,
  nunca en el centro.

### 3. Ajustar la parte inferior sin dañar el video corregido

- Confirmó que el video ya se había arreglado y pidió no dañar ese trabajo.
- Indicó que tanto la vista de video como la de descanso tenían una franja negra
  inferior y parecían estar levantadas respecto del borde del teléfono.
- Pidió que la corrección funcionara en todos los teléfonos, no solamente en el
  suyo.
- Pidió retirar la palabra `trabajo` de indicadores como `3 · trabajo`.
- Pidió mostrar solamente un número de serie claro y visible, por ejemplo `3`.

### 4. Corregir posteriormente los títulos de las rutinas

- Pidió títulos más atractivos y acordes con el entrenamiento real del día.
- Indicó que se debía detectar correctamente si el entrenamiento era de glúteos o
  femorales.
- Dio como ejemplo una tarjeta que decía `Pierna · Espalda`, mientras que dentro
  de la rutina el título correcto era `Glúteos y femorales`.
- Explicó que el peso muerto se estaba interpretando como espalda aunque en ese
  entrenamiento correspondía principalmente a glúteos.
- Señaló que los títulos eran largos, generales o imprecisos.
- Pidió enfocarlos en uno o dos grupos principales del día.
- Antes de autorizar ese cambio, pidió solamente confirmar que se había entendido
  el criterio.

### 5. Falla grave: la vista de video comenzó a quedarse colgada

- Informó que al entrar por primera vez a una sesión activa, la vista de video
  podía quedar colgada y comenzar a responder solamente después de muchos toques.
- Señaló que la falla ya estaba publicada y afectaba a alumnos que estaban
  entrenando.
- Reiteró que la franja inferior seguía apareciendo o que la pantalla parecía
  levantada.
- Informó que distintos botones dejaban de responder correctamente.
- Mencionó que también la flecha de retroceso se había quedado colgada.
- Expresó preocupación por la barra inferior de la vista de lista: engranaje,
  flechas y pausa parecían demasiado elevados respecto del borde.
- Pidió tratarlo como una falla crítica y no dejar la aplicación publicada en ese
  estado.

### 6. No mezclar la pausa de sesión con la pausa del video

- Detectó que el botón inferior de pausa de la vista de lista se había combinado
  con la pausa del video.
- Aclaró que nunca había pedido esa combinación.
- Indicó que ese botón probablemente correspondía a detener o pausar el tiempo
  general del entrenamiento.
- Pidió separar nuevamente ambas funciones.

### 7. Propuesta concreta para la barra inferior

- Entregó una captura real de su teléfono.
- Pidió que `Vista de lista` estuviera separada o situada junto al botón de pausa.
- Insistió en que el botón de lista debía responder correctamente.
- Enumeró para la barra inferior: botón de reloj/ajustes, flecha izquierda, pausa,
  nuevo botón de lista, flecha derecha y botón de información.

### 8. Las pruebas del computador no representaban su teléfono

- Manifestó que las pruebas repetidas en el navegador del computador funcionaban,
  pero no parecían representar lo que ocurría en su pantalla física.
- Indicó que en su teléfono la zona inferior se veía distinta.
- Señaló que tampoco estaba viendo con claridad las actualizaciones en el
  navegador usado para las pruebas.
- Pidió validar realmente el resultado que recibía su dispositivo.

### 9. Identificación del commit donde comenzó la regresión

- Alejandro identificó explícitamente `92c7637` como el commit después del cual
  comenzaron los problemas.
- Enumeró como regresiones posteriores a ese commit: botón de `Vista de video`,
  botón de pausa y franja inferior.

### 10. Cambio de decisión sobre cómo pausar el video

- Después pidió retirar el botón visible de pausa del video.
- Definió que tocar el video debía pausarlo.
- Definió que volver a tocar el video debía reanudarlo.
- Pidió eliminar ese botón de pausa de la pantalla.

### 11. Duda sobre si la publicación estaba llegando correctamente

- Preguntó si las actualizaciones no estaban llegando correctamente a su teléfono
  o si no se estaban publicando en el momento esperado.
- Indicó que, según lo que esperaba ver entonces, el botón de pausa debía aparecer
  separado del botón de `Vista de video`.
- Esta observación coexistió con la petición inmediatamente anterior de eliminar
  el botón visible de pausa del video; por eso debe confirmarse el diseño final.

### 12. Acceso al servidor local desde el teléfono

- Preguntó si, levantando el servidor local y entrando desde su teléfono, el
  asistente podría ayudar a verificar esa misma versión.
- El objetivo era comparar la versión real de su teléfono antes de otra
  publicación.

### 13. Verificación del espacio vacío inferior en el iPhone

- Una vez conectado al servidor local, pidió observar la parte inferior de la
  vista de video.
- Calculó visualmente un espacio aproximado de uno a un centímetro y medio entre
  el contenido y el borde inferior del teléfono.
- Aclaró que no quería solamente medirlo: quería comprobar visualmente que toda la
  pantalla parecía desplazada hacia arriba.
- Describió que el contenido llegaba al borde extremo superior y dejaba un vacío
  abajo.
- Lo identificó como una posible mala optimización para su iPhone 13 Pro Max.

### 14. Captura final señalando la franja inferior

- Entregó una captura de la sesión en la que marcó en rojo todo el espacio negro
  vacío debajo de los campos `Serie`, `Reps` y `Peso (kg)`.
- Esa captura quedó como evidencia visual del problema que debía eliminarse.

### 15. Mostrar siempre antes de publicar

- Dio la instrucción explícita: `quiero que me muestres antes de publicar`.
- Desde ese momento, toda corrección debía quedar primero en local y requerir una
  aprobación expresa antes de desplegarse.

### 16. Última optimización exclusiva para iPhone

- Pidió una última prueba específica para su iPhone 13.
- Informó que al tocar ciertos puntos parecía que la pantalla o las zonas táctiles
  estaban mal optimizadas para ese teléfono.
- Comparó el resultado con el Samsung S24 de Mariana, donde la aplicación
  funcionaba muy bien.
- Pidió corregir la adaptación del iPhone sin dañar el funcionamiento de Android.

## Confirmación actual después de recuperar `d20a18b`

- Alejandro confirmó que al regresar a este punto la franja inferior quedó
  arreglada.
- Alejandro confirmó que los botones quedaron arreglados.
- En este punto reapareció el estado anterior del video: se corta arriba y falta el
  difuminado superior progresivo.
- Por tanto, la próxima implementación debe partir de esta base y corregir primero
  solamente el encuadre y el difuminado, preservando la geometría inferior y los
  botones actuales.

## Solicitudes posteriores, en orden cronológico

### 1. Encuadre de video y fotografía

- Tomar como referencia la captura de la aplicación externa entregada por el
  usuario, sin copiar su identidad visual.
- Hacer que el video llegue correctamente hasta arriba y quede integrado debajo
  del encabezado.
- Evitar que el encabezado negro se vea como un bloque separado.
- Incorporar un degradado superior oscuro y progresivo para que los datos de la
  sesión sean legibles y la transición hacia el video sea profesional.
- Mantener también el degradado inferior necesario para leer el nombre, avance y
  acciones del ejercicio.
- Adaptar videos y fotografías verticales u horizontales sin recortar cabeza,
  manos o piernas de forma incorrecta.
- Evitar el salto visual inicial en el que primero aparece una fotografía o un
  tamaño incorrecto y después el video cambia de encuadre.
- El resultado debe funcionar en el iPhone 13 Pro Max del usuario y en otros
  tamaños de iPhone y Android.

### 2. Controles de la vista de video

- Reubicar correctamente el botón `Vista de lista` para que no tape el contenido
  ni quede flotando en una posición incómoda.
- Ordenar y optimizar los demás botones sin alterar su lógica.
- El video debe reproducirse automáticamente en la vista principal de video.
- Eliminar el gran botón central que abre o reproduce otra vista del mismo video.
- Petición final sobre reproducción: tocar directamente el video debe pausarlo;
  tocarlo otra vez debe reanudarlo.
- No dejar un botón de pausa del video ocupando el centro de la pantalla.

### 3. Datos inferiores del ejercicio

- Alinear `Serie`, `Reps` y `Peso (kg)` en una sola línea y a la misma altura en
  todos los teléfonos.
- Sustituir textos como `1 · trabajo`, `2 · trabajo` o `3 · trabajo` por un
  indicador simple y visible: `1`, `2`, `3`, etc.
- Mantener la escritura y el autoguardado de peso y repeticiones en cualquier
  serie, esté o no marcada como lista.
- Conservar la apertura correcta del teclado móvil y evitar que el teclado tape el
  campo activo.

### 4. Geometría y área segura del teléfono

- La pantalla completa no debe quedar levantada respecto del borde inferior del
  iPhone.
- No debe aparecer una franja negra vacía debajo del video, los campos o la vista
  de descanso.
- La barra inferior debe respetar el área segura del iPhone sin dejar un espacio
  adicional de uno a un centímetro y medio.
- El encabezado tampoco debe empujar el resto de la pantalla ni desajustar la
  coordenada real de los toques.
- Evitar zoom accidental dentro de la sesión activa.
- Los campos y botones deben responder al primer toque, incluso cerca de los
  bordes de la pantalla.
- Esta geometría se considera actualmente resuelta al volver a `d20a18b`; debe
  preservarse mientras se corrige el video.

### 5. Barra de controles y significado de la pausa

- No combinar la pausa del tiempo total del entrenamiento con la pausa del video.
- El botón inferior original de pausa correspondía a pausar o reanudar el tiempo
  de la sesión.
- El cambio `Vista de lista` / `Vista de video` debe ser una acción independiente
  y debe responder siempre.
- Durante las pruebas se pidió una barra de seis acciones: ajustes/reloj, flecha
  anterior, pausa, cambio lista/video, flecha siguiente e información.
- Después se pidió retirar el botón visible de pausa del video y controlar el video
  tocándolo directamente.
- Estas instrucciones tuvieron variaciones y Alejandro debe confirmar la
  composición final de la barra antes de implementarla.

### 6. Estabilidad de navegación

- `Vista de video` debe funcionar desde el primer ingreso a la sesión, sin exigir
  varios toques.
- `Vista de lista` debe regresar inmediatamente y sin congelarse.
- Las flechas anterior y siguiente, ajustes, información y retroceso no pueden
  quedar bloqueados por el iframe ni por capas transparentes.
- Ningún control debe cambiar de función según se esté en lista o video, salvo que
  esa diferencia esté diseñada y rotulada explícitamente.
- Evitar estados donde la imagen se ve, pero los controles dejan de responder.

### 7. Pruebas en dispositivos y publicación

- No considerar suficiente una prueba únicamente en el navegador del computador.
- Probar prioritariamente en el iPhone 13 Pro Max real del usuario.
- Confirmar que el mismo ajuste no dañe el Samsung S24 de Mariana, donde la
  experiencia ya funcionaba correctamente.
- Verificar visualmente y por interacción los bordes superior e inferior, lista,
  video, pausa/reanudación, flechas, campos y teclado.
- Mostrar primero la versión local al usuario.
- Publicar solamente después de una aprobación explícita.
- Después de publicar, comprobar que `vipfitness.cl` y el alias V2 muestran el
  mismo despliegue nuevo y no una versión anterior.

### 8. Títulos de rutinas (solicitud separada, pendiente de autorización)

- Usar títulos breves, atractivos y precisos según el entrenamiento dominante del
  día.
- Detectar el grupo muscular por la función real de los ejercicios y no solo por
  una clasificación histórica; por ejemplo, no convertir automáticamente un día
  de glúteos/femorales en `Pierna · Espalda` por la presencia de peso muerto.
- Priorizar uno o dos focos principales en lugar de títulos largos o generales.
- Mantener coherencia entre la tarjeta de la pantalla inicial y el título de `Ver
  rutina`.
- El usuario pidió primero confirmar el criterio y luego dar autorización; por
  tanto, esta corrección no debe mezclarse todavía con la reparación visual.

## Decisiones que Alejandro debe confirmar o corregir

1. Composición final exacta de la barra inferior: cuatro, cinco o seis controles.
2. Si el botón de pausa del tiempo total de sesión permanece visible en lista,
   video o ambas.
3. Confirmar que la pausa del video será únicamente mediante toque directo sobre
   el video, sin botón visible adicional.
4. Intensidad y extensión exactas del degradado superior.
5. Estrategia de encuadre cuando un archivo no coincide con la proporción del
   teléfono: mostrarlo completo con márgenes o permitir un recorte mínimo y
   controlado.
6. Si los títulos de rutinas entran en esta recuperación o quedan para una fase
   posterior.

## Orden propuesto después de aprobar esta lista

1. Congelar y respaldar `d20a18b`.
2. Corregir únicamente encuadre y degradado superior.
3. Probarlo físicamente sin tocar la barra inferior estable.
4. Corregir reproducción automática y toque para pausar/reanudar.
5. Ajustar datos inferiores y el texto numérico de serie.
6. Recién después decidir cambios en la barra de controles.
7. Ejecutar pruebas completas y revisión física en iPhone y Samsung.
8. Mostrar la versión local y esperar aprobación explícita.
9. Integrar de forma trazable en `main`, actualizar el handoff y publicar.
