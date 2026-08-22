# Handoff — Estado del repo y pendientes consolidados

Fecha: 2026-08-22.

## Mensaje para la próxima sesión

Empieza por acá, no por los otros 58 `.md`. En orden de lectura:

1. **`git log --oneline -3`**: local tiene 3 commits que `origin/main` no
   tiene (Impulso VIP Fases 0-5 + 2 de docs). **No los pushees sin que
   Alejandro lo pida explícitamente** — es la regla de `CLAUDE.md` para este
   trabajo específico, no una preferencia general.
2. Si Alejandro te pide seguir con **Impulso VIP**: lee
   `INSTRUCTIVO_CLAUDE_IMPULSO_VIP_V2_PUNTA_A_PUNTA.md` completo primero (es
   el documento maestro), después la sección "Impulso VIP V2" más abajo en
   este handoff para saber exactamente dónde quedó cada fase. Fase 5 quedó a
   mitad de camino (2 de 7 puntos); Fases 6 y 7 sin empezar.
3. Si te pide seguir con **Club VIP V2**: no arranques todavía. Lee la
   sección "Club VIP V2" más abajo — depende de que Impulso VIP esté
   pusheado y aprobado primero, porque comparten el mismo libro contable
   nuevo.
4. El resto de las secciones (`Videos`, `Rediseño Entrenar`, `Generador de
   Rutinas`, `Control VIP V2`) son independientes entre sí — se puede entrar
   directo a cualquiera si Alejandro pide otra cosa.
5. Antes de dar por buena cualquier afirmación vieja de este documento
   (incluida esta), verifícala contra el código o la base — esta misma
   sesión encontró dos secciones desactualizadas (estado del repo, video
   Cloudflare) que decían algo que ya no era cierto.

## Por qué existe este documento

Hay 58 archivos `.md` sueltos en la raíz del repo (handoffs, instructivos e
informes de sesiones distintas, varios contradictorios entre sí sobre qué
está "pendiente"). El propio `HANDOFF_GENERADOR_RUTINAS_CLAUDE.md` (punto 9,
"Orden de los `.md` sueltos en la raíz") ya señalaba esto como una tarea sin
hacer. Este documento no reemplaza a ninguno de esos archivos — los reúne,
para que la próxima sesión no tenga que releer 58 documentos para saber qué
falta. Si algo acá contradice a un instructivo específico más nuevo, gana el
instructivo específico.

## Estado del repo al cerrar esta sesión

- `main` local está en `1bdb9fd`, **3 commits adelante de `origin/main`**
  (`0dac2ca`, verificado con `git fetch` — no pusheados, a propósito: son las
  Fases 0-5 de Impulso VIP y no deben pushearse sin autorización expresa de
  Alejandro). `origin/main` en sí mismo ya no es `199e033`: avanzó por otra
  sesión de Claude en paralelo (ver Club VIP V2 abajo) mientras esta corría.
- Sin worktrees activos salvo el checkout principal (`C:\dev\vip-fitness`).
- Ramas remotas: solo `main` y `feature/rediseno-entrenar-clasico` (ver
  abajo). Las otras 19 ramas vivas al empezar esta limpieza (2026-08-21) se
  compararon funcionalmente contra `main` —no solo por hash— y se borraron
  por estar 100% absorbidas.
- `respaldo-cloud-ia-2026-08-09.bundle` (2.21 GB, confirmado redundante:
  cada commit/tag/rama que contiene ya está en `main` o en GitHub) vive en
  `C:\dev\vip-fitness-backups\2026-08-09-respaldo-cloud-ia\`, fuera del
  repo activo. No se borró — decisión pendiente del usuario, sin apuro.
- `.claude/settings.local.json` está correctamente excluido (ignorado, no
  rastreado).
- `_fotos_ejercicios_staging/` (340 MB) NO es caché: está versionado en git
  a propósito, con seguimiento propio en `_pendientes_procesamiento.md`
  (que a su vez dice que el trabajo de fotos ya fue procesado el 14/08).
  No tocar sin releer ese archivo primero.
- Commit `199e033` ("reiniciar sesion/plan, sacar bloqueo de cupo, avisar
  cupo agotado") lo hizo otra sesión de Claude trabajando en paralelo sobre
  este mismo `main` el 2026-08-21/22 — no forma parte de esta limpieza, se
  documenta acá solo para que quede el rastro de por qué `main` avanzó
  durante la sesión de limpieza.

## Pendientes reales, consolidados por área

### Videos de ejercicios atascados en "procesando" — RESUELTO esta sesión
Empezó por dos capturas de Alejandro ("Curl con barra EZ" y "Curl en banco
predicador" sin reproducirse en `/portal-v2`). Causa raíz: 17 ejercicios
con `ejercicios.video_cloudflare_estado = 'procesando'` (algunos desde hacía
23 días), y `videoCloudflareListo` exige literalmente `estado === "listo"`
para reproducir el clip. Conseguido un token válido de la cuenta correcta de
Cloudflare Stream, se corrió `sincronizarVideoCloudflare` contra los 17 y
quedó verificado en la base real (2026-08-22): **0 ejercicios en
"procesando"** (`select count(*) from ejercicios where
video_cloudflare_estado = 'procesando'` → 0; los dos casos originales están
en `"listo"`). No fue necesario escribir código nuevo.

**Sigue sin hacerse** (pedido explícito de Alejandro, aparte del bug): un
relevamiento de TODAS las secciones de `/portal-v2` que muestran video (no
solo la sesión activa), con una lista concreta de dónde debe reproducirse
cada clip dentro de su recuadro — nunca la versión vieja de foto+overlay a
pantalla completa. Esta sesión no llegó a hacer ese relevamiento.

### Impulso VIP V2 — Fases 0 a 5 implementadas en el working tree, nada pusheado
Documento vigente: `INSTRUCTIVO_CLAUDE_IMPULSO_VIP_V2_PUNTA_A_PUNTA.md`
(prevalece sobre cualquier indicación anterior ambigua, 8 fases). Contexto
histórico: `HANDOFF_IMPULSO_VIP_CLAUDE.md` (encargo original, ya superado).
Esta sesión (2026-08-22) avanzó fase por fase con reporte y autorización de
Alejandro entre cada una. **Nada de esto está pusheado ni desplegado** — sigue
solo en el working tree local, esperando autorización expresa antes de push
(regla explícita del instructivo y de `CLAUDE.md`). Gate completo (eslint,
`tsc --noEmit`, vitest, `next build`) verde en todas las fases.

- **Fase 0 (auditoría)**: confirmó en vivo que los 4 diagnósticos del
  instructivo seguían vigentes (mancuernas sin cap de salto, historial no
  comparable entre asignaciones, un solo tipo de intervención, sin línea de
  tiempo de sesión).
- **Fase 1 (política de carga)**: `src/lib/impulso-vip/politica-carga.ts`
  (nuevo, funciones puras) — cap real de 2.5kg/decisión para mancuernas
  (antes saltaba libre), snap a inventario real si existe. `alejandro.ts` y
  `motor.ts` reescritos para usarlo.
- **Fase 2 (historial comparable)**: `data.ts`/`politica-carga.ts` — el
  historial que alimenta el motor ahora cruza distintas asignaciones del
  mismo ejercicio (antes solo miraba una), con guarda de anomalías
  (`esComparableEntreAsignaciones`) para no mezclar peso-unitario con
  suma-del-par.
- **Fase 3 (orquestador de 5 clases)**: `en-vivo.ts` — implementó
  orientación/adaptación/seguridad/reto (reconocimiento sigue sin lógica de
  disparo, ver pendientes). Encontró y corrigió 2 bugs de ciclo de vida
  propios de esta fase antes de reportarla: el gate de calibración RIR no
  distinguía clase, y `limitarMomentosPorPreparacion` recortaba
  posicionalmente sin importar la clase (podía tapar un aviso de seguridad).
- **Fase 4 (experiencia Portal V2)**: `SesionActivaV2.tsx`/`.module.css` —
  reto sigue siendo el modal a pantalla completa sin cambios; orientación/
  adaptación/seguridad ahora es una banda no bloqueante arriba de la
  pantalla. Etiqueta "kg c/u" en mancuernas (`etiquetaPeso()`). Verificado
  en navegador real (no solo tipos/tests): encontró y corrigió un bug
  encontrado en vivo — completar la serie sin tocar "descartar" dejaba la
  banda pegada en pantalla (el auto-resuelto silencioso no limpiaba el
  estado ni corría en modo demo).
- **Fase 5 (control del entrenador) — 2 de 7 puntos, el resto pendiente**:
  auditó los 7 puntos del instructivo contra el código real antes de tocar
  nada (evitó duplicar lo que ya existía). Hechos: **configuración por
  asignación** (`ConfiguracionProgresionPanel.tsx`, nuevo — progresión on/off,
  tipo, salto de carga, RIR objetivo por ejercicio; antes solo se podía fijar
  una vez al generar la rutina y `rir_objetivo` no tenía ninguna UI) y
  **explicación de la decisión** (`ExplicacionRecomendacionesPanel.tsx`,
  nuevo, solo lectura — regla, motivos y qué historial se usó por cada
  recomendación reciente; deliberadamente NO muestra una "confianza"
  inventada porque el motor no calcula ni persiste ese dato por alumno hoy).
  Verificado con queries reales contra producción (solo lectura, vía MCP de
  Supabase) además del gate completo — no con captura de pantalla real
  porque esta ruta no tiene modo demo sin sesión de entrenador/admin.
  **Pendiente, sin empezar**: configuración de carga del ejercicio (falta
  modelo de datos: modalidad, etiqueta, inventario — hoy solo existe un
  `equipo` de texto libre), línea de tiempo de sesión, simulador. El punto
  "anomalías de carga" de esta fase se pisa con toda la Fase 6 (ver abajo) —
  decisión: resolverlo ahí directamente, no duplicar una cola de revisión.
- **Fases 6 y 7**: sin empezar. Fase 6 (auditoría de datos históricos) tiene
  un caso de prueba ya identificado en el instructivo (Nicolás,
  15/16/20/32/35). Fase 7 (despliegue gradual) depende de que Alejandro
  autorice expresamente el push, y de que las fases anteriores estén
  cerradas.

Huecos documentados a propósito, no bugs: la clase "reconocimiento" nunca
tuvo lógica de disparo definida (¿cuándo confirma algo breve? no hay spec);
`seleccionarDestacadosSesion` en `en-vivo-data.ts` limita a 1-2 ejercicios
por sesión sin distinguir clase, así que un aviso de seguridad en un
ejercicio no destacado todavía no se muestra.

### Club VIP V2 — propuesta aprobada, sin empezar, NO tocar todavía
Documento: `INSTRUCTIVO_CLAUDE_CLUB_VIP_V2.md` (2026-08-22, 1555 líneas — no es
trabajo de esta sesión, lo escribió otra sesión de Claude en paralelo sobre
este mismo `main`). Reemplaza Ranking + Comunidad por un destino nuevo
"Club" en la barra inferior de Portal V2 (Entrenar/Nutrición/Dashboard/
Club/Más — sin "Inicio"), con 4 pestañas (Hoy/Arena/Comunidad/Premios)
reproduciendo una maqueta HTML aprobada pixel a pixel. Reescribe además toda
la economía de puntos en un libro contable nuevo append-only
(`club_vip_movimientos`), separando XP de carrera / Saldo VIP / Puntaje de
temporada — hoy todo eso vive mezclado en `puntos_vip_movimientos`.

**Por qué esperar**: la sección 22.2 de ese instructivo liquida la
bonificación de Impulso VIP (máx. 60 por sesión) dentro de ese mismo libro
contable nuevo — exactamente la pieza que esta sesión estuvo reescribiendo en
paralelo (ver Impulso VIP arriba) sin haberla commiteado hasta ahora. `CLAUDE.md`
ya lo marca explícito: no empezar Club VIP V2 hasta que Impulso VIP En Vivo
quede cerrado y aprobado, para no duplicar ni chocar. Como esta sesión recién
commiteó Fases 0-5 de Impulso VIP (sin pushear ni aprobar todavía), Club VIP
V2 sigue bloqueado por ese motivo — no es simple orden de prioridad, es una
dependencia real de datos.

### Rediseño "Entrenar" (portal clásico) — primera sesión de varias
Rama: `feature/rediseno-entrenar-clasico` (viva en GitHub, sin PR a
propósito — se abre cuando el bloque completo esté terminado, acuerdo
vigente con Alejandro). Handoff: `HANDOFF_REDISENO_PORTAL_CLASICO.md` en esa
misma rama. Último commit ahí: `8806203`. Arrancó por pedido de Alejandro
tras probar la pantalla como entrenador y encontrarla confusa comparada con
portal-v2.

### Generador de Rutinas VIP — 7 pendientes abiertos
Documento: `HANDOFF_GENERADOR_RUTINAS_CLAUDE.md` (sigue siendo "trabajo
activo" en `CLAUDE.md`). En orden recomendado por ese mismo documento:
1. Selector de ejercicios y vista previa fuera del generador.
2. ~~Multi-alumno real~~ — resuelto, commit `16e9bbd`.
3. Metadatos de ejercicios editables en la galería administrativa +
   selección visual de sustitutos.
4. Sub-grupos de pierna / enfoque de forma como dato estructurado (hoy es
   heurística por nombre en `motor.ts`).
5. Reemplazo y regeneración parcial (un ejercicio, un día, sin destruir el
   resto del borrador).
6. Usar historial + Impulso VIP para orientar el Generador.
7. Modelar disponibilidad de sala (máquinas, estaciones, capacidad).
8. CRUD visual de técnicas de entrenamiento.
9. Este mismo punto: ordenar los `.md` sueltos de la raíz.

### Control VIP V2 (panel nuevo del entrenador) — Fases 0-6 ya en producción
Documentos: `docs/PROYECTO_CONTROL_VIP_V2.md` (visión original),
`docs/CONTROL_VIP_V2_INVENTARIO.md` (inventario de rutas/permisos, léelo
antes de tocar nada de `/control-vip/**`). Pendiente si se retoma:
- Estudio VIP: restringir "publicar" a solo el propietario (hoy cualquier
  entrenador/admin con el piloto activado puede publicar).
- Comparación visual entre versiones del historial de Estudio VIP.
- Comando global (`Ctrl/Cmd+K`) todavía no busca ejercicios ni rutinas
  guardadas, solo destinos y alumnos.
- `/admin/configuracion` y notificaciones del entrenador sin pantalla V2:
  decisión deliberada (bajo valor), no un olvido.

### Portal V2 (alumno) — dos pendientes menores, pedido de Alejandro 2026-08-22 — RESUELTOS esta misma sesión
1. **Nombre del alumno en la pantalla principal de Entrenar** — hecho en
   `EntrenamientoInicioV2.tsx`: "Hola, {primer nombre} · ..." en la línea de
   fase, mismo patrón que ya usaba `ProgresoDashboardV2.tsx`. `nombre` llega
   como prop nueva desde `portal-v2/entrenamiento/page.tsx`
   (`contexto.nombre`, ya disponible ahí, sin consulta nueva).
2. **Versión de la app al final de "Más"** — hecho en `MasV2.tsx`: se
   completó una línea que ya existía como placeholder
   (`VIP FITNESS V2 · MÉTODO VIP`) con el commit corto de Vercel
   (`leerDespliegueActual()` de `novedades-deploy.ts`, el mismo mecanismo ya
   probado que alimenta el historial de Novedades — no se inventó una fuente
   nueva). Solo aparece en producción; en local/preview la línea queda igual
   que antes, sin versión.

No se tocó el panel admin (`/admin/mas`) — el pedido fue específicamente
sobre portal-v2. Verificado: tsc, lint, 710 tests, build, todo verde.

## Pendiente sin dueño claro: orden de los 58 `.md` de la raíz

No se auditó archivo por archivo en esta sesión (se decidió no hacerlo sin
pedido explícito). Candidatos obvios a revisar/archivar en una próxima
pasada, por nombre: la serie `HANDOFF_1.md` a `HANDOFF_1.33.md` (33
archivos, casi con certeza historial de sesiones muy viejas ya superadas por
documentos con nombre propio como este), más `CONTINUIDAD_PROYECTO.md`,
`HANDOFF_FINAL.md`, `HANDOFF_CLAUDE_2026-07-30.md`,
`RECUPERACION_POST_D20A18B.md`, `INFORME_ERROR_SCROLL_NUTRICION.md`,
`INFORME_ENTRENAMIENTO_ACTIVO_2026-08-14.md`. No se confirmó contenido de
ninguno — antes de borrar o mover cualquiera, hay que leerlo entero, igual
que se hizo con los archivos del worktree de Codex en la limpieza del
2026-08-21.
