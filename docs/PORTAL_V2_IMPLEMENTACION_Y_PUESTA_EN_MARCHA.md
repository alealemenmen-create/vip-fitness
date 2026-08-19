# Portal VIP Fitness V2 — implementación y puesta en marcha

Actualizado: 2026-08-19  
Rama: `portal-v2`  
Ruta de desarrollo: `C:\dev\vip-fitness-v2`  
Estado: piloto funcional conectado al motor y a la base del Portal VIP original.

## Regla de seguridad

La V2 no tiene una base paralela ni copia información sensible a una interfaz
anónima. Cuando existe una sesión autenticada, usa las mismas filas y acciones
del Portal VIP original, respetando permisos, RLS, validaciones e idempotencia.
Cuando no existe sesión, muestra exclusivamente datos demostrativos. Esta es la
forma correcta de probar la nueva experiencia sin exponer ni duplicar alumnos.

La Vista clásica se conserva. No se elimina hasta completar un piloto real y
recibir aprobación expresa.

## Regla de migración visual y de continuidad

Del Portal VIP original se heredan el motor, las validaciones y la información
real; no se copian sus componentes visuales sin adaptación. Toda función que
llegue a la V2 debe reconstruirse dentro del sistema V2: tipografía, escala,
peso del blanco, superficies, bordes, radios, gradientes, iconografía,
espaciado, alineación, estados, transiciones, safe areas y tamaños táctiles.
Una tarjeta, modal o formulario con apariencia clásica se considera una
migración incompleta aunque su acción técnica funcione.

La continuidad del alumno es obligatoria. La V2 consulta las mismas identidades
y registros autorizados del portal activo: programas, sesiones, ejercicios,
series, cargas, repeticiones, pesos corporales, fotografías, alimentación,
seguimientos, puntos, rangos y comunidad. No reinicia historiales, no entrega
puntos por migrar y no duplica filas para llenar una pantalla nueva. Cuando una
estructura nueva necesite datos derivados, deben reconstruirse de forma
idempotente y contrastarse contra el registro original antes del piloto.

## Módulos y pantallas construidos

### Entrenamiento

- `/portal-v2/entrenamiento`: programa activo, semana, día, fotografía,
  métricas, rutina asignada, continuidad de sesión y acceso a Vista clásica.
- `/portal-v2/entrenamiento/rutina`: detalle real del día, ejercicios, series,
  descansos, técnicas y acción segura para iniciar.
- `/portal-v2/entrenamiento/sesion`: ejecución por campos `serie → descanso →
  serie`, lista y video, controles anterior/siguiente, pausa, temporizador
  manual, sonido, vibración, notificación, notas, historial y cierre.
- `/portal-v2/entrenamiento/historial`: programas entrenados, sesiones reales,
  duración, cumplimiento, ejercicios completados y reapertura de cada registro,
  sin abandonar la navegación V2.
- `/portal-v2/entrenamiento/programas`: programa activo y versiones
  anteriores, incluidos programas sin sesiones y archivados; resume días,
  ejercicios, series y actividad sin permitir que el alumno altere la
  prescripción. El activo vuelve al entrenamiento y los anteriores abren su
  historial filtrado.
- `/portal-v2/entrenamiento/biblioteca`: catálogo real del gimnasio con 130
  fichas activas en el entorno actual, búsqueda tolerante a tildes y alias,
  filtros musculares, equipo, nivel, técnica, consejos, errores frecuentes,
  fotografías y video privado para cuentas autorizadas. Es deliberadamente de
  consulta: un alumno no puede sobrescribir la prescripción del entrenador.
- Alejandro / Impulso VIP: automático, escaso, contextual, auditable y
  desactivable. No obliga a cambiar carga en cada serie; reserva los momentos
  fuertes para series estratégicas y bloquea intensidad ante señales de dolor.
- Técnicas: biserie, triserie, superserie, serie gigante, circuito, drop-set,
  rest-pause, myo-reps, cluster, FST-7 y fallo técnico cuando son elegibles. La
  secuencia se calcula por rondas: no descansa entre estaciones y reconoce el
  último trabajo real incluso si los ejercicios tienen cantidades distintas de
  series. Los pasos internos y microdescansos sobreviven una recarga sin repetir
  la técnica ni reiniciar su cuenta atrás.

### Nutrición

- `/portal-v2/nutricion`: fecha chilena, semana colapsable, resumen fijo de
  calorías/macros y línea de tiempo de 24 horas.
- Buscar: catálogo propio primero; Search-a-licious de Open Food Facts para
  texto en Chile y luego global; el buscador histórico queda como respaldo y
  siempre existe creación manual cuando no hay resultado.
- La base entregada en `C:\dev\vipfitness_nutricion` quedó incorporada mediante
  `0114_catalogo_nutricional_vip_local.sql`: sus `260` alimentos están
  disponibles en el buscador y el catálogo compartido pasó de `316` a `483`
  filas. Se añadieron sólo `167` nombres ausentes y se conservaron intactas las
  `93` coincidencias históricas; la importación nunca reemplaza macros ya
  utilizados por los alumnos.
- Cada fila importada conserva país, tipo de producto, fuente y nivel de
  verificación. Nueve productos tienen una URL específica; los otros `251`
  proceden de una referencia compuesta y quedan identificados como tales, no
  como verdad clínica ni como ficha oficial de una marca.
- Los productos externos se vuelven a consultar por código en el servidor:
  nombre y macros enviados por el navegador nunca se confían, se rechazan
  rangos imposibles y la caché compartida sólo puede escribirla la service
  role. Una fila JSON dañada se descarta antes de llegar a la interfaz.
- La búsqueda externa es explícita, no se dispara por cada tecla: protege la
  disponibilidad del servicio público; el catálogo VIP local conserva la
  búsqueda inmediata. Si Search-a-licious falla, se intenta el endpoint
  histórico una vez y la interfaz mantiene catálogo local y creación manual.
  Cada buscador se consulta una sola vez: un toque ya no puede generar cuatro
  reintentos contra una API limitada por IP.
- `open_food_facts_cache` comparte respuestas entre procesos y alumnos: siete
  días para resultados y seis horas para búsquedas vacías. Ante una caída usa
  un respaldo de hasta 30 días; tres fallos consecutivos abren durante un
  minuto un circuito que deja de insistir. Consultas simultáneas iguales
  también se agrupan en una sola petición.
- Escanear: lector de código de barras; en producción necesita HTTPS y permiso
  de cámara.
- Registrar, editar cantidad, borrar y copiar alimentos recientes.
- El resumen calcula fibra, azúcares y sodio desde las etiquetas reales y los
  escala por la cantidad consumida. Un nutriente ausente se mantiene como
  “sin dato” en vez de convertirse en cero; cada fila declara además cuántos
  alimentos del día aportan información. El sodio se conserva internamente en
  gramos, como lo entrega Open Food Facts, y se convierte a miligramos al
  mostrarlo.
- La hoja de alimentos mantiene cinco destinos V2 conectados: Buscar,
  Guardados, Creados, Recetas y Escanear. La portada recupera los alimentos
  usados recientemente por el alumno desde su registro real, respetando el
  orden temporal, eliminando duplicados y sin fabricar un historial local.
- Favoritos personales y recetas reutilizables con ingredientes reales,
  porciones configurables y macros derivados del catálogo
  (`0105_biblioteca_nutricion_v2`). Al usar una receta, la cantidad elegida se
  reparte según sus porciones en lugar de duplicar silenciosamente todos sus
  ingredientes.
- Un alimento manual pendiente de aprobación pública sigue siendo utilizable
  por su creador en favoritos y recetas. El servidor conserva el aislamiento:
  otro alumno sólo puede usar alimentos aprobados o creados por sí mismo.
- Objetivos de calorías, proteína, carbohidratos y grasas persistentes.
- Panel de distribución nutricional sin inventar micronutrientes ausentes.

### Progreso y dashboard

- `/portal-v2/progreso`: estado del día conectado a entrenamiento y nutrición,
  peso, variación, sesiones, series, adherencia, calidad, Impulsos, programa,
  rango y clasificación.
- Una cuenta autenticada recibe ese dashboard ya resuelto desde el servidor:
  no espera una segunda petición del cliente para descubrir sus métricas. La
  visita directa conserva primero el esqueleto protegido y sólo habilita su
  demostración después de hidratar, por lo que el HTML anónimo no incluye
  identidades ni cifras simuladas.
- Registro de peso mediante la acción original, con ventana temporal y puntos
  protegidos contra duplicación.
- Historial corporal y galería privados integrados en V2: evolución por fecha,
  fotografía quincenal, carga, reemplazo/borrado sólo en la quincena vigente y
  acceso directo desde Comunidad sin regresar a la interfaz clásica.

### Comunidad, ranking y retos

- `/portal-v2/progreso/comunidad`: actividad verificada, clasificación mensual
  y acumulada, podio, desglose explicable de puntos y desafíos activos.
- La clasificación dentro de Comunidad muestra el top 10 y, cuando el alumno
  está más abajo, también su posición y las dos personas vecinas. La lista
  completa sigue disponible por acción expresa y se vuelve a compactar al
  cambiar de período; Arena continúa siendo el destino competitivo detallado.
- `/portal-v2/progreso/ranking`: Arena V2, rangos, tabla semanal/mensual/anual,
  reglas públicas, movimientos auditables, retos y catálogo de recompensas;
  permanece navegable como demostración segura sin enviarla al login clásico.
- Arena conserva el rango y la identidad cromática propia de cada medalla, pero
  dejó atrás la sala ámbar heredada: encabezado, superficies, tarjetas,
  pestañas, estados activos, tienda, guía y retos usan ahora el sistema negro,
  blanco, gris pulido y verde de la V2. La prueba QA mantuvo exactamente el
  saldo real de `175 XP`, su rango Bronze y su posición calculada; el rediseño
  no recalcula ni reinicia puntos.
- Los puntos provienen de eventos del servidor con claves idempotentes; no de
  clics del cliente. Existen topes, penalizaciones y cierre de actividad.
- Aceptación/rechazo de torneos conectada a las acciones existentes.
- Tienda VIP con catálogo administrable, stock, saldo real, solicitud de canje,
  aprobación, entrega y reintegro automático al rechazar.
- El canje se ejecuta en PostgreSQL como una sola transacción: valida saldo,
  reserva stock y registra el descuento sin permitir dobles envíos simultáneos.
- Arena y Tienda bloquean preventivamente respuestas y canjes en modo solo
  lectura. Cada operación confirma el resultado del servidor; una pérdida de
  red conserva invitación, saldo, stock y formulario administrativo anteriores,
  y un error de lectura no se presenta falsamente como catálogo vacío.
- Publicaciones voluntarias, selección explícita de una foto privada, aplausos,
  comentarios, eliminación propia, reportes y límites diarios contra spam.
- La carga social distingue una migración aún no instalada de un error real y
  nunca fabrica aplausos o comentarios. En modo solo lectura no se puede
  responder retos; una cuenta editable recibe confirmación de servidor, y cada
  publicación muestra los seis comentarios más recientes en orden de lectura.
- Las acciones normalizan y limitan entradas aunque un cliente manipule la
  llamada. Los límites diarios deben poder consultarse antes de escribir y una
  eliminación sólo confirma éxito si modificó contenido del alumno: una fila
  ajena, inexistente o ya eliminada no produce una confirmación falsa.
- Las fotos corporales permanecen privadas salvo la foto concreta elegida por
  su dueño al publicar. Los reportes se resuelven en `/admin/reportes`.

### Más, cuenta y roles

- `/portal-v2/mas`: perfil, rango, puntos, notificaciones, plan, privacidad,
  soporte, redes y retorno a la Vista clásica. La identidad, el rango, los
  puntos, el plan y las preferencias se resuelven en el servidor antes de
  entregar la pantalla autenticada; ya no aparece una vista vacía que haga una
  segunda consulta al montar el navegador. La carga transitoria de navegación
  conserva el mismo lenguaje visual V2.
- La vista directa y las cuentas de solo lectura no pueden registrar ni retirar
  suscripciones push. El temporizador y el descanso preferido sólo quedan
  reflejados tras confirmación del servidor; ante error o corte de red, la
  interfaz revierte al valor anterior y conserva la preferencia existente.
- `/portal-v2/privacidad`: documento completo reutilizado del portal original,
  con retorno a la V2. El texto se conserva como una sola fuente para evitar
  versiones legales contradictorias, pero la presentación se adapta por
  completo a tipografía, contraste, superficies y acento verde V2; el cierre
  de sesión real sólo aparece cuando existe una identidad autenticada.
- `/portal-v2/perfil`: edición autenticada de datos personales, temporizador,
  contraseña, correo y reseña reutilizando las acciones probadas del portal.
  La interfaz ya no incrusta las tarjetas clásicas: organiza esas funciones en
  secciones V2 plegables, con tipografía, superficies, campos, interruptores,
  botones, estados y jerarquía propios de la nueva experiencia. La vista
  directa protege la información sin redirigir al login.
- `/portal-v2/soporte`: asistente contextual, recordatorios y marcas recientes
  dentro del shell V2; la demostración no fabrica conversaciones privadas. El
  panel heredado fue sustituido por componentes V2 propios y la prueba QA
  confirmó una respuesta construida desde el historial real, con fechas
  legibles en español y sin costo de IA para consultas que el motor local puede
  resolver.
- El plan muestra nombre, sesiones, frecuencia y estado reales de la cuenta.
- Las notificaciones push son reversibles por dispositivo: activar suscribe el
  endpoint y desactivar lo elimina del servidor y del navegador.
- La demostración directa no expulsa al login al abrir perfil, soporte,
  privacidad, progreso o Arena: resuelve el destino dentro de la V2 y mantiene
  bloqueadas únicamente las escrituras que requieren una identidad real.
- Alumno: experiencia personal.
- Entrenador: acceso a alumnos y seguimiento.
- Administrador: control total mediante el panel operativo. La lógica probada
  del portal original se conserva, pero su marco ya usa negro OLED, grafito,
  blanco y verde mineral V2; la marca amarilla antigua no reaparece al cambiar
  de espacio.
- “Más” resuelve siempre la identidad de la sesión, no la cookie usada para
  observar a otro alumno. Un entrenador o administrador sin ficha personal ya
  no cae en la identidad ficticia de demostración: ve su rol real, sus accesos
  profesionales y una ruta explícita para activar su propio perfil de alumno.
- El panel profesional ofrece regreso visible a `/portal-v2/mas` en escritorio
  y móvil. “Mi rutina” entra en `/portal-v2/entrenamiento`, mientras “Portal
  del entrenador” y “Administración” mantienen permisos separados.
- Las opciones administrativas se muestran por rol verificado en servidor.
- La separación de roles se aplica también a las acciones: un entrenador sólo
  conserva alumnos, asistencia, armado de rutinas, documentos, pendientes,
  notificaciones y asistente. Las bibliotecas maestras —fotos, videos, fichas y
  aprobación de alimentos— pertenecen al rol diseñador/administrador, junto a
  altas, equipo, puntos, auditoría, reportes, borrados, Arena, noticias, gastos
  y configuración; escribir la URL no evita el control.

## Navegación y conexiones

La navegación principal tiene cuatro destinos: Entrenar, Nutrición, Progreso y
Más. Las sesiones inmersivas ocultan esa barra para no competir con el ejercicio.
Cada acción visible tiene destino, panel, cambio de estado o respuesta. Cambiar
o reordenar ejercicios usa una personalización separada y auditable de la
sesión: no modifica la rutina publicada del entrenador, bloquea sustituciones
después de comenzar y mantiene unidos los bloques de biserie, triserie,
superserie, circuito o serie gigante.

`npm run audit:v2-interactions` analiza el TSX real de todas las pantallas y
componentes V2. Exige `onClick`, `formAction`, un formulario conectado o
`href`, y falla indicando archivo y línea cuando un control sólo parece
interactivo. La última ejecución confirmó `176` botones, `77` enlaces y `11`
formularios. Detectó y corrigió la pestaña “Buscar” de Nutrición: era un botón
sin acción; ahora es correctamente un indicador activo y “Escanear” conserva
la interacción.

La biblioteca de ejercicios cubre la exploración y educación que Standrd
presenta como `Exercise Library`. No se trasladó un `Workout Builder` libre al
alumno: en VIP Fitness el programa es una prescripción profesional. Si en el
futuro se ofrecen entrenamientos autónomos, deben vivir como sesiones
adicionales separadas, jamás modificar silenciosamente la rutina publicada.

## Tablas y campos necesarios

La definición exhaustiva y tipada está en `src/lib/supabase/types.ts`; las
migraciones históricas y de la V2 están en `supabase/migrations/0001_init.sql` a
`0114_catalogo_nutricional_vip_local.sql`. Las tablas que sostienen esta V2 son:

| Área | Tabla | Campos esenciales |
| --- | --- | --- |
| Identidad | `perfiles` | `id`, `nombre`, `rol`, `created_at` |
| Alumno | `alumno_perfil` | `user_id`, objetivos, nivel, restricciones, macros, `temporizador_descanso`, `segundos_descanso_preferido`, estado de acceso |
| Rutina | `rutinas` | `id`, `alumno_id`, `nombre`, `activa`, `version`, `archivada`, fechas |
| Calendario | `rutina_dias` | `id`, `rutina_id`, `numero_dia`, `orden`, `nombre`, `tipo`, `descripcion` |
| Prescripción | `rutina_dia_ejercicios` | ejercicio, orden, series, repeticiones, descanso, técnica, grupo y notas |
| Biblioteca | `ejercicios` | nombre, grupo, equipo, instrucciones, foto, video/Cloudflare, dimensiones, calidad y alias |
| Sesión | `sesiones_entrenamiento` | `id`, alumno, rutina/día, número, estado, inicio/fin, duración, corrección y puntos |
| Ejercicio ejecutado | `sesion_ejercicios` | `sesion_id`, `dia_ejercicio_id`, completado, nota y estado |
| Personalización de sesión | `sesion_ejercicio_personalizaciones` | alumno, ejercicio de sesión, sustituto aprobado, orden y motivo |
| Serie real | `series_realizadas` | sesión-ejercicio, número, repeticiones, peso, unidad, realizada, técnica y trazabilidad |
| Día alimentario | `registros_diarios` | `id`, `alumno_id`, `fecha` |
| Comida | `comidas_registradas` | registro, tipo/hora, observación, omitida y fecha de registro |
| Consumo | `alimentos_consumidos` | `comida_id`, `alimento_id`, `cantidad`, `unidad` |
| Biblioteca nutricional | `alimentos_favoritos`, `recetas_alumno`, `receta_ingredientes` | propiedad, alimento, cantidad, porciones, orden y fechas |
| Catálogo | `alimentos` | nombre, marca, porción, macros, micronutrientes, medida casera, código, origen OFF, país, fuente, clave y nivel de verificación, imagen y aprobación |
| Caché nutricional externa | `open_food_facts_cache` | consulta normalizada, país, productos validados, expiración y actualización; acceso exclusivo de service role |
| Peso | `pesos_corporales` | alumno, fecha, `peso_kg`, observación y creación |
| Fotos | `fotos_progreso` | alumno, ruta, fecha, categoría, comentario y creación |
| Seguimiento | `seguimientos_diarios` | alumno, fecha, energía, ánimo, sueño, dolor/molestias y notas |
| Actividad | `actividad_alumno_eventos` | alumno, tipo, fecha, contexto y datos auditables |
| Puntos | `puntos_vip_movimientos` | alumno, clave única, concepto, puntos, fecha, estado y metadatos |
| Ranking | `ranking_semanas` | alumno, semana, desglose, total, cierre y auditoría |
| Retos | `torneos`, `torneo_participantes` | reglas, modalidad, fechas, bolsa, estado, invitación, aceptación y resultado |
| Comunidad social | `comunidad_publicaciones`, `comunidad_reacciones`, `comunidad_comentarios`, `comunidad_reportes` | autor, consentimiento de foto, texto, estado, aplauso, comentario, reporte y moderación |
| Recompensas | `recompensas_vip_catalogo`, `recompensas_vip_canjes` | nombre, tipo, costo, stock, vigencia, estado, costo congelado, responsable y resolución |
| Impulso | `impulso_vip_recomendaciones` | alumno, ejercicio, prescripción congelada, evidencia, confianza, estado y resultado |
| Impulso en vivo | `impulso_vip_intervenciones` | sesión/serie, momento, instrucción, respuesta, carga, RIR y trazabilidad |
| Memoria | `impulso_vip_memoria_tecnicas` | alumno, ejercicio/técnica, exposición, tolerancia, resultado y próxima elegibilidad |
| Supervisión | `impulso_vip_alertas`, `impulso_vip_avisos_entrenador`, `impulso_vip_indicaciones_programadas` | severidad, motivo, estado, responsable y resolución |
| Push | `push_suscripciones` | usuario, endpoint, claves, agente, activo y fechas |

## Integraciones, APIs y datos externos

- Supabase Auth, Postgres, RLS y Storage: identidad, datos, fotografías y
  archivos. Es el mismo proyecto contratado actualmente.
- Open Food Facts: Search-a-licious para texto, Product API para verificación
  por código de barras y buscador histórico sólo como respaldo. Estrategia:
  catálogo VIP local → OFF Chile → OFF global → creación manual.
- FatSecret queda documentado como proveedor secundario opcional, no como
  dependencia de lanzamiento. Su edición gratuita cubre datos de Estados
  Unidos; el mercado chileno requiere solicitar acceso Premier y aceptar sus
  condiciones comerciales. Si se contrata, se integrará por su API autorizada
  detrás del mismo adaptador de búsqueda; nunca copiando ni extrayendo su app.
- Catálogo VIP propio: `260` alimentos de la base local ya están integrados con
  procedencia explícita y sin sobrescribir filas históricas. Debe enriquecerse
  continuamente con productos y marcas chilenas —incluida Soprole—, manteniendo
  revisión humana; Open Food Facts sigue siendo el complemento para productos
  envasados que aún no existen localmente.
- INTA/Universidad de Chile: referencia nutricional nacional para alimentos
  genéricos; su licencia y formato deben revisarse antes de importar en masa.
- Cloudflare Stream: video de ejercicios y webhooks.
- El webhook de Stream exige HMAC reciente, limita el cuerpo, valida UID y
  metadatos y persiste el instante firmado. Un evento antiguo no puede pisar
  uno nuevo; “procesando” tampoco puede hacer retroceder “listo” o “error”.
- Las imágenes dinámicas de ejercicios utilizan una cadena segura y sin
  duplicados: recurso principal, miniatura o imagen muscular contextual y, en
  última instancia, portada V2. Un archivo histórico eliminado de Storage no
  rompe la sesión, la rutina, la biblioteca ni la vista previa del programa.
- Web Push/VAPID: avisos de descanso, entrenador e Impulso.
- Resend: correos transaccionales del portal original.
- Anthropic: funciones de IA administrativas y de apoyo; Alejandro no depende
  de una respuesta generativa en vivo para decidir una serie.
- ZXing: lectura de códigos en el navegador.
- Tailwind CSS y su adaptador PostCSS están fijados en la versión exacta
  compatible con la compilación actual. Esto evita que una instalación limpia
  resuelva automáticamente una versión posterior incompatible con el parser
  CSS de esta versión de Next.js.

Decisión de fuentes (verificada el 19-08-2026):

- [Open Food Facts](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/)
  es la mejor capa gratuita para productos envasados y marcas chilenas: lectura
  sin autenticación, códigos de barras y licencia abierta ODbL. Sus datos son
  colaborativos y no garantizan exactitud; por eso nunca sustituyen la etiqueta
  ni entran al catálogo VIP sin reconsulta y controles de coherencia.
- La propia documentación limita la búsqueda a 10 consultas/minuto/IP y
  desaconseja buscar con cada tecla. La V2 consulta OFF sólo por acción expresa,
  con caché; para texto mantiene el endpoint legado porque la API v3 actual aún
  no ofrece búsqueda full-text equivalente.
- La [tabla chilena publicada por MINSAL](https://www.minsal.cl/composicion-de-alimentos/)
  y la [recopilación INTA 2018](https://inta.uchile.cl/noticias/201337/tabla-de-composicion-de-alimentos-2018)
  son referencias nacionales útiles para alimentos genéricos, pero no ofrecen
  una API gratuita vigente de productos de supermercado; la edición INTA 2018
  se comercializa. Se usarán para revisión humana y semillas, no como consulta
  automática ni como si cubrieran Soprole u otras marcas actuales.
- [USDA FoodData Central](https://fdc.nal.usda.gov/api-guide/) es CC0 y dispone
  de API, pero requiere clave y su catálogo de marcas está orientado a Estados
  Unidos. Queda como respaldo futuro para genéricos ausentes, no por delante
  del catálogo VIP ni de OFF Chile.

Variables requeridas para producción:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (sólo servidor)
- `OPENFOODFACTS_CONTACT` (correo o URL real que identifica VIP Fitness ante
  Open Food Facts; respaldo actual: `soporte@vipfitness.cl`)
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_INSTAGRAM_URL` y `NEXT_PUBLIC_FACEBOOK_URL` cuando las cuentas
  oficiales estén confirmadas; si faltan, la V2 lo declara y no inventa URLs.
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_CONTACT_EMAIL`
- `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_STREAM_API_TOKEN`,
  `CLOUDFLARE_STREAM_CUSTOMER_CODE`, `CLOUDFLARE_STREAM_WEBHOOK_SECRET`
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
- `CRON_SECRET`
- `ANTHROPIC_API_KEY` si se habilitan las funciones de IA opcionales.

Funciones SQL de seguridad:

- `solicitar_canje_vip`: serializa por alumno, confirma saldo, congela costo,
  reserva stock y descuenta puntos en la misma transacción.
- `resolver_canje_vip`: sólo administrador; aprueba, entrega o
  rechaza, reintegrando stock y puntos de manera idempotente.
- `crear_notificacion_entrenador_dedup`: exclusiva de service role; usa un
  bloqueo transaccional por clave para que dos cron concurrentes creen una
  sola fila y, por tanto, un solo push.

## Qué mantener, adaptar y retirar

### Mantener

- Modelo de datos y autenticación del portal original.
- Guardado idempotente de sesiones, series y puntos.
- Motor nutricional, catálogo aprobado, creación manual y medidas caseras.
- Seguimiento integral, pesos, fotos, torneos, push y Cloudflare Stream.
- Motor histórico, trazabilidad, memoria y supervisión de Impulso VIP.
- Paneles de entrenador y administrador.
- Biblioteca maestra de ejercicios, multimedia, alias y perfiles de seguridad.

### Adaptar

- Presentación clásica de rutina a la máquina de estados V2.
- Impulso VIP a Alejandro: automático, breve, escaso y dependiente del equipo,
  historial, madurez, constancia, técnica y seguridad.
- Ranking a explicación pública sin revelar alimentación o salud privada.
- Noticias del sistema a actividad comunitaria verificable.
- Nutrición a una línea de tiempo móvil, conservando acciones del servidor.
- Sustituciones y orden de sesión como capa personal auditable, sin reescribir
  la prescripción maestra.
- Fotos privadas a publicaciones únicamente mediante consentimiento explícito,
  con moderación y trazabilidad.
- Seguimiento a un dashboard diario con conexiones directas.
- Biblioteca técnica del entrenador a una experiencia de consulta móvil para
  el alumno, manteniendo videos privados y la rutina maestra inmutable.

### Retirar o no trasladar

- Navegación antigua de cinco destinos dentro de la V2.
- Controles decorativos o botones sin acción.
- Aumentos fijos de 2,5 kg para todo equipo.
- Encuestas obligatorias en cada serie.
- Datos simulados cuando existe un usuario real autenticado.
- Puntos creados desde el navegador o recompensas por simples clics.
- Cualquier sustitución/reordenamiento que altere la rutina maestra o rompa un
bloque técnico.

La V2 incluye estados globales de carga, error recuperable y conexión. Al
perder red avisa sin expulsar al alumno del flujo; al recuperarla confirma el
estado. No afirma que una escritura se guardó sin haber recibido confirmación
del servidor. Inter se sirve desde el propio portal para conservar la geometría
visual y permitir compilaciones sin depender de Google Fonts.

## Comprobación antes de publicar

Validaciones locales completadas el 19-08-2026:

- Next.js `16.3.1`, React `19.2.8` y ESLint `9.39.5`; actualización hecha con
  el codemod oficial, revisando y descartando transformaciones de páginas que
  no aplicaban porque `cacheComponents` no está activado.
- Auditoría de dependencias de producción: cero vulnerabilidades conocidas.
- `75` archivos de pruebas y `593` pruebas aprobadas; ESLint sin advertencias,
  TypeScript sin errores y compilación de producción completa (`68` rutas).
- Las 16 rutas principales de la V2 respondieron `200` en el servidor de producción local,
  incluida la búsqueda prefiltrada de la biblioteca y la nueva pantalla de
  programas. La primera carga de biblioteca puede esperar el catálogo remoto;
  las siguientes quedan atendidas por la caché del servidor.
- Las migraciones `0104` a `0107` se ejecutaron juntas en PostgreSQL efímero.
  Se comprobó la transacción de canje (saldo y stock) y el reintegro idempotente
  al rechazar. Esta comprobación valida sintaxis y reglas transaccionales; no
  sustituye la prueba de Auth, RLS y Storage en un Supabase de preview.
- `0108_recompensas_vip_solo_alumnos.sql` cierra el acceso directo de
  entrenador o administrador al RPC de solicitud: estar autenticado ya no
  basta; el solicitante debe tener rol `alumno`.
- `0109_cache_open_food_facts.sql` se aplicó al Supabase activo: RLS habilitado
  y todos los permisos revocados para `anon` y `authenticated`. Una búsqueda
  autenticada de `yogur soprole frutilla` devolvió productos reales y dejó una
  sola fila chilena compartida con `14` productos y expiración vigente. Las
  pruebas aíslan además caché, deduplicación simultánea, respaldo recuperable
  y circuito abierto sin depender de una caída real del proveedor.
- `0110_automatizaciones_idempotentes.sql` se aplicó al Supabase activo. La
  prueba transaccional creó el primer aviso, deduplicó el segundo y terminó en
  `ROLLBACK`; una comprobación independiente confirmó cero residuos QA. El RPC
  fue rechazado con código `42501` al llamarlo con clave pública. Los handlers
  cubren además secreto ausente/incorrecto, falla parcial, HMAC, reenvíos,
  cuerpos excesivos y eventos de video fuera de orden sin enviar avisos reales.
- `0111_recompensas_vip_solo_admin.sql` se aplicó al Supabase activo. Las
  políticas permiten al alumno ver sus propios canjes y el catálogo activo,
  pero reservan al rol `admin` la lectura global, los estados inactivos, la
  resolución y el inventario. Invocar directamente los RPC ya no permite que
  un entrenador eluda la separación que mostraba la interfaz.
- `0112_perfil_v2_consistente.sql` se aplicó al Supabase activo. El RPC de datos
  personales es invocador seguro, no admite ejecución anónima y actualiza
  `alumno_perfil` y `perfiles` como una sola operación; la QA confirmó que una
  carga inválida no deja una de las dos tablas modificada.
- `0113_seguimiento_revisiones_faltante.sql` recuperó la tabla de revisiones del
  entrenador que no estaba instalada. Tiene RLS activo, acceso anónimo revocado,
  lectura/inserción autenticada bajo política y no concede actualización ni
  borrado desde el cliente.
- `0114_catalogo_nutricional_vip_local.sql` se aplicó al Supabase activo. La
  auditoría posterior confirmó `483` alimentos compartidos, presencia de los
  `260` nombres de la base entregada y cero faltantes. Las `15` coincidencias con
  diferencias superiores al 20 % en algún macronutriente conservaron el dato
  histórico para revisión humana en vez de ser alteradas automáticamente.
- Comunidad y clasificación se recorrieron autenticadas sobre la compilación
  candidata: Actividad mostró eventos reales, Clasificación mostró el ranking
  mensual de `74` alumnos y Arena/Recompensas mantuvo un destino explícito, sin
  errores de consola. Si la lectura integral falla, Comunidad presenta reintento
  y regreso a Progreso; ya no convierte una caída de datos en contenido demo.
- Arena carga clasificación, movimientos, desafíos y recompensas de forma
  independiente. Una falla parcial conserva lo que sí respondió, explica qué
  falta y ofrece reintento; una consulta fallida de alumnos ya no se presenta
  como una clasificación vacía. Semana, Mes, Año y la guía desplegable fueron
  ejercitados en navegador autenticado sin errores de consola.
- La sesión activa conserva un borrador local validado y aislado por id durante
  48 horas. Una recarga recupera los últimos pesos, repeticiones, notas por
  ejercicio, nota general, tiempo y posición sin pisar series que el servidor
  ya confirmó; los fallos de red se muestran y el alumno puede reintentar sin
  perder la pantalla. La nota general se captura antes del cierre, se persiste
  con la sesión y vuelve a aparecer al revisar el registro.
- El descanso activo también queda ligado a una hora real de término. Si iOS o
  Android suspende la pestaña, al volver no reinicia los segundos: recupera el
  tiempo transcurrido, emite el aviso y avanza a la serie correcta. El push abre
  la sesión exacta en lugar de abandonar al alumno en el panel general.
- La finalización real se comprobó sin cerrar la sesión QA: el diálogo muestra
  tiempo, series y una nota opcional conectada al payload; al confirmar, la UI
  sólo pasa al resumen después de una respuesta válida del servidor. Abrir
  `/entrenamiento/sesion` o `/entrenamiento/rutina` sin sus identificadores con
  una cuenta autenticada ya no muestra datos de ejemplo: ofrece una salida
  clara hacia el programa real.
- Las escrituras visibles de nutrición, check-in, peso, fotografías,
  preferencias y fichas de ejercicios manejan también fallos de transporte.
  Ninguna queda indefinidamente cargando ni afirma que guardó si la petición no
  llegó; conserva el dato anterior y ofrece un mensaje recuperable.
- El tiempo total se reconcilia tomando el valor más avanzado entre el inicio
  persistido por el servidor y el borrador del dispositivo. Se verificó en una
  sesión autenticada que avanzó de `183:00` a `183:02` y, tras recargar, continuó
  en `183:06`; un borrador atrasado ya no puede hacer retroceder el cronómetro.
- Con autorización expresa del propietario, el 19-08-2026 se aplicaron `0104` a
  `0107` al Supabase activo dentro de una sola transacción. La comprobación
  previa confirmó todas las dependencias y que ninguna migración estaba
  instalada; PostgreSQL confirmó el bloque completo sin modificar tablas ni
  filas preexistentes.
- La comprobación posterior confirmó las `10` tablas nuevas, RLS activo en las
  `10`, `10` políticas, las `3` funciones de recompensa como
  `security definer` y ausencia de permisos directos de escritura para `anon` y
  `authenticated`. El plan gratuito no ofrece respaldos programados y el panel
  mostraba el proyecto como `Unhealthy`; ambos puntos deben corregirse antes de
  cualquier cambio estructural posterior.
- Con autorización expresa del propietario, el 19-08-2026 se contrastaron las
  claves locales con las vigentes y se validaron mediante el cliente oficial de
  Supabase. Tanto el cliente público como el cliente exclusivo de servidor
  respondieron `200` contra las tablas V2; no fue necesario copiar ni rotar
  secretos. El `401` observado previamente procedía de una prueba HTTP
  incorrecta que trataba una clave nueva como token `Bearer`, no de credenciales
  vencidas.
- Se crearon tres cuentas claramente identificadas como QA (alumno, entrenador
  y administrador), sin copiar datos personales ni enviar correos, más una
  rutina completamente sintética. `scripts/configurar-y-verificar-qa-v2.mjs`
  deja sus credenciales sólo en `.env.qa.local`, ignorado por Git, y permite
  repetir la prueba sin duplicar cuentas ni rutinas.
- La prueba RLS real confirmó: anónimos sin acceso a rutinas; alumno aislado a
  sus propios datos y autorizado únicamente para registrar su sesión;
  entrenador con el acceso global decidido en la migración `0005`, pero sin
  capacidad de registrar sesiones en nombre del alumno; administrador
  operativo; entrenador sin lectura ni administración de canjes; y escritura
  directa bloqueada en personalizaciones, recetas, comunidad y canjes V2.
- `npm run qa:v2:integridad` se ejecutó dos veces consecutivas contra el
  proyecto activo. En cada pasada creó únicamente datos QA temporales, rechazó
  el intento de canje del entrenador, le negó consultar solicitudes, resolverlas
  o ajustar inventario, reservó `1` unidad y descontó exactamente `37` puntos al
  alumno QA. El administrador rechazó el canje, reintegró stock y puntos una
  sola vez y un segundo intento fue bloqueado. El bloque `finally` desactiva y
  elimina recompensa, canje y movimientos temporales incluso si una aserción
  falla.
- El recorrido autenticado Programas → Entrenamiento → Sesión → Historial se
  ejecutó de punta a punta. Una serie QA de `10` repeticiones con `10 kg`
  persistió, la sesión cerró como `finalizada_incompleta`, apareció en el
  historial y no otorgó puntos por trabajo incompleto.
- `npm run qa:v2:tecnicas` prepara de forma idempotente una sesión sintética
  aislada con FST-7, drop set, rest-pause, myo-reps, cluster, fallo técnico,
  superserie, triserie, serie gigante y circuito. El script exige una identidad
  marcada como Portal QA y sólo reemplaza datos bajo el nombre reservado.
- En navegador autenticado se verificó que el drop set recupera su paso `2/3`
  al recargar; el rest-pause conservó la cuenta atrás (`13 s` antes y `8 s`
  después de recargar) y avanzó por sí solo al siguiente trabajo. En video, la
  superserie recorrió estación 1 → estación 2 → descanso único → segunda ronda,
  sin descanso entre estaciones ni errores de consola.
- La compilación candidata se reauditó con la rutina sintética completa: tocar
  un ejercicio lo contrae y lo vuelve a desplegar; las flechas cambian de serie
  dentro del mismo ejercicio; sólo los campos de la serie activa dejan de ser
  `readOnly`. En vista de video, finalizar la serie `2` abrió el descanso grande
  y al vencer avanzó automáticamente a la serie `3`, no al siguiente ejercicio.
  Los ajustes de Alejandro, temporizador, sonido y kg/lb persistieron al cerrar
  y volver a abrir el panel; sonido y vibración físicos siguen formando parte
  de la prueba obligatoria en iPhone/Android.
- El ciclo automático de Alejandro quedó conectado a la memoria original: el
  aviso aparece sin pulsar “Alejandro”, `VOY` registra que fue leído y completar
  la serie resuelve el reto desde sus datos guardados. La prueba QA terminó como
  `lograda` con verificación `datos`, y después de recargar no volvió a aparecer.
  “Tengo una molestia” resolvió otro ciclo como `omitida_molestia`, desactivó
  los retos automáticos y no convirtió una declaración en evidencia numérica.
- El recorrido autenticado de Nutrición también se ejecutó de punta a punta:
  la búsqueda remota encontró productos reales de Soprole, importó Leche
  Natural Entera al catálogo, registró y editó su cantidad, recalculó macros,
  copió y eliminó el duplicado, guardó el alimento como favorito y creó una
  receta reutilizable. Base de datos e interfaz coincidieron al terminar:
  `250 g`, `150 kcal`, `8 g` de proteína, `12 g` de carbohidratos y `7,8 g` de
  grasa. La meta nutricional elegida también persistió en el plan activo.
- El 19-08-2026 el endpoint de texto heredado de Open Food Facts respondió
  `503` incluso después del reintento. Se migró la búsqueda principal a
  Search-a-licious y se comprobó desde la interfaz: cuatro resultados Soprole
  locales más siete productos chilenos externos válidos, importación de una
  porción de `155 g`, actualización inmediata de Nutrición y Progreso, y
  eliminación posterior del registro QA para restaurar los totales iniciales.
  No hubo errores de navegador.
- El mismo recorrido comprobó después que la etiqueta nutricional atraviesa la
  cadena completa catálogo → consumo → recarga → resumen. El resumen mostró
  azúcares y sodio escalados a la porción, señaló la ausencia real de fibra y
  expresó el sodio en `mg`; el consumo QA se eliminó al finalizar.
- La hoja autenticada de “Buscar comida” dejó de reutilizar la presentación
  clásica. Conserva el motor real —catálogo propio, búsqueda por nombre y
  marca, productos de Chile, favoritos, recetas, escáner y carga múltiple—,
  pero todo su marco, estados y acciones usan ahora la geometría, contraste,
  tipografía y superficies de V2. La prueba visual con Soprole confirmó
  resultados reales y corrigió además etiquetas de porción que Open Food Facts
  entregaba en inglés (`portion`) para presentarlas en español.
- La búsqueda autenticada posterior a `0114` comprobó desde la interfaz la
  convivencia de ambas fuentes: `Mango` apareció desde el catálogo local junto
  con resultados externos, y `Whey` devolvió aislado, concentrado, hidrolizado y
  productos de marcas locales con porciones de `30`, `33` y `36 g`. El catálogo
  propio responde primero y Open Food Facts continúa como respaldo, sin errores
  ni duplicación de la consulta.
- Durante esa prueba se corrigió un desacople visual: el formulario cargaba
  los números de “Volumen controlado” pero marcaba “Mantenimiento”. Ahora el
  preset seleccionado se deduce de los cuatro valores almacenados; una meta
  personalizada no marca falsamente ningún preset.
- El recorrido autenticado de Progreso validó el peso corporal, historial,
  programa, ranking, desglose público de puntos, comunidad y conexión al
  check-in privado. El primer peso QA acreditó `75 XP`; una corrección del
  mismo día actualizó el valor sin crear una tercera fila ni volver a premiar.
  La V2 colapsa duplicados históricos por fecha sin borrar registros antiguos,
  por lo que una corrección de minutos ya no se presenta como evolución de 30
  días.
- Se corrigieron además cuatro incoherencias detectadas con datos reales: el
  rango se refresca en la misma pantalla después del pesaje, “sesiones
  realizadas” ya no llama completada a una sesión incompleta, “Ver
  clasificación” abre el ranking y la regla nutricional publicada coincide
  con el motor (`-100` a `+250`, no `-150` en una tarjeta y `-100` en otra).
- La revisión final de Comunidad comprobó actividad verificada, clasificación
  mensual y acumulada, podio, posición propia, desglose público de puntos,
  Arena semanal/mensual/anual, rangos y saldo real. El desglose sólo admite al
  propio alumno o identidades que forman parte del ranking; nunca devuelve el
  detalle privado de alimentación. También se verificó el selector explícito
  de fotografía social sin publicar la foto sintética en la comunidad activa.
- Perfil, Más y Soporte se recorrieron completos: datos personales, descanso,
  contraseña, correo, opinión, plan, términos, redes, notificaciones,
  temporizador, sonido, vibración, kg/lb y asistente Alejandro. Los ajustes de
  sesión se alternaron y restauraron con la cuenta QA; la unidad cambió la
  tabla entre kg y lb y el temporizador manual volvió a la misma serie sin
  registrar trabajo. Alejandro respondió usando el historial QA real.
- Se recorrió “Más” con las tres cuentas QA. El alumno conservó rango, XP y
  sólo su espacio personal; el entrenador obtuvo su portal sin controles de
  administración; el administrador recibió los tres accesos. Una cuenta
  profesional sin ficha personal fue guiada a “Activar mi perfil de alumno” en
  vez de ser sustituida por datos demo. Desde el panel administrativo se volvió
  a la V2 mediante navegación visible, y la revisión visual confirmó la misma
  paleta, contraste y jerarquía de la nueva experiencia.
- Cuando todavía no existen recomendaciones evaluadas, el progreso de Impulso
  Alejandro ya no presenta un falso `0 %`: muestra un estado neutral hasta que
  exista una medición válida.
- El almacenamiento privado de fotografías de progreso se probó de punta a
  punta con una imagen sintética y la cuenta QA: carga, lectura mediante URL
  firmada y reemplazo dentro de la misma quincena conservaron una sola foto.
  El reemplazo no volvió a acreditar los `100 XP` y la interfaz lo comunicó de
  forma explícita. No se observó ningún error de navegador durante el flujo.
- El reemplazo ahora adopta primero el archivo nuevo y sólo entonces retira el
  anterior. Si falla la base de datos, elimina el archivo nuevo huérfano y
  preserva la foto vigente. La eliminación tampoco confía en una ruta enviada
  por el navegador: recupera `storage_path` desde la fila del alumno
  autenticado. La eliminación física no se ejecutó durante esta prueba porque
  la foto QA se conserva deliberadamente como fixture y una acción destructiva
  requiere confirmación expresa.
- `npm run verify:v2-storage` creó una segunda identidad sintética y aislada,
  claramente marcada como QA. La prueba real confirmó que esa cuenta recibe
  cero filas de `fotos_progreso` pertenecientes al primer alumno QA y tampoco
  puede descargar su objeto privado de Storage. No se consultó ni modificó la
  fotografía de ningún alumno activo.
- Los recursos privados de Cloudflare Stream ya no usan el UID público que
  provocaba `401`: miniatura y reproductor comparten un token temporal emitido
  por el servidor y reutilizado con margen de expiración. En el entorno local
  actual no están definidas las tres variables de Stream, por lo que la V2 cae
  a la foto real del ejercicio sin exponer ni simular el video; la reproducción
  local queda pendiente de configurar esas credenciales.
- La prueba autenticada de roles confirmó que el entrenador conserva su sesión
  al intentar una URL reservada pero vuelve a Alumnos, sin ver altas, equipo ni
  administración. El administrador mantiene el mapa completo y su encabezado
  se identifica expresamente como `Panel de administración`.
- El seguimiento diario ya vive dentro de `Progreso → Tu día` en la V2. Permite
  registrar y editar sueño, energía, agua, cumplimiento, molestias y comentario
  sin regresar al portal clásico. La prueba QA confirmó el recorrido completo:
  la tarjeta se actualizó en la misma pantalla y el entrenador recibió el dato
  en `Alumno → Actividad → Seguimiento diario` con los mismos valores.
- Se corrigió un defecto heredado: una respuesta binaria vacía se interpretaba
  como `No`. Ahora permanece `null`, y el servidor rechaza horas, litros o
  energía fuera de rangos posibles antes de escribirlos.
- Alejandro consume esas señales en la sesión V2 como límite automático de
  intensidad: una molestia, energía `1–2` o menos de cinco horas de sueño pausa
  los retos extra; una señal intermedia limita el cupo a uno; una preparación
  estable conserva los momentos planificados. Sin check-in aplica por seguridad
  un máximo de un momento. La rutina base nunca se altera ni se diagnostica.
- `npm run audit:v2-data` ejecuta una auditoría agregada y estrictamente de
  sólo lectura contra las fuentes activas. El 19-08-2026 confirmó, entre otros,
  `125` programas, `4.257` ejercicios prescritos, `521` sesiones históricas,
  `3.998` ejercicios ejecutados, `11.329` series con sus cargas, `100` pesajes,
  `6` fotos privadas, `550` comidas y `2.666` movimientos de puntos. La V2
  consume esas mismas tablas: no existe una copia vacía que obligue a reiniciar
  el progreso. Los totales son una fotografía de auditoría y cambiarán con el
  uso normal del portal activo.
- El auditor reintenta tres veces cada lectura remota y conserva el código,
  detalle y pista de Supabase en el error final. Una saturación transitoria ya
  no se presenta como un fallo vacío ni se confunde con pérdida de datos.
- `npm run verify:v2` además de probar las `16` rutas principales extrae los
  destinos V2 declarados en páginas y componentes y comprueba que respondan sin
  caer al login. La última ejecución verificó `17` conexiones, incluidos los
  destinos condicionales por rol. Los
  destinos con estado —por ejemplo `Progreso#checkin` y
  `Perfil#descanso`— también fueron abiertos en navegador: ambos muestran el
  panel correspondiente, no sólo la página general.

1. Crear un respaldo lógico verificable antes del próximo cambio de esquema; el
   plan gratuito actual no incluye respaldos automáticos.
2. Mantener `portal-v2` separada y desplegar una URL de preview.
3. `0104_personalizacion_sesion_v2.sql`,
   `0105_biblioteca_nutricion_v2.sql`, `0106_comunidad_social_v2.sql` y
   `0107_recompensas_vip.sql`, junto con el refuerzo
   `0108_recompensas_vip_solo_alumnos.sql`, la caché externa
   `0109_cache_open_food_facts.sql` y el refuerzo de automatizaciones
   `0110_automatizaciones_idempotentes.sql`, además de la separación
   administrativa `0111_recompensas_vip_solo_admin.sql`, la escritura atómica
   de perfil `0112_perfil_v2_consistente.sql`, las revisiones de seguimiento
   `0113_seguimiento_revisiones_faltante.sql` y el catálogo nutricional local
   `0114_catalogo_nutricional_vip_local.sql`, ya quedaron instaladas
   y verificadas en el proyecto activo. Mantener una instancia de preview para
   las pruebas destructivas y los cambios siguientes.
4. Configurar variables de preview y producción por separado.
5. Probar con cuentas reales de ensayo: alumno, entrenador y administrador.
6. Ejecutar `npm run quality:v2`, que detiene la entrega si falla ESLint,
   TypeScript, cualquier prueba o la compilación de producción.
7. Probar iPhone/Android: cámara, teclado, sonido, vibración, segundo plano,
   red intermitente, safe areas y notificaciones.
8. Revisar permisos de cámara/push bajo HTTPS y políticas RLS con intentos de
   acceso cruzado.
9. Ejecutar en preview el delivery real de Vercel Cron, webhook de Cloudflare
   y correo una vez configurados sus secretos; autenticación, idempotencia y
   manejo interno de errores ya están cubiertos sin enviar mensajes reales.
10. Activar la V2 por grupo piloto, conservando Vista clásica y reversión.
11. Medir errores, abandonos, sesiones finalizadas, uso de Alejandro y consultas
    sin resultado antes de hacerla predeterminada.

## Corte para la primera versión de prueba

La primera prueba cerrada puede comenzar cuando se cumplan estas condiciones,
sin esperar ampliaciones comerciales:

- `npm run quality:v2`, `npm run verify:v2` y la auditoría de interacciones
  deben terminar sin errores sobre el mismo commit candidato.
- Debe existir una URL HTTPS de preview separada del portal activo y un respaldo
  verificable previo al despliegue.
- Alumno, entrenador y administrador deben completar sus recorridos con cuentas
  de ensayo; ningún alumno real se usa para acciones destructivas.
- En al menos un iPhone y un Android deben probarse entrenamiento, descanso,
  persistencia, nutrición, cámara/teclado, recuperación de red y navegación.
- Toda integración todavía no configurada debe fallar cerrada, explicar la causa
  y mantener una salida útil. No se aceptan botones muertos ni datos simulados
  presentados como reales.

Pueden continuar después de esa primera prueba cerrada, sin bajar la calidad del
nucleo ya entregado:

- evaluar FatSecret únicamente mediante su API licenciada como proveedor
  adicional; el catálogo VIP local y Open Food Facts ya cubren el primer corte;
- conectar cobros cuando se elija un proveedor de pagos;
- definir premios, stock y responsables comerciales reales antes de publicar el
  catálogo de recompensas a todo el alumnado;
- revisión jurídica definitiva, medición formal de Core Web Vitals y pruebas de
  entrega real de push, cron, correo y Cloudflare Stream en preview;
- ampliar técnicas, desafíos y contenido editorial a partir de los resultados
  del piloto, sin reabrir las garantías transaccionales ya verificadas.

Cada elemento diferido debe conservar aquí su estado, evidencia y dependencia.
“Medio hecho” nunca se presenta como terminado: permanece deshabilitado o fuera
del menú hasta cumplir su recorrido completo.

## Trabajo que no debe presentarse como terminado todavía

- Auth, escrituras reales y límites RLS principales ya están comprobados con
  cuentas QA aisladas. Storage ya tiene carga, lectura firmada y reemplazo
  reales verificados, además del bloqueo de lectura y descarga cruzada entre
  dos alumnos QA. Sólo queda ejecutar la eliminación física cuando exista una
  confirmación expresa para retirar el fixture sintético. Cámara,
  notificaciones y segundo plano todavía requieren dispositivos físicos bajo
  HTTPS. Estas pruebas nunca deben utilizar alumnos activos.
- Definir el catálogo comercial real, disponibilidad, responsables de entrega
  y condiciones de cada premio. El sistema de catálogo, stock, canje y
  reintegro está construido; no debe inventar premios que VIP Fitness no haya
  decidido ofrecer.
- Historial longitudinal completo del ejercicio sustituido: el sistema ya
  bloquea la meta anterior y evita comparar implementos distintos. Falta
  acumular suficientes sesiones del sustituto antes de proponer aumentos de
  carga automáticos sobre ese movimiento.
- El escáner ofrece salida al buscador si la cámara no responde, pero la lectura
  real de EAN, permisos y cambio entre cámara trasera/frontal sigue requiriendo
  un teléfono físico bajo HTTPS; la automatización de escritorio no sustituye
  esa prueba.
- La firma temporal de miniaturas privadas de Cloudflare Stream está resuelta
  y el recorrido QA dejó de producir `401`. Falta cargar en el entorno local
  `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_STREAM_API_TOKEN` y
  `CLOUDFLARE_STREAM_CUSTOMER_CODE` para validar allí el iframe completo; sin
  esas variables se muestra la foto real disponible y no una imagen simulada.
- El entorno local tampoco contiene `CRON_SECRET` ni
  `CLOUDFLARE_STREAM_WEBHOOK_SECRET`: los tres endpoints fallan cerrados con
  `503`, como corresponde, y sus contratos están probados con secretos QA en
  memoria. Falta confirmar una entrega real desde Vercel y Cloudflare en la
  URL de preview; no se debe ensayar contra alumnos ni videos activos.
- Los avisos push de descanso y sesión inconclusa ya abren directamente la
  sesión o el entrenamiento V2. El entorno local no contiene
  `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` ni `VAPID_SUBJECT`; por
  eso Configuración muestra el interruptor deshabilitado y explica la causa en
  lugar de solicitar permisos que el servidor todavía no podría usar. Sonido y
  vibración locales continúan operativos sin esas claves.
- Publicación en el dominio y cambio de vista predeterminada: sólo después del
  piloto y de una orden expresa del propietario.
- La compilación y los tiempos de respuesta locales de las 15 rutas están
  verificados, pero la traza formal de Core Web Vitals (LCP, CLS, INP y cadena
  de red) debe ejecutarse sobre la URL HTTPS de preview. El entorno actual no
  tiene conectado Chrome DevTools MCP, por lo que no se publican cifras
  estimadas como si fueran mediciones reales.
- Cobro, renovación o cancelación del plan desde la V2: hoy se muestran datos
  reales del plan, pero no existe en el portal original un proveedor de pagos
  conectado que permita ejecutar esas operaciones sin inventarlas.
- Revisión jurídica del borrador de privacidad y términos antes de publicarlos
  como documentos contractuales definitivos.
- Las acciones sociales tienen validaciones de propiedad, límites diarios,
  moderación y RLS; el compositor y el consentimiento de foto se probaron en
  navegador. No se creó una publicación visible durante la auditoría porque el
  entorno usa la comunidad activa. La escritura, reacción, comentario, reporte
  y eliminación deben repetirse en la futura instancia de preview para probar
  el ciclo destructivo sin exponer contenido QA a alumnos reales.

Estos puntos son ampliaciones reales de producto, no detalles visuales. Fingirlos
con botones sería peor que declararlos pendientes y construirlos con seguridad.
