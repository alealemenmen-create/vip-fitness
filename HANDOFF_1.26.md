# HANDOFF 1.26

Continúa el 1.25. Cubre el tramo del **14/08** — una sesión larga con 8
pedidos de Impulso VIP y del panel de alumnos, más un análisis detallado
(sin implementar) de hacia dónde debería evolucionar Impulso VIP. Este
handoff manda sobre el 1.25 en todo lo que se contradigan.

## PUNTO DE REGRESO

| | |
|---|---|
| **Rama** | `main` |
| **Último commit local** | sin commitear al cierre de esta sesión — Alejandro pidió esperar |
| **origin/main** | `6aa4562` (fotos de ejercicios, sesión anterior) |
| **Migraciones nuevas, corridas y verificadas contra la base real** | `0089`, `0090`, `0091` |
| **Pruebas** | 396 pasando · ESLint limpio · TypeScript limpio |

**Antes de hacer nada con Impulso VIP, ver la sección 9 (abajo) — es el
pedido más importante de esta sesión y queda sin implementar a propósito,
solo diagnosticado.**

### Migraciones de esta sesión

```
0089_archivar_rutinas.sql                              — rutinas.archivada
0090_acceso_bloqueado_alumno.sql                        — alumno_perfil.acceso_bloqueado(_motivo)
0091_temporizador_descanso_por_alumno_penalizacion.sql  — alumno_perfil.temporizador_descanso_desactivado_por_alumno
```

Las tres corridas y verificadas por consulta directa contra la base real.
No hay migraciones pendientes de correr.

### Columna huérfana, inofensiva

`perfiles.ultimo_acceso_en` — se creó a mitad de un enfoque para el punto 6
(alerta de alumnos inactivos) que se abandonó al descubrir que
`/admin/ingresos` ya resolvía eso mejor (ver sección 6). Quedó en la base,
nullable, sin ningún código que la lea o escriba. No molesta a nadie; se
puede borrar con `alter table perfiles drop column ultimo_acceso_en;`
cuando convenga, no es urgente.

---

## 1. Impulso VIP: se sacó la notificación de "propuesta cercana"

Pedido explícito de Alejandro: el push "Impulso VIP está por llegar a tal
ejercicio" ya no hace falta — Impulso se activa solo, esa es la gracia.

**Importante — esto ya se había intentado el 13/08 (commit `4644a46`) y se
revirtió**, pero por otro motivo (el texto del botón que lo acompañaba
sonaba a "mayordomo", ver `HANDOFF_1.24.md`). Esta vez el pedido es más
acotado y no repite ese error.

- Se eliminó `avisarPropuestaImpulsoCercana` de
  `src/lib/impulso-vip/avisos-entrenador.ts` y sus 5 llamadores en
  `src/app/alumno/entrenar/actions.ts`.
- La tabla `impulso_vip_avisos_entrenador` (migración 0086) queda sin
  nuevas filas — no se borró la tabla ni las escrituras `UPDATE` que ya
  existían en otros lados (encuentran cero filas y no hacen nada, ya
  tolerado por diseño).
- El panel "Propuestas de Impulso" en `/admin/alumnos` (in-app, no push)
  sigue funcionando igual — Alejandro puede seguir viendo y cancelando
  propuestas desde ahí, solo dejó de sonarle el teléfono por cada una.

## 2. Botón "Pídele ayuda a Ale" → texto simple, sin push en vivo

- `src/components/student/MomentoImpulsoEnVivo.tsx`: se sacó el botón que
  llamaba a `solicitarAsistenciaAle` (mandaba push en vivo a Ale) y el
  polling de `consultarEstadoAsistenciaAle`. En su lugar, un texto fijo:
  *"Avísale a tu entrenador si necesitas que te guíe en esta serie."*
- **No se tocó** `impulso-actions.ts` (`solicitarAsistenciaAle`),
  `avisos-entrenador.ts` (`avisarSolicitudAsistencia`), ni el panel admin
  `AsistenciaImpulsoEnVivo` / `asistencia-data.ts` — quedan como código
  vivo pero sin ningún llamador desde la UI del alumno. Si en el futuro se
  quiere retomar ese flujo (o borrarlo del todo), están intactos para
  decidir con calma.

## 3. Resultado del Momento Impulso: push a Ale + historial en el panel

Nuevo, no reemplaza nada: cuando una intervención pasa a `resuelta` (el
alumno contesta "lo logré" / "quedé corto" / etc.), Ale recibe un push con
alumno + ejercicio + resultado, y queda un historial cronológico chico en
`/admin/alumnos`.

- `avisarResultadoIntervencion` nueva en `avisos-entrenador.ts`, llamada
  desde `resolverIntervencionEnVivo` en `impulso-actions.ts`.
- `src/lib/impulso-vip/historial-data.ts` +
  `src/components/admin/HistorialImpulsoVIP.tsx` — lee
  `impulso_vip_intervenciones` con `estado='resuelta'`, últimas 12,
  cronológico. Probado en pantalla con datos reales.

## 4. Investigación: ¿Impulso VIP ya prioriza técnicas de nueva escuela?

Alejandro preguntó si el motor ya pide drop set/rest-pause/fallo técnico
con cierta frecuencia. Respuesta corta: **no, estructuralmente no puede
pasar hoy.** El detalle completo y actualizado está en la sección 9 — este
punto se fusionó con el pedido más grande de esa sección (el ejemplo de
Juliana) y no hace falta repetirlo dos veces.

## 5. "Rutinas hechas" → archivar y traspasar a otro alumno

Alcance confirmado con Alejandro antes de tocar código (preguntas
específicas sobre qué significa "borrar", "traspasar" y "editar" en este
contexto):

- **Archivar ≠ borrar.** `rutinas.archivada` (migración 0089) solo oculta
  del listado normal; no toca `sesiones_entrenamiento` ni
  `puntos_vip_movimientos` (confirmado con certeza alta — ver sección 9.3
  para el detalle completo de por qué los puntos nunca dependen de
  `rutina_id`). No se puede archivar la rutina activa de un alumno (guarda
  en `archivarRutina`, `src/app/admin/rutinas-generadas/actions.ts`).
- **Traspasar = duplicar como punto de partida para otro alumno**, no
  mover la rutina de dueño. `RutinasGeneradasPanel.tsx` ahora deja elegir
  un alumno destino distinto al dueño original antes de abrir la mesa de
  trabajo; al publicar, la nueva rutina queda en el alumno destino y la
  original sigue intacta en el historial del alumno de origen.
- **Editar sigue siendo por copia**, a propósito — Alejandro lo confirmó
  explícitamente (mantener el mecanismo actual, no editar en el lugar).
  Cualquier rutina del historial (activa o no) ya se puede reabrir, no
  solo la activa — eso ya funcionaba, no hizo falta cambiarlo.
- Probado en pantalla: archivar, ver archivadas, traspasar a otro alumno.

## 6. Alerta de alumnos que dejaron de entrar a la app

**Ojo con esto para la próxima sesión:** el primer intento (tracking nuevo
con `perfiles.ultimo_acceso_en`, ver la columna huérfana arriba) se
abandonó a mitad de camino al descubrir con más investigación que
**`/admin/ingresos` ya existía** (`src/lib/ingresos/data.ts`,
`src/app/admin/ingresos/page.tsx`) — tabla `alumno_accesos`, estados
`en_gimnasio/hoy/esta_semana/inactivo/nunca`, mucho más maduro que lo que
se estaba por construir. Se revirtió el enfoque nuevo y se construyó
`AlumnosSinIngresar.tsx` reusando `obtenerIngresos()` en vez de duplicar.

**Lección para la próxima vez que aparezca un pedido de "tracking de
actividad del alumno": buscar primero en `src/lib/ingresos/` y
`/admin/ingresos` antes de diseñar algo nuevo.**

- Panel nuevo en `/admin/alumnos`, arriba de "Prioridades de hoy": lista
  alumnos con `estado === "inactivo"` (7+ días sin ninguna actividad:
  app/comida/entrenamiento), con link a `/admin/ingresos?estado=sin_novedad`.
- Verificado consistente entre ambas pantallas (mismo dato, mismo conteo).
- Al cierre de la sesión, 0 alumnos en ese estado — el gimnasio está
  activo, no es un bug del panel.

## 7. Bloqueo de acceso a la app por no pago

Nuevo mecanismo completo, distinto de `plan_entrenamiento_pausado` (que ya
existía y solo pausa iniciar sesiones de entrenamiento dentro de un plan
configurado — no bloquea el resto de la app).

- `alumno_perfil.acceso_bloqueado` + `acceso_bloqueado_motivo` (migración
  0090, nota interna, el alumno no la ve).
- Gate en `requireAlumno()` (`src/lib/auth.ts`): si el alumno de verdad
  (no la vista "como alumno" del entrenador) tiene `acceso_bloqueado`,
  redirige a `/acceso-bloqueado` — pantalla fuera de `/alumno/*` a
  propósito, con mensaje y botón de cerrar sesión.
- **Bug real encontrado y corregido durante la verificación:**
  `/acceso-bloqueado` usaba `requireRol(["alumno"])`, pero una cuenta dual
  (entrenador con ficha de alumno propia) tiene `perfiles.rol =
  'entrenador'` — la página lo rebotaba a `/login` en vez de mostrar el
  mensaje. Corregido a `requireRol(["alumno", "entrenador", "admin"])`.
- Toggle en `/admin/alumnos/[id]` (mismo formulario que ya tenía "pausar
  plan" y "sin temporizador"), con motivo interno opcional.
- Probado de punta a punta con la cuenta de prueba: bloqueada → sacada de
  la app con el mensaje correcto → desbloqueada → volvió a entrar normal.

## 8. Candado de descanso, también editable por el alumno

Antes solo lo tocaba el entrenador desde el panel. Ahora el alumno tiene el
mismo interruptor en `/alumno/perfil`, con una distinción importante:

- `alumno_perfil.temporizador_descanso_desactivado_por_alumno` (migración
  0091) — `true` **solo** cuando el ALUMNO lo apagó desde su propio botón.
  Si lo apaga el entrenador (ej. razón médica), este flag queda en
  `false` y nunca penaliza — `actualizarPerfilAlumno`
  (`src/app/admin/alumnos/actions.ts`) lo resetea a `false` siempre que
  el entrenador guarda ese formulario.
- Si el alumno lo apaga él mismo y termina una sesión así, en vez de los
  puntos normales de "Entrenamiento finalizado" (hasta +300,
  `PUNTOS_VIP.entrenamientoMaximo`) recibe una penalización fija de -50
  (`PUNTOS_VIP.entrenamientoSinDescansoPorAlumno`, `reglas.ts`) — ver
  `registrarEntrenamiento` en `movimientos.ts` y `finalizarSesion` en
  `alumno/entrenar/actions.ts`.
- Componente `TemporizadorDescansoToggle.tsx`: aviso explícito antes de
  confirmar apagarlo ("vas a ganar menos puntos... -50 en vez de hasta
  +300"), con opción de cancelar. Probado en pantalla: apagar, ver el
  aviso, confirmar, verificar en la base que ambos flags quedaron
  correctos, volver a activar.

---

## 8.1 Segundos de descanso elegibles por el alumno

Pedido de último momento, encima del punto 8: en la misma pantalla
(`/alumno/perfil`), el alumno ahora también elige CUÁNTOS segundos
descansar — 45/60/90/120/150, o "Programado por tu entrenador" (default,
`null`).

- `alumno_perfil.segundos_descanso_preferido` (migración 0092, `check` a
  los 5 valores o `null`).
- **Decisión explícita de Alejandro, con el riesgo advertido antes de
  implementar:** cuando hay preferencia, reemplaza el `descanso_segundos`
  de **cada** ejercicio de la rutina activa — incluidas técnicas
  encadenadas (biseries/triseries) que tienen `0` puesto a propósito entre
  pasos, y cardio. No hay excepción por tipo de ejercicio. Si en el futuro
  esto genera quejas de alumnos rompiendo el ritmo de una superserie, la
  solución sería excluir `tecnicaTipo !== null` del reemplazo — no está
  hecho porque Alejandro pidió explícitamente "reemplaza todo".
- Un solo punto de resolución: `src/app/alumno/entrenar/data.ts`, en
  `obtenerSesionCompleta` — `descansoSegundos: segundosDescansoPreferido ??
  prog.descanso_segundos`. Ni `SesionEjercicioCard.tsx` ni
  `SesionGrupoCard.tsx` ni la penalización por exceso
  (`registrarPenalizacionDescanso`) necesitaron tocarse: ambos ya confían
  ciegamente en el número que llega resuelto desde acá.
- Probado en pantalla con el número real: cambié la preferencia de 90s a
  45s y el "Descanso" de Press de banca en una sesión activa cambió al
  instante de 90s a 45s — confirmado que reemplaza de verdad, no
  coincidencia. Restaurado a `null` al terminar.
- **No resuelto, cosmético:** `minutosEstimados` en `obtenerDiasRutina`
  (`data.ts:92-93,125`, la vista previa del calendario) sigue usando un
  `DESCANSO_DEFAULT_SEGUNDOS = 60` fijo para ejercicios sin descanso
  programado — no la preferencia del alumno. Nunca se tocó ese cálculo
  (es solo una estimación de duración, no el cronómetro real), pero puede
  verse inconsistente si alguien compara ambos números.

## 9. LO MÁS IMPORTANTE DE ESTA SESIÓN: hacia dónde debería ir Impulso VIP

Alejandro pidió explícitamente **no implementar esto todavía** — solo
verificar contra el código real si el sistema ya funciona como él lo
imagina, y dejarlo detallado acá para la próxima sesión de trabajo.

### 9.1 La visión, en sus palabras (ejemplo real de Juliana)

Juliana llegó a un Momento Impulso que pedía que el entrenador supervisara
su última serie. Ella tocó el aviso, llamó a Alejandro, él se acercó, la
exigió más de lo que venía haciendo (de 10 reps limpias con 20kg a 8 reps
al fallo real, supervisada) y le fue mejor que entrenando sola. **Eso es
exactamente lo que Impulso VIP debería producir, repetido 3 veces por
sesión, con cada alumno, indistintamente de qué esté entrenando.**

El objetivo explícito no es solo hipertrofia — es la **conexión humana**:
el alumno llama, Alejandro lo asiste, el alumno sale contento, y Alejandro
no se satura porque son solo 3 llamados por alumno por sesión, no una
alerta por cada propuesta automática (eso ya se resolvió en la sección 1 y
2 de este handoff: cero push automáticos, todo pasa por que el alumno
decida llamar).

### 9.2 Qué de esto YA funciona (gracias a esta sesión y a lo que ya existía)

- **El llamado es siempre iniciado por el alumno, nunca un push automático
  a Ale** — resuelto en las secciones 1 y 2. Coincide con la visión.
- **Ya existe un tope de 3 "ejercicios destacados" por sesión** que pueden
  tener un Momento Impulso: `MAX_EJERCICIOS_CON_IMPULSO_EN_VIVO = 3`
  (`src/lib/impulso-vip/en-vivo.ts:40`), aplicado en
  `asegurarIntervencionEnVivo` (`en-vivo-data.ts:57-70`). El número "3" que
  Alejandro pide ya está en el código — pero no hace lo que él imagina
  (ver más abajo).

### 9.3 Qué NO funciona todavía — brechas concretas, con archivo:línea

**Brecha 1 — el tope de "3" no es de técnica intensa, es de cualquier
momento.** De esos 3 momentos por sesión, la mayoría queda como
`cierre_controlado` (un ajuste liviano en la última serie, sin exigir
supervisión) — la escalera a técnica intensa (drop set / rest-pause /
fallo técnico) tiene su **propio tope, de 1 por sesión, no 3**:
`elegibilidad.ts:42` — `if (input.tecnicasIntensasSesion >= 1)
bloqueos.push("limite_sesion_alcanzado")`. Confirmado también por el test
`elegibilidad.test.ts:36-38` ("no agrega una segunda técnica intensa en la
misma sesión").

**Brecha 2 — hoy la técnica intensa NUNCA se activa en la práctica**,
tope aparte. `evaluarTecnicaIntensiva` exige
`perfilEjercicioRevisado === true` (`elegibilidad.ts:35`) y **los 121
ejercicios activos de la biblioteca siguen en
`impulso_perfil_revisado = false`** — es el backfill conservador de la
migración `0082_elegibilidad_tecnicas_impulso.sql`, que a propósito nunca
marca nada como revisado automáticamente (comentario textual en esa
migración: *"True cuando Alejandro reviso manualmente... false identifica
el backfill conservador automatico"*). El único lugar que cambia esto es
`actualizarPerfilImpulsoEjercicio` en
`src/app/admin/ejercicios/actions.ts:824`, que Alejandro dispara a mano,
ejercicio por ejercicio, desde `/admin/ejercicios`. **Mientras esto no se
haga, ningún ajuste de código va a producir una sola técnica intensa
real.**

**Brecha 3 — la elección de qué ejercicios reciben el momento no es "los
mejores para hipertrofiar", es orden de llegada.** `calcularIntervencionEnVivo`
(`en-vivo.ts:77-115`) solo exige: ≥3 series programadas, una
`impulso_vip_recomendacion` aprobada/modificada, regla distinta de
"reducir"/"consultar", y que el ejercicio no tenga ya una técnica
programada a mano. Entre los ejercicios que cumplen eso, se activan los
primeros 3 que el alumno alcanza en la sesión (`en-vivo-data.ts:57-70`) —
no hay ninguna lógica que priorice compuestos, el grupo muscular del día,
o "el mejor candidato para exigir de verdad". Si Alejandro quiere que
sean *los 3 mejores ejercicios* de la sesión (no los primeros 3), hace
falta una heurística de selección nueva acá.

**Brecha 4 — la supervisión obligatoria no está atada a "es técnica
intensa", solo a "fallo técnico".** En `elegibilidad.ts:47-56`: para
`rest_pause` y `drop_set`, `requiereSupervision` se pasa tal cual venía
del ejercicio (`input.requiereSupervision`, un campo que Alejandro
configura por ejercicio en el editor "Seguridad de Impulso VIP" de
`/admin/ejercicios`) — **no se fuerza a `true` automáticamente**. Solo
`fallo_controlado` (línea 56) lo fuerza siempre. Si la intención es que
*toda* técnica intensa exija que Ale supervise (y por lo tanto empuje al
alumno a llamarlo), hay que decidir si eso se vuelve automático para las
tres técnicas o si se deja como configuración por ejercicio, y documentar
cuál de las dos es la política real.

### 9.4 Para la próxima sesión — orden recomendado, sin implementar todavía

Esto es una propuesta de Claude para ordenar el trabajo, no una decisión
tomada — Alejandro tiene que confirmar cada punto antes de tocar código,
como pidió.

1. **Decidir primero lo operativo, no lo técnico:** ¿Alejandro va a
   revisar ejercicios en `/admin/ejercicios` antes de que esto se toque?
   Sin eso, cualquier cambio de código es invisible en producción (Brecha
   2). Puede convenir arrancar por un subconjunto chico (ej. 10-15
   ejercicios compuestos comunes) para probar el flujo con pocos alumnos
   antes de escalar a los 121.
2. **Subir el tope de técnica intensa de 1 a 3** (`elegibilidad.ts:42`) —
   cambio acotado, un número y su test.
3. **Decidir la política de supervisión** (Brecha 4): ¿toda técnica
   intensa fuerza supervisión, o se mantiene configurable por ejercicio?
   Si es lo primero, cambiar `elegibilidad.ts:48` y `:51` para que
   devuelvan `requiereSupervision: true` igual que ya hace la línea 56
   con fallo técnico.
4. **Diseñar la selección de "los 3 mejores ejercicios"** (Brecha 3) —
   esto es lo más grande de la lista. Hay que definir qué hace a un
   ejercicio "mejor candidato" (¿compuesto? ¿grupo muscular prioritario
   del día? ¿el que Alejandro marque a mano?) antes de tocar
   `en-vivo-data.ts`.
5. Repetir la verificación completa (`tsc`, tests, lint, build) y probar
   en pantalla con un alumno real antes de considerar esto terminado —
   mismo criterio que el resto de Impulso VIP.

---

## Verificación general de esta sesión

- `npx tsc --noEmit` limpio después de cada bloque de cambios.
- `npx eslint` limpio en todos los archivos tocados.
- `npx vitest run`: **396 pruebas pasando**, las 44 suites.
- Navegador de desarrollo (`localhost:3001`, cuenta `Entrenador Prueba` /
  dual admin+alumno): probado en pantalla — historial de Impulso VIP con
  datos reales, archivar/traspasar una rutina, panel "Dejaron de entrar"
  consistente con `/admin/ingresos`, bloqueo de acceso de punta a punta,
  candado de descanso de punta a punta con verificación en la base.

## Pendientes, en orden de importancia

1. **La sección 9 completa** — es el pedido más grande de la sesión y
   queda sin tocar a propósito.
2. **Probar en el teléfono real** (arrastrado desde el 1.24/1.25, sigue
   sin hacerse): candado de descanso excedido de principio a fin,
   notificación real de "Pídele ayuda"/aviso de resultado, interruptor de
   temporizador por alumno.
3. **La demo de Impulso VIP En Vivo** (arrastrado desde el 1.22): revisión
   técnica y visual completa, nunca se hizo formalmente pese a estar
   pedida en `HANDOFF_IMPULSO_VIP_CLAUDE.md`.
4. Decidir qué hacer con la columna huérfana `perfiles.ultimo_acceso_en`
   (borrarla o dejarla) — no urgente.
5. **Nada de esta sesión está pusheado a `origin/main` todavía** —
   Alejandro pidió esperar. Confirmar alcance antes de subir (¿todo junto
   en 8 commits por tema, como se venía haciendo, o revisar algo primero?).

## Cómo consultar/escribir en la base (quedó autorizado esta sesión)

Mismo patrón de siempre: credenciales de servicio en `.env.local`, script
`.mjs` en la raíz del repo, borrado después de usarlo. Se usó para: crear y
limpiar datos de prueba (reportes de fotos duplicados, bloqueo/desbloqueo
de acceso, toggle de temporizador), y verificar cada migración después de
que Alejandro la corriera manualmente en el SQL Editor de Supabase (no hay
`DATABASE_URL` ni token de Supabase CLI en este entorno — si se agrega
alguno de los dos a `.env.local`, la próxima sesión puede correr las
migraciones sin pedírselo a Alejandro cada vez). **No es autorización
permanente** — hay que volver a pedirla la próxima vez.
