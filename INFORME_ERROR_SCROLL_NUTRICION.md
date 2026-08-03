# Informe técnico — Error de scroll y selección en Nutrición móvil

Fecha: 2 de agosto de 2026  
Proyecto: Portal VIP (`C:\dev\VIP`)  
Rama de diagnóstico: `fix/nutricion-movil-local`

## Resumen ejecutivo

En un teléfono real, la hoja inferior para buscar alimentos cambia de posición mientras el alumno desplaza los resultados o intenta seleccionar uno. El salto puede hacer que el gesto termine fuera de la fila que se tocó, por lo que el alimento no se selecciona. Durante el mismo problema también puede desplazarse la pantalla que está detrás, dando la impresión de que el logo, el encabezado y los iconos inferiores dejan de estar fijos.

El fallo está relacionado con la combinación de cuatro elementos: teclado móvil, `visualViewport`, bloqueo incompleto de la página de fondo y selección del alimento al finalizar el toque.

## Síntomas reportados

1. Al bajar por los resultados del buscador, el scroll salta.
2. Después del salto no siempre se puede seleccionar un alimento.
3. El logo, la cabecera y los iconos que deberían permanecer fijos se desplazan o “ceden”.
4. El comportamiento es más grave en el teléfono que en el navegador de escritorio.

## Comportamiento esperado

- Solo la lista de alimentos debe desplazarse mientras la hoja está abierta.
- La pantalla de Nutrición que queda detrás debe permanecer completamente inmóvil.
- La hoja no debe cambiar de posición entre `pointerdown` y `pointerup`.
- Un arrastre debe desplazar la lista sin seleccionar alimentos.
- Un toque corto debe seleccionar exactamente el alimento tocado.
- Logo, encabezado, buscador inferior y navegación deben conservar su posición.

## Hallazgos confirmados

### 1. La hoja depende del viewport visual

`HojaAgregarComida.tsx` calcula el alto y la posición mediante `window.visualViewport`. Cuando el teclado aparece o desaparece, el navegador emite un evento `resize` y la hoja completa puede ser reposicionada.

Al tocar una fila, el campo de búsqueda puede perder el foco y el teclado comienza a cerrarse antes de que termine el gesto. Si la hoja se mueve entre apoyar y levantar el dedo, el `pointerup` puede llegar a otro elemento o perderse.

### 2. La selección ocurre al levantar el dedo

Las filas comparan las coordenadas de `pointerdown` y `pointerup` para distinguir un toque de un scroll. La lógica es válida mientras la interfaz permanezca estable, pero falla si el teclado cambia el viewport durante el gesto.

### 3. El bloqueo de fondo confirmado en el último commit es insuficiente para algunos teléfonos

La versión confirmada solo aplica `document.body.style.overflow = "hidden"`. En iOS y en algunos casos de Android esto no garantiza que el documento, la barra del navegador o el viewport visual permanezcan inmóviles.

### 4. El encabezado y la navegación usan `position: sticky`

El logo/cabecera y la navegación inferior son elementos `sticky`, no `fixed`. Funcionan correctamente cuando el documento no se desplaza, pero pueden moverse si el gesto escapa de la lista interna o si cambia el viewport durante la apertura/cierre del teclado.

### 5. Nutrición calcula dinámicamente el alto de la línea de horas

`PantallaComer.tsx` vuelve a medir la lista cuando cambia el tamaño de la ventana o `visualViewport`. Además usa un alto mínimo y un margen negativo para compensar el espacio inferior. Durante cambios rápidos del viewport puede existir un estado transitorio donde el documento tenga más alto que la pantalla.

## Pruebas realizadas

En una emulación de 390 × 667 px se observó:

- La línea de horas tenía 220 px visibles y 968 px de contenido desplazable.
- Al desplazar correctamente dentro de esa lista, `window.scrollY` permaneció en `0`.
- El encabezado y la navegación conservaron su posición en la emulación.

Esto indica que el problema restante depende especialmente del comportamiento táctil y del teclado del dispositivo real, no únicamente del tamaño CSS de la pantalla.

## Causa técnica más probable

Secuencia del fallo:

1. El alumno toca o comienza a arrastrar una fila de alimento.
2. El buscador pierde el foco y el teclado empieza a cerrarse.
3. `visualViewport` cambia de tamaño.
4. La hoja recalcula su alto y se mueve mientras el dedo sigue apoyado.
5. El navegador pierde o redirige el final del toque.
6. El alimento no se selecciona; en ciertos casos el gesto continúa hacia la página de fondo.
7. Los elementos `sticky` parecen desplazarse junto con la pantalla.

## Corrección recomendada

Aplicar la solución como un conjunto, en este orden:

1. Bloquear la página de fondo con `body { position: fixed }`, conservando y restaurando `scrollY` al cerrar la hoja.
2. Bloquear también el overflow y el overscroll de `html` mientras la hoja esté abierta.
3. Congelar las medidas de la hoja desde `pointerdown` hasta `pointerup` o `pointercancel`.
4. Si el teclado cambia el viewport durante el gesto, guardar la medición como pendiente y aplicarla después de levantar el dedo.
5. Mantener `touch-action: pan-y` y `overscroll-behavior: contain` únicamente en la lista desplazable.
6. Cancelar explícitamente el `click` posterior cuando el gesto haya sido clasificado como scroll.
7. Probar primero el bloqueo de fondo; convertir logo y navegación de `sticky` a `fixed` solo si todavía se desplazan en un teléfono real.

## Cambios que quedaron en borrador

Después del commit `e7b2508` quedaron modificaciones locales sin commit en `HojaAgregarComida.tsx`:

- bloqueo reforzado de `body` y `html`;
- congelación de la geometría durante el gesto;
- aplicación diferida del cambio de viewport;
- protección para que un scroll no termine convertido en click;
- restauración de la posición original al cerrar la hoja.

Estas modificaciones pasan TypeScript y ESLint, pero no deben considerarse terminadas ni publicarse hasta probarlas en el teléfono donde ocurre el fallo.

## Validación obligatoria antes de publicar

Probar en un dispositivo real:

1. Abrir Nutrición y tocar “Buscar alimentos”.
2. Escribir una consulta con al menos ocho resultados.
3. Deslizar desde el centro de una fila, no desde un espacio vacío.
4. Llegar al final y volver al inicio varias veces.
5. Seleccionar una fila con el teclado abierto.
6. Seleccionar otra fila después de que el teclado se cierre.
7. Confirmar que la hoja no salta ni se cierra.
8. Confirmar que el logo, la cabecera, el buscador y la navegación no se mueven.
9. Repetir en Android Chrome y, si está disponible, iPhone Safari.

## Estado actual

- Vercel no fue modificado.
- No se desplegó esta corrección.
- No se confirmó ninguna comida durante las pruebas.
- Último commit estable de esta rama: `e7b2508`.
- El arreglo adicional permanece local y sin commit para revisión.

