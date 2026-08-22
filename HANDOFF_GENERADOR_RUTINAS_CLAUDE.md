# Handoff para Claude — Generador de Rutinas VIP Fitness

## Instrucción principal

Claude es el agente principal para continuar este trabajo. Este documento es la fuente de verdad del traspaso. Antes de modificar código, lee también `AGENTS.md` y la documentación relevante de Next.js 16 en `node_modules/next/dist/docs/`, tal como exige el proyecto.

**Estado del commit**: este trabajo ya está commiteado y pusheado. Rama `main`, commit `87f6150` ("Agregar revisión de IA al generador y ficha obligatoria del alumno"), sincronizado con `origin/main` en `github.com/alealemenmen-create/vip-fitness`. El detalle sesión por sesión de todo lo agregado después de la primera versión de este handoff está en `HANDOFF_1.10.md` y `HANDOFF_1.11.md` — este documento consolida el estado resultante, no repite esa narrativa.

**Nota 2026-08-22 (madrugada)**: `main` local avanzó mucho más allá de
`87f6150` desde entonces (incluye Impulso VIP V2 completo, sin pushear —
ver `HANDOFF_2026-08-22_ESTADO_Y_PENDIENTES.md` para el estado real y
actualizado del repo, ese es el handoff maestro de hoy). El único commit de
esta sesión que toca el generador es `24af1ca` ("editor de metadatos
biomecanicos y sustitutos por ejercicio", punto 3 de abajo) — alcance
confirmado explícitamente por el usuario antes de tocar código, como pide
la regla de más abajo. Sin pushear.

## Decisión de arquitectura

El generador forma parte del portal VIP Fitness. No debe convertirse en una aplicación separada.

- Portal del entrenador: selección del alumno, brief, generación, revisión (incluida la revisión de IA) y publicación.
- Portal del alumno: ficha de entrenamiento obligatoria (objetivo, disponibilidad, experiencia, preferencias y antecedentes).
- Pantalla Entrenar: recibe únicamente la rutina aprobada por el entrenador.

Esto permite reutilizar autenticación, RLS, alumnos, biblioteca de ejercicios, fotos, videos, rutinas, sesiones, historial e Impulso VIP.

## Estado implementado

### Base de datos

`supabase/migrations/`, de `0051_generador_rutinas.sql` a `0059_unificar_ejercicios_duplicados.sql`:

- **0051**: `perfiles_entrenamiento`, `tecnicas_entrenamiento`, `borradores_generador_rutinas`, RLS, biblioteca inicial de técnicas, metadatos nuevos de ejercicios (patrón, articulaciones, impacto, salto, lateralidad, complejidad, supervisión, montaje, circuito, posición, precauciones, sustitutos).
- **0052**: soporte para el generador avanzado (segunda a cuarta ronda de mejoras, ver más abajo).
- **0053**: técnicas adicionales — Fallo muscular, Cluster set.
- **0054**: soporte para la revisión de IA.
- **0055**: modalidades de cardio (spinning, steps, funcional).
- **0056**: baja de máquinas que no existen en la sala real (caminadora, trotadora, elíptica, escaladora).
- **0057**: baja de 10 máquinas más que no existen (pec deck, remo en T, press inclinado en máquina, gemelos de pie/sentado, femoral sentado/de pie, crunch en máquina, remo ergómetro) + renombre de TRX a "TRX profundo".
- **0058**: "Remo Hammer" pasa de máquina a montaje sobre polea (`equipo = 'polea'`), con la descripción del armado.
- **0059**: unificación de 10 ejercicios duplicados que habían entrado por importación de PDF. Criterio: el original cargado por el entrenador tiene `ilustracion_slug`; los duplicados no. Los nombres viejos quedaron como alias para que el emparejador de PDFs los siga reconociendo. Todo se desactiva (`activo = false`), nunca se borra.

Según `HANDOFF_1.11.md`, el usuario confirmó haber corrido `0049` a `0059`, verificado leyendo la base ("la base real"). **Esto no está re-verificado en esta consolidación** — antes de asumir que ya corrieron en el entorno correcto, confirmar con el usuario si esa base era de pruebas o producción. El criterio permanente sigue siendo no aplicar migraciones a producción sin autorización explícita (ver "Criterios que no se pueden romper").

### Portal del alumno

- `/completar-perfil`: cuestionario de ingreso bloqueante, **fuera del layout de `/alumno` a propósito** (el bloqueo vive en `src/app/alumno/layout.tsx`; si colgara de ahí, se redirigiría a sí misma en bucle).
- `src/components/student/FichaAlumnoForm.tsx`: un solo formulario reutilizado en tres lugares (ingreso, "Mi entrenamiento", panel del entrenador). Escrito tuteando, en lenguaje de sala.
- `src/lib/perfil-alumno/ficha.ts` + `datos.ts`: definición única de "ficha completa" (`camposFaltantes()`) y lectura/escritura unificada sobre las dos tablas donde viven los datos (`alumno_perfil` + `perfiles_entrenamiento`).
- Los cinco temas de salud van con sí/no obligatorio y detalle solo si dice que sí — un cuadro vacío no distingue "no tengo nada" de "no contestó".
- Bloqueo en `alumno/layout.tsx`: alumno sin ficha completa → `/completar-perfil`. Solo aplica a `rolSesion === "alumno"` sin `soloLectura`.
- El sistema no diagnostica lesiones ni prescribe rehabilitación.

### Portal del entrenador

- `/admin/generador`: página, acciones y `GeneradorRutinasPanel.tsx`.
- `RevisionIAPanel.tsx`: panel de revisión de IA integrado en `RutinaDraftEditor` (ver "Revisión de IA" abajo).
- `FichaAlumnoAdmin.tsx` + `alumnos/fichaActions.ts`: el entrenador llena o corrige la ficha del alumno. `alumnoId` va por `.bind()`, nunca como campo del formulario.
- `CopiarRutinaAlumno.tsx` + `alumnos/rutinaTexto.ts`: "Extraer rutina como texto" copia al portapapeles con el mismo serializador del documento publicado, para pegarla como base de otro alumno vía Documentos. Pasa por el editor a propósito, no copia directo alumno-a-alumno.
- `BotonRefrescarCatalogo.tsx`: refresca el caché de 1 hora (`unstable_cache`) de biblioteca y técnicas. Necesario después de cualquier SQL que edite `ejercicios` o `tecnicas_entrenamiento` directo en Supabase, porque ese caché solo se limpia solo cuando el cambio pasa por una Server Action.
- `SelectorGruposDia.tsx`: selector de grupos musculares por día en la distribución "personalizada", sin tope de grupos combinados.
- Acceso rápido a biblioteca de ejercicios y flujo histórico de PDF/documentos.

### Revisión de IA

`src/lib/ai/revisarRutina.ts`. El motor de reglas sigue siendo el único que **elige** ejercicios (determinista, por cupos de grupo, solo biblioteca real). Esta capa **audita**, no genera: cruza la rutina generada con la ficha real del alumno (lesiones, molestias, operaciones, condiciones médicas, edad) y devuelve `veredicto`, `resumen`, `hallazgos` y `cambios` acotados.

- Modelo `claude-opus-5`, thinking adaptativo, effort high, salida estructurada por Zod.
- `resolverRevision` resuelve cada `ejercicioId` propuesto contra la biblioteca real en el servidor — **el modelo nunca inventa un id**. Si el nombre no calza, el cambio se muestra sin botón de aplicar.
- `src/lib/gimnasio/inventario.ts` se pasa a la IA en cada revisión junto con lo que explícitamente NO existe en el gimnasio, para que no razone sobre equipo imaginario.
- Si la IA falla o no hay `ANTHROPIC_API_KEY`, el borrador se publica igual — es un plus, nunca un requisito.
- El entrenador aplica cada cambio individualmente desde `RevisionIAPanel`, con vista previa del documento actualizándose en vivo.

### Motor de reglas

- Tipos: `src/lib/generador-rutinas/tipos.ts`.
- Motor: `src/lib/generador-rutinas/motor.ts`.
- Pruebas: `src/lib/generador-rutinas/motor.test.ts`, `whatsapp.test.ts`, `src/lib/perfil-alumno/ficha.test.ts`.

Reglas actuales (base + lo agregado en 1.10/1.11):

1. Usar únicamente ejercicios activos de la biblioteca VIP.
2. Cada ejercicio generado lleva un `ejercicioId` real, revalidado antes de publicar.
3. Los PDFs antiguos siguen usando emparejamiento por nombre/alias.
4. Ninguna rutina se publica sin aprobación del entrenador.
5. Distribución automática (1–3 días full body, 4 días upper/lower, 5–7 días push/pull/legs) o "personalizada" a mano por grupo(s), sin tope.
6. Cupos garantizados por grupo muscular (`elegirPorCupos`) — ya no puede pasar que un día "tren superior" quede solo con espalda.
7. Respetar nivel, ejercicios prohibidos, obligatorios y preferidos; filtros opcionales de máquinas/poleas/Smith y de saltos/impacto alto (incluido cardio).
8. Volumen por experiencia (principiante 3–4, intermedio 3, avanzado 4–5 según intensidad) y por objetivo real (hipertrofia/pérdida de grasa/rendimiento ajustan reps, series y tipo de ejercicio priorizado).
9. **Ajuste por edad**: 60+ una serie menos, 70+ dos menos, con piso de 2.
10. **Técnicas repartidas en la semana** (`EstadoTecnicasSemana`): rota por la menos usada, evita repetir la del día anterior — ya no cae siempre en los mismos dos accesorios. Checklist real contra `tecnicas_entrenamiento`, no solo automático/sí/no.
11. **Cardio por modalidad real** (spinning, steps, funcional o indistinto), derivada de lo activo en biblioteca. Funcional en circuito (30s entre estaciones) o separado (descanso real), vía `cardioFormato`. Cardio siempre al final.
12. **`ejerciciosPorTiempo(minutos, cardioMinutos)`**: la duración de la sesión dicta la cantidad de ejercicios de fuerza (~1 cada 10 min), editable.
13. Sub-grupos de pierna (Glúteo/Cuádriceps/Femoral/Pantorrilla) y enfoque de forma (amplitud/densidad/definición) seleccionables — **heurística por nombre de ejercicio**, sin columna estructurada todavía.
14. Variedad respecto a la rutina anterior del alumno: se penaliza (no excluye) repetir lo que ya venía la última vez.
15. Orden de ejercicios por tamaño de grupo dentro de un día combinado (piernas > espalda > pecho > hombros > brazos > core), salvo grupo prioritario.
16. Si los filtros dejan cero candidatos, detener la generación. Si un obligatorio no cabe, alertar; nunca ocultar el conflicto. Alerta si un día enfocado (≤2 grupos) queda con menos de 3 ejercicios por grupo (salvo principiante).
17. Fuerza: principales 3×4–6/120s; accesorios 2×8–10/75s. Hipertrofia: 3×8–12 o 10–15/90–60s. Retorno/técnica: 2×10–12/90s.
18. Guardar snapshot del perfil, brief, resultado, reglas y alertas.

### Publicación

`RutinaExtraida` admite `ejercicioId` opcional. `src/app/admin/archivos/actions.ts` lo usa cuando viene del generador y conserva el emparejamiento histórico para PDFs. El borrador reutiliza `RutinaDraftEditor`, incluida la configuración de Impulso VIP.

La rutina publicada se guarda además como **documento de texto legible** en "Mis planes" del alumno (antes solo quedaba en tablas internas). Serializador compartido cliente/servidor en `src/lib/generador-rutinas/serializar.ts`. Codificación UTF-8 explícita al subir a Storage (bug de acentos rotos, corregido).

El cuestionario por WhatsApp (`mensajeEncuesta.ts`) se eliminó — la ficha obligatoria lo reemplaza. Queda `src/lib/generador-rutinas/whatsapp.ts` con solo el link (`wa.me/<número>`, sin texto predeterminado).

## Verificaciones realizadas

Según la última sesión documentada (`HANDOFF_1.11.md`):

- `npx tsc --noEmit`: limpio.
- `npx vitest run`: **170/170 pruebas en verde**.
- `npm run build`: compila.
- Probado en navegador contra la base real (`localhost:3001`, cuenta `1@1.com` / `111111`): generación, revisión de IA con aplicación de cambios en vivo, cuestionario de ingreso, generador arrancando sin alumno preseleccionado, catálogo reflejando las migraciones.

Estado de la biblioteca al cierre de esa sesión: 119 ejercicios activos de 147 cargados; 113 con ilustración (los 6 sin foto son cardio funcional agregado ese día: jumping jacks, sentadilla con salto, slam ball, wall ball, mountain climber, TRX profundo).

El lint global puede entrar en `.next-preview`, una carpeta generada previamente, y reportar código compilado ajeno. No usar ese resultado para atribuir errores al módulo nuevo; ejecutar lint sobre `src`.

## Archivos sin relación que no deben tocarse

- `respaldo-cloud-ia-2026-08-09.bundle`: sigue como archivo sin seguimiento en la raíz. No fue creado por este trabajo y no debe incluirse en un commit.
- `stash@{0}` y `stash@{1}` en la rama `agent/interfaz-entrenamiento-enfocada` (editor de rutina en texto plano, tema aparte): sin tocar.

## Nota operativa: sincronizar escritorio ↔ notebook

Sincronizar **solo por GitHub**, nunca por Google Drive: `.git` se corrompe, `node_modules` son ~40.000 archivos con binarios por máquina, y los conflictos de Drive crean copias tipo `motor (1).ts` que rompen el build. `.env.local` no viaja por GitHub — copiarlo a mano una vez por máquina. Remoto: `github.com/alealemenmen-create/vip-fitness`.

Flujo verificado que funciona: en la máquina nueva, `git fetch origin` + `git switch main` (o `git fetch origin main:main` sin cambiar de rama si se está trabajando en otra) trae todo sin fricción, siempre que no haya commits locales divergentes.

## Pasos inmediatos para Claude

1. ~~Confirmar con el usuario si las migraciones `0049`–`0059` corrieron en Supabase de pruebas o en producción~~ — **confirmado el 09/08/2026**: se verificaron una por una contra la base real de Supabase (tablas, columnas, técnicas, máquinas dadas de baja, alias) y las 9 están aplicadas.
2. Subir foto a los 6 ejercicios de cardio funcional que quedaron sin ilustración (jumping jacks, sentadilla con salto, slam ball, wall ball, mountain climber, TRX profundo). El usuario avisó que las va a sacar el 10/08/2026, cuando esté en el gimnasio.
3. Revisar si conviene ya el CRUD visual de técnicas (postergado de común acuerdo — el entrenador avisa si necesita técnicas fuera de las 10 cargadas).
4. Impulsar que los alumnos completen la ficha: el bloqueo ya obliga al abrir la app, pero al cierre de la última sesión había ~56 alumnos marcados "para revisar" sin ficha completa.
5. ~~Pasar la prop `ejercicios` a `RutinaDraftEditor` desde `ArchivosManager`/`DocumentosManager`~~ — **verificado el 22/08/2026, ya estaba resuelto**: los 4 llamadores de `RutinaDraftEditor` (`GeneradorRutinasPanel`, `RutinasGeneradasPanel`, `ArmarRutinaPanel`, `ArchivosManager`) ya pasan `ejercicios`. Este documento estaba desactualizado en este punto — no repitas el trabajo sin confirmar contra el código primero.

## Desarrollo pendiente, en orden recomendado

### 1. Selector de ejercicios y vista previa fuera del generador — resuelto, ver punto 5 de arriba

No hace falta ningún cambio: los 4 llamadores de `RutinaDraftEditor` ya pasan `ejercicios`.

### 2. Multi-alumno real — resuelto (commit `16e9bbd`)

Este punto ya no es una limitación: `src/lib/generador-rutinas/perfil-grupal.ts`
(`combinarPerfilesGrupo`) arma un perfil grupal conservador — nivel menos
experimentado, mayor edad, cardio más bajo, y unión (no reemplazo) de
molestias/lesiones/condiciones/medicamentos/ejercicios preferidos y no
deseados de todos los integrantes. `src/app/admin/generador/actions.ts` lo usa
tanto en `generarBorradorRutina` como en `revisarBorradorConIA`, así que la
generación y la revisión de IA calibran con el grupo completo. Cubierto por
`perfil-grupal.test.ts`.

Lo único que sigue tomando solo al primer alumno del grupo es cosmético: el
nombre de la rutina y el número de versión (`rutinasPrevias`), no la
calibración de seguridad ni el contenido.

### 3. Metadatos de ejercicios — resuelto el 22/08/2026, con alcance confirmado por el usuario

`EditorMetadatosGenerador` y `EditorSustitutos` en `GaleriaEjercicios.tsx`
(modal de edición de la Biblioteca clásica, no Mesa), acciones
`actualizarMetadatosGenerador`/`actualizarSustitutosEjercicio` en
`admin/ejercicios/actions.ts`. Sin migración nueva — las 11 columnas de
`0051` ya existían en producción, confirmado vía el MCP de Supabase antes de
tocar código.

- Impacto, salto, complejidad, supervisión, posición en la sesión y
  precauciones: **el motor real ya los lee** (`cargarContextoAlumno`,
  `admin/generador/actions.ts`) — editarlos acá cambia de verdad qué
  recomienda el generador la próxima vez, no es cosmético.
- Articulaciones, lateralidad y tiempo de montaje: sin consumidor todavía —
  es preparación de datos, mismo caso que `patron_movimiento`.
- Sustitutos (`sustitutos_ids`): multi-select buscable contra la biblioteca
  real (nunca texto libre). Sin consumidor todavía — el flujo de
  "reemplazar con alternativas" sigue siendo el punto 5 de abajo, sin
  empezar.
- `Ejercicio` (`lib/ejercicios/tipos.ts`) ganó los 9 campos correspondientes.
  Un solo lugar se rompió por el tipo más estricto: `emparejar.test.ts`
  (fixture manual), corregido en el mismo commit.
- Verificado: `tsc`, `eslint`, `vitest` (710/710), `next build`. **No
  probado con un login real en el navegador** — sesión sin forma de
  autenticarse (madrugada, autónoma).

### 4. Sub-grupos de pierna y enfoque de forma como datos estructurados

Hoy son heurística por nombre de ejercicio (`PALABRAS_SUBGRUPO` en `motor.ts`). Si el catálogo crece con nombres que no calzan, la alternativa es una columna nueva en `ejercicios` con migración y carga manual.

### Fix real 22/08/2026: emparejamiento débil al pegar una rutina (Mesa)

Alejandro aclaró que su flujo real para crear rutinas es pegarlas como
texto, no el asistente guiado — investigando ESE camino específico se
encontró un bug real, no listado en ningún pendiente anterior:
`cargarRutinaImportada()` en `RutinaDraftEditor.tsx` (la caja de "pegar
rutina" de Mesa/`ArmarRutinaPanel`, alimentada por
`importarRutinaDesdeTexto` → `importarRutinaEstructurada` o IA) resolvía
cada nombre contra la biblioteca con comparación EXACTA de texto, no con
`emparejarEjercicio` (el emparejador real, con alias/abreviaturas/veto por
músculo y equipo que usa el resto de la app). Resultado real: más
ejercicios pegados de los necesarios terminaban sin `ejercicioId`, sin
foto/video para el alumno, y en la cola de "nombres sin vincular" de Mesa.

Corregido (commit `7de0577`): `emparejarEjercicio()` pasa a ser genérico
sobre un tipo mínimo (`EjercicioParaEmparejar`) en vez de exigir un
`Ejercicio` completo, así `RutinaDraftEditor` puede usarlo con su
`EjercicioBiblioteca` liviana. Cambio de tipos puro — los 19 tests
existentes de `emparejar.test.ts` siguen en verde sin tocarlos, más uno
nuevo para el caso de uso liviano. Verificado: tsc, eslint, vitest
(711/711), build. **No probado con login real.**

### 5. Reemplazo y regeneración parcial — despriorizado por Alejandro el 22/08/2026

Alejandro pidió explícitamente no invertir tiempo acá: su flujo real y
dominante para crear rutinas es pegar la rutina como texto (importación +
auto-emparejamiento), no el asistente guiado paso a paso del Generador. Este
punto mejora específicamente el asistente guiado / Varita VIP, que usa poco
en la práctica — no confundir el orden numerado de este documento (por
complejidad técnica) con prioridad real. Investigado pero no implementado:
"regenerar un día" ya existe hoy (Varita VIP, `alcance: "sesion"`,
preserva lo que no encaja en el patrón automático); lo que faltaría de
verdad es reemplazar un ejercicio puntual con alternativas curadas (hoy es
búsqueda libre en toda la biblioteca) y un candado por ejercicio contra la
Varita. Ninguna de las dos, sin pedido explícito de nuevo.

### 6. Historial e Impulso VIP

Usar sesiones anteriores para conservar ejercicios con progresión, detectar estancamiento, evitar movimientos asociados a alertas de dolor y sugerir rotación. El historial orienta; el entrenador aprueba.

### 7. Operación de sala

Modelar disponibilidad de máquinas, tiempo de montaje, estaciones ocupadas, capacidad para circuitos y necesidad de supervisión.

### 8. CRUD visual de técnicas

Alta, edición, activación, nivel, fatiga, descansos, supervisión y máximo por sesión para `tecnicas_entrenamiento`. Reemplazar gradualmente el texto libre `tecnica_tipo` por referencias estructuradas sin romper rutinas antiguas.

### 9. Orden de los `.md` sueltos en la raíz

Se acumularon varios handoffs y documentos de contexto de sesiones distintas (`ROADMAP_PRODUCTO.md`, los `HANDOFF_*.md`, etc.) sin depurar.

## Criterios que no se pueden romper

- El alumno informa; el entrenador decide.
- La IA propone; nunca publica.
- Toda referencia visual depende de un ID real.
- No diagnosticar ni tratar lesiones.
- No relajar filtros silenciosamente.
- No eliminar compatibilidad con PDFs históricos.
- No agregar ejercicios o maquinaria que no estén físicamente en el gimnasio — la biblioteca es inventario real, no sugerencia.
- No aplicar migraciones ni desplegar a producción sin autorización explícita.
- No hacer commit o push de trabajo nuevo hasta confirmar el alcance con el usuario.

Para una descripción complementaria del producto, leer `docs/GENERADOR_RUTINAS_VIP.md`.

## Entrega local pendiente de push · 13 de agosto de 2026

Alejandro autorizó dejar este trabajo **commiteado en `main`, sin pushear**, para
que Claude haga la revisión final y el push. El commit incluye la nueva mesa de
`Armar rutina`: edición/reordenamiento de sesiones y músculos, descansos
insertables y recuperables, ajustes compactos, deshacer global, importación de
rutinas pegadas (formato determinista sin IA y respaldo de texto libre con IA),
eliminación de las dos pantallas intermedias antiguas y acceso directo desde la
selección del alumno.

La galería de ejercicios queda como inventario oficial: alta con nombre/alias,
grupo, patrón, categoría, equipo, nivel, foto, video, descripción, ejecución,
errores y consejos; impresión/PDF del catálogo; aviso de posibles duplicados y
combinación manual conservando como original el registro con foto, trasladando
las rutinas y guardando el nombre alternativo como alias. El alta invalida el
catálogo para que el ejercicio aparezca en `Armar rutina` y el resto de la app.

Verificación ya ejecutada y limpia antes del commit:

- `npm run lint`
- `npx tsc --noEmit`
- `npm test -- --run`: **378/378 pruebas**
- `npm run build`: compilación de producción correcta

Claude puede revisar el commit y, si no encuentra regresiones, hacer `git push
origin main`. No hay migraciones pendientes en esta entrega. Los archivos
`.next-dev-*.log` son locales y se dejaron fuera del commit a propósito.
