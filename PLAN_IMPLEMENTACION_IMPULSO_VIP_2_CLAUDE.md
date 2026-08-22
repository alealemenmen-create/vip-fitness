# Encargo para Claude — Impulso VIP 2.0

## Instrucción principal

Implementa **Impulso VIP 2.0 dentro del portal VIP Fitness existente**. No lo conviertas en una aplicación, página o motor separado. Antes de editar:

1. Lee `AGENTS.md` completo.
2. Lee la guía relevante de Next.js 16 indicada allí.
3. Revisa el estado de Git y preserva todo cambio ajeno.
4. Lee por completo los archivos actuales relacionados con Impulso VIP, especialmente:
   - `src/components/student/SesionEjercicioCard.tsx`
   - `src/components/student/SesionGrupoCard.tsx`
   - `src/app/alumno/entrenar/actions.ts`
   - `src/app/alumno/entrenar/impulso-actions.ts`
   - `src/lib/impulso-vip/data.ts`
   - `src/lib/impulso-vip/motor.ts`
   - `src/lib/impulso-vip/tipos.ts`
   - pruebas existentes de `src/lib/impulso-vip/`
   - migraciones `0043` en adelante relacionadas con Impulso VIP.

No apliques migraciones, no despliegues, no hagas commit y no hagas push sin autorización explícita.

---

## Problema real que se debe solucionar

El alumno a veces conoce el Impulso VIP demasiado tarde. Termina sus series, responde la pregunta de esfuerzo y recién después comprende que había una meta de peso o repeticiones. En la práctica puede haber realizado incluso el ejercicio siguiente antes de entender la recomendación.

Esto destruye el valor del sistema: una recomendación vista después de actuar no es una guía, sino una explicación atrasada.

También existe confusión conceptual. La pregunta **“¿Cómo sentiste este ejercicio?”** no genera una orden para una supuesta serie siguiente. Se responde una vez al finalizar el ejercicio completo y alimenta el cálculo de sesiones futuras. Si un ejercicio tiene dos series, la pregunta aparece después de la segunda porque el ejercicio terminó; no significa que esté ordenando una tercera serie.

Impulso VIP 2.0 debe eliminar esa ambigüedad.

---

## Principio funcional obligatorio

> Ningún alumno puede comenzar un ejercicio compatible con Impulso VIP sin haber visto y comprendido primero la meta que debe intentar.

La recomendación se calcula y congela al crear la sesión, como ocurre actualmente. No debe recalcularse improvisadamente entre series. Debe mostrarse **antes de la primera serie**, permanecer visible durante el ejercicio y evaluarse únicamente al finalizarlo.

La secuencia obligatoria es:

**Ver meta → comenzar ejercicio → realizar todas las series → responder esfuerzo → ver meta del siguiente ejercicio → comenzar el siguiente.**

Nunca:

**Realizar ejercicio → descubrir tarde la meta.**

---

## Experiencia exacta del alumno

### 1. Al comenzar la sesión

Después de crear/cargar la sesión y antes del primer ejercicio, mostrar un resumen compacto:

- “Hoy tienes Impulso VIP en X ejercicios”.
- Explicación breve la primera vez que el alumno lo usa:
  - “Impulso VIP es tu meta personalizada para progresar. Mírala antes de comenzar cada ejercicio.”
- Botón: **“Ver mi primer Impulso”**.

No crear un tutorial largo ni obligarlo a leerlo en cada sesión. Registrar localmente o en el dato existente que la explicación inicial ya fue vista, si el proyecto ya dispone de una forma apropiada. Evitar una migración solo para este detalle salvo que sea verdaderamente necesaria y esté autorizada.

### 2. Antes de cada ejercicio compatible

Cuando el ejercicio pasa a ser el ejercicio activo y todavía no tiene series realizadas, mostrar una presentación previa clara, imposible de confundir con historial:

**IMPULSO VIP — TU META AHORA**

Ejemplo con carga:

> Prensa inclinada  
> Hoy intenta **25 kg × 10–12 repeticiones en cada serie**.

Ejemplo solo repeticiones:

> Dominadas asistidas  
> Hoy intenta completar **8–10 repeticiones en cada serie**.

Debe incluir:

- nombre del ejercicio;
- peso sugerido, cuando corresponda;
- rango de repeticiones o meta aplicable;
- cantidad de series;
- justificación muy corta y humana;
- botón principal **“Entendido, comenzar ejercicio”**.

El alumno no debe poder iniciar el temporizador ni marcar la primera serie antes de confirmar esta presentación. No bloquear la navegación general ni impedir abandonar la sesión; el bloqueo aplica solo al comienzo del ejercicio.

Si el ejercicio se reabre y ya tiene al menos una serie realizada, no volver a interrumpir con la presentación. La meta debe seguir visible dentro de la tarjeta.

### 3. Durante las series

Mantener una franja compacta y siempre visible dentro de la tarjeta activa:

> Impulso de hoy: **25 kg · 10–12 reps**

Además:

- precargar automáticamente el peso sugerido en las series sin registro;
- precargar la meta de repeticiones cuando el diseño actual lo permita;
- no sobrescribir valores que el alumno ya registró;
- no modificar retroactivamente series realizadas;
- mantener accesibles la técnica, descansos, dolor y controles existentes;
- no abrir encuestas entre series.

### 4. Al terminar la última serie

Preguntar una sola vez:

**“¿Cómo sentiste este ejercicio?”**

Mantener las alternativas actuales o equivalentes:

- Estuvo fácil.
- Podía hacer más.
- Estuvo justo.
- Estuvo muy difícil.
- No pude completarlo.

Agregar una frase inequívoca:

> “Tu respuesta prepara el Impulso de la próxima sesión; no agrega otra serie ahora.”

La respuesta debe guardarse inmediatamente. Si falla el guardado, conservarla localmente y permitir reintentar; no avanzar fingiendo que se guardó.

### 5. Transición al ejercicio siguiente

Después de responder correctamente:

1. Cerrar la encuesta.
2. Marcar visualmente el ejercicio terminado.
3. Llevar al alumno al siguiente ejercicio activo.
4. Mostrar **antes que cualquier serie** la presentación de su próximo Impulso.

No debe existir un estado donde el siguiente ejercicio se vea listo para ejecutar mientras su meta permanece oculta debajo, fuera de pantalla o detrás de otro modal.

Para ejercicios sin Impulso calculable, mostrar una indicación explícita en vez de silencio:

> “Completa y registra bien este ejercicio. Con estos datos prepararemos tu próximo Impulso VIP.”

El botón en ese caso puede decir **“Comenzar y registrar”**.

### 6. Al finalizar la sesión

Mostrar un resumen breve:

- metas cumplidas;
- metas superadas;
- metas parciales/no cumplidas;
- ejercicios que quedaron solo como registro inicial.

Usar lenguaje motivador, nunca culpabilizador. Ejemplo:

> “Cumpliste 4 de 5 Impulsos. Tu próxima sesión ya tendrá metas más precisas.”

No diagnosticar, prescribir tratamientos ni premiar entrenar con dolor.

---

## Cobertura: debe llegar a la mayoría

Actualmente Impulso puede no aparecer porque una asignación no tiene configuración de progresión, especialmente en rutinas históricas, porque falta historial suficiente o porque el ejercicio fue excluido correctamente.

Implementar esta política:

### Nivel A — Impulso completo

Mostrar meta personalizada cuando exista información confiable y el ejercicio sea compatible.

### Nivel B — Impulso inicial de registro

Cuando no exista historial suficiente, no ocultar Impulso VIP. Mostrar una misión inicial:

> “Registra peso y repeticiones de todas tus series. Esta será la base de tu próximo Impulso.”

Este estado debe contar como cobertura de Impulso, pero no inventar una carga.

### Nivel C — Excluido con explicación

Excluir solo cuando exista una razón concreta, por ejemplo:

- alerta de dolor o seguridad;
- ejercicio bloqueado hasta revisión del entrenador;
- técnica que no se representa bien con progresión tradicional: biserie, triserie, circuito, dropset, rest-pause, AMRAP, cluster u otra ya contemplada por el motor;
- progresión desactivada explícitamente por el entrenador.

No mostrar una pantalla vacía. Comunicar de forma breve:

> “Este ejercicio se guía por técnica, no por aumento automático de carga.”

### Rutinas nuevas e históricas

- Las rutinas nuevas compatibles deben nacer con progresión activada por defecto, como pretende el flujo actual.
- Para rutinas históricas sin fila de configuración, definir un fallback seguro de **registro inicial**, no asumir automáticamente un aumento de peso.
- No crear datos masivos ni modificar rutinas publicadas mediante migración sin autorización.
- El fallback debe resolverse en la lectura/generación de la sesión o mediante el mecanismo menos invasivo compatible con la arquitectura actual.

Objetivo del producto: que la gran mayoría de ejercicios medibles muestre un Impulso completo o inicial. Los excluidos deben ser explicables y medibles.

---

## Reglas del motor que no se pueden romper

1. La recomendación se genera en el servidor y queda congelada al crear la sesión.
2. No confiar en pesos, IDs, estados ni cumplimiento enviados por el cliente sin revalidación.
3. El historial orienta la progresión; no se inventan cargas cuando faltan datos.
4. Dolor o alerta de seguridad tiene prioridad sobre cualquier progresión.
5. Una recomendación bloqueada nunca debe mostrarse como “meta del día”.
6. Una recomendación pendiente de aprobación del entrenador no debe presentarse como una orden aprobada. Mantener el estado visible y aplicar la política existente.
7. No premiar como cumplida una meta que no fue mostrada antes de comenzar.
8. No pedir dificultad por serie. Se pregunta una vez al completar el ejercicio.
9. No agregar una serie nueva después de la encuesta.
10. No eliminar compatibilidad con sesiones ya iniciadas ni recomendaciones históricas.

---

## Arquitectura sugerida

No dupliques el motor. Conserva la separación actual:

- `src/lib/impulso-vip/motor.ts`: reglas puras de progresión y evaluación.
- `src/lib/impulso-vip/data.ts`: lectura, creación y congelamiento de recomendaciones.
- Server Actions de Entrenar: mutaciones, guardado de series, esfuerzo y cumplimiento.
- `SesionEjercicioCard.tsx` / `SesionGrupoCard.tsx`: máquina de estados visual del alumno.

Modela explícitamente en el cliente el estado de presentación del ejercicio, por ejemplo:

- `pendiente_de_ver_meta`
- `listo_para_entrenar`
- `entrenando`
- `pendiente_de_esfuerzo`
- `completado`

No es obligatorio usar esos nombres, pero el flujo debe ser determinista y testeable. Evita inferir todo mediante varios booleanos contradictorios.

La confirmación **“Entendido, comenzar ejercicio”** es un estado de interfaz, no una aprobación clínica ni una modificación de la recomendación. Persistirla en servidor solo si es necesario para demostrar que la meta fue vista o para recuperar correctamente una sesión en otro dispositivo. Si se persiste, requiere diseño de datos y autorización antes de crear una migración.

Mantén la frontera de Next.js:

- lecturas sensibles y cálculo en Server Components/librerías de servidor;
- mutaciones mediante Server Actions;
- componentes cliente sin acceso directo a secretos ni consultas privilegiadas;
- props serializables entre servidor y cliente;
- revalidación de rol, alumno, sesión y propiedad en cada acción.

---

## Técnicas encadenadas y grupos

`SesionGrupoCard.tsx` necesita el mismo comportamiento, sin romper biseries o triseries:

- si el grupo está excluido de progresión tradicional, mostrar una presentación previa orientada a ejecución/registro, no metas falsas por cada ejercicio;
- si el diseño permite Impulso individual en ejercicios compatibles de un grupo, mostrar todas las metas antes de iniciar la primera ronda;
- nunca interrumpir una biserie entre A y B con una encuesta o modal;
- preguntar esfuerzo al finalizar el bloque en el momento compatible con el modelo actual, sin duplicar respuestas.

Claude debe revisar el comportamiento actual antes de decidir la variante exacta y añadir pruebas específicas.

---

## Observabilidad y medición

Sin desplegar un sistema analítico nuevo innecesario, dejar preparados o calcular con datos existentes estos indicadores:

- porcentaje de ejercicios compatibles con Impulso completo;
- porcentaje con Impulso inicial de registro;
- porcentaje excluido y motivo;
- porcentaje de metas vistas antes de la primera serie, si existe persistencia confiable;
- porcentaje de ejercicios con encuesta respondida;
- cumplimiento: superada, cumplida, parcial y no cumplida.

Registrar fallos de generación de recomendación en servidor. Actualmente algunos fallos se degradan en silencio para no impedir iniciar la sesión; se puede conservar la degradación funcional, pero el fallo debe ser observable y el alumno debe recibir el estado inicial de registro.

---

## Pruebas obligatorias

Añadir pruebas unitarias y, donde sea razonable, pruebas de componentes o integración para estos casos:

1. Alumno con recomendación aprobada ve la meta antes de habilitar la primera serie.
2. La meta precarga peso/repeticiones sin pisar registros existentes.
3. Después de la primera serie no aparece la encuesta.
4. En un ejercicio de dos series, la encuesta aparece después de la segunda y aclara que no hay tercera serie.
5. Después de responder, se presenta la meta del ejercicio siguiente antes de poder iniciarlo.
6. Sin historial se muestra Impulso inicial de registro.
7. Rutina histórica sin configuración no queda silenciosamente sin Impulso.
8. Dolor/recomendación bloqueada impide mostrar una progresión normal.
9. Técnica encadenada no abre modales entre ejercicios del mismo bloque.
10. Reabrir una sesión con series hechas no vuelve a bloquear con una meta ya superada en el flujo.
11. Fallo de guardado de dificultad no pierde la respuesta ni avanza engañosamente.
12. El cumplimiento se evalúa contra la recomendación congelada, nunca contra una recalculada después.

Ejecutar al final:

- TypeScript (`tsc --noEmit`).
- Pruebas de Impulso VIP y Entrenar.
- Suite completa de Vitest si el tiempo lo permite.
- Lint focalizado sobre archivos modificados.
- `npm run build` si el entorno y el tiempo lo permiten.

No declarar éxito si alguna comprobación relevante falla. Explicar con exactitud cualquier bloqueo externo.

---

## Criterios de aceptación del entrenador

La implementación está terminada únicamente si se cumplen todos:

- El alumno conoce la meta antes de iniciar el ejercicio.
- La meta permanece visible durante las series.
- La encuesta aparece solo al terminar el ejercicio completo.
- La encuesta deja claro que prepara la próxima sesión y no agrega una serie.
- El siguiente Impulso aparece antes de comenzar el siguiente ejercicio.
- Los alumnos sin historial reciben una misión inicial de registro.
- Las rutinas históricas no quedan excluidas silenciosamente.
- Las exclusiones tienen una razón visible y segura.
- Dolor y alertas siempre frenan la progresión automática.
- El entrenador conserva control sobre aprobación y configuración.
- No se rompen descansos, técnicas encadenadas, guardado automático, recuperación local ni sesiones ya iniciadas.
- Existe cobertura de pruebas para el orden temporal completo.

---

## Texto final que debe guiar todas las decisiones

Impulso VIP no es un mensaje de felicitación ni una explicación posterior. Es una instrucción personalizada que el alumno debe conocer **antes** de levantar el peso.

Si una pantalla, animación, encuesta o guardado permite que el alumno actúe antes de ver la meta, el flujo sigue estando mal aunque el cálculo matemático sea correcto.

Implementa primero el orden temporal perfecto; después mejora la estética. La experiencia buscada es simple:

> “Sé exactamente qué debo intentar ahora, lo registro sin fricción y al terminar ayudo al sistema a preparar mi próximo avance.”

