# HANDOFF 1.11

## PUNTO DE REGRESO

Rama: `main`. **Nada está commiteado** — igual que en 1.10, todo vive como cambios
locales. Último commit real sigue siendo `26e4acf` (el merge de la otra compu).
Esta sesión arrancó desde el estado que dejó HANDOFF_1.10 y sumó todo lo de abajo.

```
Modified:
  src/app/admin/alumnos/[id]/page.tsx
  src/app/admin/archivos/actions.ts
  src/app/admin/ejercicios/actions.ts
  src/app/admin/generador/actions.ts
  src/app/admin/generador/page.tsx
  src/app/admin/layout.tsx
  src/app/alumno/layout.tsx
  src/app/alumno/mi-entrenamiento/page.tsx
  src/components/admin/GeneradorRutinasPanel.tsx
  src/components/admin/RutinaDraftEditor.tsx
  src/lib/generador-rutinas/motor.ts
  src/lib/generador-rutinas/motor.test.ts
  src/lib/generador-rutinas/tipos.ts

Untracked (nuevos de esta sesión):
  src/app/admin/alumnos/fichaActions.ts
  src/app/admin/alumnos/rutinaTexto.ts
  src/app/completar-perfil/          (page.tsx + actions.ts)
  src/components/admin/BotonRefrescarCatalogo.tsx
  src/components/admin/CopiarRutinaAlumno.tsx
  src/components/admin/FichaAlumnoAdmin.tsx
  src/components/admin/RevisionIAPanel.tsx
  src/components/student/FichaAlumnoForm.tsx
  src/lib/ai/revisarRutina.ts
  src/lib/gimnasio/inventario.ts
  src/lib/perfil-alumno/            (ficha.ts + datos.ts + ficha.test.ts)
  src/lib/generador-rutinas/whatsapp.ts + whatsapp.test.ts
  supabase/migrations/0054 … 0059

Eliminados:
  src/lib/generador-rutinas/mensajeEncuesta.ts + su test
  (reemplazados por whatsapp.ts — ver punto 7)
```

**Migraciones: de la 0049 a la 0059 están TODAS corridas**, confirmado por el
usuario y verificado leyendo la base. La `0053` (técnicas adicionales), que en
1.10 quedaba pendiente, también se corrió.

**Servidor de dev**: `localhost:3001` vía el Browser pane (`preview_start`,
nombre `vip-fitness`). Cuenta de prueba: `1@1.com` / `111111`. Se cayó una vez a
mitad de sesión y hubo que relanzarlo — si aparece "Failed to fetch" en una
Server Action, revisar que el server siga vivo antes de buscar el bug en el código.

**Stash sin tocar** de sesiones viejas: `stash@{0}` y `stash@{1}` en
`agent/interfaz-entrenamiento-enfocada`. No se tocaron.

---

## Qué se hizo, en orden

### 1. Filtro de IA sobre la rutina generada

`src/lib/ai/revisarRutina.ts`. **El motor de reglas sigue siendo el único que
ELIGE ejercicios** — determinista, con cupos por grupo, solo biblioteca real. Lo
que el motor no puede hacer es leer texto libre ("molestia en la rodilla al bajar
escaleras", "operada de hombro hace 8 meses") y cruzarlo con los ejercicios
concretos de la semana. Eso audita esta capa: no genera, revisa.

Devuelve `veredicto` (aprobada / ajustes_sugeridos / revisar_con_cuidado),
`resumen`, `hallazgos` (categoría + gravedad) y `cambios` acotados y aplicables.
Modelo `claude-opus-5` con thinking adaptativo, effort high y salida estructurada
por zod. Tarda ~40s y cuesta centavos por rutina.

`resolverRevision` cruza cada reemplazo propuesto contra la biblioteca real y
resuelve el `ejercicioId` en el servidor: **el modelo nunca inventa un id**. Si el
nombre no calza, el cambio se muestra como sugerencia pero sin botón de aplicar.

Si la IA falla o no hay `ANTHROPIC_API_KEY`, el borrador se publica igual — la
revisión es un plus, nunca un requisito.

En pruebas reales detectó cosas ciertas: "en toda la semana no hay ni un ejercicio
de cuádriceps y tampoco trabajo directo de tríceps, mientras gemelos aparece 3
veces", y con una alumna de 61 años ajustó solo ("más apropiado para una
principiante de 61 años que el peso corporal en flexiones").

### 2. Panel de revisión en el borrador

`RevisionIAPanel.tsx` + estado en `RutinaDraftEditor`. Veredicto con color,
hallazgos por gravedad, y cada cambio con su botón Aplicar (o "Aplicar los N").
La vista previa del documento se actualiza en vivo.

`ubicarEjercicio` busca el destino por posición **verificando el nombre**, y si no
calza lo busca por nombre en el día: si el entrenador movió o quitó ejercicios
desde que se hizo la revisión, el índice deja de valer. Antes que tocar el
ejercicio equivocado, no toca nada.

**Bug encontrado y corregido probando en vivo**: `aplicarCambios` marcaba lo
aplicado DENTRO del updater de `setDraft`, que React ejecuta después — así que el
`setAplicados` de abajo leía una lista vacía. El cambio se aplicaba al borrador
pero el botón seguía diciendo "Aplicar", y aplicarlo de nuevo en un cambio de tipo
"quitar" borraba un segundo ejercicio. Ahora se calcula fuera del updater.

### 3. Ficha del alumno obligatoria

El hueco real: **el generador leía `perfiles_entrenamiento`, pero casi nadie la
había llenado**, y desde el admin solo se podía LEER, nunca escribir. Todo lo
construido trabajaba a ciegas.

- `src/lib/perfil-alumno/ficha.ts` — tipos, opciones y `camposFaltantes()`, la
  definición única de "ficha completa". Solo exige lo que cambia la rutina:
  nacimiento (edad → ajuste de volumen), sexo (énfasis), objetivo, días, minutos,
  experiencia y haber contestado salud.
- `src/lib/perfil-alumno/datos.ts` — `leerFicha` / `guardarFicha`. Los datos viven
  en dos tablas por historia (`alumno_perfil` + `perfiles_entrenamiento`); este
  módulo los trata como una sola cosa, que es como los vive el alumno.
- `src/components/student/FichaAlumnoForm.tsx` — **un solo formulario** para los
  tres lugares (ingreso, "Mi entrenamiento", panel del entrenador). Escrito
  tuteando y en lenguaje de sala: "llevo menos de 6 meses entrenando", no
  "principiante".
- `/completar-perfil` — pantalla de ingreso, **fuera del layout de `/alumno` a
  propósito**: el bloqueo vive en ese layout, así que si colgara de ahí se
  redirigiría a sí misma en bucle.
- Bloqueo en `src/app/alumno/layout.tsx`: alumno nuevo o antiguo sin ficha
  completa → `/completar-perfil`. Solo aplica a `rolSesion === "alumno"` y sin
  `soloLectura`, para no bloquear al entrenador revisando la app de otro.
- `FichaAlumnoAdmin.tsx` + `fichaActions.ts` — el entrenador llena o corrige la
  ficha desde el perfil del alumno. `alumnoId` va por `.bind()`, nunca en el
  formulario: como campo oculto, cualquiera podría reescribir la ficha de otro.

**Los cinco temas de salud van con sí/no obligatorio y detalle solo si dice que
sí.** Un cuadro de texto vacío no distingue "no tengo nada" de "no lo contesté", y
esa diferencia es la que necesitan el entrenador y la IA para saber si pueden
confiar en el silencio.

### 4. Técnicas repartidas en la semana

Corrección del entrenador: *"las técnicas van distribuidas entre los días y la
semana, no es que en un día vas a meter todas las técnicas"*.

Antes cada día se resolvía solo, así que la misma técnica (la de mayor fatiga
disponible) caía en los mismos dos accesorios de TODOS los días. Ahora hay
`EstadoTecnicasSemana`: rota por la menos usada, evita repetir la del día
anterior, y `diaLlevaTecnica()` reparte parejo — mitad de los días en estándar,
75% en alta, todos en competitiva.

La instrucción siempre dice **en qué serie** va: "Última serie: al fallo, baja el
peso ~20%…".

### 5. Cardio real

Se reemplazó "bajo/moderado/alto" (una intensidad abstracta con la que no se arma
nada) por la modalidad concreta: spinning, steps, funcional o indistinto.

- El funcional es un circuito de estaciones marcadas a mano, con toggle
  **"En circuito" / "Separados"** (`cardioFormato`). En circuito van seguidas con
  30s entre estaciones; separados, cada una es su bloque con descanso real.
- `modalidadesCardioDisponibles()` deriva las opciones **de lo que está activo en
  la biblioteca**: si no hay caminadora, no aparece la opción.

### 6. El tiempo dicta los ejercicios

`ejerciciosPorTiempo(minutos, cardioMinutos)` — ~1 ejercicio cada 10 minutos de
fuerza. Calibrado con el ejemplo del entrenador: 60 min alcanzan para pecho
(plano, inclinado, aperturas) + press militar + dos de tríceps = 6 "con los
descansos y todo"; 120 min dan para el doble. Editable, con un botón para volver
al sugerido.

### 7. WhatsApp sin mensaje predeterminado

A pedido explícito. La ficha del alumno reemplaza al cuestionario por chat, así
que `mensajeEncuesta.ts` se borró y quedó `whatsapp.ts` con solo el link
(`wa.me/<número>`, sin `?text=`).

### 8. Copiar una rutina de un alumno a otro

`rutinaTexto.ts` + `CopiarRutinaAlumno.tsx`. En el perfil del alumno, "Extraer
rutina como texto" la copia al portapapeles con el mismo serializador; se pega en
Documentos → Pegar texto para el alumno nuevo.

**Pasa por el editor a propósito.** Copiar directo de alumno a alumno sería más
rápido y peor: dos fichas distintas compartiendo la misma rutina sin que nadie la
haya mirado.

### 9. La norma del catálogo y la limpieza de la biblioteca

Norma obligatoria del entrenador: *"no se pueden agregar ejercicios o maquinaria
que no estén en el gimnasio"*. Está escrita como regla dura en el prompt: el
catálogo no es una sugerencia, es el inventario real. La IA no puede nombrar una
máquina inexistente ni en los cambios, ni en los hallazgos, ni al pasar. Sí puede
proponer técnicas o variantes sobre lo que existe (un curl 21 sobre el curl con
barra) porque eso no necesita equipo nuevo.

`src/lib/gimnasio/inventario.ts` guarda la maquinaria real y **se le pasa a la IA
en cada revisión**, junto con una lista explícita de lo que NO hay. Antes solo veía
nombres de ejercicios y podía razonar sobre equipo imaginario.

Limpieza de la biblioteca, leyendo la base y cruzándola con el inventario:

- **0056**: caminadora, trotadora, elíptica y escaladora — no están en la sala.
- **0057**: 10 máquinas más que no existen (pec deck, remo en T, press inclinado
  en máquina, gemelos de pie/sentado, femoral sentado/de pie, crunch en máquina,
  remo ergómetro) + TRX renombrado a **"TRX profundo"**, como lo llama él.
- **0058**: "Remo Hammer" no es máquina sino montaje (banco de hombros de frente a
  la polea, pecho apoyado, agarre hammer) — pasó a `equipo = 'polea'` con la
  descripción del montaje, porque el alumno lo lee y no hay máquina rotulada que
  se lo explique.
- **0059**: 10 duplicados unificados. **El criterio para distinguirlos fue la
  ilustración**: los originales que cargó el entrenador tienen `ilustracion_slug`
  (un .webp en `public/ejercicios`); los duplicados aparecieron al subir rutinas
  que llamaban al mismo movimiento de otra forma. Ninguna rutina publicada los
  usaba (0 filas, verificado), así que la fusión fue limpia. Cinco entradas de
  elevación lateral en polea quedaron en una.

**Lo que evita que los duplicados vuelvan son los ALIAS, no la desactivación**: el
emparejador de rutinas importadas busca por nombre y por alias, así que el próximo
PDF que diga "Bench press" cae en "Press de banca".

Todo se desactiva (`activo = false`), nunca se borra: las rutinas ya publicadas
siguen enteras y se revierte con un update.

### 10. Refresco manual del catálogo

Hueco encontrado al verificar: la biblioteca se cachea 1 hora
(`unstable_cache`) y ese caché solo se limpia cuando el cambio pasa por una Server
Action. Editando Supabase directo —que es como se cargan máquinas o se desactivan
las que no están— nada avisaba y el generador seguía armando rutinas con el
catálogo viejo. En producción hubiera pasado igual.

`refrescarCatalogo()` + botón **"Actualizar catálogo"** arriba del generador.
Refresca biblioteca y técnicas. **Hay que usarlo después de cada SQL que toque
`ejercicios` o `tecnicas_entrenamiento`.**

### 11. Bug: el generador preseleccionaba un alumno

`useState(() => new Set([alumnos[0].id]))` dejaba marcado al primer alumno
alfabético. Si el entrenador no miraba, generaba una rutina para alguien que nunca
eligió. Arranca vacío; el botón de generar ya estaba deshabilitado sin selección.

---

## Verificación general

`npx tsc --noEmit` limpio. `npx vitest run` → **170/170 en verde** (26 tests
nuevos: reparto semanal de técnicas, `ejerciciosPorTiempo`, modalidades de cardio,
circuito vs separado, `fichaCompleta`, `linkWhatsApp`). `npm run build` compila.

Probado en el navegador contra la base real: se generó una rutina, se analizó con
IA, se aplicó un cambio viendo la vista previa actualizarse, se confirmó que el
cuestionario carga y scrollea, que el generador arranca sin nadie seleccionado y
que el catálogo refleja las migraciones.

**Estado de la biblioteca al cierre**: 119 ejercicios activos de 147 cargados; 113
con ilustración. Los 6 sin foto son los de cardio funcional agregados hoy
(jumping jacks, sentadilla con salto, slam ball, wall ball, mountain climber,
TRX profundo).

---

## Pendiente

1. **Commitear.** Todo esto sigue sin commitear en `main`, encima de lo que ya
   venía sin commitear de 1.10. Es mucho trabajo sin respaldo.
2. **Sincronizar escritorio ↔ notebook por GitHub, no por Google Drive.** El
   usuario instaló Drive para eso. Se le explicó por qué no sirve para el
   proyecto (`.git` se corrompe, `node_modules` son ~40.000 archivos con binarios
   por máquina, los conflictos de Drive crean `motor (1).ts` y rompen el build) y
   que `.env.local` no viaja por GitHub y hay que copiarlo a mano una vez. Remoto:
   `github.com/alealemenmen-create/vip-fitness`.
3. **Subirle foto a los 6 ejercicios de cardio funcional** desde "Agregar
   ejercicio".
4. **CRUD visual de técnicas** — sigue postergado de común acuerdo: se evalúa que
   las técnicas son un set cerrado y agregar una es un SQL de dos líneas. El
   entrenador quedó de avisar si usa técnicas que no están en las 10 cargadas.
5. **Que los alumnos llenen la ficha.** El bloqueo ya los obliga al abrir la app,
   pero hasta que pase, el generador sigue armando a ciegas para quien no la tenga.
   En el panel aparecían ~56 marcados "para revisar".
6. **Multi-alumno**: si se eligen varios, la rutina se genera y se revisa con la
   ficha del primero. Es lo que ya hacía; ahora al menos lo avisa en pantalla.
7. **Selector de ejercicios y vista previa solo en el flujo del generador** —
   sigue igual que en 1.10: falta pasarle la prop `ejercicios` a
   `RutinaDraftEditor` desde `ArchivosManager`/`DocumentosManager`.
8. **Sub-grupos de pierna y enfoque de forma siguen siendo heurística por
   nombre**, sin columna estructurada. Igual que en 1.10.
9. **Ordenar los `.md` sueltos de la raíz** — se sumó este handoff a la pila.

### Detalle menor
"Press de banca" quedó con `bench press` repetido en sus alias (ya lo tenía y la
0059 lo volvió a agregar). No afecta el emparejado.
