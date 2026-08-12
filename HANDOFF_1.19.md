# HANDOFF 1.19

Continúa el 1.18. Este cubre el tramo del **12/08 (tarde)** que se cortó por
luz y por límite de uso, y deja **un solo trabajo pendiente definido con
precisión: el fondo negro de la pantalla de entrenar**.

## Punto de regreso

- Rama **`main`**. Último commit: **`ded8118`** — *"feat(alumno): reporte de
  fallas con captura + pantalla de entrenar mas limpia"*.
- **`ded8118` NO está pusheado.** Alejandro pidió esperar antes del push y
  todavía no dio el sí. `main` despliega a producción, así que el push publica.
- **Hay trabajo sin commitear en el árbol** (ver "Sin commitear" abajo):
  `src/app/globals.css` (+191) y
  `src/components/student/SesionEjercicioCard.tsx` (+16 −4).
- Verificado en este estado: **`npx tsc --noEmit` limpio** y **eslint limpio**
  sobre `SesionEjercicioCard.tsx`.
- `.next-dev-claude.log` es basura de desarrollo sin trackear. No commitear.
- **Migración pendiente de correr en Supabase: `0072_reportes_bugs.sql`.** Sin
  ella el botón de reportar fallas guarda nada (el panel del entrenador avisa
  cuál falta en vez de romperse: verificado). Siguen pendientes `0068` y la
  situación de `0067` descrita en el 1.18.

## Lo que ya está terminado (en `ded8118`)

1. **Botón de reportar fallas del alumno.** Flotante, chico, en toda la app del
   alumno. Saca captura de la pantalla, el alumno escribe qué pasó, y llega al
   panel del entrenador en **Más → Sistema → Errores reportados**.
   - **Trampa importante para el próximo:** `html2canvas` **no sirve en este
     proyecto** y no hay que volver a intentarlo. Falla siempre porque no
     entiende `color-mix()`, y el CSS de la app lo usa en **132 lugares**. Se
     verificó en el navegador con el error real logueado, no por sospecha. La
     librería que sí funciona y quedó instalada es **`html-to-image`** (delega
     el render al navegador vía SVG).
2. **Pantalla de entrenar más limpia.** La técnica ya no ocupa espacio fijo en
   la tarjeta: botón "!" sobrepuesto en la esquina de la foto abre el modal
   completo; se abre sola la primera vez que el ejercicio pasa a activo. Nuevo
   glosario que explica cada técnica (drop set, rest-pause, biserie…). Se quitó
   el rótulo "SERIES".
   - **Bug encontrado y arreglado al verificar:** el modal vivía dentro de la
     rama `expandido`, así que en un ejercicio **plegado** el botón "!" abría el
     estado pero el modal nunca se montaba. Ahora vive fuera de esa rama —
     **no volver a meterlo adentro**.
3. **Biseries que se fusionaban.** Si el entrenador no escribía "(1/2)" en el
   texto, dos biseries seguidas se unían en un grupo de 4. Cada familia tiene
   ahora su tamaño por defecto.

## Sin commitear: animación de impacto de la técnica

Pedido de Alejandro, textual: la burbuja *"flotando delante… al medio de la
pantalla, que no esté abajo"*, el fondo *"un poco más visible, no tan oscuro"*,
y cuando toca la técnica de entrenamiento *"una animación de impacto… entre
reto, entre rayos, entre desafíos, entre un tú puedes"*.

Implementado y sin verificar en navegador todavía:

- `globals.css` — bloque nuevo **"BURBUJA DE TÉCNICA"** (después de la línea
  ~2450): `.fondo-burbuja-tecnica` (fondo a `rgba(0,0,0,.42)` en vez de `/70`,
  con `blur(2px)`), `.burbuja-tecnica` (entrada centrada), y la variante de
  reto: `.burbuja-tecnica-reto` (golpe con overshoot y rotación que se
  corrige), `.onda-reto` ×2 (anillo expansivo, una sola vez), `.rayos-reto`
  (abanico de `conic-gradient` que gira y se apaga, con máscara radial) y
  `.titulo-reto` (destello que recorre el nombre de la técnica). Todo respeta
  `prefers-reduced-motion`.
- `SesionEjercicioCard.tsx` (~1916-1940) — el modal pasó de `items-end` a
  `items-center` y aplica esas clases.
- **Decisión de diseño a preservar:** el tratamiento de reto entra **solo si
  hay `explicacion`** (es decir, solo las técnicas que exigen de verdad: drop
  set, rest-pause, al fallo…). Si toda técnica entrara con rayos, los rayos
  dejarían de significar algo — el mismo criterio que se usó para que el aviso
  de "sesión sin cerrar" sea el único elemento que parpadea en la app.

**Bug propio encontrado al verificar y ya arreglado:** los rayos estaban
adentro de la burbuja, y como solo la cabecera tiene `relative`, los haces se
pintaban **por delante** del cuerpo y del botón "Entendido" — la explicación
quedaba cruzada de amarillo e ilegible. Ahora `.rayos-reto` es **hermano** de
la burbuja dentro de la capa y la burbuja lleva `z-index: 1`; los haces asoman
alrededor, que era el efecto buscado. Las ondas sí siguen adentro (son un
anillo pegado al borde). **No volver a meter los rayos adentro de la burbuja.**

**Verificado así (sin poder entrar a la app):** la sesión de alumno del
navegador se perdió con el corte y no hay forma de loguearse, así que se armó
una vista de prueba aislada con el CSS y el markup reales, en
`scratchpad/burbuja-tecnica-prueba.html` (temas VIP / Steel Fit / Lady Fit
oscuro / Lady Fit claro, repetición a velocidad normal y al 25%). Ahí se
confirmó el arreglo de los rayos. `tsc` y eslint limpios.

**Falta:**
- Verlo dentro de la app real, con clic, en 412×915 (necesita sesión de
  alumno).
- Decisión de Alejandro: si el golpe está en el punto justo o queda
  corto/exagerado.
- **En Lady Fit claro los rayos casi no se ven**: el rosa (`#c97890`) al 42%
  detrás de un fondo oscurecido queda lavado, así que el impacto se pierde
  justo en el tema más luminoso. Si Alejandro quiere el mismo golpe en claro,
  hay que subir la opacidad de los haces cuando `[data-theme="light"]`.

## PENDIENTE PRINCIPAL: el fondo negro de la pantalla de entrenar

Pedido de Alejandro, textual: *"El fondo negro es el que está detrás de la foto
donde la persona está mostrando cómo se hacen los ejercicios, que llega hasta
detrás de la nota y de alguna molestia… Si colocas Lady Fit, solo verás todo en
blanco y un recuadro negro al fondo, que no me gusta cómo se ve. Quiero que lo
hagas más acorde a cada modo visual."*

**No empezar sin autorización** — Alejandro pidió expresamente dejarlo escrito
acá y no ejecutarlo todavía.

### Diagnóstico (ya hecho, con archivo y línea)

En `ded8118` se sacó el negro plano **de las clases del componente**, pero esa
no era la fuente. El negro lo pinta el CSS del modo enfocado, y hay **dos
mecanismos distintos**:

**1. La tarjeta enfocada redefine los tokens del tema** —
[globals.css:1636](src/app/globals.css:1636):

```
.tarjeta-ejercicio-enfocada {
  --color-surface: #111116;
  --color-surface-2: #15151a;
  --color-border: #29282e;
  border-color: #29282e !important;
  background: #050507 !important;
}
```

Esto es lo que explica el síntoma completo, y es más grave de lo que parece:
el cuadro de la foto (`CuadroFotoReferencia`,
[SesionEjercicioCard.tsx:380](src/components/student/SesionEjercicioCard.tsx:380))
**sí está bien escrito** — usa `bg-surface-2` y `border-border`, o sea tokens.
Pero como la tarjeta enfocada **reescribe esos tokens a hex negro**, todo hijo
que use tokens se vuelve negro igual. Por eso el negro "llega hasta detrás de
la nota y de la molestia": no son varios elementos negros, es **un ámbito de
tokens pisado**.

**2. `.accion-secundaria-ejercicio` está hardcodeada y NO está limitada al modo
enfocado** — [globals.css:1660](src/app/globals.css:1660):

```
.accion-secundaria-ejercicio {
  border: 1px solid #29282e;
  background: #15151a;
}
```

Es exactamente "Alguna molestia"
([SesionEjercicioCard.tsx:728](src/components/student/SesionEjercicioCard.tsx:728))
y el campo de nota
([SesionEjercicioCard.tsx:2191](src/components/student/SesionEjercicioCard.tsx:2191)).
Al estar fuera del ámbito de `.tarjeta-ejercicio-enfocada`, esos dos recuadros
salen negros **en todos los temas y también en modo claro**, no solo en modo
enfocado. Este es el "recuadro negro" más evidente en Lady Fit luminoso.

**3. Resto de hex sueltos del mismo bloque** (todos entre las líneas 1608 y
1760 de `globals.css`): `--focus-*` (1609-1615), `::before` con violeta y
ámbar fijos (1617), `.datos-ejercicio` `#15151a` (1681), `.fila-serie`
`#111116` (1691), serie activa `#f5a623` (1695), `.campo-serie-plano`
`#1d1c22` + `#34333b` (1708-1710), los tres estados de `.boton-descanso`
(1726-1739) y `.boton-completar-ejercicio` (1745-1755).

### Trampa: `.modo-entrenamiento-enfocado` está definida DOS veces

Una vez en [globals.css:1285](src/app/globals.css:1285) (con `::before` en
`color-mix()` sobre `--color-vip`, o sea consciente del tema) y otra en
[globals.css:1608](src/app/globals.css:1608), que **pisa** ese `::before` con
violeta y ámbar fijos. Editar solo la primera no se ve en pantalla. Es el mismo
tipo de trampa que ya documentó el 1.18 con `.panel-aero-superior`.

### Camino recomendado (no ejecutado)

1. Derivar la paleta del modo enfocado **de los tokens del tema en vez de hex**.
   Para que siga siendo "más oscuro/concentrado que el resto de la app" sin
   inventar un color: `background: color-mix(in srgb, var(--color-bg) 88%, #000)`
   para la tarjeta, y los internos como `var(--color-surface)` /
   `var(--color-surface-2)` / `var(--color-border)` sin redefinirlos.
2. **No redefinir `--color-surface*` dentro de la tarjeta.** Es lo que arrastra
   a los hijos bien escritos. Si hace falta un tono propio, usar variables
   nuevas (`--focus-*`, que ya existen) y aplicarlas explícitamente.
3. Pasar `.accion-secundaria-ejercicio` a tokens (`var(--color-surface-2)` /
   `var(--color-border)`). Es la de menor riesgo y la de mayor efecto visible.
4. Los acentos ámbar/violeta fijos: en VIP quedan bien porque coinciden con
   `--color-vip`, pero en Lady Fit y Steel Fit chocan. Reemplazar el ámbar de
   "próximo paso" por `var(--color-vip)` y el violeta por `var(--color-acento)`.
   Ojo: `--color-vip` en Lady Fit claro es `#c97890`, así que revisar el
   contraste del texto oscuro (`#211400`) sobre esos botones llenos.
5. Sacar los `!important` solo si el estilo de Tailwind del componente
   (`bg-surface` en la tarjeta, [SesionEjercicioCard.tsx:1765](src/components/student/SesionEjercicioCard.tsx:1765))
   no vuelve a ganar. Verificar, no suponer.
6. **Verificar en las cinco combinaciones**, en 412×915: VIP oscuro · Steel Fit
   oscuro · Steel Fit claro · Lady Fit oscuro · **Lady Fit claro** (es el caso
   que Alejandro nombró). Los tokens de cada tema están en
   [globals.css:617-708](src/app/globals.css:617).

## Dos cosas que Alejandro tiene que responder

1. **¿Se hace el push de `ded8118`?** Está commiteado y sin subir a propósito.
2. **Quedó sin entender un pedido suyo:** *"cuando se avise serio sería
   gigante"*. Se le preguntó y no llegó la respuesta antes del corte. No
   adivinar: volver a preguntar.

## Sigue vigente del 1.18

- **Dos agentes en el mismo repo.** Zona de Codex: "Armar rutina"
  (`ArmarRutinaPanel.tsx`, `RutinaDraftEditor.tsx`, `niveles-armado.ts`) — no
  tocar. `globals.css` lo tocan los dos: ediciones cortas y commit rápido.
- Cola pendiente: terminar las **apuestas de Arena VIP** (solo existe el motor
  aritmético, nada funciona en la app todavía) y el **zoom que achique TODO**,
  no solo la letra (pedido tres veces, sin empezar).
- **Regla de continuidad:** no rehacer lo terminado; no aplicar migraciones ni
  escribir en masa sobre datos de alumnos sin autorización expresa; `main`
  despliega solo a producción.
- Feedback vigente: *"siento que todas las ideas son mías y no me ayudas"* —
  corresponde proponer, no solo ejecutar. Y verificar con clic real antes de
  decir que algo anda.
