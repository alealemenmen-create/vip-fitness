# HANDOFF 1.14

## Punto de regreso

- Proyecto: VIP Fitness Portal.
- Carpeta: `C:\dev\vip-fitness`.
- Rama activa: `main`, **a la par con `origin/main`** — no queda nada sin
  subir. Último commit: `f612f85 fix(deploy): recorta el deploymentId a 12
  caracteres`.
- Remoto: `https://github.com/alealemenmen-create/vip-fitness.git`.
- Producción: **https://vipfitness.cl, verde y al día** (verificado con
  HTTP 200 y `data-dpl-id="f612f853f2b2"`).
- Aplicación local: `http://localhost:3001` (`.claude/dev-preview.cmd`).

**Corrección al HANDOFF 1.13**: ese documento dice que todo el trabajo de
esa sesión estaba sin commitear. Ya no es así — se commiteó en 6 bloques
temáticos y se subió. No hay que volver a revisar eso.

Archivos locales que siguen fuera del repositorio, sin cambios:

```text
Rutinas Alejandro/
respaldo-cloud-ia-2026-08-09.bundle
tmp/
```

---

## 1. Incidente: producción estuvo 8 horas congelada sin que se notara

Lo más importante de esta sesión. Alejandro reportó que "hay cosas que no
están" en producción.

**Causa**: el commit `7767ff1` ("fix: recupera editor tras despliegues
nuevos") puso el SHA completo de git como `deploymentId` en
`next.config.ts`. Vercel rechaza cualquier `deploymentId` de más de 32
caracteres y un SHA tiene 40:

```text
Error: The deploymentId "ecb77cda03c5e84b5b823675518134b984a232a1"
must be 32 characters or less.
```

**Por qué no se notó**: el build compilaba las 40 rutas sin un solo error y
recién fallaba en el último segundo, al publicar. Y cuando un despliegue
falla, Vercel **no rompe producción: la deja servida por el último
despliegue bueno**. Así que la app seguía en pie, respondiendo normal, pero
congelada en una versión vieja. **Cinco despliegues de producción seguidos
fallaron** (8 h, 7 h, 7 h, 6 h, 4 h y el del momento) sin ninguna señal
visible desde la app.

**Arreglo** (`f612f85`): `process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12)`.
12 caracteres siguen siendo únicos de sobra (git abrevia en 7) y la
protección de version skew que buscaba `7767ff1` sigue intacta — el id
cambia en cada commit. Verificado con un build local pasándole un SHA de 40
caracteres: emite `dpl=f44e93bbc791`.

**Consecuencia ya resuelta**: al desplegar el arreglo entró de golpe todo lo
acumulado del handoff 1.13 (plan contratado, editor rápido de plan, patrón
de movimiento, vista previa editable, selector en Documentos,
bíceps/tríceps en personalizada, los dos bugs del motor) más el tope por
grupo de esta sesión.

**Riesgo que queda abierto**: no hay ninguna alerta cuando un despliegue de
producción falla. Volvería a pasar igual. Ver "Próximos pasos" #1.

---

## 2. Tope de ejercicios por grupo muscular al generar

Era el pendiente #5 del handoff 1.13 y el más grande que quedaba del
generador. Commit `f44e93b`.

Decisión de alcance de Alejandro: *"yo elijo los topes cuando armo la
rutina"* — es 100% manual, sin topes por defecto, y con los 12 grupos
(los 6 principales más bíceps, tríceps, glúteo, cuádriceps, femoral y
pantorrilla).

- `tipos.ts`: campo nuevo `limitesPorGrupo` en `BriefGenerador`, **opcional**
  a propósito, para que los borradores ya guardados en
  `borradores_generador_rutinas` sigan deserializando sin tocar nada.
- `motor.ts`: `repartirConLimites()` corre después del reparto normal por
  cupos. Recorta hasta el tope y **le pasa los espacios liberados a los
  otros grupos del mismo día**, así la sesión no se achica sola. Solo suma
  espacios a un cupo si le quedan candidatos reales en la biblioteca.
- Un tope de sub-grupo convive con el de su grupo padre y **gana el más
  chico** (Brazos máx. 3 + Bíceps máx. 1 → 1 de bíceps y hasta 2 de
  tríceps).
- El tope también se respeta en los **dos rellenos que quedaban fuera** del
  reparto por cupos: el de un día de brazos general y el de sobrantes del
  final. Sin eso, un día podía terminar con 4 de pecho aunque el tope
  dijera 2.
- Si por los topes el día queda más corto de lo pedido, **avisa** en vez de
  rellenar con cualquier cosa. Y se silenció la alerta vieja de "solo N
  ejercicios de X" cuando ese número lo puso el entrenador a mano.
- `revisarRutina.ts`: el prompt de la IA ahora recibe los topes, para que no
  marque como deficiencia justo lo que el entrenador pidió a propósito.
- `LimitesPorGrupo.tsx`: componente nuevo, dentro de "3. Estructura de la
  semana", con botón "Quitar topes".

**Verificado en vivo, con clic real, contra la base real** (121 ejercicios,
nivel avanzado):

```text
Día "Pecho + Espalda", 6 ejercicios, sin tope  → 3 espalda + 3 pecho
El mismo día con Pecho máx. 2                  → 4 espalda + 2 pecho (sigue en 6)
Día solo de pecho, máx. 2, pidiendo 6          → 2 ejercicios + alerta explícita
```

De paso quedó verificado con clic real el lápiz de editar y el "+" de
insertar de la vista previa, que el handoff 1.13 daba por pendiente.

---

## 3. Medición de la biblioteca real (121 ejercicios)

Se midió en vivo para responder si el tope tenía un cuello de botella de
contenido:

```text
Piernas 29 · Espalda 22 · Brazos 19 (≈11 bíceps / ≈8 tríceps)
Pecho 14 · Core 14 · Hombros 12 · Cardio 11
```

Conclusión: **el tope funciona bien con la biblioteca actual**. Hay margen
de sobra para que los espacios liberados se reubiquen. El límite real sigue
siendo pantorrilla (1 solo ejercicio) y que trapecio/antebrazo no existen
como grupo propio ("Encogimiento de hombros" está clasificado como Espalda).
No se cargó nada: Alejandro dijo que sube fotos y contenido faltante él
mismo.

---

## Verificación al cierre

```text
tsc --noEmit: limpio
eslint sobre los archivos tocados: limpio
Vitest: 22 archivos, 237 pruebas aprobadas (234 + 3 nuevas)
npm run build: pasa, 40 rutas
Navegador: verificado con clic real contra datos reales (ver sección 2)
Producción: https://vipfitness.cl HTTP 200, dpl-id f612f853f2b2
```

---

## Próximos pasos recomendados

1. **Alerta de despliegue fallido** — hoy un deploy roto es invisible desde
   la app y puede dejar producción vieja durante días. Es el hallazgo más
   importante de esta sesión y no está resuelto, solo documentado.
2. Tope de ejercicios en grupos "chicos" (gemelo/trapecio/antebrazo), con la
   aclaración ya confirmada de que bíceps/tríceps/hombros nunca cuentan como
   chicos y que el tope no aplica a un día armado a propósito solo con esos
   grupos.
3. Revisar a mano los 8 alumnos sin plan y los que el backfill asumió Access
   siendo Select.
4. STNDRD: se relevó qué hay construido (puntos VIP, 7 rangos, ranking
   plano de 68, Arena con torneos, noticias) contra las 4 ideas. El ranking
   plano es el punto más flojo: el que va 40º no le está ganando a nadie, y
   ya existen dos ejes para segmentar en ligas sin crear datos nuevos (el
   rango y el plan contratado). **Alejandro todavía no eligió por cuál
   arrancar** — quedó pendiente de decisión, no de trabajo.
5. Cargar ejercicios de trapecio y antebrazo para habilitarlos como grupos.
6. Conectar `patron_movimiento` como override real en el motor. Sigue
   bloqueado por datos: la columna está vacía en los 121 ejercicios, así que
   conectarlo hoy no cambiaría nada.
7. Alejandro pidió una explicación clara y coloquial de cómo funciona todo
   esto (el flujo de despliegue, el generador, la app). Pendiente de dar.

---

## Regla de continuidad

No rehacer lo ya terminado. Partir desde `main` (esta vez sí está limpio y
sincronizado), leer este handoff y el 1.13, y preservar siempre:

- Puntos históricos, sesiones completadas, rutinas publicadas, documentos y
  fotografías.
- Planes activos, incluidos los asignados por el backfill del handoff 1.13 —
  no recalcular ni tocar en masa sin revisar con Alejandro primero.
- Carpeta local `Rutinas Alejandro/`.
- No aplicar migraciones ni escribir en masa sobre datos reales de alumnos
  sin autorización explícita.
- **No pushear a `main` sin autorización expresa: `main` despliega solo a
  producción** (vipfitness.cl). Esto se confirmó en esta sesión.
