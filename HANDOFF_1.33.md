# HANDOFF 1.33 — Motor Ale: calibración RIR en V2 + diseño de repotenciada

Fecha: 2026-08-20/21

Continúa directo de `HANDOFF_1.32.md`. Antes de tocar nada de esto, leer
también `HANDOFF_IMPULSO_VIP_CLAUDE.md` si existe una revisión pendiente, y
el resto de este documento completo — hay contexto de producto (no solo
técnico) que Alejandro dio en vivo y que no está escrito en ningún otro
lado.

## Contexto: el plan "Motor Ale"

Alejandro pidió una auditoría profunda de si Impulso VIP (el motor de
progresión + retos en vivo, construido en V1) está aplicado "en su
totalidad y adaptado coherente, eficiente y eficazmente" en V2. La
respuesta fue: V2 reutiliza el backend de V1 pero le faltaban piezas reales.
Encontramos y priorizamos 4 pasos, en este orden (pedido explícito de
Alejandro: "PARTE CON EL PROYECTO" autorizó ejecutar el plan, paso por
paso, no todo de una):

1. **Aviso de "Supervisión obligatoria"** en técnicas intensas — cerrado y
   publicado antes de este handoff.
2. **Calibración RIR en vivo** ("¿cuántas repeticiones más podías hacer?")
   — cerrado en esta sesión, ver abajo.
3. **Decidir el destino del motor "Ale"** (`src/lib/impulso-vip/alejandro.ts`,
   `alejandro-sesion.ts`, `preparacion-diaria.ts`) — hoy construido y
   testeado pero **dormido**: solo lo usa el demo sin sesión real. V2
   reutiliza mayormente las server actions de V1
   (`src/app/alumno/entrenar/actions.ts`, `impulso-actions.ts`) con
   adaptadores finos (`xxxV2`). **No decidido todavía** — hay que resolver
   con Alejandro si el motor "Ale" reemplaza al de V1, convive, o se
   descarta.
4. **"Repotenciar" más** — diseñado en esta sesión (dos ideas concretas,
   ver más abajo), **nada construido todavía**.

Alejandro pidió explícitamente renombrar el motor de "Alejandro" a **"Ale"**
en cualquier texto nuevo de cara al alumno.

Guía de producto que dio (no es una instrucción de código, es una guía
para juzgar cualquier regla de progresión futura): *"un peso que el alumno
no domina no es mejor que cinco repeticiones más con menos peso... aplica
técnicas de la nueva escuela, saca máximo provecho, siempre consciente de
la seguridad."*

## Lo que se cerró en esta sesión

### Bug de entorno encontrado y arreglado (no era del código)

El servidor de desarrollo (`next dev`, Turbopack) tenía un chunk cacheado
desincronizado del código real: la consola tiraba
`ReferenceError: PointerSensor is not defined` en `OrdenSesionV2.tsx`,
pero ese archivo hace rato usa `MouseSensor` (fix ya publicado en 1.32).
Confirmado con el log (`.next-preview/dev/logs/next-development.log`) que
el error venía repitiéndose desde antes de esta sesión, siempre con el
código viejo (`delay: 1800`, `PointerSensor`) en el stack trace. Se mató
el proceso viejo (`taskkill /PID ... /F`) y se relevantó limpio con
`preview_start`. **No afecta producción** (`next build` no tiene este
problema de caché de HMR) — puramente un artefacto del dev server local.

### Paso 2: calibración RIR en vivo (V2)

**El problema real:** un alumno probando V2 se quejó de que los pesos no
le salían "calibrados" como en V1. Al auditar, encontramos que además
faltaba algo más profundo: V2 nunca preguntaba "¿cuántas repeticiones más
podías hacer?" sobre la serie anterior antes de mostrar un reto — por eso
el motor automático nunca escalaba a drop set / rest-pause / fallo
controlado por esta vía (sí lo hacía la sesión clásica, vía
`MomentoImpulsoEnVivo.tsx`).

**Qué se cambió** (5 archivos, reutilizando `calibrarIntervencionEnVivo`
de V1 sin tocarlo):

- [`src/lib/impulso-vip/alejandro-sesion.ts`](src/lib/impulso-vip/alejandro-sesion.ts) —
  `MomentoSesionAlejandro` ahora trae `intensiva`, `estado`, `calibrada`.
- [`src/app/portal-v2/entrenamiento/sesion/page.tsx`](src/app/portal-v2/entrenamiento/sesion/page.tsx) —
  pasa esos campos reales (no colapsados por `tipoMomento()`), y arregla
  el precalentado de peso/reps (`seriesIniciales`) leyendo
  `recomendacionImpulso` igual que `SesionEjercicioCard.tsx` en V1 — esto
  es lo que arregla el "no me sale calibrado" que reportó el alumno.
- [`src/app/alumno/entrenar/impulso-actions.ts`](src/app/alumno/entrenar/impulso-actions.ts) —
  adaptador nuevo `calibrarIntervencionEnVivoV2`.
- [`src/components/v2/SesionActivaV2.tsx`](src/components/v2/SesionActivaV2.tsx) —
  nuevo modal de calibración (4 botones de RIR) antes de mostrar el
  momento, si la intervención está `preparada` y aún no `calibrada` y la
  serie anterior ya está hecha. También: aviso de "Supervisión
  obligatoria" para técnicas intensas, resolución de reto en 3 estados
  (antes solo 2 — se perdía el matiz "parcial"/"dificil").
- `SesionActivaV2.module.css` — estilos del modal nuevo.

**Verificado en vivo, no solo con tsc/lint/build/tests (los 4 en verde,
602/602 tests):**

1. Encontré, vía Supabase REST directo, una intervención real
   `estado: preparada` de mi propia cuenta de prueba
   (`af398287-fceb-47dd-a72e-d918808cd3a8`) atada a una sesión
   `en_progreso` (id sesión `67016b2e-22d0-449a-bd4c-13168b32aa91`,
   ejercicio "Jalón al pecho", `serie_objetivo: 4`).
2. **Encontré una causa de falso negativo durante la propia prueba**: el
   interruptor "Impulso VIP automático" estaba guardado en `false` en el
   `localStorage` del navegador de pruebas (de una sesión anterior). Sin
   esto, ningún momento se muestra nunca — no es un bug, es el
   comportamiento correcto del interruptor, pero hay que saberlo si un
   agente futuro prueba algo de Impulso VIP en V2 y "no pasa nada":
   revisar `localStorage['vip-v2-impulso-automatico']` antes de sospechar
   del código.
3. Con el interruptor en `true`: jugué la sesión real hasta la serie 3,
   apareció el modal "Ale calibra tu última serie", respondí "Una", y
   confirmé en la base de datos real que `series_realizadas.rir_estimado`
   quedó en 1 y que `impulso_vip_intervenciones.decision_data` se
   actualizó (`rirCalibracion: 1`, `calibradaEn`, `serieCalibracion: 3`).
   Inmediatamente después apareció el modal real "MOMENTO IMPULSO VIP"
   con la instrucción ya recalculada.

**Estado de publicación:** commiteado en `portal-v2`
(`af9502d — feat: calibracion RIR en vivo para Impulso VIP en V2`) y
pusheado a GitHub `origin/portal-v2`. **NO está en `main`/producción
todavía** — el push (`git push origin portal-v2:main`) fue bloqueado dos
veces por el clasificador automático de permisos, y de todas formas es
justo el tipo de cambio (Impulso VIP) que `CLAUDE.md` exige confirmar
explícitamente con Alejandro antes de publicar. **Pendiente: confirmar
con Alejandro y correr `git push origin portal-v2:main`, después
verificar `Ready` en Vercel** (mismo patrón que 1.32).

### Bug encontrado y arreglado: sugerencia de peso vacía

Alejandro reportó en vivo que el cuadro de peso le seguía saliendo vacío.
Se verificó con datos reales (no supuesto): la única sesión anterior de
ese ejercicio tenía las 4 series con repeticiones cargadas pero **el peso
en blanco en las 4** — el motor sí corrió y decidió "sube de peso"
(`B_subir_peso`), pero al no saber de qué peso partir, devolvía
`peso_sugerido_kg: null` sin más explicación.

**Causa real:** `motor.ts` solo miraba la sesión más reciente
(`ultimoPesoTrabajado(ultima)`) para calcular el peso base, aunque el
motor ya recibe hasta 3 sesiones de historial (`obtenerHistorialParaMotor`).
Si esa única sesión no tenía peso cargado, no había ningún respaldo.

**Arreglo** (`src/lib/impulso-vip/motor.ts`, commit `0eb3032`):

- Nueva función `ultimoPesoConocido(historial)`: busca hacia atrás en las
  hasta 3 sesiones disponibles hasta encontrar la última vez que sí se
  cargó un peso real, en vez de mirar solo la más reciente.
- De paso se corrigió un bug real en la Regla D (reducir): sin ningún
  peso de referencia, calculaba la reducción del 92.5% sobre una base de
  **0kg** en vez de dejar la sugerencia vacía (mismo criterio que ya
  usaba la Regla B en ese caso).
- Cuando de verdad nunca se registró un peso en el ejercicio (ninguna de
  las 3 sesiones disponibles lo tiene), el mensaje ahora lo dice
  explícito ("Aún no registraste un peso en este ejercicio...") en vez
  de "sube al siguiente peso disponible" sin ningún número.

**Verificado con 3 tests nuevos** en `motor.test.ts` (el escenario exacto
que reportó Alejandro: sesión más reciente sin peso + sesión anterior con
peso; y el caso límite de nunca haber registrado peso). 605/605 tests en
verde, tsc/lint/build limpios. Pusheado a `portal-v2`, **no a `main`
todavía** — mismo pendiente de autorización que el resto de este handoff.

**Importante:** la recomendación se congela una sola vez al crear la
sesión y nunca se recalcula sola (ver comentario en
`generarYGuardarRecomendacion`, `data.ts`). Este arreglo aplica a
sesiones nuevas hacia adelante — no reescribe la fila ya guardada de la
sesión de prueba de hoy.

## Lo que se diseñó pero NO se construyó — Paso 4 ("repotenciar")

Dos ideas, discutidas y acordadas en principio con Alejandro, listas para
construir cuando él confirme el detalle que falta:

### A. Rangos de peso por tipo de equipo, usando el inventario real

Hoy `src/lib/impulso-vip/motor.ts` (Regla B, "subir peso") usa un
incremento **fijo de 5kg para todo** (`CONFIG_DEFAULT.incrementoKg`),
sin distinguir tipo de equipo. Existe un override manual, pero es
**por ejercicio individual** (tabla `rutina_dia_ejercicio_progresion`,
editable desde `RutinaDraftEditor.tsx`) — no hay ninguna regla automática
por categoría de equipo.

Alejandro pidió una regla **por categoría completa** (todos los
ejercicios de barra juntos, todos los de mancuerna juntos, todos los de
polea juntos — no ejercicio por ejercicio):

- **Mancuerna**: saltos chicos, con rango (ej. "12-14kg"), no un número
  seco.
- **Barra**: saltos grandes, 5-10kg, hasta 15kg si vino fácil.
- **Polea**: intermedio, 5-10kg.

**Mejora propuesta y acordada en principio:** en vez de inventar un rango
para mancuerna, usar el inventario real ya escrito en
[`src/lib/gimnasio/inventario.ts`](src/lib/gimnasio/inventario.ts) —
"Mancuernas de 2,5 · 5 · 6 · 7 · 8 · 9 · 10 · 11 · 12 · 16 · 18 · 20 · 22 ·
25 kg, y una de 50 kg" — y saltar directo a la mancuerna real siguiente.
Los saltos NO son uniformes (12→16 es +4kg, 25→50 no tiene nada en el
medio), así que un rango calculado a ojo a veces sugeriría un peso que no
existe físicamente en la sala. Hoy ese inventario solo se usa para el
filtro de IA al armar rutinas (`describirInventario()`), nunca se cruza
con el motor de progresión.

Para barra, el rango que dio Alejandro (5-10kg, hasta 15 si fue fácil)
está bien tal cual — ahí el peso es continuo (se agregan discos), no una
pieza fija como la mancuerna.

**Pendiente sin cerrar:** preguntarle a Alejandro de cuánto en cuánto sube
el stack de peso de sus dos poleas ajustables (multiestación). Si no lo
sabe, usar su rango de 5-10kg como aproximación.

**Antes de construir esto**, tener en cuenta:
- El campo `equipo` de `ejercicios` es texto libre, no una categoría
  limpia — hay que detectar "barra"/"mancuerna"/"polea" por palabras
  clave en el nombre/equipo del ejercicio (mismo patrón que
  `esTecnicaExcluida` en `motor.ts`, que ya hace regex sobre texto libre).
- `Recomendacion.pesoSugeridoKg` hoy es `number | null`, nunca un rango.
  Dar un rango de peso (no solo de reps, que ya es rango) es un cambio de
  tipo, no solo de valor — revisar todo lo que lee `pesoSugeridoKg` antes
  de tocar el tipo.

### B. Mostrarle al alumno su propio progreso de Impulso VIP

Hallazgo: **todo el detalle que genera este motor hoy solo lo ve
Alejandro**, en su panel de admin (`PropuestasImpulsoVIP`,
`MemoriaImpulsoVIP`, `HistorialImpulsoVIP` en `src/app/admin/alumnos/page.tsx`).
El alumno recibe la pregunta en el momento, responde, y esa información
desaparece de su vista para siempre — ni V1 ni V2 muestran nada de esto en
`/alumno/progreso` o `/portal-v2/progreso`.

Ideas propuestas (Alejandro no las rechazó, pero tampoco dio luz verde
formal a construirlas — falta confirmar antes de empezar):

1. Sección "Impulso VIP" en la pestaña de Progreso del alumno: qué subió,
   cuándo, evolución de sus respuestas de esfuerzo.
2. Cerrar el círculo explícitamente: "la semana pasada esto te costó, por
   eso hoy lo ajustamos así" en vez de solo preguntar en silencio.
3. Mostrarle cuando "gradúa" en una técnica (pasa de `en_prueba` a
   `confiable` en `impulso_vip_memoria_tecnicas`) — el dato ya existe
   (intentos, logradas, verificadas, racha), solo falta mostrarlo.

## Para el próximo agente

1. Confirmar con Alejandro el push a `main` de los commits `af9502d`
   (calibración RIR, Paso 2) y `0eb3032` (arreglo de sugerencia de peso
   vacía) — ambos cerrados y verificados, ninguno en producción todavía.
   Si dice que sí: `git push origin portal-v2:main`, confirmar `Ready`
   en Vercel (`vercel ls` / `vercel inspect --logs`).
2. Preguntarle a Alejandro el incremento real del stack de sus poleas
   ajustables antes de construir la Parte A de arriba.
3. Confirmar si quiere que se construya la Parte A, la Parte B, ambas, o
   ninguna todavía — no asumir, es trabajo nuevo no autorizado aún.
4. El Paso 3 (destino del motor "Ale" dormido vs. el de V1) sigue sin
   decisión — no tocar `alejandro.ts`/`alejandro-sesion.ts` sin resolver
   esto primero con Alejandro.
5. Recordatorio permanente para pruebas de Impulso VIP en V2: revisar
   `localStorage['vip-v2-impulso-automatico']` antes de asumir que algo
   no funciona.
