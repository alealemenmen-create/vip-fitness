# Instructivo para Claude — Galería multimedia de ejercicios preparada para producción masiva

Fecha: 2026-08-16  
Proyecto: Portal VIP  
Prioridad: **urgente y máxima**  
Área: `/admin/ejercicios`  
Objetivo operativo: permitir que el entrenador vuelva del gimnasio con decenas o cientos de fotos y videos y pueda dejarlos correctamente vinculados con la menor cantidad posible de decisiones, sin perder archivos, duplicar ejercicios ni dejar pendientes desactualizados.

---

## 0. Orden directa para Claude

Implementa este instructivo en el repositorio. No lo conviertas en otra propuesta y no te limites a cambiar textos o colores.

El resultado debe ser un sistema único de ingreso multimedia que acepte fotos y videos, antes o después de que exista el ejercicio, y que resuelva automáticamente todas las relaciones derivadas cuando haya certeza suficiente.

La regla principal es:

> El entrenador aporta el material y, cuando sea necesario, el nombre. El sistema hace la clasificación, vinculación, compresión, carga, cierre de pendientes y control de calidad. Solo pide intervención frente a una ambigüedad real.

Antes de modificar código:

1. Lee `AGENTS.md` completo.
2. Lee cualquier `CLAUDE.md` o instrucción local aplicable.
3. Lee el handoff 1.27 y los instructivos de reorganización que existan en la raíz.
4. Esta aplicación usa Next.js 16.2.12 con cambios incompatibles. Lee en `node_modules/next/dist/docs/` la documentación local correspondiente a App Router, Server Actions, formularios, Route Handlers y carga de archivos antes de implementar.
5. Revisa el estado de Git y conserva cualquier cambio ajeno. No uses `git reset --hard`, `git checkout --` ni borres trabajo existente.
6. Trabaja por fases pequeñas, ejecuta pruebas después de cada fase y corrige las regresiones antes de continuar.
7. No hagas commit, push, PR ni despliegue. El propietario lo hará después de revisar.

---

## 1. Contexto real de uso

El diseño no debe imaginar a un administrador sentado con un computador y archivos perfectamente nombrados. El caso principal es este:

1. El entrenador llega al gimnasio con varios amigos.
2. Graba ejercicios de forma rápida, posiblemente con poca señal.
3. Por cada ejercicio puede obtener:
   - una foto vertical;
   - una foto horizontal;
   - varias tomas;
   - un video corto;
   - foto y video;
   - solo video;
   - archivos repetidos o fallidos;
   - un archivo cuyo nombre no coincide exactamente con el catálogo.
4. Algunos ejercicios ya existen.
5. Otros aparecen en rutinas, pero todavía no existen como ficha de biblioteca.
6. Otros están en `Pendientes` porque un alumno reportó una fotografía faltante o incorrecta.
7. Otros son realmente nuevos.
8. Puede haber nombres equivalentes: `Jumping jacks`, `jumping jack`, `saltos de tijera`, `polichinelas`.
9. Puede haber nombres peligrosamente parecidos que no deben mezclarse: equipos distintos, variantes unilaterales, zonas musculares diferentes o movimientos técnicamente distintos.
10. El entrenador no debe rellenar cinco clasificaciones y cuatro textos técnicos mientras sostiene el teléfono en el gimnasio.
11. Si la conexión se corta, el trabajo ya realizado no se puede perder.

Diseña y prueba todo contra este contexto.

---

## 2. Estado actual verificado el 16 de agosto de 2026

La página real examinada muestra:

- 120 ejercicios activos.
- 92 con fotografía y 28 sin fotografía.
- 21 reportes individuales, agrupados visualmente en 18 pendientes.
- Una `Mesa` con 9 elementos visibles en la pestaña.
- Un aviso de 35 nombres solicitados que aparentemente no existen como ficha.
- `Curl Bayesian` figura como pendiente por falta de foto.

### 2.1 Lo que ya está bien y debe reutilizarse

No reescribir estas bases desde cero:

- `src/components/admin/GaleriaEjercicios.tsx`
  - Mesa por ejercicio.
  - Vista previa igual a la del alumno.
  - Editor de nombre y alias.
  - Reasignación de nombres de rutinas.
  - Fusión de duplicados con historial.
  - Restauración de fotografía anterior.
  - Carga individual de clips.
- `src/components/admin/CargaMasivaFotos.tsx`
  - Selección múltiple.
  - Emparejado por nombre de archivo.
  - Separación entre coincidencia segura y coincidencia que requiere revisión.
  - Aplicación secuencial de fotografías seguras.
- `src/lib/ejercicios/emparejar.ts`
  - Coincidencia exacta y por alias.
  - Vetos por zona muscular y equipo.
  - Prevención de colisiones ya descubiertas en producción.
- `src/lib/ejercicios/procesarFoto.ts`
  - Procesamiento de imágenes y normalización.
- `src/app/admin/ejercicios/actions.ts`
  - Cierre automático de reportes por `ejercicio_id`.
  - Cierre por nombre o alias cuando el reporte todavía no tiene `ejercicio_id`.
  - Versionado de fotografía anterior.
  - Alta de ejercicio con fotografía opcional.
  - Integración actual con Cloudflare Stream.
- `src/lib/cloudflare/stream.ts`
  - URL de subida directa.
  - Archivos que no atraviesan Next.js/Vercel.
  - Consulta de procesamiento y reproducción firmada.
- Migraciones existentes:
  - `0048_reportes_fotos_ejercicios.sql`.
  - `0049_video_cloudflare_stream.sql`.
  - `0093_ejercicio_fusiones_historial.sql`.
  - `0094_ejercicio_foto_version_anterior.sql`.

### 2.2 Problemas concretos actuales

#### A. La carga masiva solo acepta imágenes

`CargaMasivaFotos.tsx` acepta JPEG, PNG, WebP, HEIC y HEIF. No admite MP4, MOV o WebM y no puede formar un conjunto foto + video.

#### B. Un archivo sin coincidencia queda bloqueado

La fila permite buscar un ejercicio existente, pero no ofrece `Crear ejercicio con este archivo`. El entrenador tiene que salir del lote, abrir otro modal, crear la ficha y volver a la carga.

#### C. Crear ejercicio exige demasiados datos en el peor momento

El alta obliga a completar:

- nombre;
- grupo muscular;
- tipo o patrón de movimiento;
- categoría;
- equipo;
- y luego ofrece nivel y detalles técnicos.

Todos son datos útiles para la calidad del catálogo, pero no todos deben bloquear la captura. En el gimnasio, el alta rápida debe pedir solo lo indispensable y dejar la clasificación incierta en una cola de revisión.

#### D. El alta nueva no permite subir un clip desde el teléfono

El modal solo acepta un enlace de video. El propio texto indica que, para subir un archivo, hay que crear el ejercicio, cerrar el alta, encontrarlo otra vez y usar `Subir clip`. Este recorrido debe desaparecer.

#### E. Foto y video son dos mundos separados

No existe una cola común que entienda que:

- `023-curl-bayesian.jpg` y `023-curl-bayesian.mov` pertenecen al mismo ejercicio;
- una imagen puede ser portada y el video la demostración;
- varios archivos pueden ser tomas del mismo movimiento.

#### F. La cola vive solo en memoria

Si la página se recarga, el navegador se cierra o el teléfono pierde conexión, la selección y las decisiones de asociación se pierden. Los `objectURL` creados por la vista previa tampoco se revocan de forma explícita.

#### G. La carga por lote es totalmente secuencial

Es segura para la conexión, pero con cien archivos es innecesariamente lenta. Debe existir concurrencia limitada y adaptable, no paralelismo ilimitado.

#### H. El reemplazo de video tiene una ventana de riesgo

La acción actual asocia el nuevo UID al ejercicio y elimina el UID anterior antes de comprobar que el nuevo clip terminó de subir y procesar correctamente. Un fallo puede dejar al ejercicio sin el video anterior recuperable.

#### I. El modelo actual admite una foto principal y un video

No representa de forma limpia varias fotos, ángulos, una portada elegida, un video de ejecución y eventualmente un video de error común. La nueva arquitectura debe soportarlo sin romper las columnas legadas que hoy consume el portal del alumno.

#### J. Los pendientes no forman parte explícita del trabajo por lote

La foto individual sí cierra reportes automáticamente, pero la carga masiva no explica antes de guardar cuántos pendientes resolverá. Tampoco hay una unidad transaccional que confirme: archivo listo, ejercicio vinculado, reporte cerrado y contador actualizado.

---

## 3. Resultado final exigido

La Galería debe convertirse en un centro de ingestión multimedia con cuatro puertas equivalentes:

1. **Capturar ahora:** cámara de foto o video desde el teléfono.
2. **Subir archivos:** uno o muchos archivos mezclados.
3. **Resolver pendientes:** entrar desde `Curl Bayesian` u otro reporte y adjuntar foto, video o ambos.
4. **Crear ejercicio:** crear la ficha aportando primero foto, video, nombre o cualquier combinación.

Todas deben terminar en el mismo motor y producir el mismo resultado.

### 3.1 Frase de producto

> Sube todo primero. VIP lo ordena. Tú solo confirmas las dudas.

### 3.2 Objetivos medibles

- Agregar foto + video a un ejercicio existente: máximo 3 intervenciones cuando el nombre coincide.
- Crear un ejercicio desde un archivo sin coincidencia: nombre + una confirmación.
- Subir 100 archivos: una selección, revisión de ambiguos y una confirmación final.
- Ningún archivo correcto se pierde por recarga o corte de red.
- Ningún ejercicio existente se duplica sin una advertencia explícita.
- Ninguna coincidencia de confianza media o baja se aplica automáticamente.
- Todo reporte relacionado se cierra solo cuando el medio definitivo quedó vinculado correctamente.
- El entrenador puede abandonar la página y ver el progreso al volver.

---

## 4. Nueva arquitectura de experiencia: una sola bandeja de ingreso

Renombrar `Carga masiva` a **Subir y organizar** y convertirla en la entrada principal de Galería.

En móvil, colocar arriba cuatro acciones grandes:

- `Tomar foto`.
- `Grabar video`.
- `Elegir archivos`.
- `Elegir carpeta` cuando el navegador lo soporte.

El selector principal debe aceptar simultáneamente:

```text
image/jpeg,image/png,image/webp,image/heic,image/heif,
video/mp4,video/quicktime,video/webm
```

No confiar solamente en `File.type`: validar también extensión y firma real en el servidor o proveedor porque algunos teléfonos entregan MIME vacío o genérico.

### 4.1 Capturar primero, decidir después

Al elegir archivos:

1. Crear una sesión de ingestión.
2. Mostrar miniaturas inmediatamente.
3. Extraer un candidato de cada nombre.
4. Agrupar foto y video que parezcan pertenecer al mismo ejercicio.
5. Comparar contra nombre, slug y alias.
6. Comparar contra nombres sueltos usados en rutinas.
7. Comparar contra reportes pendientes.
8. Buscar duplicados por hash del archivo.
9. Presentar el destino propuesto.
10. Comenzar en segundo plano solo las cargas no destructivas cuando sea seguro.

### 4.2 Unidad visible: conjunto de ejercicio, no archivo aislado

La cola no debe mostrar cien filas inconexas. Debe agrupar:

```text
Curl Bayesian
├─ Foto de portada · IMG_3021.HEIC
├─ Video de ejecución · IMG_3022.MOV
├─ Coincidencia: Curl Bayesian · 99%
├─ Resolverá: 1 reporte pendiente
└─ Estado: listo para aplicar
```

Cada grupo permite:

- cambiar ejercicio;
- crear uno nuevo;
- cambiar nombre;
- elegir portada;
- cambiar rol del archivo;
- dividir el grupo;
- unirlo con el grupo anterior o siguiente;
- eliminarlo solo de la cola, sin borrar el original del teléfono;
- reintentar;
- posponer.

### 4.3 Cómo agrupar archivos

Aplicar, en orden:

1. Mismo prefijo numérico: `023_...jpg` y `023_...mov`.
2. Mismo nombre base sin sufijos conocidos: `-foto`, `-video`, `-portada`, `-clip`, `-1`, `-2`.
3. Nombre normalizado idéntico.
4. Capturas hechas dentro de la misma sesión de ejercicio en modo gimnasio.
5. Cercanía temporal y candidato textual común, solo como sugerencia.

La cercanía temporal nunca debe unir automáticamente dos ejercicios sin otro indicio.

---

## 5. Modo gimnasio

Agregar un modo específico **Sesión de grabación**. Este modo es tan importante como la carga posterior.

### 5.1 Preparar lista antes de grabar

Permitir formar una lista desde:

- ejercicios sin foto;
- ejercicios sin video;
- reportes pendientes;
- nombres usados en rutinas que no tienen ficha;
- selección manual de la biblioteca;
- texto pegado con un ejercicio por línea.

Orden configurable:

- por máquina o equipo;
- por zona muscular;
- por prioridad de pendientes;
- alfabético;
- orden manual mediante arrastre.

Esto evita caminar varias veces por el gimnasio.

### 5.2 Tarjeta de captura

Mostrar una sola tarjeta grande:

```text
7 de 42 · CURL BAYESIAN
Polea · Brazos

[ Tomar portada ] [ Grabar demostración ]
[ Agregar otra toma ] [ No disponible hoy ]

Anterior                         Siguiente
```

Después de capturar:

- guardar en la cola local;
- avanzar automáticamente si el entrenador activa `Avance automático`;
- permitir deshacer durante algunos segundos;
- no exigir subir en ese instante;
- mostrar claramente `Guardado en este dispositivo, falta sincronizar`.

### 5.3 Convención opcional para grabar con cámara normal

El sistema no debe depender de esta convención, pero debe enseñarla como acelerador:

```text
001__curl-bayesian__portada.jpg
001__curl-bayesian__demo.mov
002__sentadilla-goblet__portada.heic
002__sentadilla-goblet__demo.mp4
```

Si el teléfono no permite renombrar en el momento, el modo gimnasio asigna internamente el número y el ejercicio.

---

## 6. Casos obligatorios y comportamiento exacto

| Situación | Comportamiento |
|---|---|
| Ejercicio existe y coincidencia es exacta | Preseleccionar, indicar qué se reemplaza o agrega y permitir `Aplicar seguros`. |
| Ejercicio existe por alias | Preseleccionar mostrando `Coincide por alias: ...`. |
| Ejercicio aparece en pendientes | Mostrar el número de reportes que se cerrarán cuando el medio quede listo. |
| Nombre aparece en rutinas, pero no hay ficha | Ofrecer `Crear ficha y vincular todas las rutinas`. |
| No existe ningún nombre parecido | Ofrecer `Crear ejercicio con este material`. |
| Hay dos candidatos posibles | No cargar automáticamente. Presentar las diferencias: grupo, equipo, patrón y usos. |
| Ya existe una foto | Preguntar por fila: `Reemplazar portada`, `Agregar como toma`, `Conservar actual` o `Comparar`. |
| Ya existe un video | `Reemplazar cuando el nuevo esté listo`, nunca borrar antes. |
| Archivo duplicado exacto | Marcarlo y excluirlo del lote por defecto. |
| Dos archivos distintos para la portada | Elegir mejor candidato por resolución y encuadre; pedir confirmación visual. |
| Video demasiado largo | Ofrecer recortar inicio/fin en el cliente o subirlo como pendiente de edición. No obligar a volver a grabar. |
| Archivo supera el límite | Explicar tamaño, permitir comprimir o dejar pendiente, conservar el trabajo de asociación. |
| Conexión se corta | Pausar, conservar cola y reintentar desde donde corresponda. |
| HEIC/HEIF | Convertir respetando orientación EXIF. |
| MOV de iPhone | Aceptar aunque el MIME llegue vacío; validar contenido y procesar. |
| El video está vertical | Mostrar vista previa real y zona segura; no rechazarlo. |
| El archivo tiene audio | Por defecto, reproducir al alumno silenciado y permitir quitar audio en el procesamiento. |
| Se cierra la página | Restaurar sesión, archivos y decisiones al volver cuando el navegador lo permita. |
| El entrenador crea un ejercicio desde Mesa | Cerrar nombres pendientes vinculados y llevar el foco al nuevo ejercicio sin buscarlo otra vez. |
| Se sube material desde Pendientes | Usar el mismo modal unificado y volver a la siguiente tarea pendiente. |

---

## 7. Alta rápida de ejercicio

Reemplazar el formulario actual por dos niveles.

### 7.1 Alta rápida — visible por defecto

Pedir solamente:

1. **Nombre principal**.
2. **¿Es uno existente?** resultados en vivo mientras se escribe.
3. Foto y/o video, ya precargados si el alta nació desde un archivo.

Opcionalmente mostrar chips sugeridos, sin convertirlos en preguntas obligatorias:

- grupo muscular;
- equipo;
- patrón;
- categoría.

Botón principal:

`Crear, vincular y continuar`.

### 7.2 Clasificación automática

Reutilizar los clasificadores y vocabularios existentes. Inferir desde:

- nombre;
- alias;
- nombres parecidos ya clasificados;
- reporte o nombre de rutina de origen;
- equipo detectado en el texto;
- selección de la lista de grabación.

Mostrar la inferencia como propuesta editable:

```text
Sugerido: Brazos · Polea · Bíceps supinado
[Correcto] [Cambiar]
```

Nunca inventar silenciosamente una clasificación de baja confianza.

### 7.3 Ficha incompleta segura

Agregar un estado explícito de calidad, por ejemplo:

- `completa`;
- `requiere_clasificacion`;
- `requiere_revision_multimedia`.

No usar valores falsos para satisfacer campos obligatorios. Si el esquema actual no permite una ficha incompleta, agregar una migración segura.

Mientras `requiere_clasificacion` esté activo:

- el ejercicio puede recibir multimedia;
- puede resolver el pendiente visual;
- queda visible en una cola `Completar ficha`;
- no entra automáticamente al generador de rutinas basado en reglas hasta tener clasificación confiable;
- sí puede vincular las entradas históricas que originaron su creación cuando el nombre es inequívoco.

### 7.4 Detalles técnicos

Descripción, técnica, errores, consejos y nivel deben quedar en `Completar después`. No bloquear nunca una carga en terreno.

### 7.5 Video dentro del alta

El alta debe aceptar:

- archivo MP4;
- archivo MOV;
- archivo WebM;
- grabación directa;
- enlace externo permitido;
- ningún video.

No mostrar de nuevo el mensaje actual que obliga a crear primero y volver a `Foto y datos`.

---

## 8. Modelo de datos recomendado

No intentes meter toda la nueva lógica solamente en estados React. La sesión debe ser recuperable y auditable.

### 8.1 Tabla de sesiones de ingestión

Crear una migración nueva, con nombre siguiente al último número real del repositorio, para una tabla equivalente a:

```text
ejercicio_ingestas
- id uuid
- entrenador_id uuid
- origen: carga | camara | modo_gimnasio | pendiente | alta
- estado: borrador | cargando | requiere_revision | aplicando | completada | parcial | cancelada
- total_archivos
- archivos_listos
- archivos_error
- creado_en
- actualizado_en
- completado_en
```

### 8.2 Elementos de ingestión

```text
ejercicio_ingesta_items
- id uuid
- ingesta_id uuid
- clave_grupo text
- nombre_archivo text
- mime text
- tamano_bytes bigint
- hash_sha256 text null
- tipo: imagen | video
- rol: portada | galeria | demostracion | error_comun | sin_definir
- ejercicio_id uuid null
- nombre_candidato text
- confianza numeric null
- razon_match text null
- almacenamiento_temporal text null
- proveedor_uid text null
- estado: local | preparado | subiendo | procesando | listo | error | aplicado
- error_codigo text null
- error_detalle text null
- intentos integer
- metadatos jsonb
- creado_en
- actualizado_en
```

No guardar bytes pesados en Postgres.

### 8.3 Biblioteca multimedia normalizada

Agregar una tabla equivalente a:

```text
ejercicio_multimedia
- id uuid
- ejercicio_id uuid
- tipo: imagen | video
- rol
- es_principal boolean
- estado: procesando | listo | error | archivado
- proveedor
- storage_path / provider_uid
- url_miniatura
- url_reproduccion o referencia privada
- ancho, alto, duracion_seg, tamano_bytes
- hash_sha256
- orden
- version_reemplazada_id null
- creado_por
- creado_en
```

Mantener por compatibilidad las columnas actuales de `ejercicios` durante la transición. Cuando se confirma una portada o video principal, sincronizar:

- `foto_miniatura_url`;
- `foto_completa_url`;
- `video_cloudflare_uid` y sus campos relacionados.

El portal del alumno no debe romperse durante la migración.

### 8.4 Reportes resueltos con trazabilidad

Cuando se resuelva un reporte, guardar si el esquema lo permite:

- medio que lo resolvió;
- ingesta que lo resolvió;
- fecha;
- entrenador;
- razón: `foto_asignada`, `video_asignado`, `alias_vinculado`, `resuelto_manual`.

No marcar un reporte como resuelto al seleccionar el archivo. Resolver solo después de que el medio está listo y la asociación definitiva se confirmó.

### 8.5 RLS y permisos

- Solo entrenador o admin puede crear y administrar ingestas.
- El alumno no puede consultar sesiones ni elementos temporales.
- El alumno solo consume multimedia `lista` y vinculada a ejercicios activos.
- No almacenar endpoints de subida de un solo uso más tiempo del necesario.

---

## 9. Motor de coincidencias

Centralizarlo. No crear otro comparador paralelo dentro del componente nuevo.

### 9.1 Fuente única

Extender `src/lib/ejercicios/emparejar.ts` para que el resultado explique:

```ts
type ResultadoMatchMultimedia = {
  ejercicio: Ejercicio | null;
  confianza: "exacta" | "alta" | "media" | "baja" | "ninguna";
  puntuacion: number;
  razones: string[];
  alternativas: Array<{ ejercicio: Ejercicio; puntuacion: number; razones: string[] }>;
  reportesRelacionados: number;
  nombresRutinaRelacionados: number;
};
```

### 9.2 Orden de comparación

1. ID transportado por modo gimnasio o pendiente.
2. Nombre exacto normalizado.
3. Alias exacto normalizado.
4. Slug exacto.
5. Nombre suelto de rutina ya vinculado.
6. Prefijo o tokens, aplicando vetos de zona, equipo y patrón.
7. Similitud aproximada para sugerir, nunca para autoaplicar.

### 9.3 Umbrales

- Exacta o alta sin candidato cercano: puede entrar a `Aplicar seguros`.
- Media: debe confirmarse.
- Baja: ofrecer alternativas y `Crear nuevo`.
- Diferencia pequeña entre primer y segundo candidato: siempre revisar.

### 9.4 Detección de duplicado de ejercicio

Antes de crear:

- buscar nombre y alias normalizados;
- mostrar ejercicios desactivados también;
- mostrar fotografía, grupo, equipo y número de usos;
- ofrecer `Usar existente`, `Reactivar`, `Crear variante distinta` o `Combinar`;
- no crear automáticamente si hay una coincidencia plausible.

---

## 10. Procesamiento de fotografías

Conservar y ampliar `procesarFoto.ts`.

Requisitos:

- JPEG, PNG, WebP, HEIC y HEIF.
- Corregir orientación EXIF.
- Generar miniatura y versión completa.
- Mantener encuadre elegido.
- Detectar resolución insuficiente.
- Detectar archivo corrupto.
- Calcular hash para duplicados.
- Mostrar comparador antes/después al reemplazar una portada.
- Mantener versión anterior recuperable.
- Si hay varias fotos, proponer portada por nitidez, resolución y relación de aspecto, pero permitir cambiarla.
- Revocar cada `URL.createObjectURL` al quitar una fila o desmontar el componente.

No borrar la foto anterior hasta que la nueva versión haya sido procesada, guardada y vinculada exitosamente.

---

## 11. Procesamiento de videos

### 11.1 Formatos y validación

Aceptar MP4, MOV y WebM. Probar además el caso de iPhone donde `File.type` puede estar vacío.

Validar:

- tamaño;
- duración;
- legibilidad del contenedor;
- dimensiones;
- orientación;
- estado final de Cloudflare;
- existencia de miniatura.

### 11.2 Duración

El límite actual de 30 segundos puede seguir siendo el objetivo recomendado, pero no debe convertir un video válido de 34 segundos en trabajo perdido.

Implementar una de estas dos opciones, en este orden de preferencia:

1. Recorte simple de inicio y fin antes de subir.
2. Guardar la fila como `requiere_recorte`, conservando su asociación y permitiendo resolverla después.

No comprimir o transcodificar videos pesados dentro de una Server Action de Vercel.

### 11.3 Subida reanudable

Para lotes y redes móviles, preferir TUS/reanudable cuando el proveedor y la configuración lo permitan. La subida POST directa actual puede mantenerse para archivos pequeños y conexión estable.

La cola debe saber:

- bytes enviados;
- porcentaje;
- intento;
- si puede reanudarse;
- estado de procesamiento.

### 11.4 Reemplazo sin pérdida

Flujo obligatorio:

1. Mantener el video actual activo.
2. Subir el nuevo a un elemento temporal.
3. Esperar estado `listo`.
4. Verificar reproducción o metadatos mínimos.
5. Cambiar el video principal de forma atómica.
6. Archivar el anterior con posibilidad de restauración.
7. Eliminarlo físicamente solo según una política posterior y segura.

Nunca eliminar el UID anterior en `iniciarSubidaVideoCloudflare`.

### 11.5 Miniatura y reproducción

- Elegir miniatura representativa, no necesariamente el 15% fijo.
- Permitir escoger fotograma cuando sea necesario.
- Vista previa igual a la del alumno.
- Reproducción automática, en silencio y en bucle según el diseño existente.
- Mostrar estados claros: local, subiendo, procesando, listo, error.

---

## 12. Cola confiable y trabajo sin señal perfecta

### 12.1 Persistencia local

Usar IndexedDB para conservar:

- archivos seleccionados cuando el navegador lo soporte;
- handles del File System Access API cuando estén disponibles;
- grupos;
- nombre candidato;
- ejercicio elegido;
- roles;
- progreso e intentos.

No usar `localStorage` para bytes.

### 12.2 Persistencia del servidor

Después de iniciar una ingesta, conservar en servidor todos los metadatos y estados. Si el archivo aún existe solo localmente, marcarlo explícitamente.

### 12.3 Recuperación

Al volver a `/admin/ejercicios` mostrar:

```text
Tienes una carga sin terminar
42 listos · 6 requieren revisión · 3 por reintentar
[Continuar]
```

### 12.4 Concurrencia adaptativa

- Imágenes: 2 o 3 cargas simultáneas.
- Videos: 1 o 2 según red y tamaño.
- No subir todos al mismo tiempo.
- Pausar automáticamente ante varios errores de red.
- Botones: `Pausar`, `Continuar`, `Reintentar fallidos`.
- No bloquear la revisión mientras otros archivos suben.

### 12.5 Idempotencia

Cada aplicación debe tener una clave idempotente. Reintentar no puede:

- crear dos ejercicios;
- insertar dos medios iguales;
- cerrar dos veces un reporte de forma inconsistente;
- perder la versión anterior.

---

## 13. Integración con Pendientes y Mesa

### 13.1 Desde Pendientes

En cada tarjeta, incluyendo `Curl Bayesian`, reemplazar la acción limitada por:

`Resolver con foto o video`.

Al abrir:

- ejercicio o nombre pendiente ya viene seleccionado;
- mostrar alumnos/reportes afectados de forma resumida;
- permitir foto, video o ambos;
- ofrecer crear la ficha si todavía no existe;
- mostrar exactamente cuántos pendientes se cerrarán;
- después del éxito avanzar al siguiente pendiente sin regresar al inicio de la lista.

### 13.2 Desde Mesa

Para cada ejercicio:

- `Agregar multimedia` abre la bandeja unificada.
- Acepta foto, video, cámara y varios archivos.
- Si el ejercicio está seleccionado, no volver a pedirlo.
- Después de guardar, actualizar la vista previa y contadores sin búsqueda manual.

### 13.3 Nombre pedido pero ficha inexistente

Al crear desde el aviso `Te pidieron ejercicios que no existen`:

1. Prellenar el nombre.
2. Mostrar usos de rutina.
3. Adjuntar foto o video.
4. Crear ficha rápida.
5. Vincular todas las entradas inequívocas.
6. Resolver reportes por nombre o alias.
7. Retirarlo de Mesa y Pendientes.

### 13.4 Contadores

Los contadores de Galería y `/admin/pendientes` deben derivarse de fuentes reales. No mantener contadores duplicados.

Después de una operación exitosa, revalidar al menos:

- `/admin/ejercicios`;
- `/admin/pendientes`;
- rutas de rutinas que consuman la biblioteca;
- tags de caché de ejercicios.

---

## 14. Diseño de la cola

### 14.1 Resumen fijo

En la parte superior:

```text
86 archivos · 44 ejercicios
31 seguros · 9 para revisar · 4 nuevos
2 errores · 7 reportes se resolverán
```

Filtros:

- Todos.
- Seguros.
- Revisar.
- Nuevos.
- Con errores.
- Fotos.
- Videos.
- Pendientes relacionados.

### 14.2 Acciones de lote

- `Aplicar seguros`.
- `Confirmar seleccionados`.
- `Crear nuevos confirmados`.
- `Reintentar fallidos`.
- `Pausar cargas`.
- `Guardar y continuar después`.

No agregar un `Aplicar todo` que incluya coincidencias ambiguas.

### 14.3 Estados comprensibles

Evitar lenguaje técnico como UID, MIME o endpoint en la interfaz principal.

Usar:

- En este teléfono.
- Esperando conexión.
- Subiendo.
- Preparando video.
- Listo.
- Necesita tu revisión.
- No se pudo subir; reintentar.

Los detalles técnicos pueden estar en `Ver detalle`.

### 14.4 Éxito por grupo

Al completar:

```text
Curl Bayesian quedó listo
✓ Portada actualizada
✓ Video vinculado
✓ 1 reporte resuelto
✓ 3 nombres de rutina vinculados
[Ver como alumno] [Deshacer]
```

---

## 15. Calidad automática

La pestaña `Calidad` debe mostrar trabajo real, no estadísticas decorativas.

Detectar:

- ejercicio sin portada;
- ejercicio sin video;
- medio en error;
- video procesando demasiado tiempo;
- resolución baja;
- orientación extraña;
- duplicado exacto;
- posible duplicado visual;
- portada reemplazada recientemente;
- ejercicio con múltiples reportes;
- ejercicio nuevo sin clasificación;
- alias en disputa;
- archivo huérfano de ingesta;
- medio temporal antiguo.

Priorizar por:

1. número de usos en rutinas activas;
2. número de reportes;
3. alumnos afectados;
4. severidad técnica;
5. antigüedad.

---

## 16. Cambios de componentes y archivos

Los nombres exactos pueden ajustarse a la arquitectura, pero la separación de responsabilidades debe quedar clara.

### 16.1 Reemplazar

- `CargaMasivaFotos.tsx` por un componente unificado, por ejemplo `BandejaIngestaMultimedia.tsx`.

### 16.2 Crear

- `components/admin/galeria/BandejaIngestaMultimedia.tsx`.
- `components/admin/galeria/GrupoMultimedia.tsx`.
- `components/admin/galeria/SelectorDestinoEjercicio.tsx`.
- `components/admin/galeria/AltaRapidaEjercicio.tsx`.
- `components/admin/galeria/ModoGimnasio.tsx`.
- `components/admin/galeria/RecuperarIngesta.tsx`.
- `components/admin/galeria/ProgresoCarga.tsx`.
- `lib/ejercicios/ingesta/archivos.ts`.
- `lib/ejercicios/ingesta/agrupar.ts`.
- `lib/ejercicios/ingesta/matcher.ts`, apoyándose en `emparejar.ts`.
- `lib/ejercicios/ingesta/indexed-db.ts`.
- acciones o Route Handlers pequeños y bien delimitados.
- pruebas unitarias y de integración de cada motor puro.

### 16.3 Modificar

- `GaleriaEjercicios.tsx`: descomponer; hoy concentra demasiadas responsabilidades.
- `actions.ts`: separar foto, video, ingesta, vinculación y resolución de reportes.
- `page.tsx`: entregar datos necesarios sin inflar el cliente.
- `lib/cloudflare/stream.ts`: carga reanudable o estrategia híbrida y reemplazo por staging.
- `lib/ejercicios/tipos.ts`: estados y tipos multimedia.
- `lib/pendientes/data.ts`: enlaces y conteos vinculados a la vista correcta.
- vista del alumno solo en lo necesario para consumir la multimedia principal sin regresiones.

### 16.4 No crear un componente monstruoso

`GaleriaEjercicios.tsx` ya supera ampliamente un tamaño cómodo. La nueva funcionalidad debe reducir su responsabilidad, no agregar otras mil líneas dentro del mismo archivo.

---

## 17. Acciones atómicas

Crear una operación de aplicación por grupo que conceptualmente haga:

1. Verificar autorización.
2. Verificar clave idempotente.
3. Crear o confirmar ejercicio.
4. Vincular alias y nombres de rutina inequívocos.
5. Confirmar medios listos.
6. Elegir medio principal.
7. Sincronizar columnas legadas.
8. Resolver reportes relacionados.
9. Marcar elemento de ingesta aplicado.
10. Registrar auditoría.
11. Revalidar cachés.

Las operaciones de base de datos que deban ser atómicas deben ejecutarse mediante una función SQL/RPC transaccional o una estrategia equivalente. No encadenar actualizaciones críticas suponiendo que todas siempre funcionarán.

Si falla el paso de cierre de reportes, no ocultar el problema. Dejar el grupo en estado parcial y ofrecer `Completar sincronización` de forma idempotente.

---

## 18. Seguridad y privacidad

- Verificar rol en toda acción y ruta.
- Validar tamaño y tipo del lado servidor o proveedor.
- No confiar en el nombre del archivo para su tipo.
- Sanitizar enlaces externos y mantener protección SSRF existente.
- No exponer token de Cloudflare, service role ni credenciales en el cliente.
- Endpoints de subida de un solo uso y duración limitada.
- Escapar nombres mostrados.
- Limitar frecuencia de creación de URLs de carga.
- Registrar quién reemplazó o eliminó multimedia.
- No borrar físicamente medios anteriores durante la misma operación de reemplazo.
- Diseñar limpieza de temporales con período de gracia.
- Si aparecen terceros en los videos, el producto debería mostrar una nota operativa sobre consentimiento; no agregar fricción técnica en cada carga, pero sí dejar una guía visible en Modo gimnasio.

---

## 19. Accesibilidad y uso móvil

- Debe funcionar desde 320 px de ancho.
- Zonas táctiles mínimas de 44 × 44 px.
- No depender de hover.
- No depender de orientación horizontal.
- Cámara, video y archivos como acciones textuales, no iconos solos.
- Navegación con teclado en escritorio.
- Progreso anunciado con `aria-live` sin repetir cada porcentaje.
- Errores asociados a su archivo y resumidos arriba.
- Mantener la acción principal visible con barra inferior fija en móvil.
- Prevenir cierre accidental si hay archivos exclusivamente locales sin sincronizar.
- Respetar `prefers-reduced-motion`.
- Vista previa con texto alternativo útil.

---

## 20. Rendimiento

- No cargar las 120 fichas completas con toda su multimedia en cada render.
- Virtualizar lotes grandes.
- Generar miniaturas locales eficientes y liberar memoria.
- No mantener cien videos montados en el DOM.
- Cargar vista previa de video solo al solicitarla.
- Consultas agrupadas, no N+1 por archivo.
- Hash de archivos en Web Worker cuando el tamaño lo justifique.
- Procesamiento pesado fuera del hilo principal.
- Límites de concurrencia configurables.
- No pasar bytes grandes por Server Actions.

---

## 21. Pruebas obligatorias

### 21.1 Unitarias

- Normalización de nombres con tildes, mayúsculas, guiones y números.
- Agrupación foto + video por prefijo y base.
- No agrupación de ejercicios solo por cercanía temporal.
- Alias exactos.
- Vetos por grupo y equipo.
- Ambigüedad entre dos candidatos.
- Detección de duplicado por hash.
- Estados de una ingesta.
- Reintentos idempotentes.

### 21.2 Integración

- Crear ejercicio nuevo con foto.
- Crear con video.
- Crear con foto + video.
- Crear desde un reporte sin `ejercicio_id` y resolverlo por nombre.
- Asignar a ejercicio existente y cerrar todos sus reportes.
- Vincular nombres de rutina.
- Fallo de foto después de crear ficha.
- Fallo de video sin borrar el anterior.
- Reintento después de red interrumpida.
- Reemplazo y restauración.
- Ingesta parcial recuperada.

### 21.3 Navegador móvil real o emulado

Probar como mínimo:

- 320 × 568.
- 360 × 800.
- 390 × 844.
- 430 × 932.
- tablet vertical.
- escritorio.

### 21.4 Matriz de archivos

- JPG grande.
- PNG transparente.
- WebP.
- HEIC vertical con EXIF.
- HEIF.
- MP4 de Android.
- MOV de iPhone.
- WebM.
- video de 29 s.
- video de 31–35 s.
- video mayor de 100 MB.
- MIME vacío.
- archivo corrupto.
- duplicado exacto.
- nombres con emojis, espacios y tildes.

### 21.5 Prueba de carga real

Construir una prueba reproducible con al menos:

- 60 imágenes;
- 30 videos;
- 20 conjuntos foto + video;
- 10 ejercicios existentes exactos;
- 5 por alias;
- 5 ambiguos;
- 5 nuevos;
- 3 reportes pendientes;
- una desconexión simulada.

Verificar que no se pierda ninguna decisión y que `Aplicar seguros` no asigne un medio ambiguo.

---

## 22. Criterios de aceptación

La implementación no está terminada hasta que se cumpla todo:

- [ ] Un selector acepta fotos y videos mezclados.
- [ ] Foto y video del mismo ejercicio se agrupan.
- [ ] Una fila sin coincidencia permite crear su ejercicio sin salir del flujo.
- [ ] El alta rápida permite archivo de video directamente.
- [ ] Nombre es el único dato textual imprescindible en terreno.
- [ ] Clasificación incierta queda pendiente sin contaminar el generador.
- [ ] Pendientes muestran cuántos reportes se resolverán.
- [ ] Los reportes se cierran solo después de éxito definitivo.
- [ ] Los nombres de rutina inequívocos quedan vinculados.
- [ ] El ejercicio desaparece de Pendientes y Mesa cuando corresponde.
- [ ] Los contadores se actualizan.
- [ ] Se conserva la cola después de recargar.
- [ ] Hay reintento de fallidos.
- [ ] El reemplazo de video conserva el anterior hasta que el nuevo esté listo.
- [ ] El reemplazo de foto sigue siendo recuperable.
- [ ] La interfaz soporta 100 archivos sin congelarse.
- [ ] Funciona sin girar el teléfono.
- [ ] La vista previa coincide con el portal del alumno.
- [ ] No hay errores de consola.
- [ ] TypeScript, lint, pruebas y build pasan.

---

## 23. Orden de implementación recomendado

### Fase 1 — Ganancia inmediata

1. Unificar selector para fotos y videos.
2. Agregar `Crear ejercicio con este material` en filas sin coincidencia.
3. Permitir archivo de video en alta nueva.
4. Reducir el alta rápida a nombre + sugerencias.
5. Integrar desde Pendientes y Mesa.
6. Revocar vistas previas locales.

Esta fase debe ser utilizable aunque la arquitectura avanzada todavía no esté completa.

### Fase 2 — Confiabilidad

1. Sesiones e items de ingesta.
2. Persistencia IndexedDB + servidor.
3. Reintentos e idempotencia.
4. Concurrencia limitada.
5. Recuperación después de recarga.

### Fase 3 — Multimedia normalizada

1. Tabla multimedia.
2. Varias fotos y roles.
3. Staging seguro de video.
4. Restauración de video.
5. Compatibilidad con columnas actuales.

### Fase 4 — Modo gimnasio y calidad

1. Lista de grabación.
2. Captura secuencial.
3. Agrupación automática.
4. Recorte simple.
5. Calidad y limpieza de huérfanos.

No dejes la aplicación rota entre fases. Cada fase debe incluir migración, compatibilidad y pruebas.

---

## 24. Qué no hacer

- No crear una segunda galería separada.
- No resolverlo solo agregando `accept="video/*"` al input existente.
- No mandar videos grandes a través de una Server Action.
- No aplicar coincidencias ambiguas automáticamente.
- No usar valores de clasificación falsos para crear rápido.
- No borrar el video anterior antes de verificar el nuevo.
- No perder la cola en un refresh.
- No exigir que el entrenador renombre perfectamente todos los archivos.
- No forzar a crear primero, buscar después y volver a subir.
- No esconder errores en un toast fugaz.
- No bloquear todo el lote por un solo archivo fallido.
- No inflar todavía más `GaleriaEjercicios.tsx`.
- No cerrar manualmente reportes que pueden derivarse del resultado real.

---

## 25. Entrega que Claude debe dejar

Al terminar, Claude debe entregar:

1. Resumen de lo implementado por fase.
2. Lista de migraciones creadas.
3. Archivos modificados.
4. Automatizaciones incorporadas.
5. Casos que requieren confirmación humana.
6. Comandos de verificación ejecutados y resultados.
7. Evidencia de prueba móvil.
8. Riesgos o configuración externa pendiente, especialmente Cloudflare.
9. Instrucciones breves para que el entrenador use Modo gimnasio y Subir y organizar.
10. Nada de push ni despliegue.

---

## 26. Prompt final listo para copiar a Claude

```text
Lee completo INSTRUCTIVO_CLAUDE_GALERIA_MULTIMEDIA_CARGA_MASIVA.md y ejecútalo en el repositorio Portal VIP.

No me entregues otro análisis: implementa el sistema por fases y verifica cada fase. Preserva los cambios existentes y lee primero AGENTS.md y la documentación local de esta versión de Next.js.

La prioridad absoluta es que el entrenador pueda seleccionar o capturar muchas fotos y videos mezclados, y que el sistema los agrupe, vincule, cree ejercicios cuando no existan, cierre pendientes y conserve el progreso aunque falle la conexión. El alta rápida no debe obligar a completar clasificaciones ni a crear primero para después volver a subir un video.

Reutiliza el matcher, procesamiento de fotos, integración de Cloudflare, cierre de reportes, fusiones y versionado existentes. No apliques matches ambiguos. No borres medios anteriores hasta verificar los nuevos. No agregues toda la solución dentro de GaleriaEjercicios.tsx.

Ejecuta TypeScript, lint, pruebas, build y verificación visual móvil. No hagas commit, push, PR ni deploy. Al final informa exactamente qué quedó implementado, qué automatiza el sistema y cualquier configuración externa pendiente.
```

---

## 27. Principio final

La Galería no debe ser un formulario de mantenimiento. Debe funcionar como un asistente de producción:

> El entrenador graba. La aplicación recuerda, organiza, propone, sube, vincula y limpia. El entrenador solo decide aquello que realmente requiere criterio humano.
