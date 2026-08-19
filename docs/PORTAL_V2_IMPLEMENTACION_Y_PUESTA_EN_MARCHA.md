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
  rest-pause, myo-reps, cluster, FST-7 y fallo técnico cuando son elegibles.

### Nutrición

- `/portal-v2/nutricion`: fecha chilena, semana colapsable, resumen fijo de
  calorías/macros y línea de tiempo de 24 horas.
- Buscar: catálogo propio primero; Open Food Facts Chile y luego global como
  complemento; creación manual cuando no hay resultado.
- Los productos externos se vuelven a consultar por código en el servidor:
  nombre y macros enviados por el navegador nunca se confían, se rechazan
  rangos imposibles y la caché pública tiene caducidad y tamaño máximo.
- La búsqueda externa es explícita, no se dispara por cada tecla: respeta el
  límite oficial de Open Food Facts de 10 búsquedas por minuto e IP; el
  catálogo VIP local conserva la búsqueda inmediata.
- Escanear: lector de código de barras; en producción necesita HTTPS y permiso
  de cámara.
- Registrar, editar cantidad, borrar y copiar alimentos recientes.
- Favoritos personales y recetas reutilizables con ingredientes reales,
  porciones y macros derivados del catálogo (`0105_biblioteca_nutricion_v2`).
- Objetivos de calorías, proteína, carbohidratos y grasas persistentes.
- Panel de distribución nutricional sin inventar micronutrientes ausentes.

### Progreso y dashboard

- `/portal-v2/progreso`: estado del día conectado a entrenamiento y nutrición,
  peso, variación, sesiones, series, adherencia, calidad, Impulsos, programa,
  rango y clasificación.
- Registro de peso mediante la acción original, con ventana temporal y puntos
  protegidos contra duplicación.
- Historial corporal y galería privados integrados en V2: evolución por fecha,
  fotografía quincenal, carga, reemplazo/borrado sólo en la quincena vigente y
  acceso directo desde Comunidad sin regresar a la interfaz clásica.

### Comunidad, ranking y retos

- `/portal-v2/progreso/comunidad`: actividad verificada, clasificación mensual
  y acumulada, podio, desglose explicable de puntos y desafíos activos.
- `/portal-v2/progreso/ranking`: Arena V2, rangos, tabla semanal/mensual/anual,
  reglas públicas, movimientos auditables, retos y catálogo de recompensas;
  permanece navegable como demostración segura sin enviarla al login clásico.
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
- Las fotos corporales permanecen privadas salvo la foto concreta elegida por
  su dueño al publicar. Los reportes se resuelven en `/admin/reportes`.

### Más, cuenta y roles

- `/portal-v2/mas`: perfil, rango, puntos, notificaciones, plan, privacidad,
  soporte, redes y retorno a la Vista clásica.
- La vista directa y las cuentas de solo lectura no pueden registrar ni retirar
  suscripciones push. El temporizador y el descanso preferido sólo quedan
  reflejados tras confirmación del servidor; ante error o corte de red, la
  interfaz revierte al valor anterior y conserva la preferencia existente.
- `/portal-v2/privacidad`: documento completo reutilizado del portal original,
  con retorno a la V2; el cierre de sesión real sólo aparece cuando existe una
  identidad autenticada.
- `/portal-v2/perfil`: edición autenticada de datos personales, temporizador,
  contraseña, correo y reseña reutilizando las acciones probadas del portal;
  la vista directa protege la información sin redirigir al login.
- `/portal-v2/soporte`: asistente contextual, recordatorios y marcas recientes
  dentro del shell V2; la demostración no fabrica conversaciones privadas.
- El plan muestra nombre, sesiones, frecuencia y estado reales de la cuenta.
- Las notificaciones push son reversibles por dispositivo: activar suscribe el
  endpoint y desactivar lo elimina del servidor y del navegador.
- La demostración directa no expulsa al login al abrir perfil, soporte,
  privacidad, progreso o Arena: resuelve el destino dentro de la V2 y mantiene
  bloqueadas únicamente las escrituras que requieren una identidad real.
- Alumno: experiencia personal.
- Entrenador: acceso a alumnos y seguimiento.
- Administrador: control total mediante el panel existente.
- Las opciones administrativas se muestran por rol verificado en servidor.

## Navegación y conexiones

La navegación principal tiene cuatro destinos: Entrenar, Nutrición, Progreso y
Más. Las sesiones inmersivas ocultan esa barra para no competir con el ejercicio.
Cada acción visible tiene destino, panel, cambio de estado o respuesta. Cambiar
o reordenar ejercicios usa una personalización separada y auditable de la
sesión: no modifica la rutina publicada del entrenador, bloquea sustituciones
después de comenzar y mantiene unidos los bloques de biserie, triserie,
superserie, circuito o serie gigante.

La biblioteca de ejercicios cubre la exploración y educación que Standrd
presenta como `Exercise Library`. No se trasladó un `Workout Builder` libre al
alumno: en VIP Fitness el programa es una prescripción profesional. Si en el
futuro se ofrecen entrenamientos autónomos, deben vivir como sesiones
adicionales separadas, jamás modificar silenciosamente la rutina publicada.

## Tablas y campos necesarios

La definición exhaustiva y tipada está en `src/lib/supabase/types.ts`; las
migraciones históricas están en `supabase/migrations/0001_init.sql` a
`0107_recompensas_vip.sql`. Las tablas que sostienen esta V2 son:

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
| Catálogo | `alimentos` | nombre, marca, porción, macros, micronutrientes, medida casera, código, origen OFF, imagen y aprobación |
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
- Open Food Facts API: búsqueda y código de barras. Estrategia obligatoria:
  catálogo VIP local → OFF Chile → OFF global → creación manual.
- Catálogo chileno propio: semillas y respaldo en `supabase/seeds` y
  `supabase/respaldos`; debe enriquecerse continuamente con productos y marcas
  locales, incluida Soprole, conservando aprobación humana.
- INTA/Universidad de Chile: referencia nutricional nacional para alimentos
  genéricos; su licencia y formato deben revisarse antes de importar en masa.
- Cloudflare Stream: video de ejercicios y webhooks.
- Web Push/VAPID: avisos de descanso, entrenador e Impulso.
- Resend: correos transaccionales del portal original.
- Anthropic: funciones de IA administrativas y de apoyo; Alejandro no depende
  de una respuesta generativa en vivo para decidir una serie.
- ZXing: lectura de códigos en el navegador.

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
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_CONTACT_EMAIL`
- `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_STREAM_API_TOKEN`,
  `CLOUDFLARE_STREAM_CUSTOMER_CODE`, `CLOUDFLARE_STREAM_WEBHOOK_SECRET`
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
- `CRON_SECRET`
- `ANTHROPIC_API_KEY` si se habilitan las funciones de IA opcionales.

Funciones SQL de seguridad:

- `solicitar_canje_vip`: serializa por alumno, confirma saldo, congela costo,
  reserva stock y descuenta puntos en la misma transacción.
- `resolver_canje_vip`: sólo entrenador/administrador; aprueba, entrega o
  rechaza, reintegrando stock y puntos de manera idempotente.

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
- `54` archivos de pruebas y `499` pruebas aprobadas; ESLint sin advertencias,
  TypeScript sin errores y compilación de producción completa (`67` rutas).
- Las 15 rutas de la V2 respondieron `200` en el servidor de producción local,
  incluida la búsqueda prefiltrada de la biblioteca y la nueva pantalla de
  programas. La primera carga de biblioteca puede esperar el catálogo remoto;
  las siguientes quedan atendidas por la caché del servidor.
- Las migraciones `0104` a `0107` se ejecutaron juntas en PostgreSQL efímero.
  Se comprobó la transacción de canje (saldo y stock) y el reintegro idempotente
  al rechazar. Esta comprobación valida sintaxis y reglas transaccionales; no
  sustituye la prueba de Auth, RLS y Storage en un Supabase de preview.
- La sesión activa conserva un borrador local validado y aislado por id durante
  48 horas. Una recarga recupera los últimos pesos, repeticiones, notas, tiempo
  y posición sin pisar series que el servidor ya confirmó; los fallos de red se
  muestran y el alumno puede reintentar sin perder la pantalla.
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
- Las claves Supabase conservadas en `.env.local` devolvieron `401` el mismo día
  y deben reemplazarse por las claves vigentes antes de probar datos reales
  desde localhost. No se copiaron secretos desde el panel sin autorización
  específica.

1. Crear un respaldo lógico verificable antes del próximo cambio de esquema; el
   plan gratuito actual no incluye respaldos automáticos.
2. Mantener `portal-v2` separada y desplegar una URL de preview.
3. `0104_personalizacion_sesion_v2.sql`,
   `0105_biblioteca_nutricion_v2.sql`, `0106_comunidad_social_v2.sql` y
   `0107_recompensas_vip.sql` ya quedaron instaladas y verificadas en el
   proyecto activo. Mantener una instancia de preview para las pruebas
   destructivas y los cambios siguientes.
4. Configurar variables de preview y producción por separado.
5. Probar con cuentas reales de ensayo: alumno, entrenador y administrador.
6. Ejecutar `npm run lint`, `npx tsc --noEmit`, `npm test` y `npm run build`.
7. Probar iPhone/Android: cámara, teclado, sonido, vibración, segundo plano,
   red intermitente, safe areas y notificaciones.
8. Revisar permisos de cámara/push bajo HTTPS y políticas RLS con intentos de
   acceso cruzado.
9. Verificar webhooks de video, cron de puntos/reconocimientos y correo.
10. Activar la V2 por grupo piloto, conservando Vista clásica y reversión.
11. Medir errores, abandonos, sesiones finalizadas, uso de Alejandro y consultas
    sin resultado antes de hacerla predeterminada.

## Trabajo que no debe presentarse como terminado todavía

- Actualizar las claves locales y probar con cuentas autorizadas de alumno,
  entrenador y administrador. La instalación, RLS declarativo y funciones ya
  están verificadas; quedan Auth, Storage, escrituras reales y los intentos de
  acceso cruzado. Estas pruebas deben usar cuentas de ensayo, nunca alumnos
  activos.
- Definir el catálogo comercial real, disponibilidad, responsables de entrega
  y condiciones de cada premio. El sistema de catálogo, stock, canje y
  reintegro está construido; no debe inventar premios que VIP Fitness no haya
  decidido ofrecer.
- Historial longitudinal completo del ejercicio sustituido: el sistema ya
  bloquea la meta anterior y evita comparar implementos distintos. Falta
  acumular suficientes sesiones del sustituto antes de proponer aumentos de
  carga automáticos sobre ese movimiento.
- Validación destructiva de escrituras con una cuenta real: debe hacerse con una
  cuenta de prueba autorizada en el preview, nunca con alumnos activos.
- Publicación en el dominio y cambio de vista predeterminada: sólo después del
  piloto y de una orden expresa del propietario.
- Cobro, renovación o cancelación del plan desde la V2: hoy se muestran datos
  reales del plan, pero no existe en el portal original un proveedor de pagos
  conectado que permita ejecutar esas operaciones sin inventarlas.
- Revisión jurídica del borrador de privacidad y términos antes de publicarlos
  como documentos contractuales definitivos.

Estos puntos son ampliaciones reales de producto, no detalles visuales. Fingirlos
con botones sería peor que declararlos pendientes y construirlos con seguridad.
