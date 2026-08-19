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
- Escanear: lector de código de barras; en producción necesita HTTPS y permiso
  de cámara.
- Registrar, editar cantidad, borrar y copiar alimentos recientes.
- Objetivos de calorías, proteína, carbohidratos y grasas persistentes.
- Panel de distribución nutricional sin inventar micronutrientes ausentes.

### Progreso y dashboard

- `/portal-v2/progreso`: estado del día conectado a entrenamiento y nutrición,
  peso, variación, sesiones, series, adherencia, calidad, Impulsos, programa,
  rango y clasificación.
- Registro de peso mediante la acción original, con ventana temporal y puntos
  protegidos contra duplicación.
- Acceso al historial corporal y galería de progreso existentes.

### Comunidad, ranking y retos

- `/portal-v2/progreso/comunidad`: actividad verificada, clasificación mensual
  y acumulada, podio, desglose explicable de puntos y desafíos activos.
- Los puntos provienen de eventos del servidor con claves idempotentes; no de
  clics del cliente. Existen topes, penalizaciones y cierre de actividad.
- Aceptación/rechazo de torneos conectada a las acciones existentes.
- Las fotos corporales permanecen en el módulo privado de progreso. No se
  publican como red social sin consentimiento y moderación.

### Más, cuenta y roles

- `/portal-v2/mas`: perfil, rango, puntos, notificaciones, plan, privacidad,
  soporte, redes y retorno a la Vista clásica.
- Alumno: experiencia personal.
- Entrenador: acceso a alumnos y seguimiento.
- Administrador: control total mediante el panel existente.
- Las opciones administrativas se muestran por rol verificado en servidor.

## Navegación y conexiones

La navegación principal tiene cuatro destinos: Entrenar, Nutrición, Progreso y
Más. Las sesiones inmersivas ocultan esa barra para no competir con el ejercicio.
Cada acción visible tiene destino, panel, cambio de estado o respuesta. Las
acciones no seguras que todavía no tienen contrato de servidor —sustituir y
reordenar ejercicios desde la cuenta del alumno— no se simulan.

## Tablas y campos necesarios

La definición exhaustiva y tipada está en `src/lib/supabase/types.ts`; las
migraciones históricas están en `supabase/migrations/0001_init.sql` a
`0103_tema_boton_masculino.sql`. Las tablas que sostienen esta V2 son:

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
| Serie real | `series_realizadas` | sesión-ejercicio, número, repeticiones, peso, unidad, realizada, técnica y trazabilidad |
| Día alimentario | `registros_diarios` | `id`, `alumno_id`, `fecha` |
| Comida | `comidas_registradas` | registro, tipo/hora, observación, omitida y fecha de registro |
| Consumo | `alimentos_consumidos` | `comida_id`, `alimento_id`, `cantidad`, `unidad` |
| Catálogo | `alimentos` | nombre, marca, porción, macros, micronutrientes, medida casera, código, origen OFF, imagen y aprobación |
| Peso | `pesos_corporales` | alumno, fecha, `peso_kg`, observación y creación |
| Fotos | `fotos_progreso` | alumno, ruta, fecha, categoría, comentario y creación |
| Seguimiento | `seguimientos_diarios` | alumno, fecha, energía, ánimo, sueño, dolor/molestias y notas |
| Actividad | `actividad_alumno_eventos` | alumno, tipo, fecha, contexto y datos auditables |
| Puntos | `puntos_vip_movimientos` | alumno, clave única, concepto, puntos, fecha, estado y metadatos |
| Ranking | `ranking_semanas` | alumno, semana, desglose, total, cierre y auditoría |
| Retos | `torneos`, `torneo_participantes` | reglas, modalidad, fechas, bolsa, estado, invitación, aceptación y resultado |
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

## Qué mantener, adaptar y retirar

### Mantener

- Modelo de datos y autenticación del portal original.
- Guardado idempotente de sesiones, series y puntos.
- Motor nutricional, catálogo aprobado, creación manual y medidas caseras.
- Seguimiento integral, pesos, fotos, torneos, push y Cloudflare Stream.
- Motor histórico, trazabilidad, memoria y supervisión de Impulso VIP.
- Paneles de entrenador y administrador.

### Adaptar

- Presentación clásica de rutina a la máquina de estados V2.
- Impulso VIP a Alejandro: automático, breve, escaso y dependiente del equipo,
  historial, madurez, constancia, técnica y seguridad.
- Ranking a explicación pública sin revelar alimentación o salud privada.
- Noticias del sistema a actividad comunitaria verificable.
- Nutrición a una línea de tiempo móvil, conservando acciones del servidor.
- Seguimiento a un dashboard diario con conexiones directas.

### Retirar o no trasladar

- Navegación antigua de cinco destinos dentro de la V2.
- Controles decorativos o botones sin acción.
- Aumentos fijos de 2,5 kg para todo equipo.
- Encuestas obligatorias en cada serie.
- Datos simulados cuando existe un usuario real autenticado.
- Puntos creados desde el navegador o recompensas por simples clics.
- Sustitución/reordenamiento improvisado que altere una rutina publicada sin
  autorización y auditoría del entrenador.

## Comprobación antes de publicar

1. Crear un respaldo verificable de la base y del despliegue actual.
2. Mantener `portal-v2` separada y desplegar una URL de preview.
3. Confirmar que todas las migraciones existentes están aplicadas, sin aplicar
   cambios destructivos sobre producción.
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

- Recetas y favoritos persistentes: no existe aún un modelo dedicado con
  ingredientes, porciones y propiedad. El buscador, escáner, registro, edición
  y copia sí están operativos.
- Publicaciones sociales con fotos, comentarios y “me gusta”: requieren
  consentimiento, moderación, reportes, privacidad y tablas propias. La V2 usa
  actividad verificada y enlaza la galería privada; no publica fotos por defecto.
- Sustituir o reordenar ejercicios desde el alumno: se retiró de la V2 hasta
  definir reglas de compatibilidad y guardar una revisión auditable.
- Premios físicos o monetarios del ranking: los puntos, retos y apuestas existen;
  la entrega de un premio requiere catálogo, inventario, términos y aprobación.
- Validación destructiva de escrituras con una cuenta real: debe hacerse con una
  cuenta de prueba autorizada en el preview, nunca con alumnos activos.
- Publicación en el dominio y cambio de vista predeterminada: sólo después del
  piloto y de una orden expresa del propietario.

Estos puntos son ampliaciones reales de producto, no detalles visuales. Fingirlos
con botones sería peor que declararlos pendientes y construirlos con seguridad.
