# Handoff para Claude — Generador de Rutinas VIP Fitness

## Instrucción principal

Claude es el agente principal para continuar este trabajo. Este documento es la fuente de verdad del traspaso. Antes de modificar código, lee también `AGENTS.md` y la documentación relevante de Next.js 16 en `node_modules/next/dist/docs/`, tal como exige el proyecto.

**Estado del commit**: este trabajo ya está commiteado y pusheado. Rama `main`, commit `87f6150` ("Agregar revisión de IA al generador y ficha obligatoria del alumno"), sincronizado con `origin/main` en `github.com/alealemenmen-create/vip-fitness`. El detalle sesión por sesión de todo lo agregado después de la primera versión de este handoff está en `HANDOFF_1.10.md` y `HANDOFF_1.11.md` — este documento consolida el estado resultante, no repite esa narrativa.

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

1. Confirmar con el usuario si las migraciones `0049`–`0059` corrieron en Supabase de pruebas o en producción, antes de asumir el estado de la base.
2. Subir foto a los 6 ejercicios de cardio funcional que quedaron sin ilustración.
3. Revisar si conviene ya el CRUD visual de técnicas (postergado de común acuerdo — el entrenador avisa si necesita técnicas fuera de las 10 cargadas).
4. Impulsar que los alumnos completen la ficha: el bloqueo ya obliga al abrir la app, pero al cierre de la última sesión había ~56 alumnos marcados "para revisar" sin ficha completa.
5. Pasar la prop `ejercicios` a `RutinaDraftEditor` desde `ArchivosManager`/`DocumentosManager` para que el selector de ejercicios por clic y la vista previa también estén disponibles fuera del flujo del generador (hoy solo ahí).

## Desarrollo pendiente, en orden recomendado

### 1. Selector de ejercicios y vista previa fuera del generador

Ver punto 5 arriba — es lo más inmediato y acotado de lo que falta.

### 2. Multi-alumno real

Hoy, si se seleccionan varios alumnos, la rutina se genera y se revisa (IA incluida) con la ficha del primero solamente. Ya se avisa en pantalla, pero sigue siendo una limitación real.

### 3. Metadatos de ejercicios

Ampliar la galería administrativa para editar los campos agregados por `0051`. Incorporar selección visual de sustitutos.

### 4. Sub-grupos de pierna y enfoque de forma como datos estructurados

Hoy son heurística por nombre de ejercicio (`PALABRAS_SUBGRUPO` en `motor.ts`). Si el catálogo crece con nombres que no calzan, la alternativa es una columna nueva en `ejercicios` con migración y carga manual.

### 5. Reemplazo y regeneración parcial

- Reemplazar un ejercicio mostrando tres alternativas compatibles.
- Regenerar únicamente un día.
- Reducir duración o fatiga sin destruir el resto del borrador.
- Mantener manualmente ejercicios bloqueados por el entrenador.

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
