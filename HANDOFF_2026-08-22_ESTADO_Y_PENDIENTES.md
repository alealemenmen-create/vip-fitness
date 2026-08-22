# Handoff — Estado del repo y pendientes consolidados

Fecha: 2026-08-22 (actualizado, misma fecha, sesión posterior a la que abrió
este documento — ver "Historial de este documento" al final).

## Mensaje para la próxima sesión

Empieza por acá, no por los otros `.md` sueltos de la raíz. En orden de
lectura:

1. **`git status` y `git log --oneline origin/main..main`** primero que
   nada. A la fecha de este párrafo: `main` local tiene **10 commits** que
   `origin/main` no tiene, pero en la práctica es **una sola pieza real**:
   todo el motor de Impulso VIP V2 (Fases 0-6, ~2175 líneas en 32 archivos —
   confirmado con `git diff --stat origin/main main`). Todo lo demás de esta
   sesión (fixes de video/galería, saludo por nombre, versión de la app, los
   docs) **ya está pusheado**. **No pushees el resto de Impulso VIP sin que
   Alejandro lo pida explícitamente** — regla de `CLAUDE.md`, confirmada de
   nuevo por Alejandro en esta sesión.
2. Si te pide seguir con **Impulso VIP**: lee
   `INSTRUCTIVO_CLAUDE_IMPULSO_VIP_V2_PUNTA_A_PUNTA.md` completo primero (es
   el documento maestro), después la sección "Impulso VIP V2" más abajo. Fase
   6 ya está completa y verificada con datos reales (ver abajo). Fase 5 sigue
   a mitad de camino (2 de 7 puntos). Fase 7 sin empezar.
3. **Importante sobre el push parcial**: la Fase 6 (y cualquier trabajo
   nuevo sobre paneles del entrenador) importa componentes que creó la Fase 5
   (`ConfiguracionProgresionPanel.tsx`, `ExplicacionRecomendacionesPanel.tsx`,
   etc.). Como esos componentes viven solo en el `main` local, **no se puede
   cherry-pickear un commit nuevo de Impulso VIP hacia `origin/main` sin
   arrastrar esas piezas también** — ya pasó en esta sesión (conflicto real,
   resuelto abortando el cherry-pick). Si Alejandro pide pushear "solo lo de
   hoy" y hay código nuevo de Impulso VIP de por medio, avisale este acoplamiento
   antes de improvisar una solución.
4. Si te pide seguir con **Club VIP V2**: no arranques todavía. Sigue
   bloqueado por Impulso VIP sin pushear (ver sección abajo).
5. El resto de las secciones (`Galería/videos`, `Rediseño Entrenar`,
   `Generador de Rutinas`, `Control VIP V2`) son independientes entre sí — se
   puede entrar directo a cualquiera si Alejandro pide otra cosa.
6. **Antes de dar por buena cualquier afirmación vieja de este documento**
   (incluida esta), verifícala contra el código o la base. Dos sesiones
   seguidas ya encontraron secciones desactualizadas acá mismo — no es
   hipotético.
7. Si te toca revisar el estado del repo o del historial de un alumno y no
   tenés acceso MCP de Supabase autorizado: `.env.local` tiene
   `SUPABASE_SERVICE_ROLE_KEY` real (el mismo que usa la app) — se puede usar
   con `@supabase/supabase-js` directo en un script Node desechable
   (`node --env-file=.env.local script.mjs`, **nunca commitear ese script**)
   para consultas de solo lectura. Sirve para leer/escribir filas via REST,
   pero **no puede ejecutar DDL** (`CREATE TABLE`, etc.) — para eso hace
   falta el SQL Editor del dashboard (Alejandro lo corre) o un token de
   acceso de Supabase para enlazar el CLI (`supabase link`, pendiente,
   Alejandro dijo que lo da "después").

## Por qué existe este documento

Hay más de 58 archivos `.md` sueltos en la raíz del repo (handoffs,
instructivos e informes de sesiones distintas, varios contradictorios entre
sí sobre qué está "pendiente"). Este documento no los reemplaza — los reúne,
para que la próxima sesión no tenga que releerlos todos para saber qué
falta. Si algo acá contradice a un instructivo específico más nuevo, gana el
instructivo específico.

## Estado del repo ahora mismo

- `main` local: `4621ad4`. `origin/main`: `0855501`. **Divergieron a
  propósito** — no es un error, no hagas `git pull` sin leer el punto 3 de
  arriba primero. Confirmado con `git diff --stat origin/main main`: la
  única diferencia real de contenido es Impulso VIP V2 completo (Fases 0-6).
- **Ya pusheado a `origin/main` en esta sesión** (dos tandas, cada commit
  aplicado con cherry-pick directo sobre `origin/main` para no arrastrar
  Impulso VIP — por eso los hashes en remoto son distintos a los locales
  aunque el contenido sea el mismo):
  - Fix real recuperado de un commit huérfano (ver abajo) — avance incorrecto
    de Impulso VIP durante la sesión activa.
  - Video de ejercicio reproduciéndose inline en la Biblioteca (antes solo
    foto + botón a overlay).
  - Botón "Actualizar catálogo" conectado (existía pero no se renderizaba en
    ninguna pantalla) + link "1 · Cargar" corregido (llevaba a Biblioteca en
    vez de a Carga masiva).
  - Saludo "Hola, {nombre}" en la pantalla principal de Entrenar (portal-v2)
    y versión real de la app (commit corto de Vercel) al final de "Más".
  - Este mismo documento.
- **Sin pushear, a propósito** (regla explícita, ver arriba): Fases 0-6 de
  Impulso VIP V2 completas en el working tree/`main` local, sin probar en
  vivo con una sesión real de entrenamiento.
- Rama local extra `recuperado/portal-v1-organizacion`: apunta a un commit
  que estuvo a punto de perderse (ver "Commit recuperado" abajo). Ya está
  fusionado en `main` — esta rama es solo un respaldo, se puede borrar
  cuando alguien confirme que ya no hace falta como referencia.
- Sin worktrees activos salvo el checkout principal (`C:\dev\vip-fitness`).
  El worktree `C:\dev\vip-fitness-v1-claude` mencionado en handoffs previos
  **ya no existe** — se borró en algún momento sin que quedara registro de
  quién ni cuándo; solo sobrevivía una carpeta `.next` vacía. Su único
  commit real se recuperó (ver abajo). Si en algún momento se vuelve a crear
  un worktree aislado para trabajo paralelo, **no lo borres nunca sin
  primero confirmar que su trabajo está mergeado o descartado a propósito**
  — así se perdió este.
- Archivos sueltos sin trackear, no tocados esta sesión (no son míos, no sé
  su origen): `INSTRUCTIVO_CLAUDE_CLUB_VIP_V2.md` en la raíz y
  `supabase/.temp/` (carpeta de trabajo del CLI de Supabase, probablemente
  se puede gitignorar).
- Resto del estado (ramas remotas, backup bundle, `_fotos_ejercicios_staging/`)
  sin cambios desde la última vez que se confirmó — ver el historial de este
  documento si hace falta el detalle exacto.

## Commit recuperado: fix real de Impulso VIP que casi se pierde

Hallazgo de esta sesión, documentado en detalle porque puede volver a pasar.
`HANDOFF_CLAUDE_PORTAL_V1_RESULTADO.md` e `INVENTARIO_CONTROL_PORTAL_V1.md`
(21-ago, 23:04) describen una sesión de Claude que trabajó en el worktree
`vip-fitness-v1-claude` (rama `claude/portal-v1-organizacion`) y dejó un
commit real, firmado con la cuenta de Alejandro, que corregía un bug
prioritario: la encuesta general de fin de ejercicio se habilitaba antes de
que el alumno viera el resultado de un reto de Impulso VIP, tapándolo. Ese
commit **nunca se mergeó ni se pusheó**, y el worktree se borró — el commit
quedó como objeto huérfano en la base de git, a un `git gc` de desaparecer
para siempre. Ninguno de los handoffs consolidados posteriores lo mencionaba.

Se recuperó (`git fsck --unreachable`, rama de respaldo
`recuperado/portal-v1-organizacion`), se comparó contra el fix equivalente
que **otra sesión ya había hecho de forma independiente un día después**
(mismo bug, mejor UX pero con una regla más laxa para mensajes personales de
Ale), se reconciliaron ambas versiones quedándose con lo mejor de cada una, y
se verificó con el gate completo. Ya está pusheado a `origin/main`.

**Lección para la próxima sesión**: antes de dar por completo un
relevamiento de "qué falta", vale la pena correr `git fsck --unreachable`
sobre el repo — puede haber más commits huérfanos de sesiones que se
cortaron sin avisar. Esta sesión encontró ~50 más, pero corresponden a la
limpieza de ramas ya documentada y revisada del 2026-08-21 (no son casos
nuevos, se confirmó comparando mensajes de commit y fechas).

## Pendientes reales, consolidados por área

### Galería/videos de ejercicios — relevamiento hecho, 1 de 2 candidatos corregido
Pedido explícito de Alejandro: mapear todas las secciones de `/portal-v2`
que muestran video de ejercicio, y decir cuáles siguen con el patrón viejo
(foto quieta + botón que abre un overlay a pantalla completa) en vez del
nuevo (video reproduciéndose dentro de su propio recuadro). Relevamiento
completo hecho esta sesión — 12 secciones revisadas, la mayoría solo muestra
foto sin video. Dos candidatos encontrados:

1. **`BibliotecaEjerciciosV2.tsx` (ficha de detalle)** — **CORREGIDO** esta
   sesión. Ahora reproduce el video inline (mudo, automático) dentro del
   recuadro, igual que ya hacía `FichaEjercicioActiva`; el botón se
   renombró a "Ampliar video" para la misma opción de siempre (ver con
   sonido/controles en overlay), no se sacó nada.
2. **`FichaEjercicioActiva` en `SesionActivaV2.tsx`** — **sin tocar, a
   propósito**. Ya tiene el mecanismo nuevo (inline) como comportamiento
   base, pero conserva el botón "Ampliar video" que abre el overlay viejo
   como acción secundaria explícita (ver con sonido). No quedó claro si esto
   cuenta como el "antipatrón a corregir" o como un uso legítimo — pendiente
   de que Alejandro decida antes de tocarlo.

También encontrado (fuera de portal-v2, no se tocó): `SesionEjercicioCard.tsx`
(ruta clásica `/alumno/entrenar`) tiene un modo "video ambiente en el
cuadro" ya construido pero apagado a propósito
(`VIDEO_EN_CUADRO_ACTIVO = false`, comentario de Alejandro 2026-08-17 sobre
no poder verificarlo en su momento) — podría ser la referencia si algún día
se quiere portar el mismo enfoque a más lugares.

### Panel de administración `/admin/ejercicios` — auditoría hecha, 3 de alta confianza corregidos, 2 preguntas abiertas
Pedido de Alejandro: "tiene cosas que nunca se usan". Auditoría completa de
`GaleriaEjercicios.tsx` (3847 líneas), `actions.ts`, `ingestaActions.ts`,
`multimediaActions.ts`. Hallazgo tranquilizador: el sistema de "ingesta"
(carga masiva) **no duplica** la subida de archivos — reusa las mismas
Server Actions clásicas por debajo, solo agrega una capa de persistencia de
cola encima. El temor de "dos sistemas paralelos" de una auditoría anterior
no se confirmó a nivel de servidor.

Corregidos esta sesión (ya pusheados):
- `BotonRefrescarCatalogo.tsx` estaba completo y funcional pero nunca se
  renderizaba en ninguna pantalla — **conectado** en el header de
  `/admin/ejercicios` y `/control-vip/galeria` (no se borró: resuelve un
  problema real, forzar el refresco del caché de 1h cuando se edita la
  tabla de ejercicios directo en Supabase).
- La tarjeta "1 · Cargar" del header llevaba a la pestaña Biblioteca en vez
  de a Carga masiva — **corregido** el link y agregado el ancla
  `#carga-masiva-ejercicios` que faltaba en `GaleriaEjercicios.tsx`.
- Comentario desactualizado que decía "4 pestañas" cuando ya son 6 (se
  agregaron "Mesa" y "Referencia" sin actualizar el comentario) —
  **corregido**.

**Dos preguntas sin responder, hechas a Alejandro, sin decisión tomada
todavía** — no tocar sin su respuesta:
1. Hay dos lugares distintos para subir/cambiar una foto de un ejercicio
   (pestaña "Mesa" y el modal de "Biblioteca") — es intencional por diseño
   (comentario explícito en el código), pero ¿usa las dos en el día a día o
   sobra una?
2. La pestaña "Mesa" y la pestaña "Pendientes" muestran en parte el mismo
   problema (reclamos de fotos de alumnos) de dos formas distintas — ¿usa
   las dos, o conviene unificar?

Hallazgo menor, no corregido (muy bajo impacto): `guardarVideoEjercicio` en
`actions.ts` está exportada pero solo se llama desde dentro del mismo
archivo — se podría sacar el `export`, cosmético.

### Impulso VIP V2 — Fases 0-6 completas en `main` local, sin pushear
Documento vigente: `INSTRUCTIVO_CLAUDE_IMPULSO_VIP_V2_PUNTA_A_PUNTA.md`
(8 fases). Contexto histórico: `HANDOFF_IMPULSO_VIP_CLAUDE.md` (encargo
original, superado). Gate completo (`tsc --noEmit`, lint, vitest, `next
build`) verde en todo lo implementado hasta ahora.

- **Fases 0-4**: sin cambios desde la sesión anterior — ver el historial de
  este documento si hace falta el detalle fase por fase.
- **Fase 5 (control del entrenador) — sigue en 2 de 7 puntos.** Hechos:
  configuración por asignación, explicación de la decisión. **Pendiente**:
  configuración de carga del ejercicio (falta modelo de datos: modalidad,
  etiqueta, inventario), línea de tiempo de sesión, simulador, intervención
  personal manual desde el panel.
- **Fase 6 (auditoría de datos históricos) — COMPLETA esta sesión.** Motor
  de detección puro y testeado (`src/lib/impulso-vip/anomalias-carga.ts`, 10
  tests) que marca 3 de las 6 señales que pide el instructivo: salto que
  aproximadamente duplica el peso entre sesiones (mezcla probable de peso
  unitario con suma del par), salto que excede el límite duro del equipo, e
  inconsistencia dentro de una misma sesión. Las otras 3 (inventario real,
  oscilación unitario/total, patrón artificial de corrección) no se
  implementaron — falta modelo de datos que no existe todavía, documentado
  en el propio código en vez de inventar una detección sin base real.
  - **Verificado con datos reales de producción**, no solo con tests: el
    caso obligatorio del instructivo (Nicolás Albornoz, elevaciones
    laterales, registros 15/16/20/32/35 kg) se confirmó exacto contra la
    base real, y el motor detecta 7 anomalías reales en su historial —
    reveló que son 3 asignaciones del mismo ejercicio corriendo en paralelo,
    una de ellas aparentemente registrando la suma del par en vez del peso
    unitario.
  - **Migración 0121 aplicada y verificada en producción** (tabla
    `impulso_vip_anomalias_clasificaciones`, aditiva, RLS con
    `es_admin_o_entrenador()`). Verificado con un insert/delete de prueba
    (borrado después) y confirmando la política real vía
    `select policyname from pg_policies where tablename = '...'` — no solo
    con la clave de service role, que se salta RLS por diseño.
  - Panel nuevo en la ficha del alumno (`AnomaliasCargaPanel.tsx`): cola de
    revisión, el entrenador clasifica cada anomalía como error/válida/
    ignorada sin tocar nunca `series_realizadas` — conserva el dato
    original, registra quién decidió qué y cuándo.
  - QA propio antes de commitear encontró y corrigió un bug real (comparador
    de ordenamiento inválido que no devolvía 0 para fechas iguales).
  - **Interpretación más estrecha que el texto del instructivo**: "mismo día
    aparecen convenciones incompatibles" se implementó como "misma sesión"
    (una sola instancia de entrenamiento), no literalmente "mismo día
    calendario" (dos sesiones distintas el mismo día) — en la práctica los
    otros dos criterios suelen capturar ese caso igual, pero no es 100% lo
    mismo si hace falta ser exacto.
  - **Limitación heredada, no nueva**: ejercicios de "peso corporal" con
    carga extra (ej. dominadas con lastre) pueden generar falsos positivos
    porque `limiteIncrementoKg` ya devuelve 0kg para ese equipo desde la
    Fase 1 — es el mismo comportamiento que ya tiene el motor en vivo, no
    algo que esta fase haya introducido.
- **Fase 7 (despliegue gradual)**: sin empezar. Depende de que Alejandro
  autorice expresamente el push, y de que las Fases 5 anteriores estén
  cerradas y **probadas en vivo** — nada de Impulso VIP V2 se probó todavía
  con una sesión de entrenamiento real, ni las Fases 0-5 ni la 6.

Huecos documentados a propósito, no bugs (sin cambios): la clase
"reconocimiento" nunca tuvo lógica de disparo definida;
`seleccionarDestacadosSesion` en `en-vivo-data.ts` limita a 1-2 ejercicios
por sesión sin distinguir clase.

### Club VIP V2 — propuesta aprobada, sin empezar, sigue bloqueada
Documento: `INSTRUCTIVO_CLAUDE_CLUB_VIP_V2.md` (2026-08-22, 1555 líneas).
Sigue bloqueada por la misma razón que antes: la sección 22.2 de ese
instructivo liquida la bonificación de Impulso VIP dentro del mismo libro
contable nuevo que propone, y Impulso VIP En Vivo sigue sin pushear ni
aprobar (ahora con Fase 6 sumada, el acoplamiento es aún mayor). No es
simple orden de prioridad, es una dependencia real de datos y de código.

### Rediseño "Entrenar" (portal clásico) — sin cambios
Rama: `feature/rediseno-entrenar-clasico` (viva en GitHub, sin PR a
propósito). Handoff: `HANDOFF_REDISENO_PORTAL_CLASICO.md` en esa misma
rama. Sin actividad esta sesión.

### Generador de Rutinas VIP — 7 pendientes abiertos, sin cambios
Documento: `HANDOFF_GENERADOR_RUTINAS_CLAUDE.md`. En orden recomendado por
ese mismo documento:
1. Selector de ejercicios y vista previa fuera del generador.
2. ~~Multi-alumno real~~ — resuelto, commit `16e9bbd`.
3. Metadatos de ejercicios editables en la galería administrativa +
   selección visual de sustitutos.
4. Sub-grupos de pierna / enfoque de forma como dato estructurado.
5. Reemplazo y regeneración parcial (un ejercicio, un día).
6. Usar historial + Impulso VIP para orientar el Generador.
7. Modelar disponibilidad de sala (máquinas, estaciones, capacidad).
8. CRUD visual de técnicas de entrenamiento.
9. Ordenar los `.md` sueltos de la raíz (ver sección final).

### Control VIP V2 (panel nuevo del entrenador) — Fases 0-6 en producción, sin cambios
Documentos: `docs/PROYECTO_CONTROL_VIP_V2.md`, `docs/CONTROL_VIP_V2_INVENTARIO.md`
(léelo antes de tocar `/control-vip/**`). Pendiente si se retoma:
- Estudio VIP: restringir "publicar" a solo el propietario.
- Comparación visual entre versiones del historial de Estudio VIP.
- Comando global (`Ctrl/Cmd+K`) todavía no busca ejercicios ni rutinas.
- `/admin/configuracion` y notificaciones del entrenador sin pantalla V2:
  decisión deliberada, no un olvido.

### Portal V2 (alumno) — dos pendientes menores, RESUELTOS y PUSHEADOS esta sesión
1. Saludo "Hola, {primer nombre}" en la pantalla principal de Entrenar.
2. Versión real de la app (commit corto de Vercel) al final de "Más".

No se tocó el panel admin (`/admin/mas`) — el pedido fue específicamente
sobre portal-v2.

## Pendiente sin dueño claro: orden de los `.md` de la raíz

Sin cambios esta sesión — sigue sin auditar archivo por archivo. Candidatos
obvios a revisar/archivar en una próxima pasada, por nombre: la serie
`HANDOFF_1.md` a `HANDOFF_1.33.md`, más `CONTINUIDAD_PROYECTO.md`,
`HANDOFF_FINAL.md`, `HANDOFF_CLAUDE_2026-07-30.md`,
`RECUPERACION_POST_D20A18B.md`, `INFORME_ERROR_SCROLL_NUTRICION.md`,
`INFORME_ENTRENAMIENTO_ACTIVO_2026-08-14.md`. No se confirmó contenido de
ninguno — leer entero antes de borrar o mover cualquiera.

## Historial de este documento

- **2026-08-22, versión original**: creado tras la limpieza de ramas/backups
  del 2026-08-21, documentaba el cierre de Fases 0-5 de Impulso VIP V2 (sin
  pushear) y el relevamiento de video pendiente.
- **2026-08-22, esta actualización**: sesión posterior, mismo día. Recuperó
  un commit huérfano con un fix real de Impulso VIP (ya pusheado), hizo el
  relevamiento de video pendiente (1 de 2 candidatos corregido, ya
  pusheado), auditó y corrigió cosas sin usar en `/admin/ejercicios` (ya
  pusheado), completó la Fase 6 de Impulso VIP V2 (verificada con datos
  reales, migración aplicada, sin pushear por el acoplamiento con Fase 5), y
  resolvió dos pedidos de personalización de portal-v2 (ya pusheados).
