# Control VIP V2 — Inventario (Fase 0)

Fecha: 2026-08-21
Alcance: matriz de conservación previa a cualquier pantalla nueva de
Control VIP V2, según `docs/PROYECTO_CONTROL_VIP_V2.md` §10, Fase 0.

Este documento es de consulta, no de decisión de producto. Antes de escribir
una pantalla nueva de Control VIP V2 que toque alguno de estos flujos, hay
que releer la fila correspondiente: qué existe, dónde vive y qué no se puede
romper.

## 1. Rutas actuales del panel (`src/app/admin/**`)

| Ruta | Qué hace | Permiso |
|---|---|---|
| `/admin` | Redirige a `/admin/alumnos`; no tiene contenido propio. | `entrenador`, `admin` |
| `/admin/alumnos` | Directorio de alumnos, prioridad y filtros. | `entrenador`, `admin` |
| `/admin/alumnos/[id]` | Ficha del alumno: Resumen, Plan, Actividad, Nutrición, Comunicación, Documentos, Cuenta (`FichaAlumnoTabs.tsx`). | `entrenador`, `admin` |
| `/admin/alumnos/[id]/seguimiento` (+ `/imprimir`) | Detalle diario de seguimiento y su versión imprimible. | `entrenador`, `admin` |
| `/admin/solicitudes` | Solicitudes de ingreso pendientes de aprobar. | `admin` |
| `/admin/ingresos` | Registro de asistencia / check-in del gimnasio. | `entrenador`, `admin` |
| `/admin/rutinas` | Hub que lista las 4 herramientas de rutinas (destino de la pestaña móvil; escritorio enlaza directo a cada sub-herramienta). | `entrenador`, `admin` |
| `/admin/armar-rutina` | Armado manual de rutina, ejercicio por ejercicio. | `entrenador`, `admin` |
| `/admin/generador` | Generador con reglas VIP (motor determinista). | `entrenador`, `admin` |
| `/admin/rutinas-generadas` | Reutilizar/editar rutinas ya generadas. | `entrenador`, `admin` |
| `/admin/documentos` | Importar documentos de rutina y asignarlos a alumnos. | `entrenador`, `admin` |
| `/admin/ejercicios` | Galería multimedia: una sola página con secciones ancladas (`#biblioteca-ejercicios`, `#inventario-ejercicios`, `#reportes-ejercicios`). El documento de visión habla de 4 pestañas (Trabajo/Biblioteca/Cargas/Calidad); hoy es una página densa, no 4 rutas. | `entrenador`, `admin` |
| `/admin/alimentos` | Catálogo de alimentos + cola de aprobación. | `admin` |
| `/admin/pendientes` | Agregador de decisiones pendientes (ver §3). | `entrenador`, `admin` |
| `/admin/asistente` | Asistente VIP: reportes/acciones sugeridas por IA. | `entrenador`, `admin` |
| `/admin/auditoria` | Hallazgos de auditoría de puntos a resolver. | `admin` |
| `/admin/puntos` | Ajustes manuales de puntos. | `admin` |
| `/admin/reportes` | Reportes de errores de alumnos. | `admin` |
| `/admin/resenas` | Reseñas/calificaciones de la app. | `admin` |
| `/admin/borrados` | Solicitudes de borrado de datos. | `admin` |
| `/admin/torneos` | Arena VIP: torneos/temporadas. | `admin` |
| `/admin/noticias` | Noticias/avisos mostrados a alumnos. | `admin` |
| `/admin/gastos` | Gastos de la app, vencimientos. | `admin` |
| `/admin/novedades` | Changelog / notas de versión. | `admin` |
| `/admin/configuracion` | Cuenta, apariencia, sistema. | `admin` |
| `/admin/estudio-vip` | Editor global de Portal V2 (borrador/publicado). | `entrenador`, `admin` |
| `/admin/mas` | Directorio buscable "Más" (ver §2). | `entrenador`, `admin` |
| `/admin/notificaciones` | Bandeja de notificaciones del entrenador (campanita); no está en `destinos.ts`. | `entrenador`, `admin` |

Notas:
- `/admin/archivos` solo tiene `actions.ts`, sin `page.tsx` — no es una ruta navegable, es lógica reutilizable.
- `AdminTabs.tsx:46` (`RUTAS_POR_SECCION`) referencia `/admin/generador-v2`, que no existe como carpeta. Referencia obsoleta a limpiar cuando se toque esa tabla.

## 2. Cómo se arma la navegación hoy

Fuente única (no duplicada) para sidebar de escritorio y "Más":

- `src/lib/admin/destinos.ts` — exporta `GRUPOS_DESTINOS` (grupos con href, label, `detalle`, ícono, `seccion`, `soloAdmin?`), y de ahí derivan `DESTINOS_ADMIN` y `DESTINOS_RUTINAS`. El comentario en el archivo explica que existe justamente para no repetir esta lista en dos lugares que se desincronizan.
- Sidebar de escritorio: `src/components/admin/AdminTabs.tsx` (`variant="sidebar"`) llama `gruposDestinosParaRol(rol)`.
- "Más": `src/app/admin/mas/page.tsx` → `DirectorioPanel.tsx`, mismo `gruposDestinosParaRol(rol)` + buscador cliente + contadores de pendientes por sección.

La barra móvil inferior **no** sale de `destinos.ts` — es una estructura separada y hardcodeada:

- `MOBILE_TABS` en `AdminTabs.tsx:31-37`: Alumnos, Rutinas, Ejercicios ("Galería"), Pendientes, Más (Ejercicios se oculta para entrenador no-admin).
- `RUTAS_POR_SECCION` (`AdminTabs.tsx:40-52`) decide qué rutas "absorbe" cada pestaña.
- "Más" se calcula por exclusión: cualquier ruta `/admin/*` no reclamada por otra pestaña cae en Más (`estaActivo()`, líneas 61-75) — reemplazó una lista de prefijos hardcodeada que se desactualizaba.

**Implicación para Control VIP V2**: la barra lateral y "Más" se pueden extender reorganizando `destinos.ts` sin tocar las páginas reales. La barra móvil sí necesita rediseño explícito si el objetivo final es una sola fuente de verdad para ambas plataformas (el documento de visión ya lo pide en su Fase 1).

## 3. "Pendientes" — qué agrega hoy y qué le falta para ser "Hoy"

- Página: `src/app/admin/pendientes/page.tsx` — tarjetas por categoría, cada una enlaza a su pantalla de origen (es un agregador, no un reemplazo).
- Datos: `src/lib/pendientes/data.ts`, función `obtenerColaPendientes()` — lectura en vivo (no hay tabla `pendientes` persistida) de:
  1. `solicitudes_registro` (pendiente) → "Solicitudes de ingreso"
  2. `reportes_fotos_ejercicios` (pendiente) → "Reportes de fotos"
  3. `obtenerHallazgosPendientes()` (`src/lib/auditoria/data.ts`) → "Auditoría de Puntos VIP" + "Rutinas activas con observaciones"
  4. `reportes_bugs` (pendiente) → "Errores reportados"
  5. `solicitudes_borrado_sesion` (pendiente) → "Pedidos de borrado"
  6. `obtenerResumenAlertasGastos()` (`src/lib/gastos/data.ts`) → "Gastos de la app"

Solo se muestran categorías con `cantidad > 0`.

**Falta explícitamente** (verificado leyendo la función completa):
- Solicitudes en vivo de Impulso VIP — hoy solo existen alertas por alumno individual (`AlertasImpulsoVip.tsx`, comentario propio: *"Fase 1: solo alertas activas de este alumno puntual, sin página global ni cola de recomendaciones pendientes"*), sin agregación global.
- Estado de la cola de carga/procesamiento multimedia (`src/lib/ejercicios/ingesta/*`, IndexedDB del lado del cliente) — solo se ve dentro de `/admin/ejercicios`.
- Ejercicios sin portada usados en rutinas activas.

Conclusión: la Fase 1 del documento ("Hoy deriva de Pendientes, no crea otro motor paralelo") es correcta como punto de partida, pero necesita código nuevo de agregación para Impulso VIP y para la cola multimedia — no es solo un cambio de nombre.

## 4. Estudio VIP y Portal V2

- Página: `src/app/admin/estudio-vip/page.tsx` (`requireRol(["entrenador","admin"])`).
- Editor: `src/components/admin/EstudioVipEditor.tsx` — un solo componente cliente con todo el formulario + la vista previa.
- Acciones: `src/app/admin/estudio-vip/actions.ts` — `guardarBorradorEstudioVip`, `publicarEstudioVip`, `subirPortadaEstudioVip`.
- Storage: `src/lib/estudio-vip/data.ts` — bucket `documentos`, `_estudio-vip/borrador.json` y `_estudio-vip/publicada.json`.
- Esquema/validación: `src/lib/estudio-vip/configuracion.ts` — `normalizarConfiguracionEstudioVip()` sanea todo antes de guardar, publicar y leer.

**Vista previa actual**: es una maqueta separada, no Portal V2 real. `VistaPreviaTelefono` (dentro de `EstudioVipEditor.tsx`) es JSX/Tailwind escrito a mano que imita un teléfono — no importa `EntrenamientoInicioV2`, `BottomNavV2` ni el CSS module real. La propia UI lo dice: *"La previsualización no inventa alumnos ni métricas. La página real conserva los datos de la cuenta o del alumno seleccionado…"*. El único enlace a lo real es el botón "Abrir real" que abre `/portal-v2/entrenamiento` en otra pestaña. La "vista previa exacta" que pide la Fase 5 del documento es trabajo nuevo, no una conexión que ya exista.

**Portal V2 real**: `src/app/portal-v2/layout.tsx` resuelve sesión, aplica el gate `portal_v2_habilitado` para alumnos, lee la config publicada y renderiza `BottomNavV2` con las 4 puertas fijas (`src/components/v2/BottomNavV2.tsx`, `TABS` hardcodeado: entrenamiento, nutrición, progreso, más).

**Historial de versiones**: existe la infraestructura de snapshot pero no la UI. `publicarEstudioVip()` escribe un snapshot inmutable (`upsert: false`) en `_estudio-vip/historial/v{version}-{timestamp}-{uuid}.json` antes de reemplazar `publicada.json`. No hay ningún código que liste, compare o restaure desde `historial/` — ni endpoint ni sección de UI. La Fase 5 ("historial, comparación y restauración") construye sobre una base ya sólida, pero el listado/diff/restore es 100% nuevo.

## 5. Roles y permisos

- `Rol` (`src/lib/supabase/types.ts:6`): `"alumno" | "entrenador" | "admin"` — union cerrada, sin un 4º rol "propietario/editor global".
- Helper único y consistente: `src/lib/auth.ts` — `requireRol(roles)`, `requireAdmin()`, `requireAlumno()`. Se usa en casi todas las rutas y server actions; no hay checks ad hoc sueltos.
- Estudio VIP hoy exige `requireRol(["entrenador","admin"])` en las tres acciones (`page.tsx`, `guardarBorradorEstudioVip`, `publicarEstudioVip`, `subirPortadaEstudioVip`) — **cualquier** entrenador puede editar y publicar, sin restricción de "solo propietario". Este es exactamente el vacío que señala el documento en su Prioridad 0, ítem 1.
- Contraste: acciones realmente admin-only usan `requireAdmin()` — puntos (`admin/puntos/actions.ts`), auditoría, torneos, noticias, gastos, alimentos, solicitudes, borrados, ejercicios, configuración, y borrado de fichas de alumno.
- `destinos.ts` ya tiene un campo `soloAdmin?: boolean` para ocultar destinos a entrenadores en la navegación — Estudio VIP no lo tiene marcado hoy.
- No existe un `can()`/matriz de capacidades genérica; todo es por lista de roles.

**Verificado en la base real** (2026-08-21): la cuenta de Alejandro (`vipfitnesslaserena@gmail.com`) tiene rol `admin`. Documentos anteriores (`HANDOFF_ESTUDIO_VIP_ALCANCE.md`) advertían que esa cuenta era `entrenador` y que solo una cuenta de QA era `admin` — ya no es el caso, pero conviene no asumir el rol de una cuenta real sin volver a verificarlo en la base antes de construir un gate "solo propietario" basado en `rol`.

## 6. Bandera de acceso "Control VIP V2 (beta)" (construida en esta Fase 0)

Mismo patrón que `alumno_perfil.portal_v2_habilitado`, pero para cuentas de staff:

- Migración `supabase/migrations/0119_control_vip_v2_piloto.sql`: agrega `perfiles.control_vip_v2_habilitado boolean not null default false`.
- Gate: `requireControlVipV2()` en `src/lib/auth.ts` — exige `requireRol(["entrenador","admin"])` y además la bandera en `true`; si no, redirige a `/admin/alumnos?control_vip_v2=no_habilitado`.
- Ruta protegida: `src/app/control-vip/layout.tsx` + `src/app/control-vip/page.tsx` — placeholder que solo confirma que el gate funciona. No toca ningún archivo bajo `src/app/admin/**`.
- Toggle admin-only: `actualizarAccesoControlVipV2` (`src/app/admin/configuracion/actions.ts`) + panel `ControlVipV2BetaPanel` en Configuración → "Control VIP V2 (beta)". Lista cuentas `entrenador`/`admin` (`obtenerCuentasBetaControlVipV2`, `src/lib/control-vip-v2/beta.ts`) con un botón Habilitar/Retirar por cuenta.
- Habilitada de entrada para la cuenta real de Alejandro y la cuenta admin de QA; el resto de staff queda afuera hasta que se habilite a mano desde Configuración.

## 7. Contrato de conservación

Comportamientos que Control VIP V2 no puede cambiar mientras se migra, tal
como los fija `docs/PROYECTO_CONTROL_VIP_V2.md` §11 más lo verificado acá:

- El motor determinista del generador de rutinas no se reemplaza por un prompt libre.
- La lógica de puntos, auditoría, Impulso VIP y RLS permanece intacta; Control VIP V2 reutiliza las mismas acciones de servidor, nunca las duplica.
- `/admin/**` sigue funcionando exactamente igual mientras exista `/control-vip/**` en paralelo — ninguna página actual se modifica en esta fase.
- Ninguna cuenta ve el panel nuevo sin que Alejandro la habilite explícitamente vía el toggle de §6.
- Estudio VIP sigue publicando al mismo `documentos/_estudio-vip/publicada.json` que ya consume Portal V2 — no se crea un segundo almacén de configuración.
- Ninguna acción destructiva (publicar, borrar, fusionar, otorgar puntos) se automatiza sin confirmación explícita.

## 8. Siguientes pasos

Fuera de alcance de esta Fase 0 (quedan para cuando se apruebe avanzar):

- Capturas base de escritorio/móvil del panel actual — requiere una sesión autenticada real; no se automatizó acá porque implicaría manejar credenciales, algo que este asistente no hace. Se puede coordinar una sesión conjunta cuando se quiera dejar registro visual antes de tocar pantallas.
- Marcar `estudio-vip` con un permiso más estricto que "cualquier entrenador/admin" (Prioridad 0, ítem 1) — pendiente de decidir si se resuelve con la misma bandera de §6 u otra dedicada.
- Fase 1 del documento: shell, navegación nueva y pantalla "Hoy" real.
