# Handoff — Rediseño de Comer (31 de julio de 2026)

Complementa a `HANDOFF_CLAUDE_2026-07-30.md`, que sigue vigente para todo lo
demás (deploy, biblioteca de ejercicios, Documentos, etc.).

---

## 0. ESTADO

**Todo el rediseño de Comer está SIN COMMITEAR.** `tsc`, `eslint` y
`npm run build` (26 rutas) en verde, probado en el navegador.

Punto de retorno seguro: **`6bc8b13`** — respaldo tomado justo antes de tocar
Comer. Si algo salió mal:

```
git checkout -- .
```

Antes de commitear, revisar que `tsconfig.json` no tenga entradas `.next-*`
pegadas por `VIP_DIST_DIR` (ya se restauró, pero vuelve a ensuciarse con cada
build alternativo).

---

## 1. QUÉ CAMBIÓ

La pantalla Comer pasó de **dos pasos** (calendario del mes → pantalla aparte
del día) a **una sola pantalla**, siguiendo una referencia visual que pasó
Alejandro:

- Encabezado bajito: cuadrito de la marca (V + rayo + P) y "Nutrición" al lado,
  en vez de la placa dorada de ancho completo. Sale de `TITULOS_COMPACTOS` en
  `src/components/Logo.tsx`, que es lo único que hay que tocar si otra pantalla
  quiere el mismo encabezado. La pestaña de la barra también se llama Nutrición.
- Debajo, la fecha; a su derecha, el acceso al plan de alimentación en chico
  ("Mi plan"), alineado bajo el menú de las tres rayitas.
- **Tira de 7 días con flechas** ‹ › — el día elegido SIEMPRE en el centro.
- Tarjeta de macros (CAL / PROT / GRASAS / CARB) con barras de progreso.
- **Línea de tiempo de 24 horas** (12:00 AM a 11:00 PM) con cápsula de hora,
  línea punteada, botón "+", y la comida registrada o "Agregar comida".
  Va en `text-micro` (11 px, escalón nuevo de la escala en `globals.css`): con
  `caption` en todo, una hora con tres comidas empujaba el resto fuera de
  pantalla. Al desplegar una comida se ve el nombre completo de cada alimento
  —sin cortar— con su cantidad y sus macros, más una línea de TOTAL arriba.
  El `left` de la línea punteada depende del ancho de la cápsula, del gap y del
  botón "+": si se toca alguno, hay que recalcularlo.
- Buscador fijo abajo, sobre la barra de navegación.
- Panel inferior (bottom sheet) para cargar la comida de esa hora.

`/alumno/comer` (sin fecha) redirige a hoy. La fecha vive en la URL.

### Archivos

| Archivo | Qué es |
|---|---|
| `src/app/alumno/comer/tipos.ts` | **NUEVO.** Tipos + funciones puras, SIN `server-only` |
| `src/app/alumno/comer/data.ts` | Solo consultas. Reexporta `./tipos` |
| `src/components/student/PantallaComer.tsx` | **NUEVO.** El cerebro: estado, optimismo, línea de tiempo |
| `src/components/student/TiraDias.tsx` | **NUEVO.** Los 7 días con flechas |
| `src/components/student/TarjetaMacros.tsx` | **NUEVO.** Macros con barras animadas |
| `src/components/student/HojaAgregarComida.tsx` | **NUEVO.** Panel inferior + alimento personalizado |

**Borrados por quedar sin uso:** `ComidaCard.tsx`, `MetaCalorica.tsx`,
`StatGrid.tsx`.

---

## 2. DECISIONES QUE HAY QUE CONOCER

### 2.1 No se migró la base de datos

`comidas_registradas.tipo_comida` ya era **texto libre**, así que ahora guarda
la hora: `"08:00"`. No hizo falta migración ni tocar RLS.

Lo registrado ANTES (`"Comida 1"`, `"Comida 2"`…) **se sigue leyendo**: el mapa
`HORA_LEGADO` en `tipos.ts` le asigna una hora de referencia para ubicarlo en la
línea de tiempo. Verificado: el registro del 29/07 aparece intacto a las 8:00 AM.
No se reescribió ni se perdió nada.

### 2.2 ⚠️ Se tocó el ranking, a propósito

Cada comida vale `puntosPorDía / comidasDelPlan`. Con 24 franjas horarias, un
alumno podía registrar 10 comidas y **cobrar más que un día perfecto**.

Se puso un **tope por día** en `src/lib/ranking/data.ts`:

```ts
(a, b) => a + Math.min(b, comidasPorDia)
```

La fórmula de `calcularPuntosSemana` **no se tocó**. Si algún día se revisa el
ranking, no sacar ese tope sin entender esto.

### 2.3 Alimento personalizado: lo aprueba el entrenador (migración 0030)

`crearAlimentoPersonalizado` (en `comer/actions.ts`) inserta con **cliente
admin**, porque la política `alimentos_write` solo deja escribir a
entrenador/admin y no se quiso tocar RLS. Valida sesión y números antes.

Decidido el 31/07: el alimento **nace pendiente**. La migración
`0030_alimentos_aprobacion.sql` agrega a `alimentos`:

| Columna | Qué significa |
|---|---|
| `creado_por` | `null` = catálogo del gimnasio; si no, el alumno que lo creó |
| `aprobado` | `false` hasta que el entrenador lo acepte |

La política `alimentos_select` pasa a ser
`aprobado or creado_por = auth.uid() or es_admin_o_entrenador()`. O sea: el
alumno lo usa al instante, el resto no lo ve, y el entrenador **sí** lo ve —
hace falta, porque si no las kcal del día de ese alumno no le cuadrarían.

También se rompió el `unique(nombre)` global de la 0004 en dos índices
parciales: el catálogo sigue sin admitir repetidos, pero dos alumnos pueden
crear "Pan amasado de la feria" sin pisarse. Antes, al segundo le salía
"No fue posible crear el alimento" por culpa de otro alumno.

En `/admin/alimentos` aparece arriba el bloque **Esperando aprobación**
(`AlimentosPendientes.tsx`) con Aceptar / Rechazar.

El **punto rojo** en la pestaña Alimentos sale de un `count` con `head: true`
en el layout de admin (`src/app/admin/layout.tsx`): una consulta por pantalla
del panel, sin traer filas. No muestra el número, solo avisa que hay algo que
mirar. Se apaga solo al aceptar o rechazar (`revalidatePath`).

⚠️ **Rechazar NO borra**: pone `activo = false`. La FK de
`alimentos_consumidos` impide borrar algo que el alumno ya comió, y así su
historial sigue sumando esas calorías. Mismo criterio que el resto del catálogo.

✅ La 0030 **ya está corrida** en Supabase (verificado el 31/07: las columnas
existen y el catálogo quedó entero, con `creado_por = null` y `aprobado = true`).

### 2.4 Velocidad: la ventana se precarga

Primera versión: cada cambio de día era una navegación al servidor y Alejandro
lo notó lento ("la ventana tarda en cargar").

Ahora `obtenerRegistrosRango` trae **21 días (±10) en UNA consulta**, y cambiar
de día es puro estado del cliente.

Medido en el navegador:
- Días dentro de la ventana: **16–41 ms**.
- Al cruzar el borde: ~700 ms (una carga), y vuelve a quedar instantáneo.
  Es 1 de cada 11 cambios.

La URL se sincroniza con `window.history.replaceState`, **no** con
`router.push`: el router volvería a pedirle la pantalla al servidor, que es
justo lo que se quería evitar. Así recargar o compartir el enlace cae en el día
correcto.

### 2.5 Temas: los macros salen del acento activo

En `globals.css`:

```css
--macro-cal:   var(--color-vip);
--macro-prot:  color-mix(in srgb, var(--color-vip) 22%, var(--color-acento-fuerte));
--macro-grasa: color-mix(in srgb, var(--color-vip) 30%, #38bdf8);
--macro-carb:  color-mix(in srgb, var(--color-vip) 22%, var(--color-success));
```

Ningún color va escrito en los componentes. Verificado en vivo: al cambiar a
Lady, la barra de CAL pasa a `rgb(255,95,168)` sin recargar.

### 2.6 Hoy siempre en verde

El **número de hoy** va en `--color-success`, esté o no seleccionado, para no
perderse al mirar otros días. Si hoy queda fuera de los 7 visibles, **la flecha
que lleva hacia él también se pinta de verde** (con su `aria-label`
correspondiente). El puntito de cada día volvió a indicar SOLO el estado de las
comidas.

---

## 3. TRAMPAS QUE YA COSTARON UN BUILD

### `server-only` + componente cliente

`PantallaComer` importaba de `data.ts`, que lleva `server-only`, y el build
reventó con *"You're importing a module that depends on server-only…"*. Por eso
existe `comer/tipos.ts`. **Mismo patrón que `documentos/tipos.ts` y
`ejercicios/tipos.ts`** — está documentado en el handoff anterior y volvió a
pasar.

Regla: si un componente cliente necesita un tipo o una función pura de Comer,
importar de **`@/app/alumno/comer/tipos`**, nunca de `data`.

### `z-index` sobre la barra de navegación

El botón "+" de cada hora tenía `relative z-10` y se pintaba **encima** de la
barra inferior al scrollear. Alcanza con `relative` a secas: la línea punteada
va antes en el DOM.

### Hora del cliente vs. hora de Chile

`new Date().getHours()` en el cliente daba desajuste de hidratación. La hora
actual se calcula en el servidor con `horaActualISO()` (en `lib/date.ts`) y baja
como prop.

---

## 4. LO QUE NO SE HIZO

1. ~~No hay auto-scroll a la hora actual al entrar.~~ **Hecho el 31/07**, pero
   de otra forma: la lista de horas tiene su PROPIO scroll (alto medido en el
   cliente con `useAltoDisponible`), así que se puede posicionar en la hora
   actual sin mover nada de lo de arriba. La hora de ahora queda siempre como
   la 4ª fila visible (`FILAS_DE_CONTEXTO = 3`); en otro día que no sea hoy,
   la lista arranca a las 12 AM.
   El intento anterior desplazaba la PÁGINA, y por eso se había descartado.
   Dos números atados al layout: `ALTO_ZONA_INFERIOR` (donde empieza el
   buscador fijo) y el `-mb-24` del contenedor, que cancela el `pb-24` del
   layout de /alumno. Si se toca alguno de los dos, revisar que la página no
   recupere scroll propio.
2. **La tira ya no tiene scroll horizontal.** Se probó con snap e inercia y
   Alejandro lo descartó ("el scroll no me está sirviendo"). Quedó el patrón de
   Entrenar: flechas de a un día.
3. **Duplicar / editar una comida entera**: solo se puede editar cantidad,
   quitar un alimento o borrar la comida.

---

## 5. LO PRIMERO AL VOLVER

1. **Probarlo en el celular real** — nada de esto se verificó fuera del
   navegador de escritorio en 375 px.
3. Si queda bien: commitear. Sigue habiendo **~9 commits sin desplegar**
   (contando el respaldo `6bc8b13`), ver handoff anterior:
   ```
   npx vercel --prod --yes
   ```
