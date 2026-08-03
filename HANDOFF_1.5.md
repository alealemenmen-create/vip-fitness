# HANDOFF 1.5 — Bug crítico de pantalla en blanco arreglado, historial rehecho, diseño de Entrenar en rama aparte

**Fecha:** 3 de agosto de 2026
**Estado:** dos ramas nuevas con trabajo terminado y verificado en vivo,
ninguna mergeada todavía a `main`. `main` sigue en `f738037`, igual que en
el HANDOFF 1.4.

---

## PUNTO DE REGRESO

| | |
|---|---|
| Rama de este trabajo (bugs + historial) | `fix/historial-rutinas-completo` — commit `842c676` |
| Rama de diseño (Entrenar, aparte) | `raspado/entrenar-diseno-referencia` — commit `22103ce` |
| `main` | Sin cambios, en `f738037` (== HANDOFF 1.4) |
| Trabajo pendiente sin commitear | **ninguno** en ninguna de las dos ramas |
| Deploy | **nada de esto está en producción** — las dos ramas son solo locales |

Para volver a cada rama:
```bash
git checkout fix/historial-rutinas-completo   # bugs + historial
git checkout raspado/entrenar-diseno-referencia  # diseño de Entrenar
```

---

## POR QUÉ DOS RAMAS

El dueño pidió trabajar en una rama aparte "por si acaso no queda bien" el
diseño. Cuando después pidió además corregir bugs de lógica (historial,
botones de Entrenar) y analizar la app entera, se abrió una SEGUNDA rama
(`fix/historial-rutinas-completo`) desde `main` — no arriba de la rama de
diseño — para no mezclar dos cosas de naturaleza distinta (visual vs.
lógica/datos) en un solo lote que sea más difícil de revisar o revertir
por separado.

---

## RAMA `fix/historial-rutinas-completo` — QUÉ SE HIZO

### 1. Bug crítico: pantalla en blanco en cualquier carga fría (commit `6dc6337`)

El dueño reportó que en Historial, tocar una rutina "no te deja verla, no
hace nada, el botón se tapa". Se reprodujo así: **cualquier carga fría**
de una pantalla de alumno (abrir la PWA de cero, seguir un enlace, que iOS
recargue la pestaña al reanudarla — NO una navegación de cliente dentro de
la app) dejaba la pantalla casi en blanco para siempre, con solo el
encabezado y la barra inferior.

Diagnóstico confirmado con el navegador real (no supuesto): el contenido
SÍ llega en el HTML — queda en el DOM dentro de un `<div hidden
id="S:...">`, propio del streaming de React — pero el script que lo revela
nunca corre. `document.body.innerText` volvía vacío mientras el
accessibility tree mostraba todo el contenido. Se aisló la causa probando
de a una cosa: en **Next.js 16.2.12 + Turbopack**, tener `loading.tsx` en
la ruta (que Next envuelve en un `<Suspense>` implícito) es lo que dispara
el cuelgue en cargas frías. Sacarlo lo arregla de punta a punta — probado
en pestañas nuevas y limpias en Inicio, Entrenar, Historial y la sesión de
un entrenamiento.

Había un comentario de una sesión anterior en `globals.css` que decía "no
se puede resolver borrando los loading.tsx" — pero esa decisión era sobre
un problema DISTINTO (perder el prefetch instantáneo entre pestañas en
navegación de CLIENTE), no sobre este cuelgue en cargas frías. Se
priorizó: una pantalla rota de verdad en cualquier apertura fría es mucho
peor que perder un poco de instantaneidad al cambiar de pestaña. Se
sacaron los 12 `loading.tsx` de la app (alumno y `admin/documentos`) y el
esqueleto que ya no usa nadie (`PantallaCargando`, `.esqueleto-carga`).

**Si una versión más nueva de Next arregla el bug de raíz, se puede
reconsiderar** — queda documentado en el comentario que reemplazó al
anterior en `globals.css`.

### 2. "Ver entrenamiento" ya no marca la rutina como en curso (commit `e950cac`)

Los botones "Iniciar entrenamiento" y "Ver entrenamiento" llamaban a la
misma acción (`iniciarSesion`), que crea la fila en
`sesiones_entrenamiento` con `estado='en_progreso'` por defecto. Eso ya
era la intención documentada ("ver" no debía comprometer a nada) pero el
efecto visual no acompañaba: apenas se tocaba "Ver entrenamiento" para
mirar, el círculo del día se pintaba en curso, aparecía la píldora
"Entrenamiento en curso", y la pestaña Entrenar de la barra inferior
mandaba de vuelta ahí — aunque nunca se hubiera tocado "Iniciar rutina" ni
arrancado el cronómetro.

Ahora "en curso de verdad" (en `obtenerNumerosCalendario`,
`obtenerSesionEnProgreso`, y el guard de `iniciarSesion` que evita
arrancar dos rutinas a la vez) requiere `rutina_iniciada_en IS NOT NULL` —
o que el día sea de descanso, que no tiene ese segundo paso. Una fila
creada solo por "Ver entrenamiento" queda invisible para estos tres
lugares hasta que de verdad se empiece la rutina; si el alumno vuelve a
tocar el mismo día después, reutiliza la misma fila en vez de crear otra.

**Verificado en vivo**: día sin tocar → dot transparente, sin píldora, sin
redirección de la barra inferior. Mismo día después de "Iniciar rutina" →
dot violeta, píldora "Entrenamiento en curso" visible.

### 3. Historial: reporte completo por rutina + reiniciar de cero (commit `842c676`)

El Historial pasó de una lista plana de sesiones a un **reporte por
rutina**: la portada (`/alumno/entrenar/historial`) muestra una tarjeta
por cada rutina que el alumno haya entrenado alguna vez (nombre, rango de
fechas, cantidad de sesiones); abrirla lleva a
`/alumno/entrenar/historial/rutina/[id]` con el resumen completo
(sesiones, ejercicios completados, Puntos VIP ganados bajo esa rutina) y
la lista de cada sesión cerrada.

Se agregó **"Reiniciar rutina de cero"** (confirmación en dos pasos, mismo
patrón que `AbandonarSesionBoton`): borra todas las
`sesiones_entrenamiento` de esa rutina (cascada a `sesion_ejercicios` y
`series_realizadas`), así el calendario de Entrenar vuelve al Día 1. A
propósito **no toca `puntos_vip_movimientos`** — es un registro aparte por
clave (`entrenamiento:<sesionId>`), sin llave foránea con
`sesiones_entrenamiento` — así que los Puntos VIP ya ganados quedan
intactos, tal como se pidió explícitamente ("sin que afecte el ranking").

**Verificado en vivo contra la cuenta de prueba** (Vipfitnesslaserena):
756 puntos sin cambio después de reiniciar, calendario vuelto a Día 1,
"Sesiones del mes" en 0 de 24.

---

## RAMA `raspado/entrenar-diseno-referencia` — QUÉ SE HIZO

Ver el detalle en los commits de esa rama (`84b94a7`, `22103ce`). En
resumen, para acercar Entrenar a una foto de referencia que pasó el dueño:

- Fotos de grupo muscular recoloreadas de verde/rojo a naranja cálido
  uniforme (pixel a pixel con `sharp`, preservando luminancia).
- Tema de botón por defecto de toda la app cambiado de "Espejo" a "VIP"
  (dorado sólido) para dispositivos que nunca eligieron uno.
- Insignia del grupo muscular principal (dibujo anatómico + resplandor
  cálido) arriba-izquierda de la foto del día, rayos de luz diagonales de
  fondo, tarjeta "Sesiones del mes" con degradado violeta completo + ícono
  de calendario + número resaltado, y más glow en el botón dorado.
- `Card` ahora acepta un `style` opcional (para fondos con `color-mix` que
  no se pueden expresar como clase de Tailwind).

**El dueño vio capturas reales de esta rama** (via un artifact publicado
en la conversación) y confirmó que quiere igual la foto de referencia —
esta rama sigue como está, no se tocó más esta sesión.

---

## PENDIENTE / PARA REVISAR MAÑANA

1. **Decidir sobre las dos ramas**: ¿mergear alguna, las dos, o seguir
   iterando primero? Ninguna tocó `main`.
2. **Análisis más amplio de la app** (pedido explícito del dueño: "conocé
   la app entera, qué debemos mejorar") — se lanzó un agente de
   exploración de solo-lectura sobre Nutrición, Progreso, Ranked, el
   sistema de puntos, el Asistente VIP y el panel de admin, buscando bugs
   de la misma naturaleza (botones que hacen algo distinto de lo que
   dicen, estados marcados antes de tiempo, permisos mal aplicados). Su
   reporte llega aparte — revisarlo antes de decidir qué más tocar.
3. Los pendientes livianos del HANDOFF 1.4 (bug cosmético de
   `EliminarPerfilBoton` tras confirmar un borrado, `cancelarEliminacionDatos`
   sin conectar a ningún botón) siguen sin tocar.

---

## DECISIONES QUE CONVIENE NO PERDER

- **`loading.tsx` está deliberadamente ausente** de las 12 rutas donde
  estaba — no es un olvido, es el fix del bug de pantalla en blanco. No
  volver a agregarlos sin antes confirmar que una versión más nueva de
  Next.js 16 no tiene el mismo problema.
- **"En curso de verdad" en Entrenar** = `rutina_iniciada_en IS NOT NULL`
  (o día de descanso) — no `estado = 'en_progreso'` a secas. Cualquier
  lógica nueva que necesite saber si el alumno "está entrenando ahora
  mismo" tiene que usar este criterio, no el estado crudo de la fila.
- **Reiniciar una rutina borra sesiones pero nunca toca
  `puntos_vip_movimientos`** — mismo principio que "abandonar" y que el
  borrado de datos del Asistente VIP: los Puntos VIP de una categoría no
  se tocan por acciones de otra categoría salvo que se pida explícito.
- **Comandos de git que tocan `main`/producción: el dueño los corre él
  mismo**, Claude solo los redacta (regla que ya venía del HANDOFF 1.4).

---

## CONVENCIÓN DE HANDOFFS

Este es **HANDOFF 1.5**. El siguiente va `HANDOFF_1.6.md`. Cuando el dueño
pida "lee el handoff", se lee **el último** (el de número más alto).
