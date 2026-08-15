# Informe: problemas y mejoras — Entrenamiento Activo (VIP Fitness)

Fecha: 2026-08-14
Rama: `codex/rutina-activa-redesign`
Preparado por: Claude, a partir de auditoría de código (comparación contra `main`) + consulta de datos reales de uso (últimos 14 días, 419 sesiones).

Este documento está pensado para poder pegarse en ChatGPT u otra IA si Alejandro quiere una segunda opinión sobre las soluciones propuestas.

---

## 1. Sesiones que quedan "colgadas" en progreso

### El problema, con datos reales
En los últimos 14 días hubo 419 sesiones de entrenamiento. De ellas:

- 279 completadas (66.6%)
- 67 en progreso al momento de la consulta
- 52 finalizadas incompletas (12.4%)
- 21 abandonadas explícitamente (5%)

De las que estaban "en progreso", **35 llevaban más de 3 días abiertas** sin que el alumno las cerrara ni las abandonara. Es decir: empezaron a entrenar, en algún momento se fueron (se les acabó la batería, cerraron la app, simplemente no volvieron), y la sesión quedó viva en la base de datos indefinidamente.

### Por qué importa
Revisando `src/components/student/BottomNav.tsx`, la pestaña "Entrenar" redirige a la sesión abierta mientras exista una `en_progreso` (`sesionEnProgresoId`). Esto es intencional — así el alumno vuelve exactamente donde dejó — pero tiene un efecto colateral: **si esa sesión de hace 5 días quedó colgada, el alumno que quiere arrancar una rutina nueva hoy sigue cayendo en la vieja**, sin darse cuenta de por qué.

### Solución propuesta
Ya existe toda la lógica necesaria, no hay que inventar nada de cero:

- `abandonarSesion(formData)` en `src/app/alumno/entrenar/actions.ts:853` — ya marca una sesión como `abandonada`.
- El componente `AvisoSesionSinCerrar` (usado en `src/app/alumno/layout.tsx:153`) ya muestra un aviso cuando hay una sesión sin cerrar.

Lo que falta es un **umbral de tiempo**: hoy ese aviso probablemente se muestra siempre que hay una sesión abierta, sin distinguir "la dejé hace 20 minutos, voy a seguir" de "la dejé hace 4 días, seguro me olvidé". Propuesta concreta:

1. En el mismo lugar donde se calcula `sesionEnProgresoId` (revisar de dónde sale ese dato en el layout), agregar un chequeo: si `rutina_iniciada_en` (o `hora_inicio`) tiene más de, por ejemplo, **12-24 horas**, mostrar un mensaje distinto: *"Tenés una rutina sin cerrar de hace 3 días — ¿la seguís o la cerramos?"* con dos botones: **Seguir** (la abre normal) y **Cerrar esta y empezar otra** (llama `abandonarSesion` y deja pasar al alumno a elegir rutina nueva).
2. Alternativa más agresiva (no recomendada sin hablarlo primero): un cron/job que auto-abandone sesiones de más de N días. Esto es más invasivo porque cambia datos sin que el alumno lo pida — mejor la opción 1, que deja la decisión en manos del alumno.

**Esfuerzo estimado:** bajo-medio. No requiere tabla nueva ni servidor action nueva, solo UI + un chequeo de fecha.

---

## 2. Los alumnos "hackean" el campo Nota para cosas que no tienen su propio lugar

### El problema, con datos reales
Sobre una muestra de 1000 registros de ejercicios de los últimos 14 días, 35 tenían una nota escrita a mano. Patrones que se repiten:

- **Cardio extra no programado**: *"Agrego 15 min de bicicleta"*, *"Hicimos 10 minutos de bicicleta modo hit"*.
- **Series extra hechas y anotadas a mano**: *"Serie extra 40 kg 10 rep"*, *"1 serie adicional con 15 repeticiones"*.
- **Sustitución de ejercicio**: *"La cambié por planchas"*, *"Primero hice dominadas"*.
- **Dolor reportado en el lugar equivocado**: *"Dolor de rodilla"*, *"Dolor espalda baja"* (x2) — esto en el campo Nota genérico, no en "Alguna molestia" (que además estaba oculto por un bug hasta que lo arreglamos hoy mismo — ver sección 4).

### Por qué importa
Esto no es un capricho de diseño: son alumnos reales, activamente, tratando de comunicarte algo para lo que la pantalla no tiene un lugar claro. El campo Nota funciona como "cajón de sastre" porque no hay una alternativa mejor.

### Propuestas (a decidir con vos, no las metí de cero sin preguntar)

**2.a — Actividad extra / cardio (recomendado, esfuerzo bajo-medio)**
Un botón chico, similar a "Alguna molestia", que abra un formulario mínimo: tipo de actividad (texto libre o unos pocos chips: "Cardio", "Estiramiento", "Otro") + minutos. Se guarda como un campo aparte (nueva columna o tabla chica, ej. `actividad_extra_sesion`), no mezclado con las series. Esto le da al entrenador un dato limpio y filtrable en vez de tener que leer texto libre.

*¿Suma puntos Ranked?* Tu decisión — se puede dejar como registro informativo nomás, sin puntaje, para no complicar la fórmula de puntos que ya está bien definida y calibrada.

**2.b — Serie extra (esfuerzo bajo — ya existe para biseries)**
Para biserie/triserie ya existe "+ Añadir ronda extra" (`SesionGrupoCard.tsx`). Para ejercicio suelto, no vi el equivalente. Se podría portar el mismo patrón: un botón chico "+ Agregar serie extra" que agregue una fila más al formulario, sin necesidad de nota de texto.

**2.c — Sustituir ejercicio (esfuerzo medio-alto, es un feature nuevo real)**
Esto es más grande: implica decidir de dónde sale la lista de ejercicios sustitutos (¿libres? ¿sugeridos por grupo muscular?), si el entrenador necesita aprobarlo o se entera después, y cómo queda registrado en el historial (¿se guarda como si fuera el ejercicio original, o se anota la sustitución?). Lo dejaría para una conversación aparte, no es un ajuste chico.

---

## 3. Bugs encontrados y ya corregidos hoy (para que quede registrado)

1. **Layout roto cuando la serie activa tenía una técnica asignada** (ej. "Rest-pause"): un elemento extra rompía un grid de 3 columnas pensado para exactamente 2 campos + separador. El peso terminaba flotando arriba a la derecha y las repeticiones abajo a la izquierda. — `globals.css`, regla de `.pill-tecnica-serie` en modo destacado.
2. **"Completar y guardar" (cerrar un ejercicio con series incompletas) quedaba oculto por CSS**, sin ningún reemplazo — un alumno no tenía forma de cerrar un ejercicio a medias (lesión, falta de tiempo). Se restauró como link chico "Cerrar ejercicio con series pendientes".
3. **Impulso VIP no avisaba nada visualmente en biseries/triseries** — la recomendación se aplicaba al peso/reps sugerido pero sin ningún rayo/indicador, a diferencia del ejercicio suelto. Se agregó el mismo indicador.
4. **Bug de TypeScript real**: `grupos.map(renderizarGrupo)` pasaba el índice del array como si fuera el flag de "mostrar navegación", pudiendo activar los botones Anterior/Siguiente por accidente en la vista de solo lectura. Corregido.
5. **Nota y "Alguna molestia" estaban ocultas por CSS** en el modo enfocado nuevo — coincide exactamente con los alumnos escribiendo "Dolor de rodilla" en el campo de nota genérico en vez de usar el botón dedicado (sección 2). Restauradas.
6. **Tres definiciones contradictorias de `.tarjeta-ejercicio-enfocada`** en el CSS (dos muertas, de iteraciones anteriores del rediseño) — hoy no rompe nada porque el orden de cascada resuelve bien, pero es una bomba de tiempo para cambios futuros. **Pendiente de limpieza** (no crítico, pero hay que hacerlo).
7. **Biserie/triserie no tiene los mismos ajustes de pantalla chica** (`@media max-height`, 360px de ancho) que sí tiene el ejercicio suelto. **Pendiente de arreglo** — riesgo real en iPhone SE o con "Texto grande" activado.

---

## 4. Búsqueda en curso

Está corriendo ahora mismo una tercera pasada de revisión, esta vez buscando:
- Bugs nuevos no relacionados con la comparación contra `main` (casos borde: rutina vacía, ejercicio con 0 series, race conditions).
- Oportunidades de mejora de producto: progreso histórico visible en pantalla, saltear un ejercicio completo, feedback offline, aviso al entrenador en tiempo real cuando hay un reporte de dolor, ideas de gamificación.

Se agrega a este informe apenas termine.
