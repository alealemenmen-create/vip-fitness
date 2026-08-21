# Rediseño de "Entrenar" — Portal clásico

Fecha: 2026-08-21. Primera sesión de un rediseño de varias — arrancó por la
pestaña "Entrenar" del portal clásico, a pedido de Alejandro después de
probarla él mismo como entrenador y encontrarla confusa comparada con el
nivel del portal v2.

## Punto de regreso

- Rama: `feature/rediseno-entrenar-clasico` (creada desde `main`).
- Último commit: `8806203` (`fix(entrenar): distinguir series pendiente/actual
  y no perder de vista el descanso pausado`).
- Push hecho a GitHub. **No hay Pull Request abierto todavía** — se abre uno
  solo cuando el bloque completo de "Entrenar" esté terminado (acuerdo ya
  vigente con Alejandro, ver memoria `pr-al-final-del-trabajo`).
- **Nada publicado/desplegado a producción.** Alejandro lo pidió
  explícitamente: "súbelo a GitHub, pero no lo publiques".
- Todo el trabajo quedó commiteado — no hay cambios sueltos sin guardar en
  esta rama.

## De dónde sale esto

Alejandro probó la pantalla de sesión activa (`/alumno/entrenar/sesion/[id]`,
modo enfocado de un ejercicio) como entrenador y mandó una captura de
pantalla señalando el problema: **"las series, que son las tres barras de
series, confunden mucho a los clientes, y hay varias bugs. A veces, los
descanso desaparecen."** Pidió un rediseño "más profesional, más claro",
usando el portal v2 como referencia de calidad — pero sin fusionar los dos
sistemas: `docs/PORTAL_VIP_V2_VISION.md` exige que clásico y v2 sigan siendo
independientes (regla no negociable #11), así que esto es una mejora del
clásico, no un port de v2.

Investigar el CSS reveló algo que no era evidente desde la captura: el
archivo `globals.css` tiene **tres generaciones superpuestas** de estilos
para el mismo selector de series (`.selector-series-movido`), cada una más
reciente que la anterior en el archivo, y la última (~línea 6078,
2026-08-16) es la que de verdad se renderiza. Esa última generación fue un
pedido explícito y deliberado de Alejandro ese mismo día: achicar las barras
a líneas de 5px sin número ni texto ("ya no quiero nada ahí abajo, solo
déjalas líneas"). El problema es que, en esa reducción, **"pendiente" y
"actual" quedaron pintados exactamente igual** (ambas "cápsula vacía") — no
había forma de saber cuál serie tocaba ahora mirando la fila. Eso, no el
tamaño, es la causa real de la confusión reportada.

## Qué se hizo hoy

1. **Selector de series — distinguir "actual" de "pendiente"**
   (`src/app/globals.css`, ~línea 6131): "actual" ahora se pinta con el
   mismo acento (`--color-vip`, ámbar) que ya usa el botón de Descanso en
   esta misma pantalla — sin agregar número ni texto, respetando el pedido
   de Alejandro de "solo líneas". "Pendiente" queda como estaba (línea
   vacía, borde translúcido). "Completa" ya se pintaba distinto (relleno
   blanco) y no hizo falta tocarla.
   - De paso, la primera generación de reglas (~línea 4649,
     `.tarjeta-ejercicio-enfocada .selector-series-movido`) tenía una paleta
     arcoíris por ÍNDICE de serie (verde/dorado/celeste/naranja/violeta
     rotando), no por estado — quedó reemplazada por un esquema monocromo
     consistente con `.lista-tira-navegacion` (la tira de navegación entre
     ejercicios de abajo, que ya usa blanco/negro/gris deliberadamente). Esa
     primera generación queda simplificada porque casi todas sus propiedades
     ya estaban sobrescritas por la tercera generación de todos modos.

2. **Chip persistente de descanso** (`SesionEjercicioCard.tsx` ~línea 2189 y
   ~línea 2986; CSS `.chip-descanso-en-pausa` en `globals.css` ~línea 5247):
   cuando el alumno pasa a otra serie mientras la anterior sigue
   descansando "en pausa" (biseries, o simplemente saltar de serie), antes
   no había ningún indicador visible de ese descanso — la cuenta regresiva
   vivía solo en la fila oculta de esa serie. Ahora aparece un chip chico
   ("Descansando serie 1 · 0:42") mientras eso pase. **No se tocó el motor
   de descanso** (`lib/entrenamiento/descanso.ts`, ni los efectos de
   `FilaSerie`) — el chip solo lee la misma ancla de `localStorage`
   (`leerDescanso`) que ya existía, con un `useEffect` de solo lectura
   propio a nivel de `SesionEjercicioCard`.

Verificado en vivo contra el servidor de desarrollo (sesión 19 "Hombros",
ejercicio "Press militar"): se confirmó por inspección de DOM/CSS computado
que "actual" se pinta ámbar y "pendiente" gris, y que el chip aparece con el
texto y la cuenta correctos al saltar de serie 1 a serie 2, y desaparece al
volver a la serie 1. (Los clics con el mouse del navegador tardaban en
responder por compartir el servidor de desarrollo con otra sesión activa en
esta misma máquina — se verificó disparando los eventos de clic por
JavaScript directamente contra los mismos botones, no hay atajo en la lógica
de la app.)

## Decisiones de diseño para las próximas sesiones

- El lenguaje visual de "estado" en esta pantalla es monocromo con **un
  único acento** (`--color-vip`, ámbar) para "esto requiere tu atención
  ahora" — igual criterio que ya usa `.lista-tira-navegacion`. Evitar volver
  a introducir colores por posición/índice en cualquier otro control nuevo
  de esta pantalla.
- Impulso VIP (morado) sigue siendo la única excepción deliberada al
  monocromo — es un eje de información distinto (reto especial), no un
  estado de la serie.
- Alejandro tiene una preferencia fuerte y repetida por líneas finas sin
  texto en el selector de series (lo pidió tres veces, cada vez más chico:
  22px → 13px → 5px). Cualquier ajuste futuro ahí debería mantener esa
  minimalidad y resolver problemas con color/relleno, no reintroduciendo
  números o texto.

## Qué falta

Esto fue solo la pestaña "Entrenar". Alejandro mencionó que el resto del
portal clásico (Nutrición, Mi avance, Ranked, y el resto de "Entrenar" que
no se tocó hoy: header, tarjetas de "Última vez/Objetivo", flujo de
Impulso VIP, etc.) también necesita una pasada de rediseño con el mismo
criterio — "más claro, más profesional, más cerca de v2" — pero **no se
definió el alcance de esas pantallas todavía**. Antes de tocar cualquiera de
ellas, confirmar con Alejandro por dónde seguir.

## Cómo probarlo

1. Servidor de desarrollo del proyecto (`npm run dev`, o el que ya esté
   corriendo en `localhost:3001`).
2. Entrar como entrenador o alumno a `/alumno/entrenar`, abrir cualquier
   sesión con un ejercicio de 3+ series.
3. Confirmar que la serie que toca ahora se ve ámbar y las pendientes se ven
   apagadas/grises.
4. Tocar "Descanso" en la serie 1, y mientras corre, tocar la serie 2 en el
   selector — debe aparecer el chip "Descansando serie 1 · m:ss" arriba del
   selector. Volver a tocar la serie 1: el chip debe desaparecer (la cuenta
   ya se ve en el botón grande).
