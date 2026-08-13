# HANDOFF 1.23

Continúa el 1.22. Cubre el tramo del **13/08 por la tarde y noche**. Cuatro
cosas, en el orden en que pasaron:

1. Un reporte de Yesenia Araya sobre el reloj de descanso, que estaba
   funcionando exactamente al revés de lo que debía.
2. Revisión y push del trabajo de Codex (portada unificada de Entrenar).
3. Un pedido de Alejandro para saltarse el descanso, que se construyó, se
   discutió y **se revirtió a propósito** en favor de una solución mejor.
4. El caso "Cristian perdió puntos al reeditar la rutina", donde **no se
   perdió ningún punto** — está documentado abajo con los números reales.

Este handoff manda sobre el 1.22 en todo lo que se contradigan.

## PUNTO DE REGRESO

| | |
|---|---|
| **Rama actual** | ⚠️ `codex/rutina-activa-redesign` — **no** `main` |
| **Último commit** | `3ee3171` |
| **origin/main** | `3ee3171` — **todo pusheado, nada pendiente** |
| **Migraciones** | `0087` corrida y verificada contra la base (13/08) |
| **Pruebas** | 396 pasando · ESLint limpio · TypeScript limpio |

### Ojo con la rama

El repo quedó parado en `codex/rutina-activa-redesign`, no en `main`. Codex
cambió de rama durante la sesión. La rama era `main` + un commit, así que el
trabajo se subió con `git push origin HEAD:main` y `main` local quedó
sincronizada apuntando al mismo commit. No hay divergencia, pero **el próximo
que abra el proyecto va a estar en la rama de Codex**. Si él no está usándola,
lo sano es volver a `main`.

Commits que entraron a `origin/main` en esta sesión, del más viejo al más
nuevo:

```
69b2ab1  feat(impulso-vip): automatizar propuestas, avisos push y contexto   (Codex)
73e9ef4  fix(entrenar): el reloj de descanso no descuenta si el alumno esta en pantalla
2ac7c04  feat(entrenar): unificar portada y vista previa de rutina           (Codex)
3ee3171  feat(entrenar): temporizador de descanso apagable por alumno
```

**Defecto cosmético conocido:** el mensaje de `73e9ef4` tiene una primera
línea suelta con un `@` (se usó sintaxis de here-string de PowerShell dentro
de Bash). El contenido está completo; solo se ve mal en `git log`. Arreglarlo
exige `--amend` y force-push sobre algo ya publicado — Alejandro lo dejó así.

---

## 1. El reloj de descanso penalizaba estar y perdonaba irse

### El reporte

Yesenia Araya, 13/08 9:50, desde `/alumno/entrenar/sesion/d1003f80-…` en un
iPhone:

> El reloj no se detiene, a pesar de qué estoy enfrente de la pantalla. En la
> aplicación debería detectar que estoy trabajando que estoy entrenando que
> estoy pendiente y aparece solamente cuando salgo a enviar WhatsApp o fuera
> de la aplicación.

Tenía razón, y el problema era peor de lo que ella describió.

### Qué estaba mal

El contador de exceso de descanso (`SesionEjercicioCard.tsx`, el aviso rojo
"Te pasaste del descanso: -X pts · toca para frenar") corría mientras la
alumna estaba en la app anotando kilos, y **se pausaba solo cuando se iba a
otra aplicación**, por un listener de `visibilitychange` que hacía
`setExcesoPausado(true)` con `document.hidden`.

O sea: la app penalizaba la presencia y perdonaba la ausencia. Encima, el
cartel que aparecía al volver decía *"Mientras no estabas el reloj no se
detuvo"*, que era falso.

### Cómo quedó (commit `73e9ef4`)

La regla nueva: **el reloj corre solo cuando no hay señales de presencia.**

- **Presencia = señal humana reciente.** Cualquier `pointerdown`,
  `touchstart`, `keydown`, `scroll`, `wheel` o volver a la app estampa la hora
  en un ref. Mientras esa señal tenga menos de `MS_PRESENCIA` (30 s), el
  contador no avanza ni descuenta.
- **30 s** es tramo y medio de penalización (`descansoSegundosPorTramo` = 20):
  anotar kilos o acomodar la máquina no cuesta puntos; el teléfono apoyado en
  el banco mientras se conversa, sí.
- **Salir de la app ahora sí cuenta.** Al pasar a segundo plano se descarta la
  señal y el contador arranca sin ventana de gracia. Esto **endurece** la
  regla respecto de lo que había; fue decisión explícita de Alejandro
  ("si se sale a WhatsApp, obviamente no va a estar frente a la pantalla").
- **El tiempo penalizado es un acumulador de tramos ausentes**, no el reloj de
  pared desde que terminó el descanso. Como se congela y descongela muchas
  veces por serie, contar "ahora menos el origen" habría vuelto a cobrar el
  rato en que la alumna estuvo presente.
- **Los eventos solo tocan un ref, nunca estado.** Un scroll dispara decenas
  de eventos por segundo; quien actualiza la pantalla es el tick de una vez
  por segundo del propio contador.
- **El aviso dice la verdad:** gris *"En pausa mientras estás en la pantalla"*
  cuando está congelado, rojo solo cuando de verdad descuenta. Y el cartel de
  regreso (`SalidaGuiadaSesion.tsx`) ya no manda a tocar un botón que ahora
  dice otra cosa.

### Sin verificar en pantalla

**Este fix está en producción sin haberse probado en un teléfono.** Typecheck,
lint y las 396 pruebas pasan, pero el comportamiento real —esperar que termine
un descanso, quedarse quieto 30 s y ver que arranca; tocar y ver que frena— no
se verificó. Hace falta un acceso de alumno de prueba.

---

## 2. Portada unificada de Entrenar (commit `2ac7c04`, de Codex)

Codex unificó la portada de Entrenar con la vista previa de ejercicios, eliminó
el paso intermedio "Ver entrenamiento" y dejó "Iniciar rutina" creando e
iniciando la sesión directo. Alejandro pidió revisión antes de pushear y
después pidió el push sin esperar la revisión visual.

**Lo que sí se revisó (lado servidor), y está bien:**

- `crearOEntrarSesion` pasó de `Promise<never>` a devolver el id. Era el cambio
  riesgoso —antes siempre cortaba con `redirect`— y los tres llamadores
  redirigen por su cuenta.
- El tope del plan mensual sigue **antes** de crear la sesión
  (`actions.ts:83`), así que no quedan sesiones huérfanas por el camino nuevo.
- El reporte de fotos sin sesión valida que el día pertenezca a la rutina
  activa del alumno antes de aceptar (`foto-actions.ts`). La columna
  `sesion_ejercicio_id` es nullable en la 0048, así que el insert es válido.

**Pendiente que salió de ahí:** el índice único de la 0048 solo cubre reportes
con `sesion_ejercicio_id`. Un ejercicio sin `ejercicio_id` de biblioteca,
reportado desde la portada, puede entrar varias veces y llegan repetidos al
panel. Se arregla con un índice más.

**No se hizo la revisión visual** (portada móvil, cambio entre sesiones,
miniaturas, inicio directo). Sigue pendiente.

---

## 3. Los cuatro toques: construido y revertido a propósito

Alejandro pidió poder tocar el temporizador cuatro veces seguidas para saltarse
el descanso. **Se implementó completo** (typecheck, lint y 396 pruebas
pasando) y después **se revirtió**, por decisión suya tras discutirlo. No está
en ningún commit.

Por qué se descartó, para que no se vuelva a proponer sin querer:

- Es un gesto escondido: nadie lo descubre solo y hay que enseñárselo a cada
  alumno.
- Vivía en un botón que ya tiene tres significados según cuántas veces se
  toque (2 = cancelar descanso, 3 = serie fuera de turno).
- Obligaba a hacerlo **cada vez** — doce veces por rutina para el alumno al
  que no le gusta el temporizador.
- Metía medio segundo de demora en la cancelación, para que la secuencia
  rápida no cancelara de paso.

Lo reemplazó el interruptor del punto 4, que ataca la causa en vez del síntoma.

---

## 4. Temporizador de descanso apagable por alumno (commit `3ee3171`)

### La decisión de diseño

Alejandro propuso un interruptor y preguntó si era mejor idea. Lo es. La
pregunta que había que resolver antes de escribirlo era **quién puede
apagarlo**, porque:

- Apagar el temporizador **tiene que** apagar la penalización. Si no, el alumno
  desactiva el reloj y sigue perdiendo puntos por algo que ya no ve.
- Pero si cualquiera puede apagarlo, el descuento por descanso desaparece en la
  práctica y la disciplina se vuelve voluntaria.

**Decisión de Alejandro: lo apaga él desde la ficha del alumno.** El alumno no
puede tocarlo. El descanso es parte de lo que él programa ejercicio por
ejercicio, así que el que no lo quiere se lo pide.

### Migración 0087 — CORRIDA Y VERIFICADA

```sql
alter table public.alumno_perfil
  add column if not exists temporizador_descanso boolean not null default true;
```

Se verificó contra la base el 13/08: la columna existe y todos los alumnos
quedaron en `true`, o sea el comportamiento de siempre.

**Importante para el próximo:** esta columna se escribe en **todo** guardado de
perfil (`actualizarPerfilAlumno`). Sin la migración, guardar cualquier ficha
falla entera —plan, objetivo, control incluidos—, no solo el temporizador. Por
eso el push esperó a que la migración estuviera aplicada.

### Qué hace

- **Ficha del alumno**, debajo de "Pausar nuevas sesiones": casilla *"Sin
  temporizador de descanso"*. La casilla dice "sin", así que marcada = apagado;
  la inversión se hace en la acción para que la columna se lea sola
  (`temporizador_descanso` true = normal).
- **Con el temporizador apagado:** marcar la serie la cierra y pasa a la
  siguiente sin cuenta regresiva, no corre el contador de exceso y no se
  descuenta ningún punto.
- **Los segundos programados se siguen mostrando** como referencia: son parte
  de la indicación del entrenador.
- Un descanso que hubiera quedado corriendo en el teléfono **se limpia** en vez
  de revivir al recargar.

### Cómo está cableado

La preferencia se lee **una vez** en `obtenerSesionCompleta`
(`src/app/alumno/entrenar/data.ts`) y viaja como campo
`temporizadorDescanso` de cada `EjercicioSesion`. Se eligió eso en vez de
pasar una prop por `page → SesionEjercicios → SesionGrupoCard → Card` para no
tocar cuatro archivos por un booleano. La lectura es tolerante: si la migración
no corrió, se asume encendido.

Los dos puntos donde se aplica en `SesionEjercicioCard.tsx`: el arranque del
descanso en `presionarListo` y el efecto del contador de exceso.

**Sin verificar en pantalla**, igual que el punto 1.

---

## 5. El caso Cristian Muñoz: no se perdió ningún punto

Alejandro reportó que al reeditar la rutina de Cristian —republicando sobre la
actual, después de que él ya tenía cuatro entrenamientos hechos— los puntos
bajaron de ~1200 a ~400.

Se consultó la base (solo lectura, con autorización expresa). **Resultado: no
falta ni un punto.** Vale la pena dejarlo escrito porque es probable que vuelva
a preguntarse.

### Por qué no se pueden perder así

`puntos_vip_movimientos` solo cuelga del alumno (`alumno_id`). **No tiene
ninguna relación con `rutinas`**, así que publicar, editar o borrar una rutina
no puede arrastrar puntos. No hay borrado en cascada por ningún lado.

### Los números reales de Cristian Muñoz (`a5edccce-…`)

Los cuatro entrenamientos están enteros: 7/08 (dos), 10/08 y 11/08, **300
puntos cada uno = 1200**.

Su total acumulado es **759**, y sale así:

| Concepto | Puntos |
|---|---|
| Entrenamientos (4 × 300) | **+1200** |
| Ingresos diarios (5 × 30) | +150 |
| Impulso VIP | +24 |
| **Días sin registrar alimentación** (6, 9, 10 y 12/08, a −150) | **−600** |
| Descanso excedido | −15 |
| **Total** | **759** |

### Las dos pantallas de las capturas no miden lo mismo

- **"+1200 Puntos VIP"** es el reporte de esa rutina, calculado leyendo los
  movimientos reales (`data.ts`, `obtenerRutinasHistorial`). Que muestre 1200
  **prueba** que los cuatro entrenamientos siguen registrados.
- **"414 pts"** es la tabla en vivo con la pestaña **Semana**: solo del lunes
  10 al domingo 16. Cuadra exacto: 600 de los dos entrenamientos + 24 de
  Impulso + 90 de ingresos − 300 de dos días sin comida registrada = **414**.
  Los −15 de descanso entraron después de la captura.

**No se le agregó ningún punto a Cristian**, porque no faltaba ninguno. Meter
un ajuste inventado le habría roto el ranking a él y a los otros 27.

### Lo que sí quedó al descubierto

**La penalización por no registrar comida es la más dura del sistema y es
invisible.** −150 por día, cuatro días en una semana. Y es **más dura que
registrar mal**: quien registra y se pasa de largo tiene piso en −100
(`alimentacionPenalizacionMaxima`), pero quien no registra nada recibe −150 sin
tope, porque `puntosAlimentacion` devuelve `alimentacionSinRegistro` antes de
llegar al `Math.max` del piso (`src/lib/ranking/reglas.ts`, rama `kcal <= 0`).

Puede ser intencional. **Alejandro todavía no decidió** si se empareja.

---

## Pendientes, en orden de importancia

1. **Probar en teléfono** el reloj de presencia y el interruptor del
   temporizador. Los dos están en producción sin verificación visual. Hace
   falta un acceso de alumno de prueba — pedírselo a Alejandro.
2. **Revisión visual de la portada unificada** de Codex (portada móvil, cambio
   entre sesiones, miniaturas ampliables, inicio directo). Él la pidió y no se
   hizo.
3. **Decidir la penalización de alimentación**: ¿−150 sin tope se queda, o se
   empareja con el piso de −100?
4. **Aclarar el reporte de rutina**: hoy dice "+1200" al lado de un total de
   759 y nadie puede conciliarlos mirando. Confundió al propio Alejandro.
   Idea conversada: mostrar "+1200 ganados en entrenamiento" y, aparte, qué
   descontó la alimentación.
5. **Índice para reportes de fotos duplicados** desde la portada (ver punto 2).
6. **La demo de Impulso VIP En Vivo** que sigue anotada en `CLAUDE.md`:
   revisión técnica y visual, pruebas corridas y demostración abierta en
   pantalla. Nunca se hizo; el trabajo de Codex sobre eso ya está en `main`.
7. **Volver a `main`** si Codex no está usando `codex/rutina-activa-redesign`.

## Higiene del repo

Sin trackear y sin ignorar, en la raíz: `.next-dev-claude.log`,
`.next-dev-codex.log`, `.next-dev-codex-error.log`. Son basura de los
servidores de desarrollo de los dos agentes. Vale agregarlos al `.gitignore`
para que no se cuelen en un commit por error. `public/mockups/` también está
sin trackear; Codex avisó que es temporal.

## Cómo consultar la base (quedó autorizado)

Hay credenciales de servicio en `.env.local` (`NEXT_PUBLIC_SUPABASE_URL` +
`SUPABASE_SERVICE_ROLE_KEY`). Un script `.mjs` **en la raíz del repo** (desde
el scratchpad no resuelve `@supabase/supabase-js`) con `createClient` alcanza
para diagnosticar. Alejandro autorizó la lectura para el caso de Cristian;
**esa autorización fue para eso**, no es un permiso permanente, y escribir en
producción no se hizo ni se debe hacer sin pedirlo de nuevo.
