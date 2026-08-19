# Entrenamiento v2 — especificación funcional y visual de referencia

Actualizado: 2026-08-18

Estado: sesión V2 integrada con datos, guardado e historial reales; pendiente
de piloto táctil en dispositivos y despliegue de las migraciones V2 en preview

Alcance: portada de entrenamiento, vista previa, sesión activa, descansos, video,
acciones auxiliares, cierre y resumen

Referencia funcional: STNDRD

Implementación de destino: Portal VIP Fitness v2, con contenido, marca y lógica
propios de VIP Fitness

## 1. Fuentes examinadas

Este documento se basa en la revisión de las dos grabaciones completas de la
carpeta `04-entrenamiento` y las cinco capturas tomadas en un iPhone 13 Pro Max.

- `ScreenRecording_08-18-2026 08-45-17_1.MP4` — 2 min 37 s.
- `ScreenRecording_08-18-2026 08-58-05_1.MP4` — 4 min 06 s.
- `Foto 1.jpg` a `Foto 5.jpg` — sesión, temporizador y Actividad en Vivo.

Los tiempos indicados a continuación son aproximados y sirven para localizar
rápidamente cada comportamiento dentro de las grabaciones.

### Grabación 1

- `00:00–00:20`: portada, dial semanal y navegación entre días.
- `00:21–00:35`: vista previa de la rutina y detalle de un ejercicio.
- `00:36–00:47`: marcar entrenamiento como completado y acceso a historial.
- `00:48–00:59`: programación de fecha y hora mediante panel inferior.
- `01:00–01:24`: equipo necesario, regreso a portada y selección de otro día.
- `01:27–02:03`: sesión activa, checks, descansos, desplazamiento y carga de
  valores.
- `02:03–02:12`: confirmación de cierre y detalle del programa.
- `02:15–02:37`: día de recuperación, recomendaciones y contenido adicional.

### Grabación 2

- `00:00–00:11`: portada y gesto horizontal entre días.
- `00:12–01:29`: sesión activa completa, varios ejercicios, valores y descansos.
- `01:30–01:44`: temporizador de descanso a pantalla completa y vista de video.
- `01:45–01:59`: lista de ejercicios y ficha multimedia del ejercicio.
- `02:00–02:14`: cierre, resumen, notas, medalla y recuperación.
- `02:15–03:32`: segunda sesión con videos y descansos largos.
- `03:33–03:47`: historial y sustitución de ejercicio.
- `03:48–04:06`: detalle técnico, nuevo cierre y regreso a la portada.

## 2. Principio rector

La sesión no se comporta como una lista estática. Es una máquina de estados en
la que una sola acción reorganiza la jerarquía de la pantalla:

```text
Portada del día
      ↓
Vista previa de la rutina
      ↓
Sesión activa
      ├─ Registro de serie
      ├─ Descanso en línea
      ├─ Descanso inmersivo
      ├─ Vista de video
      ├─ Historial / sustitución / detalle
      └─ Confirmación de cierre
              ↓
Resumen de la sesión
              ↓
Logro o medalla, si corresponde
              ↓
Siguiente día / recuperación
```

VIP v2 debe conservar esta continuidad. No deben sentirse como páginas
desconectadas ni como formularios administrativos.

## 3. Portada del entrenamiento

### 3.1 Estructura

1. Identidad discreta del programa activo.
2. Aviso contextual o logro reclamable, cuando exista.
3. Progreso de fase o programa mediante segmentos delgados.
4. Semana actual y dial de días.
5. Tarjeta fotográfica dominante del día seleccionado.
6. Nombre del entrenamiento y grupos musculares.
7. Tres métricas: ejercicios, series y duración prevista.
8. Acciones `Ver rutina` e `Iniciar día N`.
9. Accesos secundarios a biblioteca, constructor y entrenamientos adicionales.
10. Navegación principal de cuatro destinos.

### 3.2 Comportamiento confirmado

- El usuario cambia de día deslizando horizontalmente sobre la tarjeta.
- La fotografía y todos los datos de la tarjeta cambian como una unidad.
- El dial superior acompaña el cambio y muestra días hechos, día activo y
  descansos.
- `Ver rutina` abre la vista previa sin iniciar el cronómetro.
- `Iniciar día N` abre la sesión activa y comienza el tiempo transcurrido.
- Un día de descanso reemplaza las métricas de entrenamiento por instrucciones
  breves de recuperación y una acción para completarlo.
- La portada vuelve a mostrar el siguiente día una vez registrada la sesión.

### 3.3 Transición esperada

- Arrastre: la tarjeta sigue el dedo en el eje horizontal.
- Al superar el umbral, la siguiente tarjeta completa el recorrido.
- Si no se supera el umbral, la tarjeta vuelve suavemente a su posición.
- El gesto horizontal no debe bloquear el desplazamiento vertical de la página.

## 4. Vista previa de la rutina

### 4.1 Encabezado visual

- Fotografía o video dominante del entrenamiento.
- Acción `Atrás` dentro de la zona segura superior.
- Nombre del día y etiquetas musculares sobre un degradado oscuro.
- Acciones: guardar, programar, historial y marcar como completado.

### 4.2 Resumen

- Número de ejercicios.
- Número total de series.
- Duración estimada.
- Lista completa, separada por series o agrupaciones técnicas: A, B1/B2, C1/C2,
  etc.
- Cada fila presenta miniatura, nombre, repeticiones, tempo y menú contextual.
- Las superseries o trisets llevan una señal visible y discreta.
- La lista termina con el equipo requerido.
- `Iniciar entrenamiento` permanece accesible en la zona inferior.

### 4.3 Acciones auxiliares confirmadas

- `Programar` abre un panel inferior con calendario y hora.
- `Historial` permite consultar ejecuciones previas.
- `Marcar como completado` abre fecha/hora y exige confirmación.
- Tocar un ejercicio abre su ficha técnica y multimedia.
- El menú de tres puntos pertenece al ejercicio o bloque correspondiente.

## 5. Sesión activa — estructura persistente

### 5.1 Encabezado fijo

El encabezado permanece visible mientras se desplaza la sesión:

- izquierda: tiempo total transcurrido `MM:SS`;
- separador vertical tenue;
- centro/izquierda: `Serie X/Y`;
- derecha: botón cápsula `Terminar`;
- borde inferior: barra delgada de progreso total.

La barra aumenta al registrar series. Debe representar progreso real, no una
animación decorativa.

### 5.2 Ejercicio activo

El ejercicio activo se expande; los siguientes permanecen compactos.

Bloque expandido:

- código de agrupación: `SERIE A`, `SERIE B1`, etc.;
- miniatura vertical con icono de reproducción cuando existe video;
- nombre completo del ejercicio;
- secuencia de repeticiones programadas;
- acciones horizontales: `Consejo`, `Historial`, `Sustituir` y `Reordenar`;
- tabla editable de series.

Bloque compacto:

- código de agrupación;
- miniatura vertical;
- nombre en una o dos líneas, con truncado sólo cuando sea inevitable;
- secuencia de repeticiones;
- distintivo de superserie cuando corresponde;
- acceso `Vista de video` cuando el contenido multimedia está disponible.

### 5.3 Tabla de series

Columnas observadas:

1. `Serie`.
2. `Reps`.
3. `Peso`.
4. `Descanso`.
5. `Listo`.

Cada fila contiene:

- número de la serie;
- cápsula `TRB`/`WRK` para serie de trabajo;
- repeticiones editables;
- peso editable y unidad;
- descanso programado;
- check circular.

Los campos no deben parecer cajas blancas. Son superficies negras o gris muy
oscuro, con borde mínimo y tipografía centrada.

### 5.4 Estados visuales de una serie

```text
PENDIENTE
  check sólo delineado
  campos disponibles
        ↓ tocar check
COMPLETADA
  check relleno en azul funcional
  contador superior incrementado
  progreso superior incrementado
  descanso insertado bajo esta fila
        ↓ otra serie completada
ANTERIOR
  conserva check azul y valores
  pierde el foco activo
```

La fila actualmente atendida puede llevar una franja azul muy fina en el borde
izquierdo y un fondo apenas elevado. Ese resaltado nunca debe competir con los
datos.

### 5.5 Datos y teclado

- Tocar `Reps` abre teclado numérico.
- Tocar `Peso` abre teclado decimal/numérico.
- La unidad puede alternarse entre kg y lb cuando el diseño lo permita.
- El teclado no debe tapar la fila que se está editando.
- La barra inferior y la fila activa deben reajustarse usando el viewport visual,
  no desplazarse de manera impredecible.
- Los valores introducidos sobreviven al desplazamiento, cambio de vista y pausa.

## 6. Temporizador de descanso

### 6.1 Inicio automático

Al tocar el check de una serie:

1. La serie queda registrada visualmente.
2. El contador `Serie X/Y` aumenta.
3. Aparece inmediatamente una fila de descanso debajo de la serie recién hecha.
4. La cuenta regresiva comienza con el descanso asignado a esa serie.
5. La pantalla mantiene visible la relación entre serie terminada y descanso.

### 6.2 Fila de descanso en línea

Composición exacta:

- botón `−15 s` a la izquierda;
- `Descanso NN s` centrado;
- botón `+15 s` a la derecha;
- fondo gris carbón ligeramente distinto del resto;
- indicador azul delgado en el extremo izquierdo durante la cuenta activa.

La fila pertenece a la serie terminada. No debe mostrarse en la cabecera ni como
una tarjeta flotante sin contexto.

### 6.3 Movimiento del temporizador

- Sólo existe un descanso activo a la vez.
- Si se completa otra serie antes de terminar el descanso, el temporizador se
  reinicia con el valor de la nueva serie y se mueve debajo de ella.
- El descanso anterior deja de ser el activo.
- Al llegar a cero puede permanecer brevemente como `Descanso 0 s`, sin bloquear
  el siguiente check.
- En ejercicios enlazados con descanso cero, el flujo debe avanzar sin inventar
  una pausa.

### 6.4 Modo inmersivo

La grabación confirma una vista de descanso a pantalla completa:

- fondo negro completo;
- etiqueta `Descanso`;
- número central de gran tamaño;
- unidad `s`;
- `−15 s` y `+15 s` debajo;
- indicación `SIGUE` con próximo ejercicio y repeticiones;
- acción para volver a `Vista de lista`.

Esta vista no crea otro temporizador: representa el mismo estado compartido que
la fila en línea. Cambiar de vista no reinicia la cuenta.

### 6.5 Saltar descanso

- Dentro de la aplicación debe existir una acción inequívoca `Saltar descanso`.
- Saltar lleva el temporizador a cero y conserva el registro de la serie.
- No equivale a finalizar ni a pausar la sesión.

## 7. Multimedia y vistas de entrenamiento

### 7.1 Miniatura

- Formato vertical, cercano a 3:4.
- Esquinas redondeadas pequeñas.
- Foto quieta por defecto.
- Si hay video, aparece un triángulo de reproducción centrado.
- Tocar la miniatura abre el video o la foto correspondiente, no un sustituto.

### 7.2 Vista de video

La grabación confirma un modo inmersivo con el ejercicio ocupando la mayor parte
de la pantalla:

- video vertical grande;
- nombre del ejercicio en la zona inferior;
- datos técnicos compactos;
- campos de serie disponibles sin abandonar el modo;
- acceso `Vista de lista` para regresar;
- acceso a consejo, historial, sustitución e información del ejercicio.
- al abrirse, el modo vuelve al inicio de su plano desplazable y queda encuadrado
  en el centro de la pantalla;
- `Vista de lista` se alinea al borde derecho del modo inmersivo;
- las flechas laterales son dobles, indicativas, de color verde lima y con un
  movimiento direccional discreto.

El alumno puede registrar series tanto en lista como en video. Ambas vistas deben
usar el mismo estado; cambiar de vista no pierde peso, repeticiones, checks ni
descanso.

### 7.3 Controles inferiores persistentes

La sesión presenta cinco controles:

1. ajustes;
2. serie anterior;
3. pausa/reanudar;
4. siguiente paso de la sesión;
5. información o estado contextual.

El avance nunca salta directamente de una serie a otra. La secuencia obligatoria
es `serie → descanso → siguiente serie`; únicamente después del descanso de la
última serie de un ejercicio se activa el primer bloque del ejercicio siguiente.
Retroceder desde el descanso vuelve a la misma serie que lo originó, no a la
serie anterior.

En la referencia son iconos blancos, gruesos y bien centrados dentro de una barra
negra elevada. Deben tener zonas táctiles amplias aunque el dibujo sea pequeño.

El control de ajustes abre opciones funcionales para la sesión:

- `Temporizador automático`: activo crea el descanso al completar una serie;
  inactivo registra la serie y avanza sin abrir temporizador.
- `Sonido al terminar`: silencia o activa las dos notas del fin de descanso sin
  desactivar la vibración.
- `Unidad de peso`: permite `kg` o `lb`, actualiza todos los rótulos y convierte
  los pesos ya introducidos sin perderlos.

### 7.4 Detalle técnico del ejercicio

La ficha multimedia muestra, cuando la información existe:

- video o fotografía principal;
- nombre;
- agarre;
- posición;
- equipo;
- músculos objetivo;
- músculos secundarios;
- recomendaciones relacionadas.

## 8. Consejo, historial, sustitución y reordenamiento

### 8.1 Consejo

- Abre indicaciones breves y accionables del entrenador.
- No debe tapar permanentemente la tabla ni perder la posición de la sesión.

### 8.2 Historial

La grabación confirma una pantalla/panel con:

- nombre del ejercicio;
- pestaña de sesión actual y acumulado histórico;
- fecha;
- serie, repeticiones y peso;
- regreso directo a la sesión activa.

### 8.3 Sustitución

La grabación confirma:

- ejercicio actual en la parte superior;
- búsqueda en la biblioteca;
- recomendaciones;
- ejercicios similares;
- acción para sustituir sólo la posición actual;
- acción para sustituir todas las apariciones aplicables.

La sustitución debe mantener número de series, posición del entrenamiento y
estado ya registrado, salvo que el usuario confirme explícitamente un reinicio.

### 8.4 Reordenamiento

- Permite modificar el orden sin abandonar la sesión.
- Debe respetar agrupaciones como superseries, biseries o trisets.
- Reordenar no puede duplicar ni borrar series registradas.

## 9. Desplazamiento y foco

- El encabezado de sesión es fijo.
- La barra inferior es fija.
- El contenido central es el único plano desplazable.
- Al completar una serie, no debe producirse un salto brusco.
- Al cambiar al siguiente ejercicio, el bloque nuevo debe quedar visible por
  encima de la barra inferior.
- Tocar un ejercicio compacto lo convierte en foco y desplaza suavemente su
  encabezado a una posición útil.
- La lista conserva la posición al regresar desde video, historial, detalle o
  sustitución.

## 10. Finalización

### 10.1 Confirmación

`Terminar` abre un panel inferior, no cierra inmediatamente.

El panel presenta:

- título de confirmación;
- aviso de que salir sin registrar no guarda el progreso;
- tiempo total;
- series registradas;
- acción secundaria `Salir y descartar`;
- acción principal `Registrar entrenamiento`.

Tocar fuera puede cerrar el panel sólo si no existe riesgo de perder datos sin
confirmación.

### 10.2 Resumen registrado

Después de registrar se muestra:

- nombre del día;
- fecha y duración;
- volumen, ejercicios, series y repeticiones;
- lista por agrupación con los valores realmente registrados;
- notas opcionales;
- compartir;
- `Listo` para volver a la portada.

### 10.3 Logros

Si la sesión dispara una medalla o logro:

1. se presenta después del registro;
2. se muestra una sola vez;
3. explica qué se logró;
4. ofrece una acción clara para continuar;
5. luego deja visible el siguiente día o recuperación.

En VIP esta etapa se conectará con Impulso VIP y la comunidad, sin interrumpir el
registro principal.

## 11. Día de recuperación

- Fotografía dominante.
- Título `Día de recuperación`.
- Etiqueta de recuperación activa.
- Lista breve: movilidad, caminata, sueño u otras instrucciones del entrenador.
- Acción `Completar recuperación`.
- Biblioteca y entrenamientos adicionales disponibles debajo.
- Completarlo avanza el dial sin registrar una sesión de fuerza inexistente.

## 12. Actividad en Vivo de iPhone

La quinta captura no pertenece a una página web abierta. Es una Actividad en Vivo
de iOS en la pantalla bloqueada.

Contenido observado:

- `SIGUE`;
- próximo ejercicio;
- número de serie y repeticiones;
- descanso restante;
- anterior, pausa y siguiente;
- `Saltar descanso`.

La experiencia web debe funcionar primero sin esta capa. La réplica exacta en la
pantalla bloqueada requiere una envoltura/aplicación iOS con ActivityKit,
WidgetKit y SwiftUI. Será una fase nativa separada; el motor web debe exponer el
estado de sesión y descanso para que esa extensión lo consuma más adelante.

## 13. Sistema visual de referencia

### 13.1 Lienzo base

- Referencia principal: iPhone 13 Pro Max, 428 puntos lógicos de ancho.
- La implementación no se fija a ese teléfono: debe adaptarse a 360–460 px.
- Se respetan `safe-area-inset-top` y `safe-area-inset-bottom`.

### 13.2 Jerarquía

- Fondo: negro casi puro.
- Superficie base: negro elevado.
- Filas activas: carbón sutil.
- Botones: degradado direccional de negro a gris, sin brillo central.
- Texto principal: blanco alto, no gris lavado.
- Texto secundario: gris medio.
- Bordes: gris oscuro de un píxel o menos visualmente.
- Azul: confirmación funcional, progreso activo y foco de serie.
- Verde VIP: reservado para Impulso VIP, éxito propio o estados definidos; no
  debe sustituir indiscriminadamente al azul funcional.

### 13.3 Proporciones que deben conservarse

- Miniatura activa vertical y dominante, no cuadrada.
- Título del ejercicio claramente mayor que repeticiones y metadatos.
- Chips en una sola línea desplazable.
- Encabezados de columna perfectamente alineados con sus valores.
- Checks circulares centrados en una columna estable.
- Separación vertical uniforme entre bloques A, B, C y D.
- Barra inferior independiente del contenido, con los cinco iconos equidistantes.
- Ningún texto o control queda debajo de la barra inferior.

### 13.4 Criterio de precisión

La aprobación visual se hará con superposición de capturas en estos anchos:

- 360 px;
- 390 px;
- 393 px;
- 428 px, referencia principal;
- 460 px, límite del lienzo móvil.

Se compararán alineación, altura, márgenes, grosor, radios, pesos tipográficos y
contraste. No se considerará terminado sólo porque contenga los mismos elementos.

## 14. Estado actual del prototipo VIP v2

### Ya existe

- ruta independiente de sesión v2;
- encabezado con tiempo, contador y acción de cierre;
- ejercicio activo expandible y cola de ejercicios compactos;
- campos de repeticiones y peso bloqueados según la serie activa;
- borrador local por sesión: protege pesos, repeticiones, notas, tiempo y foco
  ante una caída de red o recarga; sólo recupera la misma sesión durante 48
  horas y nunca pisa una serie que el servidor ya confirmó;
- checks, progreso y navegación real serie por serie;
- descanso en línea e inmersivo con ajustes, salto, sonido y vibración;
- cada descanso automático se consume una sola vez: al volver a una serie ya
  completada y avanzar de nuevo, continúa a la siguiente serie sin repetirlo;
  desmarcar la serie reinicia deliberadamente ese estado;
- vistas de lista y video compartiendo la misma posición;
- ajustes funcionales de temporizador, sonido y unidad de peso;
- reloj inferior como temporizador manual independiente de la rutina;
- notas por ejercicio, consejo, historial e información;
- confirmación de salida y resumen local;
- Impulso VIP local que interpreta la última serie y prepara la siguiente;
- marco oscuro separado del portal clásico.

### Falta o está incompleto

1. Falta la validación táctil final de teclado, viewport, sonido, vibración,
   segundo plano y recuperación del borrador ante red intermitente en iPhone y
   Android físicos.
2. Las personalizaciones de sesión requieren instalar `0104` en un Supabase de
   preview y probar RLS con dos cuentas; si falta, la interfaz las oculta.
3. El resumen se puede compartir mediante las capacidades del navegador, pero
   no publica automáticamente en Comunidad sin consentimiento explícito.
4. No existe ActivityKit para la pantalla bloqueada de iPhone; Web Push y la
   notificación local siguen siendo la cobertura web/PWA.
5. La escritura final y las recuperaciones de error necesitan prueba destructiva
   con una cuenta autorizada de ensayo, nunca con alumnos activos.

## 15. Orden de implementación acordado por dependencia

### Bloque A — geometría fiel y motor local

- reconstruir encabezado, miniaturas, tabla, chips y barra inferior;
- modelar ejercicios, series, valores, foco y progreso;
- mantener todo funcional con datos de prueba controlados.

### Bloque B — descanso

- fila en línea;
- cuenta regresiva única;
- `−15 s`, `+15 s`, cero y salto;
- movimiento del descanso entre series;
- modo inmersivo compartiendo el mismo estado.

### Bloque C — multimedia

- foto quieta por defecto;
- reproducir al tocar;
- modo video y retorno a lista;
- anterior/siguiente y conservación de estado.

### Bloque D — herramientas

- consejo;
- historial;
- sustitución;
- reordenamiento;
- ficha técnica.

### Bloque E — cierre

- confirmación;
- descarte seguro;
- resumen real;
- notas, compartir, logro y siguiente día.

### Bloque F — integración VIP

- conectar el motor y los datos actuales sin duplicarlos;
- incorporar Impulso VIP;
- conservar la Vista clásica como respaldo;
- pruebas con cuentas y datos de ensayo antes de tocar producción.

### Bloque G — extensión nativa opcional

- aplicación/envoltura iOS;
- ActivityKit;
- controles de la pantalla bloqueada;
- sincronización segura con el estado de la sesión.

## 16. Criterios de aceptación del corazón de la sesión

La primera entrega funcional del entrenamiento v2 se acepta cuando:

1. Completar una serie muestra el check, actualiza contador y barra, y crea el
   descanso exactamente debajo de esa fila.
2. `−15 s`, `+15 s` y `Saltar descanso` modifican el mismo temporizador.
3. Completar otra serie mueve y reinicia correctamente el descanso.
4. Lista, video y temporizador inmersivo conservan el mismo estado.
5. En modo video, avanzar sigue `serie → descanso → siguiente serie` y no salta
   directamente al ejercicio siguiente.
6. Repeticiones y peso no se pierden al desplazar, cambiar de ejercicio o volver.
7. El encabezado y los controles permanecen accesibles sin tapar contenido.
8. La geometría a 428 px coincide visualmente con las capturas de referencia.
9. El comportamiento sigue siendo usable entre 360 y 460 px.
10. Finalizar muestra confirmación, resumen y retorno correcto.
11. Ninguna acción modifica el portal clásico ni datos reales durante esta fase.

## 17. Puntos aún por validar durante la implementación

Estos detalles no quedaron demostrados de forma concluyente en las grabaciones y
no deben inventarse silenciosamente:

- si tocar un check completado revierte la serie inmediatamente o pide confirmar;
- si pausar detiene sólo el cronómetro general, también el descanso, o ambos;
- reglas exactas de sustitución cuando ya existen series completadas;
- comportamiento sin conexión;
- persistencia después de cerrar por fuerza la aplicación;
- sonido, vibración y notificación exactos al terminar el descanso;
- permisos y privacidad de la acción `Compartir`.

Hasta validarlos, se utilizará el comportamiento más seguro y reversible, y se
mantendrá cada decisión aislada para poder ajustarla sin rehacer la pantalla.

## 18. Correcciones confirmadas durante la prueba móvil

Registradas por el propietario el 2026-08-18 e implementadas en la sesión activa.
Queda pendiente únicamente la validación táctil final del propietario en el
teléfono.

### 18.1 Flechas inferiores: navegación por series

Las flechas inferiores no deben cambiar directamente de ejercicio a ejercicio.
Su unidad de navegación es la serie:

- `Siguiente` avanza de la serie actual a la serie siguiente del mismo ejercicio.
- Al avanzar desde la última serie, pasa a la primera serie del ejercicio
  siguiente y despliega ese ejercicio.
- `Anterior` retrocede a la serie anterior del mismo ejercicio.
- Al retroceder desde la primera serie, pasa a la última serie del ejercicio
  anterior y despliega ese ejercicio.
- El cambio debe actualizar el foco y dejar visible la fila correspondiente.
- Navegar no marca una serie como completada ni altera sus valores.
- El descanso activo no debe reiniciarse sólo por navegar; se reinicia únicamente
  cuando el usuario registra una nueva serie.

Implementado: las flechas inferiores, las flechas inmersivas y el gesto lateral
comparten ahora una posición de serie activa. El encabezado y la vista de video
reflejan esa misma posición sin modificar el descanso ni completar registros.

### 18.2 Tocar nuevamente para contraer

Un ejercicio compacto se despliega al tocar cualquier parte útil de su tarjeta.
Cuando ya está desplegado, tocar nuevamente su encabezado o zona principal debe
contraerlo y devolverlo al formato compacto.

La zona táctil no puede limitarse al pequeño rótulo `SERIE A/B/C`; debe incluir la
miniatura, el nombre y el encabezado principal, sin interferir con el botón de
reproducción ni con los campos de la tabla.

Implementado: el rótulo de la serie y la zona del nombre contraen el ejercicio;
la miniatura conserva su acción de abrir la demostración. La comprobación táctil
final queda a cargo de la prueba móvil del propietario.

### 18.3 Serie y descanso son campos independientes

El foco de ejecución avanza por campos, no directamente por filas de series:

1. La serie activa muestra su segmento azul y es la única editable.
2. Al tocar `Listo`, esa serie queda registrada y el foco azul pasa al campo de
   descanso situado inmediatamente debajo.
3. Durante el descanso, ninguna otra serie queda activa automáticamente.
4. Al llegar a cero, se emite sonido, vibración y aviso; entonces el foco pasa a
   la siguiente serie y su segmento se vuelve azul.
5. Si el usuario selecciona manualmente otra serie, no se crea ni se reinicia un
   descanso por esa navegación.

En vista de video el mismo estado se presenta como una secuencia de pantallas:
`video de serie → descanso inmersivo → video de la siguiente serie`.

### 18.4 Avisos y cierre de la rutina

- El aviso local reutiliza el sistema del portal original: audio preparado desde
  el toque, vibración y notificación cuando la pestaña está oculta.
- La vista previa V2 sin inicio de sesión no invoca todavía el push autenticado:
  hacerlo redirige a `/login` porque el servidor no puede asociar un alumno. Se
  conectará al integrar la identidad real de V2; hasta entonces se conservan el
  sonido, la vibración y la notificación local sin expulsar al usuario.
- `Saltar descanso` activa la serie siguiente sin reproducir la alarma local.
- La última serie del último ejercicio no genera descanso: actúa como cierre y
  abre directamente la confirmación para registrar el entrenamiento.

### 18.5 Reloj inferior y temporizador manual

- El reloj de la esquina inferior derecha siempre está disponible.
- Si no existe un descanso, abre un temporizador manual con la duración asignada
  al ejercicio actual.
- El temporizador manual no completa, desmarca ni adelanta ninguna serie.
- Al finalizar o saltar, vuelve exactamente a la serie y vista desde donde se
  abrió.
- Si ya existe un descanso automático, el reloj abre ese mismo temporizador; no
  crea una cuenta paralela.

### 18.6 Alejandro · Impulso VIP dentro de la sesión

La versión local no exige RIR, terminología técnica ni una encuesta obligatoria.

- Al completar una serie, Alejandro interpreta automáticamente repeticiones,
  carga, rango, equipo, rendimiento reciente y confianza acumulada.
- Dentro del rango exige al menos una repetición adicional.
- Al completar el máximo sube el escalón base disponible y vuelve al mínimo del
  rango: mancuernas `+2,5 kg`, barra o máquina `+5 kg`.
- Los saltos mayores se reservan para sobrecumplimiento objetivo y señales
  repetidas: barra hasta `+10 kg` y máquina hasta `+15 kg`.
- Debajo del mínimo se opone a seguir aumentando y reduce o mantiene el
  estímulo para recuperar una serie válida.
- El ajuste se escribe en la siguiente serie pendiente, se destaca visualmente
  y no abre paneles ni interrumpe el descanso.
- Las respuestas manuales son correcciones opcionales: dificultad no visible,
  fallo, pérdida de técnica o molestia.
- Si el ejercicio ya no tiene series pendientes, la decisión se conserva como
  base para la próxima sesión.

La vista directa sin sesión conserva ejercicios demostrativos. Con una sesión
autenticada, la V2 carga identificadores reales, recomendaciones e intervenciones
persistidas del motor histórico de Impulso VIP; el guardado de series, notas y
cierre reutiliza las acciones y tablas del portal original.

La decisión en vivo se rige por `docs/ALEJANDRO_IMPULSO_VIP.md`: seguridad antes
que progresión, repeticiones antes que carga y saltos limitados por equipo y por
confianza acumulada. El alumno responde con lenguaje natural; “perdí la técnica”
y “sentí una molestia” funcionan como frenos explícitos.

Alejandro está activo por defecto. Al registrar una serie prescribe la siguiente
sin esperar una encuesta: dentro del rango exige una repetición adicional y al
completar el techo aplica el siguiente escalón de carga válido. Las respuestas
manuales corrigen la interpretación, pero no activan el motor. Puede apagarse
desde el panel de Alejandro o los ajustes de la sesión.
