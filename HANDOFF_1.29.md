# Handoff 1.29 — sesión activa sin scroll y Panel del Entrenador reorganizado

Fecha: 2026-08-16
Rama: `feature/portal-vip-premium-inicio`
Último commit: `7c78e6b` — `docs: registrar los instructivos de rediseño...`

## Punto de regreso

- **Nada está commiteado.** Todo el trabajo de esta sesión vive en el árbol de
  trabajo, encima de los cambios que Alejandro ya tenía sin commitear (Inicio y
  el cabezal hexagonal). No se hizo push ni despliegue.
- Migraciones: **ninguna nueva**. Sigue aplicado hasta
  `0093_ejercicio_fusiones_historial`.
- Verificación: `npx tsc --noEmit` correcto · `npm run lint` sin errores nuevos
  · `npm test` **421/421** · `npm run build` correcto (con el dev server
  apagado, como avisa el handoff 1.28).

## Parte 1 — Pestaña Entrenar

### Cabezal
`Logo.tsx` mostraba "Entrenamiento VIP" en `/alumno/entrenar`, pero el título
tiene 132 px de ancho útil y ese texto mide 144: el "VIP" dorado se perdía
**siempre** detrás de los puntos suspensivos, y con un saldo de cinco o seis
dígitos se comía parte de la palabra. Quedó `Entrenamiento` a secas. El
instructivo pide el VIP en oro solo "si cabe"; acá no cabe, y el escudo
hexagonal de al lado ya pone la marca.

### Rayos de luz sobre el modelo
`RayosLuz` (en `GrupoMuscularIcon.tsx`) se dibujaba **después** de la foto y sin
capa propia, así que el rayo grueso del medio le cruzaba la pierna al modelo
como una raya naranja. Ahora va primero, con `z-0` contra el `z-10` del texto —
la foto queda en medio —, en dorado pálido `#f2cd5d` en vez del ámbar saturado
`--color-vip`, y al 14% de opacidad.

### Contraste de Ejercicios/Series/Minutos
Velo `.datos-sesion-entrenar`: transparente arriba, 72% abajo. El modelo se
sigue viendo (pedido explícito) pero "48" ya no cae sobre piel iluminada.

### Vacío al final
`pb-36` → `pb-16` en `entrenar/page.tsx`. El contenedor que scrollea ya aporta
96 px y el CTA fijo empieza 142 px arriba del borde, así que 144 px propios
dejaban ~85 px de negro entre "Estado del plan mensual" y "Iniciar rutina".

## Parte 2 — Sesión activa: flechas tenues y pantalla sin scroll

### Flechas casi imperceptibles
Pedido textual de Alejandro: *"dañan el diseño"*. Estaban al 62% de blanco, con
`drop-shadow` y con un balanceo permanente.

- color `rgba(255,255,255,.13)`, sin brillo y **sin animación**;
- se encienden al 50% solo mientras el dedo las toca (`:active`);
- el aviso de "pasa al siguiente ejercicio" baja de blanco pleno a 50%;
- **el área táctil (90 × 79 px) no cambió.**

### La pantalla ahora calza entera
El mecanismo ya existía y nadie lo había visto funcionar: `SesionEjercicios`
apaga el scroll (`data-entrenamiento-ajustado="true"` →
`overflow-y: hidden`) cuando el ejercicio entero entra arriba de la barra
inferior. **Nunca se activaba** porque la composición no cabía: en un iPhone de
852 px terminaba 50 px más abajo del límite.

Se recuperaron 91 px, todos de aire, sin tocar un solo control:

| | antes | ahora |
|---|---:|---:|
| borde de la tarjeta bajo "Añadir serie extra" | 22 px | 7 px |
| fondo de la tarjeta | 816 px | 746 px |
| scroll sobrante a 393×852 | 180 px | **0 px** |

De dónde salieron:

1. `.acciones-series-extra`: `padding: 11px 0 4px` → `0`. El botón conserva sus
   36 px de alto táctil; lo que se sacó es relleno.
2. `.cierre-ejercicio-foco:empty { display: none }` — mientras el ejercicio está
   en curso ese bloque no tiene contenido, pero su `margin-top` seguía
   empujando 9 px el piso.
3. `.panel-ejecucion-foco` cierra con 6 px en vez de 12.
4. `.acciones-secundarias-ejercicio` con `margin-top: 3px` en vez de 10.
5. **`SesionEjercicios.tsx`**: el bloque de reserva de 64 px + el envoltorio de
   "Finalizar entrenamiento" ahora **solo se dibujan en el último ejercicio**.
   Antes se dibujaban en los siete y en seis eran un div vacío y 64 px de aire
   que obligaban a hacer scroll para no mostrar nada. Verificado: en
   "Elevación de gemelos" el botón y su recorrido siguen intactos.
6. **Foto de referencia con alto fluido** — el cambio que cierra la cuenta:
   `height: clamp(126px, calc(100svh - 722px), 168px)`. El resto de la
   composición mide 617 px fijos y la barra inferior se lleva 93; la foto puede
   medir `alto de pantalla − 718`, con 4 px de holgura.

### Comportamiento por tamaño de pantalla

| alto | foto | ¿calza? | scroll |
|---:|---:|---|---|
| 932 px | 168 px | sí | bloqueado |
| **852 px (iPhone 15 Pro)** | **130 px** | **sí** | **bloqueado** |
| 812 px | 126 px | no | disponible (59 px, antes 180) |

El scroll **no se desactivó a mano**: se activa solo cuando de verdad hace
falta — pantallas bajas, zoom de texto, biseries, o cuando se abre un Momento
Impulso. Esa lógica ya estaba escrita y no se tocó.

## Parte 3 — Panel del Entrenador (diseño)

Sigue `INSTRUCTIVO_CLAUDE_REORDENO_PANEL_ENTRENADOR.md` y la maqueta
`panel-entrenador-organizado.html`. Alcance: **diseño y organización**. No se
tocó ninguna consulta, acción, regla de puntos ni el generador.

### Sistema visual (`globals.css`, bloque final nuevo)
Tokens tal cual de la maqueta, todos colgando de `.admin-shell` para que el
portal del alumno no se vea afectado: `--panel-superficie #111318`,
`--panel-linea #2a2e36`, `--panel-oro #d7b56d`, `--panel-oro-claro #f2d99f`.
Clases: `.encabezado-panel-*`, `.acciones-panel`, `.boton-panel-principal`,
`.boton-panel-secundario`, `.tarjeta-panel`, `.metrica-panel`,
`.buscador-panel`, `.ficha-panel`, `.estado-panel`, `.tarjeta-menu-panel`,
`.item-menu-panel`, `.insignia-nav-panel`. **No reescribe ninguna regla
anterior.**

### Inventario único de destinos (`src/lib/admin/destinos.ts`)
La barra lateral y "Más" leían de dos listas paralelas, y ya se habían
desincronizado: Errores reportados y Pedidos de borrado existían en la barra
lateral de escritorio y **no había forma de llegar a ellos desde el celular**.
Ahora hay una sola fuente, con los seis grupos del instructivo §4.2.

### Barra inferior: cinco destinos nuevos
`Alumnos · Rutinas · Galería · Pendientes · Más`, con el acabado aprobado
(grafito, activo en oro con línea superior corta, insignia **numérica** en vez
de punto rojo). "Documentos" y "Alimentos" perdieron su pestaña propia: viven
en Rutinas y en Bibliotecas, ambos a un toque desde Más.

`estaActivo` ya no usa una lista fija de prefijos que había que acordarse de
actualizar: "Más" se enciende **por descarte**, con cualquier ruta de `/admin`
que no pertenezca a las otras cuatro.

### `/admin/rutinas` (nueva)
Puerta única a Armar manualmente, Generar con reglas, Rutinas hechas y
Documentos, **con una línea que explica cuándo usar cada una** — el instructivo
señala que Armar y Generador llevaban a experiencias casi idénticas sin decir
en qué se diferencian. Solo navegación: no arma ni toca nada.

### `/admin/mas` (nueva) y `/admin/configuracion` (adelgazada)
`/admin/configuracion` hacía dos trabajos incompatibles: era el destino de la
pestaña "Más" **y** los ajustes del sistema. Como directorio mostraba diez
atajos de diecinueve destinos.

- `/admin/mas`: buscador «¿Qué necesitas hacer?» (sin acentos, "auditoria"
  encuentra "Auditoría"), **todos** los destinos agrupados, contadores reales
  leídos en el servidor que solo aparecen cuando hay trabajo, y una fila final
  con tema, tamaño, mi rutina y cerrar sesión.
- `/admin/configuracion`: se le quitaron **203 líneas** de reja de atajos y las
  seis consultas que solo la alimentaban. Conserva los ajustes y un enlace
  "Ver todo el panel".

### Alumnos: el directorio primero
- Las **cinco tarjetas arcoíris** (azul/rojo/ámbar/verde/violeta) se
  eliminaron. Ocupaban la primera pantalla entera y, con cinco acentos
  encendidos, ninguna priorizaba: "Al día" gritaba igual que "Sin rutina".
  **Eran además un duplicado**: la misma banda de cinco filtros con los mismos
  conteos ya vivía dentro de `ListaAlumnos`, y esa filtra en el acto en vez de
  recargar la página. Se conservó esa, con el acabado del panel.
- Los cuatro conteos que el servidor calculaba para las tarjetas se borraron:
  `ListaAlumnos` los recalcula por su cuenta.
- `order-1` para el directorio: en celular, Propuestas de Impulso, Acciones
  rápidas y los avisos se metían **antes** y había que desplazarse por todo eso
  para llegar a buscar un alumno.
- Los chips de "Plan contratado" pasan de `flex-wrap` (tres líneas en celular)
  a una sola fila que se desliza.

Resultado: el primer alumno del directorio ahora se ve en la primera pantalla,
sin scroll.

### Cabezal de celular
Tenía cinco cosas peleando por 393 px: logotipo horizontal, zoom, tema, "Mi
rutina" y "Asistente". Las tres primeras son ajustes, no trabajo, y ahora viven
en Más. Quedó marca + "Panel del entrenador / nombre" + Asistente.

### Aviso de actualización
Vivía en `fixed top-16`, justo encima del encabezado pegajoso: **tapaba el `h1`
y la descripción de todas las rutas del panel** hasta cerrarlo a mano. En
celular se apoya ahora arriba de la barra inferior; en escritorio se queda
arriba a la derecha, que ahí sí está libre.

## Verificado en pantalla

- Sesión activa a 393×852, 393×932 y 375×812.
- Panel a 393×852, 320×568 y 1440×900.
- Sin desbordamiento horizontal a 320 px.
- Las diez rutas del panel que usan `AdminPageHeader` responden con el
  encabezado nuevo y sin errores.
- Barra lateral de escritorio: los seis grupos del §4.2, con los mismos nombres
  que Más.

## Pendiente

1. **Nutrición (`/alumno/comer`)** — el rediseño premium del portal del alumno
   quedó ahí. Es lo que Alejandro había pedido antes de cambiar de tema.
2. **Fase 3 del panel: Galería como flujo de producción** — las cuatro vistas
   (Pendientes / Biblioteca / Carga masiva / Calidad). La Mesa de trabajo del
   handoff 1.28 ya cubre buena parte.
3. **Fase 2 del panel: ficha del alumno con pestañas** — sigue siendo una sola
   columna larguísima.
4. **`/admin/auditoria`** puede renderizar más de 150 botones en una vista.
5. En pantallas de 812 px o menos la sesión activa todavía necesita ~59 px de
   scroll. Para cerrarlo del todo hay que achicar el bloque de "SIGUIENTE" o el
   título, que hoy fijan un piso de 135 px en la columna derecha.
6. Alejandro mandó una **foto de gimnasio** (abdominales en colchoneta) sin
   texto. Quedó sin usar: hay que preguntarle si es para la galería.

## Notas para retomar

- **No revertir el alto fluido de la foto de referencia.** Es lo único que hace
  que `data-entrenamiento-ajustado` llegue a valer `true`; volviendo a 168 px
  fijos el scroll reaparece en todos los teléfonos.
- **No volver a encender las flechas.** Fue un pedido explícito y medido.
- La barra lateral y Más comparten `src/lib/admin/destinos.ts`. Una ruta nueva
  se agrega **ahí**, no en dos lugares.
- El build vuelve a alternar entre pasar y fallar con el dev server encendido
  (ver handoff 1.28). Confirmar siempre con el server apagado.
