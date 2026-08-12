# HANDOFF 1.20

Continúa el 1.19. Cubre el tramo del **12/08** que terminó con push a `main` y
deja **un trabajo pendiente definido con precisión: técnica aplicada a series
puntuales**, con la migración de base de datos ya escrita y sin correr.

## Punto de regreso

- Rama **`main`**. Último commit: **`56e5672`** — *"feat(armar-rutina): copiar
  rutina a varios alumnos, ajustes rapidos por semana, tecnica en tira y
  deshacer"*.
- **`56e5672` YA ESTÁ PUSHEADO.** `main` despliega a producción, así que todo
  lo listado en "Lo que ya está terminado" está en vivo.
- Sin commitear en el árbol, y **creado en esta sesión**:
  - `supabase/migrations/0073_tecnica_por_serie.sql` (nuevo)
  - `HANDOFF_1.20.md` (este archivo)
- Sin trackear y **sin tocar** (venían de antes, no los creó ninguna sesión de
  Claude, no se sabe qué son — preguntar a Alejandro antes de borrar):
  `Rutinas Alejandro/`, `respaldo-cloud-ia-2026-08-09.bundle`, `tmp/`.

### Migraciones pendientes de correr en Supabase

Arrastradas del 1.19 y sin novedad: **`0067`**, **`0068`**, **`0072`**.

**`0073_tecnica_por_serie.sql` YA SE CORRIÓ** en Supabase el 12/08 ("Success.
No rows returned"), antes de que existiera código que la use. La columna está
en la base, en `NULL` en todas las filas, y la app se comporta igual que antes
— es lo esperado.

## Lo que ya está terminado (en `56e5672`, en producción)

Todo esto se verificó en el navegador antes de pushear, no por lectura de
código.

1. **Copiar rutina a varios alumnos.** Desde la ficha del alumno (que ahora
   lleva al selector al inicio de "Armar rutina") y desde la propia mesa de
   trabajo, con "Agregar alguien más a esta rutina" justo antes de "Asignar
   rutina". Funciona desde los cuatro caminos que usan ese editor: rutina
   nueva, generador, documentos y rutinas ya hechas. El botón pasa a decir
   "Asignar rutina a N alumnos".
   - `src/components/admin/AplicarRutinaAOtrosAlumnos.tsx` (nuevo)
2. **Ajustes rápidos por grupo.** Ahora incluye repeticiones (antes solo series
   y descanso) y un interruptor **"Aplicar a toda la semana"**.
3. **Selector de técnica en tira deslizable.** Antes era una grilla que se
   envolvía y empujaba la página hacia abajo; ahora son dos tiras horizontales
   —"APLICAR A ESTE EJERCICIO" y "CONECTAR DESDE ESTE EJERCICIO"— que se
   deslizan con el dedo y se ven completas sin bajar.
   - Clase `.tira-tecnicas` en `src/app/globals.css`, al lado de
     `.tira-ejercicios-rutina`. **La utilidad para ocultar la scrollbar no
     existe en Tailwind en este proyecto** — hay que escribirla a mano, como
     hacen las otras tiras. No perder tiempo buscando `scrollbar-hide`.
4. **Deshacer al encadenar por accidente.** Tocar "Circuito · 4" enganchaba en
   silencio los tres ejercicios de abajo y no había vuelta atrás: "así se me
   daña la rutina" (Alejandro, textual). Ahora aparece un aviso *"Se conectó
   Circuito desde este ejercicio"* con **Deshacer**, que restaura el estado
   exacto anterior — verificado: el ejercicio 1 volvió a "Drop set", el de
   abajo quedó suelto y la biserie que ya existía más abajo no se tocó.
5. **Cancelar un descanso corriendo pide 2 toques**, no 1.
6. **"Ya la hice, solo olvidé anotarla"** (commit anterior, `5173c82`, también
   en producción). Al cerrar un ejercicio con series sin marcar, debajo de
   "Sigo entrenando" / "Cerrar igual" hay un enlace chico que lleva a un
   segundo paso: *"¿De verdad hiciste las N series?"*. Existe en los dos
   lugares: `SesionEjercicioCard.tsx` (ejercicio suelto) y `SesionGrupoCard.tsx`
   (superseries y circuitos). **Ya está hecho: no volver a implementarlo.**

## Pendiente principal: técnica por serie puntual

### Qué pidió Alejandro, textual

> "podría tener los numeritos de la cantidad de series que son, por ejemplo, el
> uno, el dos, el tres, el cuatro, y yo los marco con el dedo, al ladito, no
> tiene que ser tan grande"

Y sobre el tamaño: *"los botones de las series que acabas de hacer fueron
enormes, no están acorde con el tamaño"*. **Los numeritos van chicos**, al lado
de la técnica elegida, no como una fila de botones grandes.

Lo que hoy existe es "última serie / todas las series" resuelto de la peor
forma posible: no existe. La técnica se aplica siempre a todo el ejercicio.

### Por qué no se hizo en la sesión anterior

No es un cambio de tamaño de botón. `tecnica_tipo` es **un solo valor por
ejercicio** en la base y en todos los caminos que lo leen. Guardarlo por serie
requiere una migración y tocar la pantalla de entrenar del alumno. Se separó a
propósito del resto, que era UI de bajo riesgo.

### La migración ya está escrita

`supabase/migrations/0073_tecnica_por_serie.sql`. Agrega
`rutina_dia_ejercicios.tecnica_series int[]`:

- **`NULL` = todas las series.** Es el default y es lo que tienen todas las
  filas existentes, así que ninguna rutina publicada cambia. No hay backfill.
- `'{4}'` = la técnica va solo en la serie 4.
- Un CHECK (vía la función inmutable `vip_tecnica_series_valida`, porque un
  CHECK no admite subconsultas y hay que mirar `series_programadas` de la misma
  fila) rechaza arrays vacíos, nulos adentro, repetidos y números fuera del
  rango real de series del ejercicio.

**Decisión de diseño que conviene no revisar de nuevo:** no se hizo una tabla
`rutina_dia_ejercicio_tecnicas` aparte. Eso haría falta solo si un ejercicio
pudiera llevar **varias técnicas distintas** en series distintas (drop set en la
4, rest-pause en la 3), y hoy no puede — `tecnica_tipo` es uno solo. Una tabla
agregaría un join a la consulta más caliente de la app (la pantalla de
entrenar) a cambio de nada. Si algún día hacen falta varias, la columna se
migra a esa tabla sin drama.

**Ojo con las técnicas encadenadas.** Superserie, biserie, triserie, circuito y
giant set encadenan **ejercicios entre sí**, no series adentro de un ejercicio.
Para ellas `tecnica_series` debe quedar en `NULL` y el editor **no** debe
ofrecer los numeritos. El CHECK no lo puede impedir (habría que parsear texto
libre dentro de un CHECK), así que es responsabilidad del editor. Cómo se
detectan: `resolverGrupoTecnica()` en
`src/lib/entrenamiento/tecnica-grupo.ts` devuelve no-null justo para esas.

### Qué falta tocar en el código (relevado, no adivinado)

1. **Correr la migración** en Supabase.
2. **`src/lib/supabase/types.ts:591-637`** — agregar `tecnica_series` a Row e
   Insert de `rutina_dia_ejercicios`. Sin esto no compila nada de lo demás.
3. **Editor — `src/components/admin/RutinaDraftEditor.tsx`.** Los numeritos,
   chicos, al lado de la técnica ya elegida. Solo cuando la técnica **no** es
   encadenada. El tipo `Ejercicio` vive en ese mismo archivo.
4. **Guardado — `src/app/admin/archivos/actions.ts:1058-1083`.** Es el **único**
   punto de la app que inserta filas en `rutina_dia_ejercicios` (verificado con
   grep sobre todo `src/`): ahí se arma el objeto con `tecnica_tipo` y ahí hay
   que sumar `tecnica_series`. Cuidado con la línea 1064, que ya advierte que
   uno de los campos del objeto **no** es columna de la tabla.
5. **Lecturas que ya traen `tecnica_tipo` y necesitan traer el nuevo campo:**
   - `src/app/alumno/entrenar/data.ts:438` (`columnasPrograma`), tipo en `:482`,
     mapeo a `tecnicaTipo` en `:633` — este es el que importa, es lo que ve el
     alumno.
   - `src/app/admin/rutinas-generadas/actions.ts:72, 103, 127`
   - `src/app/admin/alumnos/rutinaTexto.ts:31, 55, 79`
6. **Pantalla del alumno — `src/components/student/SesionEjercicioCard.tsx`.**
   Hoy la técnica se muestra para todo el ejercicio (botón "!" sobrepuesto en la
   foto + modal del glosario). Con el campo nuevo, el aviso debería aparecer en
   la serie que corresponde y no antes. **Es la parte con más riesgo de romper
   algo de lo que ya funciona bien** — dejarla para el final y verificarla en el
   navegador.
7. **Impulso VIP — `src/lib/impulso-vip/data.ts:361-369` y `motor.ts`.** Lee
   `tecnica_tipo` para excluir ejercicios enteros del motor de progresión
   (`esTecnicaExcluida`). Con técnica por serie eso cambia — la regla ya está
   decidida, ver la sección siguiente. **No es una pregunta abierta: Alejandro
   la aprobó el 12/08.**

## Regla decidida: Impulso VIP con técnica en series puntuales

Hoy el motor excluye el ejercicio **entero** si tiene técnica, porque un drop
set o un rest-pause ensucia el número y compararlo contra el historial sería
comparar peras con manzanas (`motor.ts:44`). Eso es correcto mientras la
técnica cubra todo el ejercicio. Con técnica en una serie puntual deja de
serlo: las otras series son tradicionales y perfectamente comparables.

**Regla aprobada por Alejandro (12/08):**

1. **Las series marcadas con técnica se ignoran.** No cuentan como cero: se
   descartan del cálculo.
2. **Se usan las series limpias, y solo si todas están ANTES de la primera con
   técnica.** Este punto es el que no es obvio y no hay que perderlo: un drop
   set en la última serie no contamina nada, porque las anteriores se hicieron
   frescas; pero una técnica en la serie 1 o 2 deja a las siguientes con una
   fatiga que no es la de una serie normal. En ese caso se excluye el ejercicio
   entero, como hoy.
3. **Menos de 2 series limpias → se excluye el ejercicio.** Con una sola serie
   la recomendación es ruido.
4. **Superserie, biserie, triserie, circuito y giant set siguen excluidas
   enteras, sin excepción.** Esto se cumple solo: en esas técnicas
   `tecnica_series` queda en `NULL`.

El punto 1 no inventa un criterio nuevo — **el motor ya hace exactamente eso**
con las series sin peso cargado: las ignora en vez de contarlas como volumen 0,
para no castigar al alumno por un dato que falta en lugar de por rendimiento
real (`motor.ts:90`, decisión de producto del HANDOFF 1.9). Es el mismo
criterio aplicado a otro caso; conviene implementarlo con la misma forma.

Contrapartida asumida y aceptada: se pierde algo de precisión (si un día el
drop set fue brutal y al otro flojo, la fatiga acumulada varía y el número
tiembla). Se aceptó igual, porque la alternativa es lo que pasa hoy: un alumno
con drop set en la última serie de press banca **no recibe progresión nunca**
en ese ejercicio.

**Nada de esto está implementado todavía.** Va junto con el resto de la
funcionalidad — el motor no puede aplicar la regla hasta que el editor escriba
`tecnica_series`.

### Orden sugerido

Migración → types → editor (guardar y ver el dato) → lecturas → pantalla del
alumno. Después de cada tramo, `npx tsc --noEmit` y eslint, que es como se
trabajó todo lo anterior.

## Reglas de trabajo vigentes

- **Responder siempre en español.**
- **No pushear sin que Alejandro lo autorice**, y preguntarle el alcance antes
  de subir. `main` despliega a producción.
- Verificar en el navegador antes de dar algo por hecho, no por lectura de
  código. Así se encontraron los bugs reales de los últimos handoffs.
- `.next-dev-claude.log` es basura de desarrollo sin trackear. No commitear.
- `html2canvas` **no sirve en este proyecto** (no entiende `color-mix()`, usado
  en 132 lugares del CSS). La que funciona es `html-to-image`. Ver 1.19.
