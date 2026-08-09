# Handoff para Claude — Generador de Rutinas VIP Fitness

## Instrucción principal

Claude es el agente principal para continuar este trabajo. Este documento es la fuente de verdad del traspaso. Antes de modificar código, lee también `AGENTS.md` y la documentación relevante de Next.js 16 en `node_modules/next/dist/docs/`, tal como exige el proyecto.

No se solicitó commit, push ni publicación en GitHub. Los cambios están guardados localmente en `C:\dev\vip-fitness` y permanecen sin commit para que Claude los revise y continúe.

## Decisión de arquitectura

El generador forma parte del portal VIP Fitness. No debe convertirse en una aplicación separada.

- Portal del entrenador: selección del alumno, brief, generación, revisión y publicación.
- Portal del alumno: declaración de objetivo, disponibilidad, experiencia, preferencias y antecedentes.
- Pantalla Entrenar: recibe únicamente la rutina aprobada por el entrenador.

Esto permite reutilizar autenticación, RLS, alumnos, biblioteca de ejercicios, fotos, videos, rutinas, sesiones, historial e Impulso VIP.

## Estado implementado

### Base de datos

Se creó `supabase/migrations/0051_generador_rutinas.sql` con:

- `perfiles_entrenamiento`.
- `tecnicas_entrenamiento`.
- `borradores_generador_rutinas`.
- Políticas RLS.
- Biblioteca inicial de técnicas.
- Metadatos nuevos para ejercicios: patrón, articulaciones, impacto, salto, lateralidad, complejidad, supervisión, montaje, circuito, posición, precauciones y sustitutos.

La migración está escrita pero NO fue aplicada a Supabase. Debe probarse primero en el entorno de pruebas.

### Portal del alumno

- Ruta: `/alumno/mi-entrenamiento`.
- Acción: `src/app/alumno/mi-entrenamiento/actions.ts`.
- Interfaz: `src/components/student/PerfilEntrenamientoForm.tsx`.
- Acceso agregado al menú del alumno.
- Los antecedentes relevantes marcan `requiere_revision`.
- El sistema no diagnostica lesiones ni prescribe rehabilitación.

### Portal del entrenador

- Nueva pestaña: `/admin/generador`.
- Página: `src/app/admin/generador/page.tsx`.
- Acciones: `src/app/admin/generador/actions.ts`.
- Interfaz: `src/components/admin/GeneradorRutinasPanel.tsx`.
- Acceso rápido a biblioteca de ejercicios y flujo histórico de PDF/documentos.

### Motor de reglas

- Tipos: `src/lib/generador-rutinas/tipos.ts`.
- Motor: `src/lib/generador-rutinas/motor.ts`.
- Pruebas: `src/lib/generador-rutinas/motor.test.ts`.

Reglas actuales:

1. Usar únicamente ejercicios activos de la biblioteca VIP.
2. Cada ejercicio generado lleva un `ejercicioId` real.
3. El ID se vuelve a validar contra la biblioteca antes de publicar.
4. Los PDFs antiguos siguen usando emparejamiento por nombre/alias.
5. Ninguna rutina se publica sin aprobación del entrenador.
6. Distribución automática:
   - 1–3 días: full body.
   - 4 días: upper/lower.
   - 5–7 días: push/pull/legs.
7. El entrenador puede forzar cualquiera de esas distribuciones.
8. Respetar el nivel del alumno.
9. Respetar ejercicios prohibidos.
10. Priorizar obligatorios y luego preferidos.
11. Filtro opcional para máquinas, poleas y Smith.
12. Filtro opcional contra saltos e impacto alto, incluido el cardio.
13. Cardio siempre al final.
14. Core opcional después de fuerza y antes del cardio.
15. Si los filtros dejan cero candidatos, detener la generación.
16. Si un obligatorio no cabe, mostrar una alerta; nunca ocultar el conflicto.
17. Fuerza: principales 3×4–6/120 s; accesorios 2×8–10/75 s.
18. Hipertrofia: 3×8–12 o 10–15; 90/60 s.
19. Retorno/técnica: 2×10–12/90 s.
20. Guardar snapshot del perfil, brief, resultado, reglas y alertas.

### Publicación

`RutinaExtraida` admite ahora `ejercicioId` opcional. `src/app/admin/archivos/actions.ts` usa ese ID cuando viene del generador y conserva el emparejamiento histórico para PDFs. El borrador reutiliza `RutinaDraftEditor`, incluida la configuración de Impulso VIP.

## Verificaciones realizadas

- `npm.cmd test`: 113 pruebas aprobadas.
- `npx.cmd tsc --noEmit`: aprobado.
- ESLint focalizado sobre todos los archivos modificados: aprobado.
- `npm.cmd run build`: aprobado, incluidas las rutas nuevas.
- `git diff --check`: aprobado.

El lint global entra en `.next-preview`, una carpeta generada previamente, y reporta código compilado ajeno. No usar ese resultado para atribuir errores al módulo nuevo; ejecutar lint sobre `src` o corregir las exclusiones del proyecto.

## Archivos sin relación que no deben tocarse

- `respaldo-cloud-ia-2026-08-09.bundle` ya estaba como archivo sin seguimiento. No fue creado ni modificado por este trabajo y no debe incluirse automáticamente en un commit.
- La rama local `main` estaba 13 commits por delante de `origin/main`. No mezclar ni publicar esos commits sin que el usuario defina el alcance.

## Pasos inmediatos para Claude

1. Revisar el diff completo y este documento.
2. Crear una rama local de pruebas antes de ampliar el trabajo, solo si el usuario lo autoriza.
3. Aplicar `0051_generador_rutinas.sql` exclusivamente en Supabase de pruebas.
4. Probar el cuestionario con una cuenta de alumno ficticia.
5. Probar generación y publicación con un alumno ficticio.
6. Confirmar IDs, imágenes, videos, cardio, orden e Impulso VIP.
7. Corregir cualquier incompatibilidad encontrada en el entorno real.

## Desarrollo pendiente, en orden recomendado

### 1. CRUD visual de técnicas

Crear administración para `tecnicas_entrenamiento`: alta, edición, activación, nivel, fatiga, descansos, supervisión y máximo por sesión. Reemplazar gradualmente el texto libre `tecnica_tipo` por referencias estructuradas sin romper rutinas antiguas.

### 2. Metadatos de ejercicios

Ampliar la galería administrativa para editar los campos agregados por 0051. Incorporar selección visual de sustitutos. Mantener valores por defecto para que la migración no bloquee la biblioteca actual.

### 3. Reemplazo y regeneración parcial

- Reemplazar un ejercicio mostrando tres alternativas compatibles.
- Regenerar únicamente un día.
- Reducir duración o fatiga sin destruir el resto del borrador.
- Mantener manualmente ejercicios bloqueados por el entrenador.

### 4. Volumen semanal

Calcular series por grupo muscular y permitir mínimos/máximos configurables según objetivo, experiencia y decisión del entrenador. Mostrar advertencias, no modificaciones silenciosas.

### 5. Historial e Impulso VIP

Usar sesiones anteriores para conservar ejercicios con progresión, detectar estancamiento, evitar movimientos asociados a alertas de dolor y sugerir rotación. El historial orienta; el entrenador aprueba.

### 6. Operación de sala

Modelar disponibilidad de máquinas, tiempo de montaje, estaciones ocupadas, capacidad para circuitos y necesidad de supervisión. Evitar programaciones impracticables para un gimnasio semipersonalizado.

### 7. Capa opcional de Claude

Claude puede interpretar observaciones, explicar decisiones y proponer combinaciones, pero debe recibir una lista acotada de IDs candidatos. La respuesta debe ser estructurada, validada con Zod y pasada nuevamente por el motor de reglas. Nunca aceptar un nombre inventado ni permitir que la IA relaje prohibiciones.

## Criterios que no se pueden romper

- El alumno informa; el entrenador decide.
- La IA propone; nunca publica.
- Toda referencia visual depende de un ID real.
- No diagnosticar ni tratar lesiones.
- No relajar filtros silenciosamente.
- No eliminar compatibilidad con PDFs históricos.
- No aplicar migraciones ni desplegar a producción sin autorización explícita.
- No hacer commit o push hasta confirmar el alcance con el usuario.

Para una descripción complementaria del producto, leer `docs/GENERADOR_RUTINAS_VIP.md`.
