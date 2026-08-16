# Handoff 1.28 — galería de ejercicios: nombres blindados y Mesa de trabajo

Fecha: 2026-08-15
Rama: `main`
Commit anterior: `3611962` — `feat(admin): carga masiva de fotos con coincidencia automática`

## Punto de regreso

- Migraciones aplicadas: hasta `0093_ejercicio_fusiones_historial`. **No hay
  migraciones nuevas en este trabajo.**
- Verificación: `npx tsc --noEmit` correcto, `npm run lint` correcto,
  `npm test` 421/421, `npm run build` correcto.
- Se ejecutaron cambios de datos en producción (ver "Datos corregidos").

## Por qué se hizo

Alejandro pidió resolver las fotos equivocadas y los duplicados de ejercicios.
Se midió la base real en vez de suponer, y el diagnóstico corrigió la premisa:
**los duplicados casi no existían** (4 grupos, 2 falsos positivos). El problema
era el sistema de nombres.

Causas encontradas, todas verificadas contra producción:

1. **Alias colisionantes.** Dos ejercicios distintos podían reclamar el mismo
   alias. `emparejarEjercicio` devolvía el primero del orden de la lista, así
   que qué foto veía el alumno dependía del orden en que la base devolvía las
   filas. Casos vivos: `extension unilateral` (cuádriceps y tríceps),
   `super squat` (Hack squat y Sentadilla libre), `elevacion piernas colgado`.
2. **Abreviaturas.** `equipoMencionado()` buscaba `/\bmancuerna/` y "manc." no
   coincidía: "Press inclinado manc." caía en el press de barra.
3. **Umbral 0.66 sin veto de músculo.** "Press de hombro en Smith" caía en
   "Press de banca en Smith" por compartir 2 de 3 palabras.
4. **Reportes irresolubles.** 16 de 26 eran sobre nombres que no existían en la
   biblioteca; la galería ofrecía "Agregar foto" sin ejercicio al cual pegarla.

## Cambios de código

### `src/lib/ejercicios/emparejar.ts`

- Diccionario de abreviaturas (`manc.`, `unilat.`, `ext.`…) expandido antes de
  comparar, en los dos lados.
- Veto por zona muscular (`FAMILIAS_ZONA`), usando el nombre del ejercicio y su
  `grupo_muscular`, no solo el alias que coincidió.
- Veto por equipo, pero **solo cuando el nombre del candidato menciona su propio
  equipo**. Con el campo `equipo` de la ficha rompía emparejados buenos
  ("Peso muerto con banda" perdía "Peso muerto").
- El paso exacto recorre la biblioteca entera: si hay más de un dueño del mismo
  texto devuelve `null` en vez del primero. Determinista.
- Palabra principal del movimiento: el candidato tiene que mencionarla. Saltea
  modificadores de ejecución ("Isometría hip thrust").
- `detectarAliasEnDisputa()` nuevo, para la interfaz.

Calibraciones que **no hay que deshacer** (cada una costó una regresión medida):

- "máquina" NO cuenta como equipo — Smith, Hammer, prensa y pec deck son todos
  máquina. Usarla como veto mandaba un press inclinado a la prensa de piernas.
- "al pecho" NO cuenta como zona pecho — "jalón al pecho" es espalda.

### `src/app/admin/ejercicios/actions.ts`

- `resolverAliasEnDisputa()` — le quita el alias a uno de los dos. No mueve
  rutinas ni desactiva nada; es lo contrario de combinar.
- `quitarFotoEjercicio()` — deja al ejercicio sin foto propia y borra los
  archivos. Antes solo se podía reemplazar, nunca sacar.
- `combinarEjerciciosDuplicados()` acepta `original_forzado` para que quien
  ejecuta decida cuál sobrevive, en vez de la heurística por foto.

### `src/components/admin/GaleriaEjercicios.tsx`

- Bloque **"Nombres en disputa"** al tope de Pendientes, con la pregunta y los
  usos de cada lado. Esos pares **salen** de "Posibles duplicados": ofrecer
  "Combinar" ahí habría desactivado un ejercicio legítimo y trasladado sus usos.
- Pestaña **"Mesa"** nueva: un ejercicio a la vez, cola ordenada por reclamo y
  después por usos. Reúne foto + encuadre arrastrable + vista real del alumno
  (`CuadroFotoReferencia`) + clip de Cloudflare + nombres de rutina que le
  corresponden + reasignación de nombres + parecidos. Buscador para ir directo.
- Alta de ejercicios desde la Mesa, con los nombres que pidieron los alumnos y
  los que trajeron las rutinas importadas ya precargados.
- Las sugerencias de nombre usan `emparejarEjercicio`, no el comparador viejo
  (`puntajeParecido` proponía "Hip Thrust con barra libre" para el press
  inclinado por compartir la palabra "barra").

## Datos corregidos en producción

Ejecutado con respaldo previo. **Ojo: el respaldo guardó 1.000 de 3.957 filas**
(faltó paginar). La reversión no depende de él: se reconstruye desde el plan.

- 159 filas de rutina vinculadas, en 40 nombres (incluye "bicicleta de spining"
  con 70 filas). Alias permanentes agregados solo en 10, los de coincidencia
  fuerte.
- 48 filas revinculadas (enlaces muertos y contradicciones de equipo).
- "Pec deck" reactivado: estaba desactivado con 31 usos vivos.
- Sin vincular: 465 → 306 filas. Ejercicios activos: 119 → 120.
- **No se creó ningún alias en disputa nuevo**: siguen siendo los mismos 3.

Se dejaron **a propósito** sin tocar, por ser decisión del entrenador o
ambiguos: `Patada`, `Dominadas o Jalón al pecho` (×2), `Super squats`, y todo
lo que apuntara a un ejercicio activo y válido.

## Pendiente

1. **Índice único de alias en la base** (migración). Es lo único que impide que
   la colisión vuelva a nacer; hoy está resuelta por interfaz, no por esquema.
2. **Limpiar los 3 alias en disputa** desde Pendientes.
3. **Aviso al crear un ejercicio** ("ya existe *Crunch abdominal*, ¿es este?").
   Sin esto siguen naciendo duplicados: hoy "Crunch controlado" está dos veces.
4. **Normalizar al nombre raíz.** Hoy el alumno ve el texto crudo de la rutina
   (`nombre: prog.nombre` en `alumno/entrenar/data.ts`), no el nombre de la
   biblioteca. Decisión ya tomada: normalizar todo **salvo** los que ofrecen
   alternativas con "o" / "/", para no perder la opción que dio el entrenador.
5. **23 reportes de foto pendientes.** Necesitan fotos; no hay atajo. La Mesa
   los cierra solos al guardar la foto de cada ejercicio.
6. Ejercicios desactivados con usos vivos: revisar si hay más casos como
   "Pec deck".

## Notas para retomar

- **El build alterna entre pasar y fallar mientras corre el dev server**, con el
  mismo código, por contención en `.next`. Confirmar con el server apagado.
- Antes de tocar fusiones, distinguir **colisión de alias** de **duplicado
  real**: combinar es destructivo y en las colisiones es la acción equivocada.
- `fotoDe()` devuelve la ilustración cuando no hay foto propia. Para saber si
  hay foto de verdad, mirar `fotoMiniaturaUrl`/`fotoCompletaUrl`.
- Las ilustraciones se comparten a propósito entre ejercicios parecidos (22
  slugs en 2–3 ejercicios cada uno); los alumnos las reportan como "foto
  equivocada". Está avisado en la Mesa, pero conviene marcarlo también en la
  pantalla del alumno.
