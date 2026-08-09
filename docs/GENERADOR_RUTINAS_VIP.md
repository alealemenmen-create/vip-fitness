# Generador de Rutinas VIP Fitness

## Decisión de arquitectura

El generador vive dentro del portal. No es una aplicación separada. Reutiliza autenticación, RLS de Supabase, alumnos, biblioteca de ejercicios, historial, editor de borradores, publicación e Impulso VIP.

## Flujo funcional

1. El alumno abre **Configuración → Mi entrenamiento y objetivos**.
2. Completa objetivo, disponibilidad, experiencia, preferencias y antecedentes relevantes.
3. Cualquier antecedente de salud o molestia marca el perfil para revisión. El sistema no diagnostica ni prescribe rehabilitación.
4. El entrenador abre la pestaña **Generar**, selecciona al alumno y completa el brief.
5. El motor filtra la biblioteca activa y genera una rutina usando identificadores reales.
6. El entrenador ve reglas, alertas y el borrador completo.
7. Puede editar días, ejercicios, series, repeticiones, descansos, técnica y progresión.
8. Solo al pulsar **Confirmar y asignar rutina** se publica y desactiva la rutina anterior.

## Reglas implementadas

- Nunca inventar ejercicios: cada propuesta lleva `ejercicioId` validado contra la biblioteca activa.
- Mantener compatibilidad con PDF: si no hay ID, el flujo antiguo continúa usando nombre y alias.
- Entrenador siempre aprueba antes de publicar.
- Distribución automática: 1–3 días full body, 4 días upper/lower, 5–7 días push/pull/legs.
- Permitir que el entrenador fuerce full body, upper/lower o push/pull/legs.
- Respetar nivel del alumno; no proponer ejercicios de nivel superior.
- Respetar ejercicios prohibidos.
- Priorizar ejercicios obligatorios y después preferidos.
- Filtro opcional de máquinas, poleas y Smith.
- Filtro opcional de saltos e impacto alto, incluido el cardio.
- Cardio siempre al final de la sesión.
- Core opcional al final del bloque de fuerza y antes del cardio.
- Fuerza: principales 3×4–6 con 120 s; accesorios 2×8–10 con 75 s.
- Hipertrofia: 3×8–12 en principales, 3×10–15 en accesorios; 90/60 s.
- Retorno o técnica: 2×10–12 con 90 s y revisión obligatoria si hay antecedentes.
- Otros objetivos: 2–3 series de 10–15 con descansos de 60–90 s.
- Si los filtros dejan la biblioteca vacía, detener y pedir corrección; no relajar reglas silenciosamente.
- Si un obligatorio no cabe o entra en conflicto, emitir alerta visible.
- Guardar snapshot del perfil, brief, resultado, reglas, alertas, entrenador y fecha para auditoría.

## Modelo de datos

La migración `0051_generador_rutinas.sql` crea:

- `perfiles_entrenamiento`: cuestionario estructurado y estado de revisión.
- `tecnicas_entrenamiento`: catálogo extensible de técnicas.
- `borradores_generador_rutinas`: trazabilidad completa.
- Metadatos nuevos en `ejercicios`: patrón, articulaciones, impacto, salto, lateralidad, complejidad, supervisión, montaje, circuito, posición, precauciones y sustitutos.

## Seguridad

- El alumno solo puede ver y editar su perfil.
- Entrenador/admin puede leer y revisar a sus alumnos.
- Solo el entrenador asignado puede crear borradores y publicar.
- Las Server Actions vuelven a validar rol y propiedad; la interfaz no es el control de seguridad.
- Antecedentes de salud generan alerta, nunca una decisión clínica automática.

## Puesta en marcha

1. Crear una rama de pruebas.
2. Aplicar `supabase/migrations/0051_generador_rutinas.sql` en el proyecto de pruebas.
3. Abrir `/alumno/mi-entrenamiento` con una cuenta de alumno y guardar un perfil.
4. Abrir `/admin/generador`, generar un borrador y revisarlo.
5. Publicar a un alumno de prueba y confirmar imágenes, videos, orden, cardio e Impulso VIP.
6. Completar gradualmente los metadatos de ejercicios. Los valores por defecto permiten comenzar sin clasificarlos todos.
7. Probar primero con 3–5 alumnos ficticios o internos antes de usarlo con alumnos reales.

## Trabajo siguiente recomendado

- Pantalla CRUD específica para técnicas de entrenamiento.
- Editor visual de metadatos de prescripción y sustitutos en la galería de ejercicios.
- Regeneración parcial de un día o sustitución con tres alternativas.
- Uso del historial de cargas y adherencia para conservar o rotar ejercicios.
- Cálculo de volumen semanal por grupo muscular y límites configurables por entrenador.
- Restricciones operativas de sala: estaciones ocupadas, montaje y supervisión simultánea.
- Capa opcional de Claude para interpretar observaciones y explicar elecciones. Claude nunca debe saltarse el motor de reglas ni devolver nombres sin ID.

## Mensaje de continuidad para Claude

> Estás continuando el proyecto VIP Fitness Portal. Ya existe un MVP funcional del Generador de Rutinas dentro del portal, no en una aplicación separada. Lee primero `AGENTS.md`, `docs/GENERADOR_RUTINAS_VIP.md`, `supabase/migrations/0051_generador_rutinas.sql`, `src/lib/generador-rutinas/tipos.ts`, `src/lib/generador-rutinas/motor.ts`, `src/app/admin/generador/actions.ts` y `src/components/admin/GeneradorRutinasPanel.tsx`. No reemplaces el motor por un prompt libre. Toda rutina debe usar IDs activos de `ejercicios`, respetar prohibidos y requerir aprobación del entrenador. El flujo antiguo de PDF debe seguir funcionando. Antes de escribir código Next.js, lee la guía relevante en `node_modules/next/dist/docs/`. Las próximas prioridades son: (1) CRUD de técnicas; (2) editar metadatos de prescripción en la galería; (3) reemplazo/regeneración parcial; (4) volumen semanal configurable; (5) restricciones operativas de sala; (6) capa Claude con salida estructurada limitada a IDs candidatos y validación posterior. Ejecuta pruebas, TypeScript, lint focalizado y build antes de entregar. No publiques ni apliques cambios en producción sin autorización explícita.

