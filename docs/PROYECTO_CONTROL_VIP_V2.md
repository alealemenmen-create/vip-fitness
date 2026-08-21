# Proyecto Control VIP V2

Fecha: 2026-08-21  
Estado: propuesta de arquitectura, diseño y migración  
Alcance: Panel del Entrenador, administración global y Estudio VIP  

## 1. Decisión de producto

El panel nuevo no debe ser una colección más bonita de las pantallas actuales.
Debe convertirse en **Control VIP V2**, el sistema profesional desde el cual se
opera VIP Fitness, se producen rutinas y contenidos, y se controla lo que se
publica en Portal V2.

La recomendación es reconstruir la presentación y la navegación, conservando
la lógica, los datos, las acciones del servidor y los permisos que ya funcionan.
La nueva interfaz se organiza alrededor de tareas reales y no de tablas,
subsistemas ni rutas internas.

Control VIP V2 tendrá tres espacios conectados:

1. **Operación**: alumnos, seguimiento, rutinas, asistencia y decisiones del día.
2. **Producción**: ejercicios, fotos, videos, alimentos, documentos y contenidos.
3. **Estudio VIP**: configuración global, vista previa, versiones y publicación
   de Portal V2.

La administración sensible —roles, puntos globales, gastos, auditoría, borrados
y configuración— seguirá disponible, pero separada del trabajo diario.

## 2. Lo que ya existe y debe conservarse

La base actual es mucho mejor de lo que aparenta cuando se mira solamente la
navegación. No se debe reemplazar su lógica por una aplicación paralela.

- Directorio de alumnos con prioridad y filtros.
- Ficha de alumno dividida en Resumen, Plan, Actividad, Nutrición,
  Comunicación, Documentos y Cuenta.
- Acceso seguro para ver el portal de un alumno y registro de esos accesos.
- Armado manual de rutinas, generador con reglas VIP, reutilización e
  importación de documentos.
- Impulso VIP, memoria adaptativa, propuestas, asistencia en vivo e historial.
- Puntos, movimientos, ranking, recompensas y Arena VIP.
- Galería con Pendientes, Mesa, Biblioteca, Carga masiva y Calidad.
- Procesamiento de JPG, PNG, WebP, HEIC/HEIF, miniaturas y versiones completas.
- Cloudflare Stream, reemplazo protegido, clips archivados y restauración.
- Cola multimedia persistente, reintentos, idempotencia y Modo gimnasio.
- Cola unificada de pendientes, reportes de errores, solicitudes y auditoría.
- Estudio VIP con borrador, publicación, portada global y previsualización.

El proyecto es un **rediseño de operación y experiencia**, no un reemplazo del
motor de negocio.

## 3. Diagnóstico del panel actual

### Fortalezas

- La barra móvil actual ya prioriza Alumnos, Rutinas, Galería, Pendientes y Más.
- Más y la barra lateral comparten un inventario único de destinos.
- Alumnos ya funciona como centro operativo y su ficha dejó de ser una columna
  interminable.
- La Galería ya contiene buena parte de la lógica de producción profesional que
  el nuevo diseño necesita.
- Estudio VIP ya distingue borrador de publicado.

### Problemas que todavía impiden que se sienta como el panel definitivo

- Más de veinte destinos tienen una importancia visual demasiado parecida.
- La barra lateral es un inventario completo, no una guía por tarea.
- El propietario, el entrenador y el editor global entran al mismo marco sin
  una separación suficientemente clara de intención y permisos.
- El alumno seleccionado se pierde al pasar de su ficha a Armar rutina,
  Documentos, Generador o Puntos.
- Algunas rutas todavía usan encabezados y densidades antiguas; Puntos es un
  ejemplo claro.
- Pendientes agrupa cantidades, pero todavía no funciona como una verdadera
  agenda de decisiones con contexto, impacto y acción inmediata.
- Estudio VIP previsualiza una representación construida aparte, no el mismo
  Portal V2 con sus componentes y datos reales de prueba.
- Estudio VIP permite cambiar orden y visibilidad de la navegación principal,
  aunque la visión aprobada de Portal V2 fija cuatro destinos no negociables:
  Entrenamiento, Nutrición, Progreso y Más.
- La configuración global vive como un documento JSON con borrador y publicado,
  pero no ofrece historial visible, comparación ni restauración de versiones.
- La Galería es poderosa, pero su volumen de controles y pestañas puede sentirse
  como varias herramientas unidas en una sola pantalla.
- No existe una búsqueda/comando global para abrir un alumno, ejercicio o acción
  sin recorrer el menú.

## 4. Principios del nuevo diseño

1. **La siguiente decisión primero.** El panel abre mostrando trabajo real, no
   cifras decorativas.
2. **El contexto viaja con el entrenador.** Si se elige un alumno, ese alumno
   permanece seleccionado al abrir rutina, documentos, puntos o seguimiento.
3. **Una pantalla tiene una tarea dominante.** Las opciones avanzadas aparecen
   progresivamente.
4. **La lógica existente es la fuente única.** La interfaz nueva reutiliza las
   mismas acciones, validaciones y tablas.
5. **Automatizar lo reversible; confirmar lo sensible.** Detectar, clasificar,
   comprimir y proponer puede ser automático. Publicar, borrar, fusionar,
   bloquear, enviar o cambiar puntos requiere confirmación.
6. **Portal V2 y Control VIP son familia, no gemelos.** Comparten identidad,
   materiales y precisión; Control VIP es más denso, técnico y productivo.
7. **Diseño móvil primero sin perjudicar escritorio.** Todo funciona en
   vertical desde 320 px; escritorio aprovecha dos paneles y vistas divididas.
8. **Los estados son parte del diseño.** Vacío, cargando, procesando, sin señal,
   error, listo, borrador y publicado se diseñan desde el inicio.

## 5. Arquitectura de información

### 5.1 Navegación principal móvil

La barra inferior recomendada es:

1. **Hoy**: decisiones, alumnos que requieren atención, cargas fallidas,
   vencimientos y actividad en vivo.
2. **Alumnos**: directorio, ficha, seguimiento y vista como alumno.
3. **Rutinas**: armar, generar, reutilizar, importar y publicar.
4. **Galería**: fotos, videos, ejercicios, cargas y calidad.
5. **Más**: mapa completo, Estudio VIP, puntos, comunidad, soporte,
   administración y ajustes.

`Hoy` absorbe la función de la actual pestaña Pendientes; la ruta y las colas
actuales se conservan internamente. Galería permanece a un toque porque la
producción audiovisual es una tarea central y frecuente.

### 5.2 Navegación de escritorio

La barra lateral debe mostrar siete destinos principales y revelar sus módulos
secundarios dentro de cada espacio:

| Destino | Incluye |
|---|---|
| Hoy | Pendientes, actividad en vivo, alertas, cargas y accesos rápidos |
| Alumnos | Directorio, solicitudes, asistencia y fichas |
| Rutinas | Manual, generador, rutinas hechas y documentos |
| Galería | Ejercicios, multimedia, calidad y Modo gimnasio |
| Progreso y puntos | Impulso VIP, movimientos, recompensas, ranking y Arena |
| Comunicación | Noticias, notificaciones, reseñas, errores y soporte |
| Estudio VIP | Diseño global, contenidos, vista previa y publicación |

En el pie de la barra viven `Sistema`, `Gastos`, `Auditoría`, `Borrados`,
`Configuración`, cambio de tema y cuenta. Estas herramientas no deben competir
con Alumnos o Rutinas en la zona de trabajo diario.

### 5.3 Buscador de comando

Un botón permanente o `Ctrl/Cmd + K` permite buscar:

- alumno por nombre, correo o teléfono;
- ejercicio o alias;
- rutina guardada;
- destino del panel;
- acciones como `Subir video`, `Otorgar puntos`, `Crear alumno` o
  `Publicar Portal V2`.

En la primera versión puede construirse con los índices y listas ya disponibles;
no necesita un motor de búsqueda externo.

## 6. Diseño de las pantallas principales

### 6.1 Hoy: centro de decisiones

No será un dashboard de métricas vanidosas. Su orden será:

1. Saludo, fecha, búsqueda y estado general.
2. **Necesita tu decisión**: máximo cinco asuntos críticos con razón, impacto y
   acción directa.
3. **Entrenando ahora** y solicitudes de Impulso en vivo.
4. **Alumnos para hoy**: sin rutina, control vencido, inactividad o señal de
   seguimiento, siempre explicando el motivo.
5. **Producción**: cargas multimedia incompletas, medios procesando, ejercicios
   sin portada usados en rutinas y contenido por publicar.
6. Acciones rápidas: `Agregar alumno`, `Armar rutina`, `Subir material`,
   `Otorgar puntos` y `Crear noticia` según permisos.

En escritorio se distribuye en dos columnas. En móvil forma una sola secuencia,
con decisiones antes que historiales.

### 6.2 Alumnos

El directorio actual se conserva y se refina:

- buscador fijo;
- filtros guardados y recientes;
- prioridad explicada con texto;
- última actividad, plan y próxima revisión en una sola fila;
- selección múltiple únicamente para acciones seguras;
- menú contextual separado del enlace a la ficha;
- virtualización o paginación estable cuando crezca el padrón.

La ficha tendrá una cabecera fija con nombre, estado principal, plan, última
actividad y cuatro acciones: `Indicación`, `Rutina`, `Seguimiento` y
`Ver portal`.

Las siete secciones actuales se mantienen. La pestaña elegida pasa a la URL para
que sobreviva a recargas y enlaces. Puntos permanece dentro de Actividad, pero
`Ajustar puntos` también estará en el menú contextual del alumno para evitar
volver a elegirlo en otra lista.

### 6.3 Rutinas

Las cuatro herramientas actuales deben sentirse como modos de un solo flujo:

1. Elegir alumno o grupo.
2. Elegir origen: Manual, Generador VIP, Reutilizar o Importar.
3. Editar el borrador.
4. Revisar diferencias, advertencias y alcance.
5. Publicar o guardar para después.

El encabezado conserva siempre el alumno activo. Cambiar de modo no obliga a
seleccionarlo otra vez. El generador sigue usando las reglas actuales; no se
convierte en un prompt libre.

En escritorio, biblioteca y plan pueden vivir en columnas paralelas con
arrastrar y soltar. En móvil, se usa un flujo por pasos con una bandeja inferior
para el día que se está armando.

### 6.4 Galería y producción multimedia

La lógica existente es valiosa; el rediseño debe hacerla más legible, no
reemplazarla. La estructura recomendada es:

- **Trabajo**: reportes, faltantes y Mesa de un ejercicio a la vez.
- **Biblioteca**: catálogo visual, búsqueda, filtros y ficha.
- **Cargas**: selección, Modo gimnasio, cola persistente y reintentos.
- **Calidad**: fichas incompletas, duplicados, alias, enlaces rotos, archivos
  huérfanos y cambios recientes.

`Referencia` debe ser una acción de imprimir/exportar, no una pestaña de trabajo.

La ficha del ejercicio se abre como panel lateral en escritorio y pantalla
completa en móvil. Se divide en Identidad, Clasificación, Portada, Galería,
Video, Técnica, Usos e Historial. Cada sección se guarda de manera independiente.

La cola de ingreso debe usar como unidad un **conjunto del ejercicio**:

- portada;
- video de demostración;
- otras tomas;
- miniatura;
- estado de procesamiento;
- coincidencia y confianza;
- impacto en reportes y rutinas.

Siempre debe verse la representación exacta que recibirá el alumno en Portal V2.

### 6.5 Progreso, Impulso y puntos

Esta área reúne funciones que hoy están repartidas, sin mezclar sus reglas:

- actividad y solicitudes de Impulso;
- propuestas y memoria adaptativa;
- movimientos de puntos;
- ajustes manuales con motivo;
- reglas y auditoría;
- recompensas;
- ranking y Arena VIP.

La pantalla principal muestra salud del sistema y excepciones. Un ajuste manual
de puntos parte desde el alumno, enseña el saldo antes/después, exige motivo y
deja trazabilidad. Las reglas automáticas no se editan junto al formulario de
compensación manual.

### 6.6 Estudio VIP

Estudio VIP debe parecer un editor profesional y seguro, no otro formulario
largo del panel.

#### Composición de escritorio

- Izquierda: árbol de pantallas y contenidos.
- Centro: Portal V2 real, usando los mismos componentes y un alumno de prueba o
  una vista segura seleccionada.
- Derecha: propiedades editables del elemento seleccionado.
- Arriba: estado del borrador, dispositivo, cuenta de vista previa, guardar,
  comparar y publicar.

#### Composición móvil

- vista previa a pantalla completa;
- botón `Editar esta sección`;
- inspector en una hoja inferior;
- barra fija de Guardar borrador y Publicar.

#### Qué se puede configurar

- textos editoriales y avisos globales;
- portada e imágenes globales;
- contenidos destacados y orden de tarjetas secundarias;
- recursos de Entrenamiento, Nutrición, Progreso y Más;
- tema dentro de una paleta VIP controlada;
- activación gradual de contenidos no esenciales;
- metadatos de versión y notas de publicación.

#### Qué permanece fijo

- las cuatro puertas principales de Portal V2;
- la lógica del entrenamiento, Impulso, puntos y nutrición;
- permisos y privacidad;
- estructura mínima que garantiza que una rutina siempre sea accesible;
- identidad básica VIP Fitness;
- componentes de datos personales del alumno.

Estudio VIP no debe permitir mover elementos libremente por píxeles ni ocultar
la navegación esencial. La flexibilidad se ofrece mediante opciones seguras y
componentes definidos.

#### Publicación

El flujo será `Editar → Guardar borrador → Vista previa real → Comparar →
Publicar`. Cada publicación crea una versión con autor, fecha, nota y resumen de
cambios. Debe ser posible restaurar la versión anterior sin editar JSON ni
volver a subir imágenes.

## 7. Sistema visual

Control VIP V2 toma la calidad de Portal V2 y cambia su carácter:

- fondo OLED `#090b0a`;
- superficies grafito mate entre `#111318` y `#171a20`;
- bordes de 1 px, radios de 12, 16 y 24 px;
- verde mineral VIP para selección y acción principal;
- dorado reservado para puntos, logros y recompensas;
- rojo solo para peligro o bloqueo;
- ámbar para revisión;
- verde para listo o resuelto;
- tipografía blanca de alto contraste y metadatos grises;
- retícula de 8 px y áreas táctiles de 44 px en acciones frecuentes.

Las listas y paneles divididos serán el patrón dominante. Las tarjetas grandes
se reservarán para contenido visual, vista previa o una decisión realmente
importante. No habrá una tarjeta de color distinta para cada cifra.

Animaciones: 140–220 ms, usadas para paneles, cambio de estado y confirmación.
Nada debe moverse continuamente mientras el entrenador trabaja.

## 8. Pocas mejoras de lógica, pero de alto valor

### Prioridad 0: necesarias para considerar el sistema seguro

1. **Permiso explícito para Estudio VIP.** Solo propietario/administrador
   autorizado puede editar y publicar. El entrenador puede recibir vista de
   solo lectura si se necesita. No hace falta crear de inmediato un cuarto rol;
   basta una capacidad verificada en servidor.
2. **Rol de cada archivo multimedia.** Cada elemento de ingesta debe saber si es
   portada, demostración u otra toma. Esto evita que `Agregar otra toma`
   reemplace por error la portada.
3. **Limpieza controlada de clips archivados.** Período de gracia, lista de lo
   que se borrará, confirmación y registro. Nunca borrar durante el reemplazo.
4. **Versiones restaurables de Estudio VIP.** Historial y rollback real.

### Prioridad 1: gran mejora operativa con lógica pequeña

5. **Contexto de alumno persistente.** `alumno_id` en URL/estado de navegación
   para Rutinas, Documentos, Seguimiento y Puntos.
6. **Hoy derivado de fuentes existentes.** Reutilizar Pendientes, prioridades,
   Impulso, ingresos y cargas; no crear otro motor paralelo.
7. **Vista previa exacta.** Renderizar Portal V2 real en modo seguro en vez de
   mantener una maqueta independiente.
8. **Pestañas de ficha enlazables.** Guardar la sección en `?tab=`.

### Prioridad 2: después de comprobar el uso

9. Vistas guardadas del directorio.
10. Acciones masivas seguras.
11. Historial consolidado de automatizaciones.
12. Programación de publicaciones globales.

## 9. Qué no agregaría

- Un constructor libre tipo Canva para mover cualquier cosa.
- Un chat de IA como portada del panel.
- Una segunda base de datos o un segundo motor de rutinas.
- Automatización de bloqueos, borrados, mensajes o puntos sin confirmación.
- Gráficas en tiempo real que no cambien una decisión.
- Más temas visuales antes de consolidar el sistema principal.
- Un dashboard lleno de métricas generales sin responsables ni acciones.
- Navegaciones diferentes para cada módulo.
- Dependencias o servicios pagados para resolver funciones que ya cubren la app,
  el navegador, Sharp, Supabase y Cloudflare.
- Reescribir todas las rutas en una sola entrega.

## 10. Estrategia de migración

### Fase 0 — Inventario y contrato de conservación

- matriz de función, ruta, acción, tabla, permiso y prueba;
- lista de comportamientos que no pueden cambiar;
- capturas base móvil y escritorio;
- bandera de acceso para probar Control VIP V2 sin afectar el panel actual.

### Fase 1 — Shell, navegación y Hoy

- nuevo sistema visual y de componentes;
- navegación móvil y escritorio;
- comando global;
- página Hoy usando las fuentes actuales;
- Más completo y permisos visibles.

### Fase 2 — Alumnos y contexto persistente

- directorio nuevo;
- cabecera y pestañas enlazables;
- alumno seleccionado entre módulos;
- acciones de rutina, seguimiento, documentos y puntos sin reelección.

### Fase 3 — Rutinas

- selector común de alumno;
- Manual, Generador, Reutilizar e Importar como modos del mismo flujo;
- revisión previa a publicación;
- sin cambios al motor VIP.

### Fase 4 — Galería

- reorganización visual de Trabajo, Biblioteca, Cargas y Calidad;
- ficha lateral;
- rol de medios por archivo;
- limpieza segura de clips archivados;
- validación en iPhone y Android reales.

### Fase 5 — Estudio VIP

- editor de tres paneles;
- vista previa real;
- configuración limitada por componentes;
- historial, comparación y restauración;
- publicación protegida.

### Fase 6 — Progreso, comunidad y administración

- puntos, Impulso, recompensas y Arena;
- noticias, notificaciones, soporte y reseñas;
- auditoría, gastos, borrados y configuración;
- retiro progresivo del shell viejo cuando la cobertura sea completa.

Cada fase debe poder activarse por permiso o bandera. Las rutas antiguas se
mantienen como respaldo hasta verificar equivalencia funcional.

## 11. Criterios de aceptación

- Encontrar un alumno en menos de tres segundos.
- Llegar a cualquier función en vertical sin girar el teléfono.
- Pasar de una ficha a Armar rutina sin volver a elegir alumno.
- Subir fotos y videos mezclados, cerrar la pestaña y recuperar la cola.
- Saber siempre qué archivo es portada, demostración u otra toma.
- Ver exactamente cómo aparecerá un cambio en Portal V2 antes de publicarlo.
- Publicar una versión y restaurar la anterior de forma segura.
- Explicar cada prioridad con una razón humana, no una puntuación opaca.
- No mostrar un botón para el cual el rol actual no tiene autorización real.
- Ninguna acción destructiva o externa se ejecuta sin alcance y confirmación.
- Todas las páginas comparten encabezados, campos, estados, paneles y navegación.
- El nuevo diseño no duplica rutinas, puntos, Impulso ni datos del alumno.

## 12. Resultado esperado

El propietario entra a **Hoy** y sabe qué requiere decisión. El entrenador abre
un alumno y puede resolver rutina, seguimiento, nutrición, comunicación y puntos
sin perder el contexto. El productor abre **Galería** y trabaja fotos y videos
como una cola profesional. El propietario abre **Estudio VIP**, ve el Portal V2
real, cambia únicamente lo seguro, guarda un borrador y publica una versión
restaurable.

El panel deja de sentirse como una administración acumulada durante el
crecimiento del proyecto y pasa a ser el sistema operativo definitivo de
VIP Fitness.
