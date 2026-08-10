# HANDOFF 1.10

## PUNTO DE REGRESO

Rama: `main`. **Nada de esta sesión está commiteado** — a diferencia de handoffs anteriores, todo el trabajo abajo descrito vive como cambios locales sin commitear. Último commit real: `26e4acf` (Agregar generador de rutinas VIP con reglas y perfiles — el merge de la otra compu que se trajo al principio de esta sesión).

```
Modified:
  src/app/admin/archivos/actions.ts
  src/app/admin/generador/actions.ts
  src/app/admin/generador/page.tsx
  src/app/admin/layout.tsx
  src/components/admin/GeneradorRutinasPanel.tsx
  src/components/admin/RutinaDraftEditor.tsx
  src/lib/generador-rutinas/motor.test.ts
  src/lib/generador-rutinas/motor.ts
  src/lib/generador-rutinas/tipos.ts

Untracked (nuevos):
  src/components/admin/SelectorGruposDia.tsx
  src/lib/generador-rutinas/data.ts
  src/lib/generador-rutinas/mensajeEncuesta.ts
  src/lib/generador-rutinas/mensajeEncuesta.test.ts
  src/lib/generador-rutinas/serializar.ts
  supabase/migrations/0052_generador_rutinas_avanzado.sql
  supabase/migrations/0053_tecnicas_adicionales.sql
```

**No se commiteó ni pusheó nada a propósito** — no se pidió explícitamente en esta sesión. Si el usuario quiere, el próximo paso lógico es revisar el diff y commitear.

**Migraciones de Supabase:**
- `0049`, `0050`, `0051`, `0052` — **corridas**, confirmado por el usuario ("listo los 4 sql").
- `0053_tecnicas_adicionales.sql` — **el usuario la pidió recién** (le pasé el contenido en el chat para pegar en el SQL Editor). No hay confirmación todavía de que la haya corrido. Sin ella, el checklist de técnicas en el generador solo muestra las 8 originales (Biserie, Superserie, Triserie, Circuito, Drop set, Rest-pause, Tempo controlado, Isometría) — faltan "Fallo muscular" y "Cluster set".

**Stash sin tocar** (de una sesión anterior, tema aparte — editor de rutina en texto plano): `stash@{0}` y `stash@{1}` en la rama `agent/interfaz-entrenamiento-enfocada`. No se tocaron en esta sesión.

**Servidor de dev:** corriendo en `localhost:3001` vía el Browser pane (`preview_start` con nombre `vip-dev`). Cuenta de prueba usada para todo lo que necesitó publicar de verdad: `1@1.com` / `111111` (Entrenador Prueba, tiene su propio perfil de alumno dual — ahí quedaron varias rutinas de prueba publicadas, v2/v3/v4, sin problema, es la cuenta para eso).

Esta sesión arrancó sincronizando `main` con trabajo hecho en otra computadora (rama `claude/respaldo-generador-rutinas-vip`, ya mergeada — ver commit `26e4acf`) y siguió con **cuatro rondas grandes** de mejoras al generador de rutinas (`/admin/generador`), todas a pedido del usuario tras probarlo en vivo cada vez.

## Qué se hizo, en orden

### 0. Sync inicial de rama
Se trajo a `main` el trabajo de la otra computadora (generador de rutinas base, sistema de ingresos, video Cloudflare Stream, rediseño de UI de alumno). Fast-forward limpio. Se corrigieron dos bugs de encoding/columnas que arrastraba ese trabajo (ver más abajo).

### 1. Generador de rutinas — primera ronda (arreglos base)
- **Bug real corregido**: el motor llenaba un día "tren superior" solo con espalda si esos ejercicios puntuaban más alto — ya no había garantía de que aparecieran todos los grupos objetivo. Fix: sistema de "cupos" por grupo muscular (`elegirPorCupos` en `motor.ts`), cada grupo tiene su propio cupo mínimo garantizado.
- Selector de alumnos multi-select (reusa `SelectorAlumnos` ya existente) — una rutina se puede asignar a varios alumnos a la vez.
- Distribución "personalizada" (antes `bro_split`, topaba en 2 grupos): el entrenador elige a mano qué grupo(s) entrena cada día, sin tope — evidencia real: rutinas del usuario con "Espalda + Hombros + Brazos + Abdomen" en un mismo día.
- Volumen de series por experiencia (principiante 3-4, intermedio 3, avanzado 4-5 según intensidad).
- Borrador de rutina (`RutinaDraftEditor.tsx`) rediseñado: acordeón por día, colapsado por defecto (antes era scroll infinito).

### 2. Segunda ronda (header, cuestionario más rico, WhatsApp, documento)
- Header del panel de admin más compacto (`admin/layout.tsx`).
- Técnicas de intensidad seleccionables (automático/sí/no) en vez de forzadas solo para avanzado.
- Grupo muscular prioritario (se entrena primero en la semana).
- Enfoque de forma (amplitud/densidad/definición) — heurística por nombre de ejercicio, no hay columna estructurada para esto.
- Formulario del generador reestructurado en acordeón (`GavetaConfig`, mismo patrón que `/admin/configuracion`) con resumen visible cuando está cerrado.
- Tarjeta "Alumnos sin rutina activa" con acceso rápido.
- Botón de WhatsApp por alumno con mensaje predeterminado (`mensajeEncuesta.ts`) pidiendo objetivo, lesiones, días disponibles, etc.
- Nombre de rutina con versión: "Plan hipertrofia — Alumno — v3" (cuenta rutinas previas del alumno).
- **Rutina publicada se guarda como documento de texto** visible en "Mis planes" del alumno (antes solo quedaba en tablas internas, sin rastro legible). Serializador ahora vive en `src/lib/generador-rutinas/serializar.ts` (compartido cliente/servidor).
- **Dos bugs reales encontrados probando en vivo** (no en tests, en el navegador):
  1. `sexo` y `telefono` viven en la tabla `alumno_perfil`, no en `perfiles` — estaban mal consultados, así que el "énfasis por sexo" **nunca funcionó desde la primera versión** y el botón de WhatsApp no cargaba ningún alumno. Corregido en `generador/actions.ts` y `generador/page.tsx`.
  2. Los documentos de texto guardaban los acentos rotos (`Ã­` en vez de `í`) por falta de charset UTF-8 explícito en la subida a Storage. Corregido codificando a mano con `TextEncoder`.

### 3. Tercera ronda (sub-grupos de pierna, inspiración de estilo, objetivo real)
- **Sub-grupos de pierna**: Glúteo/Cuádriceps/Femoral/Pantorrilla seleccionables por separado en "Personalizada", además de "Piernas" combinado — heurística por nombre (`PALABRAS_SUBGRUPO` en `motor.ts`), igual patrón que enfoque de forma.
- **Inspiración de estilo**: 4 arquetipos inspirados en corrientes reales del culturismo que el usuario investigó y pasó (Sam Sulek, Nick Walker, Hadi Choopan, CBum, Derek Lunsford, Keone Pearson, Jeff Nippard, Urs Kalecinski, y sus equivalentes femeninos) — **no reproduce rutinas exactas de nadie**, encodea el enfoque general de cada corriente: alta intensidad al fallo, volumen tradicional, híbrido de tensión mecánica, científico con RIR.
- **Bug de personalización real corregido**: el campo "Objetivo" (hipertrofia/pérdida de grasa/rendimiento/etc.) solo cambiaba el nombre de la rutina, no afectaba nada del motor. Ahora ajusta reps, series y prioriza tipos de ejercicio según el objetivo.
- Línea de "Combinación única de esta rutina" en las reglas aplicadas, para que el entrenador vea qué factores se combinaron.

### 4. Cuarta ronda (técnicas reales, edad, variedad, selector de ejercicios, vista previa)
- **Checklist real de técnicas** en el cuestionario (antes solo automático/sí/no): se listan las técnicas reales de `tecnicas_entrenamiento` con checkbox, el entrenador elige exactamente cuáles permitir. Se agregaron "Fallo muscular" y "Cluster set" (migración `0053`, pendiente de correr).
- **Ajuste por edad**: 60+ una serie menos, 70+ dos menos (con piso de 2). El perfil por defecto del entrenador es exigente/alta densidad; esto lo atempera con la edad real del alumno (`alumno_perfil.fecha_nacimiento`, vía `calcularEdad` de `src/lib/date.ts`).
- **Variedad respecto a la rutina anterior**: se lee la última rutina activa del alumno (`rutina_dia_ejercicios.ejercicio_id`) y se penaliza (no se excluye) en el puntaje para que la siguiente rutina no sea calcada.
- **Título con nivel y enfoque**: "Plan hipertrofia avanzado — enfoque piernas — Alumno — v3".
- **Orden de ejercicios por tamaño de grupo muscular** dentro de un día combinado: piernas > espalda > pecho > hombros > brazos > core, salvo que gane el grupo prioritario.
- **Alerta de mínimo por grupo**: avisa si un día enfocado (≤2 grupos) queda con menos de 3 ejercicios por grupo, salvo nivel principiante.
- **Vista previa del documento** en `RutinaDraftEditor`: antes de publicar, se ve exactamente el texto que se le va a guardar al alumno (mismo serializador), se actualiza en vivo con cada cambio.
- **Selector de ejercicios por clic** en vez de texto libre: al tocar el nombre de un ejercicio se abre una lista buscable de la biblioteca real, filtrada por el grupo muscular del ejercicio (o el grupo dominante del día si es uno nuevo). Al elegir, se guarda `ejercicioId` real además del nombre. **Ojo**: esto solo está conectado en el flujo del generador (`GeneradorRutinasPanel` pasa `ejercicios` a `RutinaDraftEditor`); el otro llamador de `RutinaDraftEditor` (extracción de PDF/texto pegado en `ArchivosManager`/`DocumentosManager`) todavía no pasa esa prop, así que ahí sigue el campo de texto libre de siempre (compatible, no roto, simplemente no actualizado).

## Verificación general
`npx tsc --noEmit` limpio. `npx vitest run` → **144/144 en verde** (se sumaron ~55 tests nuevos entre `motor.test.ts` y `mensajeEncuesta.test.ts`). `npm run build` limpio. `npx eslint` sobre cada archivo tocado, limpio salvo 1 warning preexistente sin relación (`_progresion` en `archivos/actions.ts`, ya existía antes). Todo probado en el navegador con clicks/flujos reales contra la base real (login `1@1.com`), usando la cuenta "Entrenador Prueba" para publicar de prueba sin tocar alumnos reales.

## Pendiente

1. **Correr `0053_tecnicas_adicionales.sql`** en Supabase (contenido ya en el repo y pasado al usuario en el chat).
2. **Decidir si commitear** — todo el trabajo de esta sesión está sin commitear en `main`. Revisar el diff primero.
3. **CRUD visual de técnicas** (de la lista pendiente original del handoff del generador): hoy se eligen técnicas existentes por checkbox, pero no hay UI para crear/editar técnicas nuevas — hay que ir a Supabase directo o agregar una migración, como se hizo con "Fallo muscular"/"Cluster set".
4. **Selector de ejercicios y vista previa solo en el flujo del generador** — si se quiere el mismo selector al editar una rutina extraída de PDF/texto pegado (`ArchivosManager`/`DocumentosManager`), falta pasarle la prop `ejercicios` a `RutinaDraftEditor` desde esos otros puntos de entrada.
5. **Sub-grupos de pierna son heurística por nombre**, no datos estructurados — igual que "enfoque de forma". Si en algún momento se quiere más precisión (o el catálogo crece con nombres que no calzan con las palabras clave), la alternativa real sería una columna nueva en `ejercicios` para sub-grupo, con migración + carga manual.
6. **Ordenar/pulir los `.md` sueltos en la raíz** (`ROADMAP_PRODUCTO.md`, `ROADMAP_PRODUCTO.md`, este handoff, etc.) — quedaron varios archivos de contexto de sesiones distintas sin depurar.
