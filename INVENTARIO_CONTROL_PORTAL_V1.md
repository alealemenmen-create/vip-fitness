# Inventario de control — Portal VIP V1 (Fase 1 del encargo de organización)

Worktree aislado `C:\dev\vip-fitness-v1-claude`, rama `claude/portal-v1-organizacion`,
base `main` en `9b71c15`. Este documento es la matriz `función → ruta → acción de
servidor → tabla → rol → estado de prueba` pedida por
`HANDOFF_CLAUDE_PORTAL_V1_ORGANIZACION.md` Fase 1, más un diagnóstico de qué
tan vigente sigue `INSTRUCTIVO_CLAUDE_REORDENO_PANEL_ENTRENADOR.md`.

**Método:** lectura directa del código (`src/app/admin/**`, `src/lib/auth.ts`,
navegación, componentes) y `grep` de `.from("tabla")` en cada acción de
servidor. No se consultó la base de datos real (instrucción explícita: no usar
datos activos). "Estado de prueba" distingue tres niveles:
- **Verificado (código):** leí el archivo completo, la lógica es coherente y
  el botón/acción tiene un handler real.
- **Spot-check:** confirmé que la ruta y la acción existen y no son un
  callejón sin salida, sin leer la lógica interna completa.
- **No verificado:** aparece en el código pero no llegué a revisarlo en esta
  sesión — no asumir que funciona.

Ningún flujo se probó en navegador contra datos reales en esta fase (eso es
Fase 2/4 más abajo, donde corresponde).

## Hallazgo principal antes de la matriz

`INSTRUCTIVO_CLAUDE_REORDENO_PANEL_ENTRENADOR.md` (spec de Codex, 2026-08-15,
"prioridad máxima") **ya está implementado en su mayor parte en `main`**, no es
trabajo pendiente desde cero:

- **Navegación (§4.1–4.3, Fase 1 del instructivo): hecha.** `AdminTabs.tsx`
  tiene los 5 destinos móviles (Alumnos/Rutinas/Galería/Pendientes/Más) y la
  barra lateral lee de `src/lib/admin/destinos.ts` — **una sola fuente**
  (`GRUPOS_DESTINOS`) para sidebar y para `/admin/mas`, con los mismos 6
  grupos del instructivo (Trabajo diario, Rutinas, Bibliotecas, Automatización
  y control, Comunidad, Administración) y las ~20 rutas de la sección §12
  (agrega "Reseñas de la app", no prevista en el instructivo original).
  `/admin/mas` reemplaza a `/admin/configuracion` como directorio completo,
  con contadores condicionales — exactamente §4.3.
- **Ficha de alumno con pestañas (§7.5, Fase 2 del instructivo): hecha.**
  `FichaAlumnoTabs.tsx` tiene las 7 pestañas exactas del instructivo (Resumen,
  Plan y rutina, Actividad, Nutrición, Comunicación, Documentos, Cuenta).
- **Galería como flujo de producción (§8, Fase 3 del instructivo): parcial.**
  Existe un sistema de "ingesta" (`ejercicio_ingestas`,
  `ejercicio_ingesta_items`, `ingestaActions.ts`, `multimediaActions.ts`) más
  avanzado que una simple lista, pero no verifiqué si ya tiene las 4 vistas
  exactas (Pendientes/Biblioteca/Carga masiva/Calidad) que pide el
  instructivo. Esto conecta directo con
  `INSTRUCTIVO_CLAUDE_GALERIA_MULTIMEDIA_CARGA_MASIVA.md`, que `CLAUDE.md`
  marca explícitamente como **proyecto aparte, de varias sesiones, que
  necesita confirmación de alcance con Alejandro antes de tocarlo**. No lo
  toqué en esta sesión por esa instrucción explícita.

**Consecuencia para la Fase 2 de este encargo** ("nueva organización
profesional"): la reorganización grande ya ocurrió. Ver la sección "Fase 2 —
qué se hizo en esta sesión" más abajo para el alcance real de esta sesión
sobre esa base.

## Matriz por área

### Alumnos

| Función | Ruta | Acción de servidor | Tabla(s) | Rol(es) | Estado |
|---|---|---|---|---|---|
| Directorio de alumnos | `/admin/alumnos` | `src/app/admin/alumnos/page.tsx` + `data.ts` | `perfiles`, `alumno_perfil`, `solicitudes_registro` | entrenador, admin | Spot-check |
| Ficha individual (7 pestañas) | `/admin/alumnos/[id]` | `src/app/admin/alumnos/[id]/page.tsx`, `FichaAlumnoTabs.tsx` | `perfiles`, `alumno_perfil`, `notas_entrenador`, `rutinas`, `sesiones_entrenamiento`, `registros_diarios`, `pesos_corporales`, `seguimientos_diarios`, `comidas_registradas`, `alimentos_consumidos`, `planes_alimentacion` | entrenador, admin | Spot-check — **en edición concurrente durante esta sesión** (ver nota abajo) |
| Notas del entrenador | ficha alumno | `alumnos/actions.ts` (`agregarNota`/similares) | `notas_entrenador` | entrenador, admin | No verificado |
| Impulso VIP / Indicación personal | ficha alumno | `alumnos/impulso-actions.ts` | `impulso_vip_intervenciones`, `impulso_vip_indicaciones_programadas`, `impulso_vip_alertas`, `impulso_vip_solicitudes_asistencia`, `impulso_vip_avisos_entrenador`, `rutina_dia_ejercicios`, `sesion_ejercicios` | entrenador, admin | Verificado (código) — ver Fase 4 |
| Crear mi propio perfil de alumno (entrenador que también entrena) | header/mas | `alumnos/actions.ts: crearMiPerfilAlumno` | `alumno_perfil` | entrenador, admin | Verificado (código) |
| Solicitudes de ingreso | `/admin/solicitudes` | `solicitudes/actions.ts` | `solicitudes_registro`, `perfiles`, `alumno_perfil`, `comprobantes`, `pesos_corporales`, `noticias_sistema` | entrenador, admin | Spot-check |
| Ingresos y asistencia | `/admin/ingresos` | — | (no revisado) | entrenador, admin | No verificado |
| "Ver como alumno" (vista segura) | cookie `vista_alumno_id` en `src/lib/auth.ts` → `/alumno/*` | `requireAlumno()` en `auth.ts` | `alumno_perfil`, `perfiles` | admin/entrenador (solo lectura) | Verificado (código) — ver Fase 3 |

### Rutinas

| Función | Ruta | Acción de servidor | Tabla(s) | Rol(es) | Estado |
|---|---|---|---|---|---|
| Armar manualmente | `/admin/armar-rutina` | `armar-rutina/page.tsx` (no tiene `actions.ts` propio en la raíz; usa acciones de `alumnos`/`generador`) | `rutinas`, `ejercicios`, `perfiles_entrenamiento`, `alumno_perfil` | entrenador, admin | Spot-check |
| Generar con reglas/IA | `/admin/generador` | `generador/actions.ts` | `rutinas`, `perfiles_entrenamiento`, `alumno_perfil`, `ejercicios`, `borradores_generador_rutinas` | entrenador, admin | No verificado en detalle (ver `HANDOFF_GENERADOR_RUTINAS_CLAUDE.md`, motor de reglas — no se tocó) |
| Rutinas hechas / reutilizar | `/admin/rutinas-generadas` | `rutinas-generadas/actions.ts` | `alumno_perfil` (+ tablas de rutinas vía otras acciones) | entrenador, admin | Spot-check |
| Documentos y asignaciones (puerta de Rutinas) | `/admin/documentos` | `documentos/actions.ts`, `archivos/actions.ts` | `documentos`, `documento_asignaciones` | entrenador, admin | Spot-check |
| Puerta única "Rutinas" (`/admin/rutinas`) | `/admin/rutinas` | — | — | entrenador, admin | Existe (`DESTINOS_RUTINAS` en `destinos.ts`); no revisado el `page.tsx` en detalle |

**Duplicado ya documentado y aceptado, no un bug:** Armar manualmente vs
Generar con reglas son dos caminos deliberadamente distintos (control total
vs motor de reglas) — el instructivo los agrupa bajo una sola puerta
"Rutinas" en vez de eliminarlos, y eso ya está hecho (`DESTINOS_RUTINAS`).

### Galería / Ejercicios

| Función | Ruta | Acción de servidor | Tabla(s) | Rol(es) | Estado |
|---|---|---|---|---|---|
| Biblioteca de ejercicios | `/admin/ejercicios` | `ejercicios/page.tsx` + `GaleriaEjercicios.tsx` | `ejercicios`, `reportes_fotos_ejercicios`, `ejercicio_foto_version_anterior`, `ejercicio_fusiones` | entrenador, admin | Spot-check |
| Ingesta / carga masiva | mismo | `ejercicios/ingestaActions.ts`, `multimediaActions.ts` | `ejercicio_ingestas`, `ejercicio_ingesta_items`, `ejercicio_multimedia` | entrenador, admin | **No tocado** — proyecto aparte, ver `INSTRUCTIVO_CLAUDE_GALERIA_MULTIMEDIA_CARGA_MASIVA.md` y regla de `CLAUDE.md` |
| Reportar foto incorrecta (desde alumno) | tarjeta de ejercicio en sesión | `alumno/entrenar/foto-actions.ts` | `reportes_fotos_ejercicios` | alumno | Verificado (código, leído para Fase 4) |
| Fusión de ejercicios duplicados | `/admin/ejercicios` | `ejercicios/actions.ts` | `ejercicio_fusiones`, `ejercicios`, `rutina_dia_ejercicios` | admin (verificar restricción de rol) | No verificado |

### Documentos / Alimentos

| Función | Ruta | Acción de servidor | Tabla(s) | Rol(es) | Estado |
|---|---|---|---|---|---|
| Alimentos — biblioteca y pendientes de aprobar | `/admin/alimentos` | `alimentos/actions.ts` | `alimentos` | entrenador, admin | Spot-check |
| Documentos — carga y asignación | `/admin/documentos`, `/admin/archivos` (interno) | `documentos/actions.ts`, `archivos/actions.ts` | `documentos`, `documento_asignaciones` | entrenador, admin | Spot-check |

### Impulso VIP / Puntos / Comunidad

| Función | Ruta | Acción de servidor | Tabla(s) | Rol(es) | Estado |
|---|---|---|---|---|---|
| Otorgar puntos manuales | `/admin/puntos` | (no localizado `actions.ts` propio en el grep — revisar) | `alumno_perfil` + tablas de puntos (no confirmadas) | entrenador, admin | No verificado |
| Auditoría de Puntos VIP | `/admin/auditoria` | `auditoria/actions.ts` | `planes_alimentacion`, `auditoria_revisiones`, `notas_entrenador` | admin (verificar) | Spot-check — el instructivo reporta "más de 150 botones" en esta vista; no confirmé si ya tiene paginación/agrupación |
| Arena VIP / torneos | `/admin/torneos` | `torneos/actions.ts` | (no confirmadas todas) | entrenador, admin | No verificado |
| Noticias | `/admin/noticias` | `noticias/actions.ts` | `anuncios`, `borradores_noticias` | entrenador, admin | Spot-check |
| Notificaciones del entrenador | `/admin/notificaciones` | `notificaciones/actions.ts` | `notificaciones_entrenador` | entrenador, admin | Spot-check |

### Soporte / Sistema

| Función | Ruta | Acción de servidor | Tabla(s) | Rol(es) | Estado |
|---|---|---|---|---|---|
| Errores reportados | `/admin/reportes` | `reportes/actions.ts` | `reportes_bugs` | entrenador, admin | Spot-check |
| Reseñas de la app | `/admin/resenas` | (no confirmado `actions.ts` — puede ser solo lectura) | `resenas_app` | entrenador, admin | No verificado |
| Pedidos de borrado | `/admin/borrados` | `borrados/actions.ts` | `solicitudes_borrado_sesion`, `sesiones_entrenamiento` | admin (verificar) | Spot-check |
| Gastos de la app | `/admin/gastos` | `gastos/actions.ts` | `gastos_app`, `gastos_app_pagos` | admin (verificar) | Spot-check |
| Configuración del sistema | `/admin/configuracion` | `configuracion/actions.ts` | `configuracion_gimnasio` | admin (verificar) | Spot-check |
| Asistente VIP (IA) | `/admin/asistente` | `asistente/actions.ts` | `solicitudes_eliminacion_datos`, `alumno_perfil` | entrenador, admin | Spot-check |
| Pendientes (cola unificada) | `/admin/pendientes` | — | agrega varias tablas de arriba | entrenador, admin | No verificado en detalle |
| Novedades / changelog | `/admin/novedades` | `lib/novedades.ts` | (no confirmada) | entrenador, admin | No verificado |

### Navegación / Shell

| Elemento | Archivo | Estado |
|---|---|---|
| Fuente única de destinos | `src/lib/admin/destinos.ts` | Verificado (código) |
| Barra inferior móvil (5 destinos) + sidebar | `src/components/admin/AdminTabs.tsx` | Verificado (código) |
| Directorio completo "Más" | `src/app/admin/mas/page.tsx` + `DirectorioPanel.tsx` | Verificado (código) |
| Layout admin (header móvil, sidebar, alterna panel) | `src/app/admin/layout.tsx` | Verificado (código) |
| Header estándar de página | `src/components/admin/AdminPageHeader.tsx` | Referenciado en varias páginas, no auditado uno por uno |

## Vista "como alumno": estado actual (previo a esta sesión)

Mecanismo real, en `src/lib/auth.ts`:
- Cookie `vista_alumno_id` (`COOKIE_VISTA_ALUMNO`).
- `requireAlumno()`: si quien pide acceso a `/alumno/*` es `entrenador`/`admin`
  y tiene esa cookie puesta, entra al portal del alumno indicado con
  `soloLectura: true` — **no** sobre su propia cuenta.
- Sin la cookie, un entrenador/admin sin ficha de alumno propia es redirigido
  a `/admin/alumnos`.
- No localicé en esta sesión desde dónde se pone la cookie (qué botón de la
  ficha de alumno la activa) ni el aviso visual de "estás viendo a fulano" —
  eso es exactamente el terreno de la Fase 3 de este encargo.

**Nota importante sobre esta sesión:** mientras se redactaba este inventario,
`src/app/alumno/layout.tsx` y `src/components/admin/FichaAlumnoTabs.tsx`
aparecieron modificados en el mismo worktree por un proceso concurrente (no
por mí) — evidencia de otra sesión/job trabajando la Fase 3 (edición en
contexto sobre "ver como alumno") en paralelo, sobre el mismo checkout. Ver
sección "Fase 3" del handoff de resultado para el detalle de qué se integró
y cómo se verificó al cierre.

## Duplicados y callejones sin salida detectados

- **No se encontraron callejones sin salida nuevos** en esta pasada — todas
  las rutas de `GRUPOS_DESTINOS` corresponden a un `page.tsx` real bajo
  `src/app/admin/`.
- **Duplicado deliberado y ya resuelto:** Armar rutina vs Generador (ver
  arriba) — agrupados bajo "Rutinas", no eliminados.
- **Pendiente de confirmar, no bug:** `/admin/puntos` y `/admin/auditoria` no
  tuve tiempo de confirmar si ya tienen búsqueda/paginación (el instructivo
  reportaba listas de 68-70 alumnos y +150 botones respectivamente el
  2026-08-15). No asumir que ya está resuelto — falta spot-check en
  navegador.
- **Multimedia/Galería:** hay dos sistemas conviviendo (`ejercicios/actions.ts`
  con edición clásica por ejercicio, y `ejercicio_ingestas`/`multimediaActions.ts`
  con un flujo de ingesta más nuevo). No until confirmado en navegador si la
  UI actual ya los presenta de forma unificada o si son dos caminos visibles
  por separado — riesgo de confusión real para Alejandro si conviven sin
  aclarar cuál usar. Anotado, no corregido (fuera del alcance autorizado de
  esta sesión, ver `CLAUDE.md`).

## Qué NO se hizo en esta Fase 1

- No se probó ningún flujo en navegador todavía (eso ocurre, cuando corresponde,
  en las fases siguientes de este mismo handoff).
- No se leyó línea por línea cada `actions.ts` — varias filas de la matriz
  dicen "Spot-check" o "No verificado" a propósito. Tratar esas filas como
  hipótesis de trabajo, no como hechos confirmados.
- No se re-auditó `/admin/puntos`, `/admin/auditoria`, `/admin/torneos`,
  `/admin/novedades`, `/admin/notificaciones` en profundidad — quedan como
  pendiente real si Codex o Alejandro necesitan ese nivel de detalle.
