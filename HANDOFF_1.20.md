# HANDOFF 1.20

Continúa el 1.19. Cubre el tramo del **12/08**, que cerró **sin pendientes de
código**: se puso al día toda la deuda de migraciones y se terminó de punta a
punta la técnica aplicada a series puntuales.

## Punto de regreso

- Rama **`main`**.
- Sin trackear y **sin tocar** (venían de antes, no los creó ninguna sesión de
  Claude, no se sabe qué son — preguntar a Alejandro antes de borrar):
  `Rutinas Alejandro/`, `respaldo-cloud-ia-2026-08-09.bundle`, `tmp/`.

### Migraciones: ya no queda ninguna pendiente

`0067`, `0068`, `0072` y `0073` se corrieron todas en Supabase el 12/08. La
deuda que venía arrastrándose desde el 1.18 quedó saldada.

**Trampa que costó un intento fallido:** la `0072` ya se había corrido a medias
en algún momento, así que el reintento moría con `42710: policy ... already
exists`. Postgres **no tiene `create policy if not exists`**, así que toda
migración que cree políticas necesita un `drop policy if exists` delante de
cada `create` — como ya hacía la `0067`. Se corrigió la `0072` con ese patrón y
entró limpia. **Escribir así las próximas.**

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

## Terminado: técnica por serie puntual

### Qué pidió Alejandro, textual

> "podría tener los numeritos de la cantidad de series que son, por ejemplo, el
> uno, el dos, el tres, el cuatro, y yo los marco con el dedo, al ladito, no
> tiene que ser tan grande"

Y sobre el tamaño: *"los botones de las series que acabas de hacer fueron
enormes, no están acorde con el tamaño"*. Por eso los numeritos son cuadraditos
de 20px al lado de la técnica, no una fila de botones.

### La base: `0073_tecnica_por_serie.sql`

Agrega `rutina_dia_ejercicios.tecnica_series int[]`:

- **`NULL` = todas las series.** Es lo que tienen todas las filas anteriores a
  la migración, así que ninguna rutina publicada cambió. No hubo backfill.
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

### La regla que atraviesa todo el módulo

**`null` significa "todas las series", no "ninguna".** Cualquier función de
`src/lib/entrenamiento/tecnica-series.ts` tiene que devolver, con `null`,
exactamente lo que devolvía antes de que la columna existiera. Ese módulo es el
único lugar donde vive esta lógica, y tiene 11 pruebas en
`tecnica-series.test.ts`.

`normalizarTecnicaSeries` también colapsa a `null` el caso "están todas
marcadas": si no, habría dos formas de decir lo mismo y cada lector tendría que
compararlas contra `series_programadas`.

### Técnicas encadenadas: nunca llevan numeritos

Superserie, biserie, triserie, circuito y giant set encadenan **ejercicios entre
sí**, no series adentro de un ejercicio. Para ellas `tecnica_series` queda
siempre en `NULL`. El CHECK no lo puede impedir (habría que parsear texto libre
adentro de un CHECK), así que **lo garantiza el editor**: se detectan con
`resolverGrupoTecnica()` y ahí los numeritos no se dibujan. Además, los cuatro
caminos que convierten un ejercicio en encadenado fuerzan `tecnicaSeries: null`
explícitamente — encadenar pisa lo que se hubiera marcado antes.

Corolario que sale gratis: `SesionGrupoCard.tsx` (la tarjeta de superseries y
circuitos del alumno) **no necesitó ningún cambio**.

### Dónde quedó cada pieza

1. `supabase/migrations/0073_tecnica_por_serie.sql` — la columna y su CHECK.
2. `src/lib/entrenamiento/tecnica-series.ts` — toda la lógica, con pruebas.
3. `src/lib/supabase/types.ts` — `tecnica_series` en Row e Insert.
4. `src/lib/ai/extraerRutina.ts` — el campo en el esquema, **opcional**: la IA
   que lee PDFs no lo produce y las rutinas viejas no lo tienen.
5. `src/components/admin/RutinaDraftEditor.tsx` — los numeritos. Estando en
   "todas", el primer toque pasa a **solo esa serie** (alternar dejaría las
   otras tres marcadas, que es lo contrario de lo que el dedo quiso decir);
   después alterna normal. Al lado, la etiqueta en texto ("última serie").
6. `src/app/admin/archivos/actions.ts` — el guardado. Se **normaliza contra las
   series reales de la fila**: el entrenador puede marcar la serie 4 y después
   bajar el ejercicio a 3 series, y sin eso el insert entero fallaría contra el
   CHECK.
7. Lecturas: `src/app/alumno/entrenar/data.ts` (la que importa),
   `src/app/admin/rutinas-generadas/actions.ts` (sin esto, reabrir una rutina
   perdía las marcas en silencio) y `src/app/admin/alumnos/rutinaTexto.ts`.
   En la del alumno el campo va en `COLUMNAS_PROGRAMA` y no en la BASE, para
   que el último intento de la escalera de selects siga degradándose solo.
8. `src/components/student/SesionEjercicioCard.tsx` — la píldora de arriba dice
   "Drop set · última serie", y la fila de la serie que la lleva muestra una
   píldora ámbar chica (`.pill-tecnica-serie` en `globals.css`) **antes** de los
   campos de carga: un drop set no se carga igual que una serie normal, así que
   tiene que leerse antes de escribir los kilos.
9. `src/lib/impulso-vip/data.ts` — la regla de abajo.

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

### El error que casi se publica, y cómo se arregló

Al revisar Impulso VIP a fondo apareció un desajuste que las pruebas iniciales
no cubrían y que habría roto el cumplimiento de todo ejercicio con técnica por
serie. **Vale la pena entenderlo antes de tocar este módulo.**

La recomendación se calcula sobre las series limpias (3 de 4), pero el
cumplimiento se resolvía después, en `resolverCumplimientoImpulso`
(`alumno/entrenar/actions.ts`), sumando **todas** las series de la sesión — las
4, incluida la del drop set, que trae muchas más repeticiones. Resultado: la
meta se armaba con una vara y el total se medía con otra.

Se arregló congelando en `decision_data` un campo nuevo, `seriesConsideradas`:

- `construirPayloadRecomendacion` lo guarda; `leerDatosCumplimiento` lo lee y
  descarta cualquier cosa que no sea una lista de enteros.
- `resolverCumplimiento` filtra por él antes de sumar. Con `null` —toda
  recomendación anterior a esto— evalúa todo, igual que siempre.
- La meta también estaba mal: el motor la arma como
  `seriesProgramadas × rango.min`, así que en `data.ts` ahora se le pasa la
  cantidad **efectiva** de series (3, no 4). Pedir 4 × el mínimo sobre 3 series
  contadas era un total inalcanzable.

**Por qué congelado y no releído:** al resolver el cumplimiento hay que mirar
exactamente las mismas series que se miraron al recomendar, aunque el
entrenador haya cambiado la rutina en el medio. Además ahorra una consulta —
`decision_data` ya está cargado en ese punto.

### Cómo quedó implementada

`seriesLimpiasParaProgresion(tecnicaSeries, seriesProgramadas)` en
`tecnica-series.ts` devuelve las series que sirven, o `null` si hay que excluir
el ejercicio igual. En `impulso-vip/data.ts`, `esTecnicaExcluida` ya no corta
solo: cuando dice que sí, se le pregunta a esa función, y si devuelve series se
pasan a `obtenerHistorialParaMotor`, que descarta del historial las que llevan
técnica. Descartar y no contar como cero es el mismo criterio que ya usaba
`esSerieUtilizable` con las series sin peso cargado.

**Se verificó también el camino de siempre:** con `tecnicaSeries` en `null` —
que es lo que tienen todas las rutinas de hoy — la función devuelve `null` y el
ejercicio se excluye entero, exactamente como antes. La suite completa (356
pruebas) pasa.

Optimización de paso: el filtro de series se hace en la base
(`.in("numero_serie", ...)`) en vez de traer filas para descartarlas en
memoria.

### Lo único que quedó sin verificar

**No se pudo probar en el navegador.** El servidor de desarrollo de esta sesión
no levantaba (el puerto lo tenía tomado otra sesión), y el que sí respondía
pedía inicio de sesión, que un agente no debe completar. Se verificó con
`npx tsc --noEmit`, eslint, la suite completa y un `npm run build` de
producción, todo limpio — pero **nadie miró los numeritos con los ojos**.
Conviene que el próximo abra "Armar rutina", ponga un drop set en un ejercicio
de 4 series, marque la 4, publique y lo mire en la pantalla del alumno.

## Reglas de trabajo vigentes

- **Responder siempre en español.**
- **No pushear sin que Alejandro lo autorice**, y preguntarle el alcance antes
  de subir. `main` despliega a producción.
- Verificar en el navegador antes de dar algo por hecho, no por lectura de
  código. Así se encontraron los bugs reales de los últimos handoffs.
- `.next-dev-claude.log` es basura de desarrollo sin trackear. No commitear.
- `html2canvas` **no sirve en este proyecto** (no entiende `color-mix()`, usado
  en 132 lugares del CSS). La que funciona es `html-to-image`. Ver 1.19.
