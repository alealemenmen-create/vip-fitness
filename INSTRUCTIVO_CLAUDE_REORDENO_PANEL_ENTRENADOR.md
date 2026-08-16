# Instructivo de implementación para Claude — reorganización total del Panel del Entrenador VIP

Fecha de especificación: 2026-08-15  
Base examinada: `main` en `159648e` o posterior  
Referencia visual: lenguaje premium aprobado de Entrenar/Entrenamiento  
Prioridad de producto: **máxima**  
Áreas críticas: **Alumnos** y **Galería de ejercicios**  

## 0. Orden directa para Claude

Implementa una reorganización integral del Panel del Entrenador. No entregues solamente recomendaciones: modifica el código por fases, verifica cada fase y deja una demostración navegable.

Este panel es la principal herramienta de trabajo del entrenador. Su objetivo no es “mostrar muchos datos”, sino permitir que el entrenador encuentre a una persona, entienda qué requiere atención y ejecute la acción correcta con el mínimo esfuerzo.

Dos áreas mandan sobre todas las demás:

1. **Alumnos:** directorio, ficha individual, seguimiento y acciones diarias.
2. **Galería de ejercicios:** carga, correspondencia, corrección y control de calidad de fotos y videos.

La regla operativa es:

> Todo lo repetitivo, seguro y verificable se automatiza. Todo lo irreversible, ambiguo o sensible se presenta como propuesta y espera confirmación del entrenador.

Antes de escribir código:

1. Lee completos `AGENTS.md`, `CLAUDE.md`, `HANDOFF_1.27.md` y este instructivo.
2. Como este trabajo toca el acceso al armado de rutinas, lee completo `HANDOFF_GENERADOR_RUTINAS_CLAUDE.md` antes de modificar esa navegación.
3. Si mueves o modifica visualmente controles de Impulso VIP dentro de Alumnos, lee completo `HANDOFF_IMPULSO_VIP_CLAUDE.md`. No cambies su lógica.
4. Lee estas guías locales de Next.js 16.2.12:
   - `node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md`
   - `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`
   - `node_modules/next/dist/docs/01-app/01-getting-started/11-css.md`
5. Recorre en el navegador todas las rutas listadas en la sección 8, primero a 390 px y luego en escritorio.
6. Conserva cambios ajenos existentes. No uses `git reset --hard`, `git checkout --` ni reemplazos destructivos.
7. No hagas commit, push ni despliegue sin autorización explícita.

## 1. Diagnóstico verificado del estado actual

La auditoría se hizo sobre el panel funcionando, no únicamente sobre el código.

### Navegación

- En celular solo existen cinco accesos inferiores: Alumnos, Armar, Documentos, Alimentos y Más.
- La barra lateral de escritorio contiene 19 destinos distribuidos en cuatro grupos.
- “Más” abre `/admin/configuracion`, pero esa pantalla solo muestra diez accesos directos y no representa fielmente todo lo disponible en escritorio.
- Errores reportados y Pedidos de borrado existen en la barra lateral, pero no aparecen como destinos claros dentro de “Más”.
- Solicitudes queda absorbido visualmente por Alumnos y no aparece en “Más”.
- El botón flotante para mostrar la barra lateral solo existe desde 768 px y queda a la izquierda. El entrenador ha tenido que girar el teléfono para encontrar o usar controles relacionados con esa navegación.
- `Armar rutina` y `Generador de rutinas` conducen a experiencias muy parecidas y no explican con claridad cuándo usar una u otra.

### Alumnos

- Hay 68 alumnos activos y 61 aparecen “Por revisar”; cuando casi todos tienen la misma alerta, el estado deja de priorizar.
- Cinco tarjetas de resumen compiten con el directorio, aunque el trabajo principal es encontrar y atender alumnos.
- En móvil, Propuestas de Impulso, resultados y acciones complementarias pueden aparecer antes o competir con el directorio.
- La ficha individual reúne estado, Indicación personal, perfil, planificación, salud, notas, mensajes IA, peso, fotos, rutina, puntos, alimentación, seguimiento, documentos, acceso y zona de riesgo en una sola columna muy larga.
- Acciones importantes se separan por muchos desplazamientos verticales.
- Algunos controles rápidos viven dentro de filas enlazadas, lo que dificulta la interacción táctil y puede producir estructuras interactivas confusas.

### Galería de ejercicios

- La biblioteca tiene 124 ejercicios.
- Solo 15 tienen foto propia y 109 no la tienen.
- Hay 34 reportes de fotos pendientes.
- La pantalla lista decenas de solicitudes una por una antes de llegar al inventario.
- Cada solicitud repite `Agregar foto` y `Resolver todos`.
- Ya existen buenas bases técnicas: agrupación de reportes, resolución automática al reemplazar una foto, soporte server-side para HEIC/HEIF, rotación EXIF, generación WebP en dos tamaños, alias, inventario de usos, candidatos duplicados y subida directa.
- Esas capacidades están dispersas en una interfaz de mantenimiento manual, no organizadas como un flujo de producción.

### Otras áreas

- Armar rutina muestra la lista completa de alumnos dentro de un bloque con scroll interno; se midieron 71 botones en la primera etapa.
- Rutinas hechas repite otra lista completa de alumnos, con 70 botones.
- Auditoría puede contener más de 150 botones, 59 formularios y más de 130 enlaces en una sola vista.
- Otorgar puntos vuelve a mostrar una lista extensa de alumnos.
- Configuración mezcla directorio de herramientas con configuración real del sistema.
- Cada página usa una combinación distinta de encabezado, densidad, tarjetas y acciones.

Los números anteriores son una fotografía del 15/08/2026. No deben quedar escritos de forma fija en la interfaz.

## 2. Resultado esperado

Al terminar, el entrenador debe poder:

1. Abrir el panel en vertical y acceder a **cualquier función** sin girar el teléfono.
2. Encontrar un alumno en menos de tres segundos.
3. Ver primero las acciones realmente urgentes, no una masa de alertas equivalentes.
4. Entrar a una ficha y cambiar entre Resumen, Plan, Actividad, Nutrición, Documentos y Cuenta sin recorrer una página interminable.
5. Subir muchas fotos desde el teléfono o el computador en una sola operación.
6. Dejar que el sistema relacione archivos con ejercicios cuando la coincidencia es segura.
7. Revisar únicamente coincidencias dudosas, duplicados y fotos de baja calidad.
8. Tener todos los destinos, incluidos los primarios, dentro de “Más”.
9. Usar el mismo lenguaje visual premium y operativo en todas las pestañas.
10. Saber qué automatizaciones están funcionando, qué resolvieron y cuáles requieren decisión.

## 3. Principios de organización

### 3.1 Trabajo antes que estructura interna

La navegación debe usar palabras del entrenador, no nombres de tablas o subsistemas.

- `Alumnos`, no “perfiles”.
- `Rutinas`, no dos entradas casi idénticas sin contexto.
- `Galería`, no “multimedia” como única etiqueta.
- `Pendientes`, no una auditoría mezclada con todos los hallazgos.
- `Más`, como directorio completo, no como sinónimo de Configuración.

### 3.2 Una pantalla, una tarea principal

- Alumnos: buscar, priorizar y actuar.
- Galería: completar y asegurar multimedia.
- Rutinas: crear, reutilizar y publicar.
- Nutrición: mantener catálogo y pendientes.
- Pendientes: resolver excepciones.
- Más: encontrar cualquier módulo y cambiar ajustes.

### 3.3 Automatización visible y reversible

Cada automatización debe mostrar:

- qué detectó;
- qué acción propone o ejecutó;
- nivel de confianza;
- alcance del cambio;
- posibilidad de deshacer cuando sea técnicamente viable;
- registro de auditoría.

### 3.4 El color comunica estado

No uses un color distinto para cada tarjeta por decoración.

- Oro: acción principal, marca o estado activo.
- Rojo: bloqueo, error o vencimiento real.
- Ámbar: requiere revisión.
- Verde: resuelto, sano o listo.
- Azul/morado: categorías o automatización cuando necesiten identidad persistente.
- Grafito: navegación y superficies normales.

## 4. Nueva arquitectura de información

## 4.1 Navegación primaria móvil

La barra inferior debe tener cinco destinos:

1. **Alumnos** — `/admin/alumnos`.
2. **Rutinas** — puerta a Armar, Generar, Rutinas hechas y Documentos.
3. **Galería** — `/admin/ejercicios`.
4. **Pendientes** — cola unificada de solicitudes, auditoría, reportes, fotos y gastos vencidos.
5. **Más** — directorio completo de todas las funciones y ajustes.

Si crear una ruta agregadora para Rutinas o Pendientes requiere demasiado trabajo en la primera fase, usa una hoja de navegación con accesos claros. No escondas las funciones mientras llega la ruta definitiva.

### Regla obligatoria

**Todos los destinos del panel deben aparecer también dentro de Más**, incluidos Alumnos, Rutinas y Galería. La barra inferior ofrece velocidad; Más ofrece completitud.

## 4.2 Navegación de escritorio

La barra lateral usa los mismos nombres y grupos que Más:

### Trabajo diario

- Alumnos.
- Solicitudes de ingreso.
- Ingresos y asistencia.
- Indicaciones/Impulso pendientes.

### Rutinas

- Armar manualmente.
- Generar con reglas/IA.
- Rutinas hechas.
- Documentos y asignaciones.

### Bibliotecas

- Galería de ejercicios.
- Biblioteca de alimentos.

### Automatización y control

- Pendientes.
- Asistente VIP.
- Auditoría de Puntos VIP.
- Otorgar puntos.
- Errores reportados.
- Pedidos de borrado.

### Comunidad

- Arena VIP.
- Noticias.

### Administración

- Gastos de la app.
- Actualizaciones.
- Configuración del sistema.
- Cuenta del entrenador.

## 4.3 Más deja de ser Configuración

`/admin/configuracion` no debe seguir haciendo dos trabajos incompatibles.

Opción recomendada:

- Crear `/admin/mas` como directorio completo.
- Mantener `/admin/configuracion` para ajustes del sistema.
- Hacer que la pestaña móvil Más vaya a `/admin/mas`.

Alternativa aceptable:

- Mantener la URL `/admin/configuracion`, pero dividirla en dos pestañas muy claras: `Todo el panel` y `Configuración`.

Más debe incluir:

- búsqueda `¿Qué necesitas hacer?`;
- accesos recientes;
- todos los destinos agrupados;
- contadores solo cuando existe trabajo pendiente;
- acceso a tema, tamaño, mi rutina y cerrar sesión;
- ninguna función dependiente de la barra lateral.

## 5. Shell y navegación sin depender de orientación

### Problema que debe desaparecer

El entrenador no puede volver a depender de un botón pequeño, ubicado a la izquierda y visible solo después de superar un breakpoint o girar el teléfono.

### Comportamiento obligatorio

- De 320 px a 767 px: barra inferior + Más de pantalla completa o bottom sheet.
- En teléfono horizontal o pantalla táctil baja: conserva la navegación móvil; no actives automáticamente una barra lateral de escritorio por alcanzar 768 px de ancho.
- En tablet: barra inferior o rail compacto según espacio real y tipo de puntero.
- En escritorio con puntero preciso y alto suficiente: barra lateral persistente.
- El botón mostrar/ocultar barra lateral vive en el cabezal de escritorio y tiene texto/tooltip claro.
- Aunque la barra lateral esté oculta, Más y la navegación completa siguen disponibles.
- Ninguna acción requiere rotación de pantalla.
- Prueba expresamente 320×568, 390×844, 430×932 y 844×390 táctil.

### Recomendación de breakpoint

No decidas “es escritorio” solo por `min-width: 768px`. Combina ancho, altura y capacidad de puntero, o usa una disposición que se adapte sin cambiar de modelo de navegación abruptamente.

## 6. Diseño visual del panel

El panel comparte la calidad premium del portal del alumno, pero su carácter es más técnico y productivo.

### Cabezal

- Marca VIP compacta.
- Nombre de la sección actual.
- Búsqueda global o botón de comando.
- Estado de automatizaciones/pendientes.
- Tema, zoom y cuenta dentro de un menú coherente.
- En móvil, el cabezal no intenta mostrar cinco acciones con texto al mismo tiempo.

### Superficies

- Negro OLED de fondo.
- Grafito para paneles y controles.
- Bordes de 1 px con contraste contenido.
- Radios de 12–18 px.
- Sombras cortas y discretas.
- No crear una tarjeta grande para cada cifra.

### Encabezado de página estándar

Todas las rutas usan `AdminPageHeader` o su sucesor:

- eyebrow opcional;
- un `h1` único;
- descripción breve;
- una acción principal visible;
- acciones secundarias dentro de un menú.

Elimina encabezados improvisados como los de Armar rutina, Generador, Rutinas hechas, Puntos y Auditoría.

### Listas

- Búsqueda y filtros pegados a la parte superior del área de trabajo.
- Filas densas pero táctiles.
- Metadatos secundarios en una sola línea cuando sea posible.
- Estado al final de la fila.
- Acciones frecuentes visibles; resto en menú contextual.
- Paginación o virtualización para conjuntos grandes.
- No repetir 68 botones sin búsqueda prioritaria y carga progresiva.

## 7. Área prioritaria 1 — Alumnos

## 7.1 Alumnos como inicio operativo

`/admin` puede seguir redirigiendo a `/admin/alumnos`. No hace falta crear un dashboard separado: Alumnos es el centro de operaciones.

La primera pantalla debe mostrar, en orden:

1. Cabezal con `Agregar alumno`, búsqueda global y acceso a Solicitudes.
2. Cola breve `Requieren acción hoy`.
3. Directorio de alumnos.
4. Información secundaria plegable.

Propuestas e historial de Impulso no deben desplazar el directorio en móvil. Muévelos a Pendientes, a una pestaña secundaria o debajo del directorio.

## 7.2 Resumen útil

Sustituye las cinco tarjetas grandes por una banda compacta de filtros:

- Todos.
- Sin rutina.
- Requieren acción.
- Estables.
- Destacados.

Cada filtro muestra cantidad, pero no necesita color y glow propios.

## 7.3 Priorización real

“Por revisar” no puede contener a 61 de 68 alumnos sin jerarquía.

Calcula una prioridad explicable usando señales existentes:

- acceso bloqueado o plan sin asignar;
- sesión abierta demasiado tiempo;
- rutina inexistente o próxima a terminar;
- días sin entrenar comparados con frecuencia contratada;
- caída marcada de adherencia;
- reporte de dolor o molestia;
- revisión/fecha de control vencida;
- solicitud de foto o error;
- mensaje o nota IA pendiente;
- nutrición sin registros cuando corresponde.

Presenta cuatro niveles:

- `Ahora` — bloqueo o riesgo operativo.
- `Hoy` — acción recomendable durante la jornada.
- `Esta semana` — seguimiento no urgente.
- `Sin acción` — únicamente consulta.

Cada razón debe ser legible: `7 días sin entrenar`, no una puntuación opaca.

## 7.4 Directorio

Incluye:

- búsqueda por nombre, objetivo, correo o teléfono;
- filtros de estado, plan, días/semana y entrenador responsable;
- vistas guardadas (`Sin rutina`, `Control vencido`, `Nuevos`, etc.);
- orden por prioridad, nombre, última actividad o próxima revisión;
- selección múltiple;
- acciones masivas seguras: asignar seguimiento, exportar, enviar a Armar rutina;
- paginación estable o virtualización;
- nombres normalizados visualmente sin alterar datos originales.

No coloques botones interactivos dentro de un enlace que ocupa toda la fila. Separa la navegación a la ficha de las acciones rápidas.

## 7.5 Ficha individual reorganizada

La ficha deja de ser una sola columna interminable.

### Cabecera fija de alumno

- volver;
- nombre;
- estado y razón principal;
- última actividad;
- plan;
- acciones: `Indicación`, `Armar rutina`, `Seguimiento`, `Ver portal`;
- menú secundario para documentos, cuenta y acciones menos frecuentes.

### Pestañas internas

1. **Resumen**
   - estado;
   - próximas acciones;
   - adherencia;
   - última sesión;
   - nutrición reciente;
   - notas importantes.
2. **Plan y rutina**
   - plan contratado;
   - sesiones/mes y días/semana;
   - rutina activa;
   - pausar sesiones;
   - descanso;
   - reutilizar/aplicar rutina.
3. **Actividad**
   - entrenamientos;
   - puntos;
   - peso;
   - fotos de progreso;
   - seguimiento diario.
4. **Nutrición**
   - plan;
   - registros;
   - adherencia;
   - alertas.
5. **Comunicación**
   - indicación personal;
   - notas del entrenador;
   - mensajes IA;
   - WhatsApp.
6. **Documentos**
   - rutina, alimentación y archivos;
   - subir/asignar sin abandonar el contexto del alumno.
7. **Cuenta**
   - datos personales;
   - correo;
   - nueva contraseña;
   - bloqueo de acceso;
   - zona de riesgo.

En móvil, las pestañas pueden ser un selector horizontal accesible o un menú de sección. La selección permanece al volver atrás.

## 7.6 Automatizaciones de Alumnos

Automatiza:

- clasificación diaria de prioridad;
- detección de plan/rutina por vencer;
- recordatorio de control próximo;
- propuestas de seguimiento por inactividad;
- borradores de notas o mensajes;
- enlace directo al módulo requerido con alumno preseleccionado;
- resumen diario para el entrenador;
- cierre automático de una tarea cuando la acción ya ocurrió.

No automatices sin confirmación:

- bloquear acceso;
- cambiar plan;
- publicar rutina;
- enviar mensajes externos;
- otorgar/quitar puntos;
- borrar datos.

## 8. Área prioritaria 2 — Galería de ejercicios

## 8.1 Galería como flujo de producción

La pantalla debe tener cuatro vistas:

1. **Pendientes** — reportes y faltantes priorizados.
2. **Biblioteca** — catálogo visual buscable.
3. **Carga masiva** — cola de fotos y videos.
4. **Calidad** — duplicados, nombres sin vincular, medios rotos y baja calidad.

La vista inicial abre Pendientes si hay trabajo; si no, Biblioteca.

## 8.2 Priorización

Ordena automáticamente por impacto:

1. foto incorrecta reportada y usada en rutinas activas;
2. sin foto con muchos usos en rutinas;
3. varios reportes del mismo ejercicio;
4. próximo entrenamiento de un alumno;
5. baja frecuencia de uso;
6. ejercicio sin uso.

Muestra `132 usos · 4 alias · 2 reportes`, no solamente `Sin foto`.

## 8.3 Carga individual cómoda

Fuentes disponibles:

- cámara del teléfono;
- galería del dispositivo;
- arrastrar y soltar;
- pegar desde portapapeles;
- URL externa segura;
- video desde archivo o enlace.

El selector debe aceptar de forma coherente JPG, PNG, WebP, HEIC y HEIF. La capa server ya reconoce HEIC/HEIF; alinea los `accept` de la interfaz.

Después de elegir una imagen:

1. aplica orientación EXIF;
2. valida resolución, peso y formato;
3. genera miniatura y versión completa WebP;
4. sugiere encuadres cuadrado y panorámico;
5. muestra exactamente las dos vistas del alumno;
6. permite corregir encuadre si la sugerencia falla;
7. guarda y cierra automáticamente todos los reportes del ejercicio.

## 8.4 Carga masiva

Permite elegir múltiples imágenes, una carpeta o un archivo ZIP en escritorio y múltiples fotos desde el teléfono.

Cada archivo entra a una cola con:

- miniatura;
- nombre del archivo;
- ejercicio sugerido;
- confianza;
- estado de proceso;
- aviso de calidad;
- acción requerida.

### Correspondencia automática

Usa, en este orden:

1. nombre exacto;
2. slug;
3. alias;
4. normalización de acentos, mayúsculas y separadores;
5. `emparejarEjercicio` con grupo/equipo cuando estén disponibles;
6. sugerencia semántica solo como último recurso.

Umbrales:

- confianza alta y coincidencia única: preseleccionar y permitir `Aplicar todos los seguros`;
- confianza media: pedir confirmación rápida;
- baja o múltiple: dejar sin aplicar.

Nunca asignes silenciosamente una foto a un ejercicio ambiguo.

### Convención de archivos

Documenta y reconoce nombres como:

- `press-banca.jpg`;
- `Press banca__panorama.heic`;
- `curl-martillo_01.png`;
- nombre principal o cualquiera de sus alias.

## 8.5 Automatización de calidad

Detecta y marca:

- imagen borrosa;
- resolución insuficiente;
- orientación extraña;
- formato no admitido;
- duplicado exacto;
- duplicado visual probable;
- foto que ya está asignada a otro ejercicio;
- URL rota;
- miniatura/completa faltante;
- encuadre que corta el sujeto;
- video con error o todavía procesando.

Las comprobaciones deterministas corren siempre. Las comprobaciones de visión/IA deben indicar costo y poder desactivarse.

## 8.6 Duplicados y alias

- Agrupa candidatos duplicados.
- Recomienda un original usando foto, usos y calidad de metadatos.
- Muestra qué rutinas y alumnos se verán afectados.
- Al fusionar, reasigna usos y conserva nombres anteriores como alias.
- La fusión es transaccional y requiere confirmación.
- No borres automáticamente el duplicado.
- Ofrece deshacer o historial de la operación.

## 8.7 Versionado y recuperación

Antes de reemplazar una foto:

- conserva temporalmente la versión anterior;
- registra quién y cuándo cambió;
- permite restaurar desde la ficha del ejercicio;
- elimina medios huérfanos mediante limpieza programada, no durante una operación incompleta.

Si esto requiere migración, crea una migración explícita y pruebas. No simules deshacer solo en el cliente.

## 8.8 Edición rápida del ejercicio

La ficha/editor debe separar:

- identidad: nombre y alias;
- clasificación: grupo, categoría, equipo, patrón y nivel;
- imagen y encuadre;
- video;
- técnica y consejos;
- usos en rutinas;
- historial y reportes.

Guardar una sección no debe obligar a reenviar todo el formulario.

## 8.9 Automatizaciones que deben aprovechar lo existente

Reutiliza:

- `procesarImagen`;
- soporte HEIC/HEIF;
- subida directa;
- `emparejarEjercicio`;
- alias;
- inventario de usos;
- agrupación/resolución de reportes;
- Cloudflare Stream;
- revalidación de biblioteca.

No sustituyas estas piezas por prompts libres.

## 9. Reorganización del resto de pestañas

## 9.1 Rutinas

Unifica la puerta de entrada:

- `Armar manualmente` — control total del entrenador.
- `Generar con reglas` — cuestionario/motor VIP.
- `Rutinas hechas` — reutilizar y editar.
- `Documentos` — importar/asignar.

Antes de mostrar 68 alumnos:

- búsqueda enfocada;
- recientes;
- sin rutina;
- control vencido;
- favoritos o últimos usados.

El alumno seleccionado persiste al cambiar entre Armar, Generar, Rutinas hechas y Documentos.

## 9.2 Documentos

- Separa `Nueva carga` de `Biblioteca`.
- Mantén Rutina y Meta nutricional como flujos diferentes.
- Permite abrir desde una ficha de alumno con ese alumno preseleccionado.
- Muestra procesamiento, errores y asignaciones.
- No mezcles carga, historial y edición sin navegación local.

## 9.3 Alimentos

- Prioriza Pendientes y Sin categoría.
- Búsqueda permanente.
- Clasificación masiva segura.
- Sugerir categoría por nombre/ingredientes; confirmar en lote.
- Detectar duplicados y medidas equivalentes.
- Mantener edición manual y trazabilidad.

## 9.4 Pendientes y Auditoría

No renderices cientos de acciones simultáneas.

- agrupa por tipo y severidad;
- muestra resumen y paginación;
- permite revisión por lotes;
- explica impacto;
- conserva confirmación para penalizaciones, puntos y borrados;
- usa filtros guardados;
- marca resuelto cuando el origen se corrige.

## 9.5 Asistente VIP

- Mantén reportes deterministas sin consumo de IA como primera opción.
- Separa claramente `Reporte seguro` de `Pregunta a IA`.
- Muestra costo estimado antes de consumir IA.
- Permite iniciar desde un alumno ya seleccionado.
- No conviertas el panel completo en un chat.

## 9.6 Arena y Noticias

- Conserva carácter editorial/competitivo.
- Usa el mismo shell y navegación.
- Separa creación, activos e historial.
- Previsualiza exactamente lo que verá el alumno antes de publicar.
- Toda publicación externa requiere confirmación.

## 9.7 Gastos, reportes, borrados y actualizaciones

- Viven dentro de Administración/Soporte y dentro de Más.
- Los vencidos aparecen en Pendientes.
- Reportes muestran captura, ruta, dispositivo y estado sin saturar la fila.
- Borrados conservan zona de riesgo y confirmación fuerte.
- Actualizaciones es historial, no una prioridad diaria salvo novedad no vista.

## 10. Automatizaciones globales del panel

## 10.1 Centro de automatización

Crea una vista donde el entrenador pueda ver:

- automatizaciones activas;
- última ejecución;
- resultado;
- errores;
- próxima ejecución;
- costo IA cuando exista;
- botón de pausa;
- historial.

## 10.2 Acciones automáticas permitidas

- procesar y optimizar medios;
- agrupar reportes equivalentes;
- calcular prioridades;
- detectar faltantes, duplicados y errores;
- preparar propuestas;
- actualizar una tarea cuando el problema desaparece;
- generar resúmenes internos;
- limpiar temporales después de un período de recuperación;
- reintentar trabajos técnicos idempotentes.

## 10.3 Acciones que esperan confirmación

- publicar o reemplazar en lote cuando la correspondencia no es exacta;
- fusionar ejercicios;
- publicar rutinas;
- cambiar planes;
- otorgar o quitar puntos;
- enviar mensajes;
- bloquear cuentas;
- borrar registros;
- incurrir en consumo significativo de IA.

## 11. Componentes y archivos obligatorios

### Shell y navegación

- `src/app/admin/layout.tsx`
- `src/components/admin/AdminTabs.tsx`
- `src/components/admin/AlternarPanelLateral.tsx`
- `src/components/admin/AdminPageHeader.tsx`
- `src/components/admin/TituloPestana.tsx`
- `src/components/admin/AdminStatCard.tsx`
- `src/app/globals.css`

### Alumnos

- `src/app/admin/alumnos/page.tsx`
- `src/app/admin/alumnos/[id]/page.tsx`
- `src/app/admin/alumnos/data.ts`
- componentes importados por ambas páginas;
- `src/app/admin/solicitudes/page.tsx`
- `src/app/admin/ingresos/page.tsx`

### Galería

- `src/app/admin/ejercicios/page.tsx`
- `src/app/admin/ejercicios/actions.ts`
- `src/components/admin/GaleriaEjercicios.tsx`
- `src/lib/ejercicios/procesarFoto.ts`
- `src/lib/ejercicios/emparejar.ts`
- `src/lib/ejercicios/inventario.ts`
- `src/lib/ejercicios/data.ts`
- `src/lib/ejercicios/tipos.ts`
- integración existente con Cloudflare Stream;
- migraciones relacionadas con multimedia y reportes.

### Resto del panel

Revisa cada `page.tsx` bajo `src/app/admin/` y los componentes principales que importa.

## 12. Rutas que deben quedar navegables desde Más

- `/admin/alumnos`
- `/admin/solicitudes`
- `/admin/ingresos`
- `/admin/armar-rutina`
- `/admin/generador`
- `/admin/rutinas-generadas`
- `/admin/documentos`
- `/admin/ejercicios`
- `/admin/alimentos`
- `/admin/asistente`
- `/admin/auditoria`
- `/admin/puntos`
- `/admin/reportes`
- `/admin/borrados`
- `/admin/torneos`
- `/admin/noticias`
- `/admin/gastos`
- `/admin/novedades`
- `/admin/configuracion`

Si una ruta queda absorbida por una nueva sección, mantén redirección o compatibilidad con enlaces guardados.

## 13. Estrategia de implementación por fases

No intentes resolver todo en un cambio monolítico.

### Fase 1 — Navegación y shell

- nueva arquitectura;
- Más completo;
- acceso sin rotación;
- encabezados estándar;
- rutas existentes preservadas.

### Fase 2 — Alumnos

- prioridad real;
- directorio primero;
- ficha con pestañas;
- acciones contextualizadas;
- automatizaciones internas.

### Fase 3 — Galería

- cuatro vistas;
- carga masiva;
- correspondencia;
- calidad;
- versionado/undo;
- flujo móvil.

### Fase 4 — Rutinas, Documentos y Alimentos

- selección de alumno reutilizable;
- búsqueda/recientes;
- flujos locales claros;
- clasificación masiva segura.

### Fase 5 — Pendientes, comunidad y administración

- cola unificada;
- auditoría paginada;
- consistencia visual;
- accesos completos.

### Fase 6 — Limpieza y consolidación

- elimina reglas CSS obsoletas solo después de verificar uso;
- evita capas nuevas de `!important`;
- documenta componentes compartidos;
- mide rendimiento.

Cada fase debe compilar y ser utilizable de forma independiente.

## 14. Restricciones de producto y seguridad

- No cambies reglas del generador por prompts libres.
- No cambies lógica de Impulso VIP.
- No publiques rutinas automáticamente.
- No envíes WhatsApp, correo o notificaciones sin confirmación.
- No borres alumnos, ejercicios, medios o reportes sin flujo seguro.
- No reasignes fotos ambiguas automáticamente.
- No penalices puntos automáticamente.
- No ocultes funciones existentes durante la migración.
- No introduzcas dependencias grandes si APIs web y Sharp ya resuelven el caso.
- No muestres información médica en vistas de lista salvo la señal mínima necesaria y con permisos adecuados.
- Mantén modo oscuro y claro.
- Mantén funcionamiento del portal del alumno.

## 15. Accesibilidad y ergonomía

- Todo funciona desde 320 px.
- Ninguna acción esencial requiere landscape.
- Área táctil mínima de 40×40 px; 44 px para acciones frecuentes.
- Un `h1` por página.
- Foco visible.
- Diálogos con título, cierre y retorno de foco.
- Navegación de pestañas accesible.
- No usar color como único indicador.
- Formularios guardan borrador local cuando una carga larga puede perderse.
- Confirmaciones indican alcance: `afecta 28 rutinas y 14 alumnos`.
- Soporta nombres largos, zoom del panel y texto ampliado.
- Respeta `prefers-reduced-motion`.

## 16. Rendimiento

- No renderices listas completas de 68/124 elementos si no son visibles.
- Usa paginación, virtualización o carga progresiva.
- No cargues imágenes completas en grillas; usa miniaturas.
- Procesa lotes en cola con concurrencia limitada.
- Evita bloquear la navegación durante cargas.
- Usa subida directa/reanudable para medios grandes.
- Muestra progreso por archivo y progreso total.
- Mantén Server Components para datos iniciales y Client Components solo donde haya interacción.
- No muevas consultas masivas al navegador.

## 17. Criterios de aceptación

### Navegación

- Todas las rutas de la sección 12 aparecen en Más.
- Alumnos y Galería están a un toque en móvil.
- En 844×390 táctil no aparece una barra lateral que robe 250–288 px al contenido.
- Mostrar/ocultar sidebar no depende de un botón inaccesible a la izquierda.

### Alumnos

- El directorio aparece antes que historiales secundarios en móvil.
- Se puede encontrar un alumno por búsqueda inmediata.
- `Requieren acción` está ordenado por urgencia explicada.
- La ficha cambia de sección sin scroll interminable.
- Rutina, indicación y seguimiento están disponibles desde la cabecera del alumno.

### Galería

- Se pueden seleccionar varias fotos.
- La cola propone coincidencias por nombre/alias.
- Coincidencias ambiguas esperan revisión.
- HEIC/HEIF funciona desde la interfaz.
- Miniatura y completa se generan automáticamente.
- Reemplazar una foto resuelve reportes vinculados.
- Existe priorización por usos/reportes.
- El entrenador puede restaurar la versión anterior durante el período definido.

### Consistencia

- Todas las páginas usan el mismo shell y encabezado.
- No hay tarjetas arcoíris sin significado.
- Acciones destructivas están separadas.
- Tema claro/oscuro y zoom siguen funcionando.

## 18. Matriz de verificación manual

| Área | Estado | Tamaño |
|---|---|---:|
| Más | todos los destinos | 390×844 |
| Más | búsqueda y contadores | 320×568 |
| Panel | teléfono horizontal táctil | 844×390 |
| Alumnos | 68 alumnos, búsqueda y filtros | 390×844 |
| Alumnos | directorio + rail | 1440×900 |
| Ficha | Resumen | 390×844 |
| Ficha | Plan y rutina | 390×844 |
| Ficha | Cuenta y zona de riesgo | 390×844 |
| Galería | 34 reportes | 390×844 |
| Galería | carga masiva de 20 fotos | 390×844 |
| Galería | coincidencias ambiguas | 1440×900 |
| Galería | HEIC, JPG, PNG, WebP | móvil/escritorio |
| Rutinas | selección y reciente | 390×844 |
| Auditoría | cientos de hallazgos | 390×844 |
| Tema | claro y oscuro | 390×844 |

Verifica además:

- consola sin errores nuevos;
- navegación hacia atrás;
- refresh en cada ruta;
- foco de teclado;
- scroll interno;
- barra inferior estable en iOS/Safari;
- permisos y confirmaciones;
- subida lenta/interrumpida;
- reintento idempotente;
- textos largos;
- contadores 0, 1, 99 y 100+.

## 19. Pruebas automáticas obligatorias

Como mínimo:

```bash
npx tsc --noEmit
npm run lint
npm test
npm run build
```

Agrega pruebas específicas para:

- función que decide navegación activa;
- completitud de destinos de Más;
- clasificación de prioridad de alumnos;
- correspondencia de nombre de archivo a ejercicio;
- umbrales de confianza;
- rechazo de coincidencias ambiguas;
- procesamiento HEIC/EXIF;
- cierre automático de reportes al reemplazar foto;
- rollback/versionado;
- operaciones masivas idempotentes;
- permisos y acciones destructivas.

## 20. Entrega que Claude debe dejar

Al terminar cada fase:

1. lista de archivos modificados;
2. comportamiento anterior y nuevo;
3. pruebas ejecutadas y resultados exactos;
4. capturas móvil, horizontal táctil y escritorio;
5. automatizaciones nuevas y sus límites;
6. migraciones necesarias;
7. pendientes reales;
8. diferencias conscientes respecto de este instructivo.

Al terminar el proyecto, deja abiertas:

- Alumnos en móvil;
- una ficha de alumno;
- Galería en Pendientes;
- Carga masiva con datos de demostración no persistentes;
- Más mostrando todos los destinos;
- vista horizontal táctil.

No hagas commit, push ni despliegue sin autorización explícita.

## 21. Prompt corto para iniciar a Claude

> Lee completos `AGENTS.md`, `CLAUDE.md`, `HANDOFF_1.27.md`, `HANDOFF_GENERADOR_RUTINAS_CLAUDE.md` e `INSTRUCTIVO_CLAUDE_REORDENO_PANEL_ENTRENADOR.md`. Reorganiza por fases todo el Panel del Entrenador usando el instructivo como especificación. Alumnos y Galería de ejercicios son las prioridades máximas. Todas las funciones deben estar también dentro de Más y ninguna acción puede depender de girar el teléfono o encontrar una barra lateral. Automatiza todo lo repetitivo y seguro; exige confirmación para lo ambiguo, externo, destructivo o que cambie puntos, planes, rutinas o cuentas. Conserva la lógica actual, las rutas y los enlaces guardados. Verifica TypeScript, lint, tests, build y la matriz visual. No hagas commit, push ni despliegue.

## 22. Decisión final en una frase

**El panel debe dejar de ser un inventario de funciones y convertirse en el puesto de mando del entrenador: alumnos primero, galería automatizada, todo accesible y cada pendiente convertido en la siguiente acción correcta.**
