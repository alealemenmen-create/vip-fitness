# Instructivo de implementación para Claude — sistema visual premium del Portal VIP

Fecha de especificación: 2026-08-15  
Base obligatoria: `main` en `159648e` o posterior  
Referencia funcional y visual: `HANDOFF_1.27.md` + entrenamiento activo actual  
Alcance: todo el portal del alumno: Inicio, Entrenar, Nutrición, Mi avance, Ranked, encabezado y barra inferior  

## 0. Orden directa para Claude

Implementa este rediseño en el repositorio. No entregues solo sugerencias ni una explicación: modifica el código, verifica el resultado y deja la aplicación abierta en las pantallas pedidas al final.

La pantalla de **entrenamiento activo** es la fuente de verdad visual. Inicio, Nutrición, Mi avance y el shell global deben parecer parte del mismo producto: negro OLED, grafito, bordes finos, oro sobrio y jerarquía compacta. **Ranked es la excepción editorial intencional:** comparte la misma calidad, marca, cabezal y navegación, pero su contenido debe ser más iluminado, competitivo y espectacular. No rediseñes la lógica de negocio ni la experiencia interna del entrenamiento activo.

Antes de escribir código:

1. Lee completos `AGENTS.md`, `HANDOFF_1.27.md` y este archivo.
2. Lee la documentación local de Next.js 16.2.12:
   - `node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md`
   - `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`
   - `node_modules/next/dist/docs/01-app/01-getting-started/11-css.md`
3. Revisa visualmente, en este orden:
   - `/alumno/entrenar/sesion/<sesión-en-curso>` — referencia principal.
   - `/alumno/entrenar` — referencia secundaria.
   - `/alumno/inicio` — prioridad alta.
   - `/alumno/comer` — adaptación premium funcional.
   - `/alumno/progreso` — adaptación premium analítica.
   - `/alumno/ranked` — excepción iluminada y competitiva.
4. Inspecciona los archivos enumerados en la sección 7 antes de editar.
5. Conserva los cambios ajenos que ya existan en el árbol de trabajo. No uses `git reset --hard`, `git checkout --` ni reemplazos destructivos.

## 1. Resultado esperado

Cuando el alumno cambia entre Inicio, Entrenar, Nutrición, Mi avance y Ranked, debe sentir que sigue dentro del mismo portal. El marco del producto no debe mutar entre una placa de logo grande, un cuadrado amarillo y un escudo hexagonal. Lo que cambia entre secciones es la intensidad del contenido, no la identidad del producto.

El resultado aprobado tiene estas cinco decisiones:

1. **Un solo cabezal para el portal del alumno.** Usa el escudo hexagonal `VIP` de la sesión activa como marca permanente, un título contextual y un único grupo de utilidades a la derecha.
2. **Los puntos VIP viven en el cabezal.** El saldo, la campana y Configuración forman un instrumento compacto, idéntico en todas las pestañas. El saldo puede crecer a cinco o seis dígitos sin recortarse.
3. **Inicio prioriza el entrenamiento.** Debajo de una identidad breve, la tarjeta “Tu entrenamiento” es la pieza principal y reutiliza la materia visual de Entrenar: negro, borde oro fino, diagonales discretas, foto y progreso legible.
4. **La barra inferior de entrenamiento activo pasa a ser la barra estándar.** Base grafito, cinco destinos, estado activo con línea superior dorada; se elimina la cápsula gris grande del destino activo.
5. **Se reduce el ruido dorado.** El oro señala marca, estado activo, puntuación y CTA principal. No todos los contenedores deben brillar ni tener borde dorado.
6. **Nutrición hereda la precisión operativa.** Debe sentirse como un diario premium, ligero y rápido, no como una lista genérica de 24 horas.
7. **Mi avance hereda la claridad de lectura.** Debe sentirse como el informe técnico del mismo sistema, con jerarquía fuerte y superficies sobrias.
8. **Ranked puede brillar.** Es el modo espectáculo del Portal VIP: luz, insignias, profundidad y recompensa. El brillo debe estar contenido dentro de sus héroes y rangos, nunca ensuciar el shell común.

## 2. Qué está mal hoy

No interpretes esta sección como una invitación a rehacer todo. Es el diagnóstico que explica las decisiones.

### Cabezal

- Inicio muestra una placa alta con el logotipo horizontal completo.
- Entrenar muestra un cuadro amarillo recortado y el título “Entrenamiento VIP”.
- Entrenamiento activo muestra un escudo hexagonal, título de contexto y un grupo compacto de puntos/campana/ajustes.
- El alumno ve tres identidades distintas para la misma aplicación.
- Inicio gasta demasiado alto antes de llegar a la tarea principal.
- Los puntos aparecen como dato de rango dentro de Inicio, pero como instrumento global durante la sesión.

### Inicio

- La identidad, la tarjeta de entrenamiento y Arena compiten con bordes, brillos y tonos dorados similares.
- El bloque rojo “entrenamiento sin cerrar” y el CTA “Continuar” expresan casi la misma urgencia en dos piezas consecutivas.
- La tarjeta de entrenamiento ya es funcional, pero su acabado es más promocional que operativo.
- La navegación inferior de Inicio usa una cápsula gris para el destino activo; la sesión activa usa una base más precisa y silenciosa.

## 3. Lenguaje visual obligatorio

### Paleta

Usa los colores existentes cuando sea posible. No introduzcas una segunda paleta global.

- Fondo principal: `#000000`.
- Superficie principal: `#0b0d0e` a `#121316`.
- Superficie elevada o control: `#111416` a `#1a1c20`.
- Borde estructural: blanco entre 8% y 14% de opacidad.
- Texto principal: `#f2f2f3` o el token `text-text`.
- Texto secundario: aproximadamente `#a1a7b3`.
- Texto terciario: aproximadamente `#717985`.
- Oro de la experiencia de entrenamiento: `#efc84d` / `#f2cd5d`.
- Ámbar corporativo existente: `#ffa100`; resérvalo para compatibilidad de tema o CTA cuando ya sea el token activo.
- Verde: progreso o finalización real.
- Morado: técnicas e Impulso VIP; nunca decoración general de Inicio.
- Rojo: únicamente advertencia real o acción destructiva.

### Geometría

- Cabezal: 52–56 px de alto útil, sin placa alta.
- Marca: escudo de aproximadamente 40 × 46 px.
- Grupo de utilidades: 38 px de alto; borde 1 px; radio 11 px.
- Tarjetas principales: radio 16–18 px.
- Tarjetas secundarias: radio 12–16 px.
- Controles táctiles: mínimo 38 px; CTA principal 44–48 px.
- Barra inferior: radio exterior 12–14 px; destinos sin cápsulas redondas grandes.

### Tipografía

- Mantén la tipografía actual del portal.
- Usa Georgia únicamente donde ya comunica la marca `VIP` o el contador premium; no la extiendas a textos funcionales.
- Títulos funcionales en sans serif, compactos y de alto contraste.
- No agregues mayúsculas ni tracking extremo a párrafos o botones.
- Los valores deben usar cifras tabulares cuando cambian o se comparan.

### Luz y profundidad

- Un solo borde y, como máximo, un brillo muy corto por superficie.
- Nada de halos grandes detrás del contenido de Inicio.
- Las diagonales doradas pueden existir únicamente en la tarjeta principal de entrenamiento y con opacidad baja.
- La interfaz debe seguir siendo legible sin depender de sombras.

## 4. Especificación del cabezal universal

### Estructura

De izquierda a derecha:

1. Escudo hexagonal `VIP`.
2. Título contextual que cede espacio con `min-width: 0` y truncado.
3. Instrumento de utilidades, sin huecos entre sus segmentos:
   - saldo VIP con corona;
   - campana de noticias;
   - configuración.

### Títulos por ruta

- `/alumno/inicio`: `Inicio`.
- `/alumno/entrenar`: `Entrenamiento` y `VIP` en oro si cabe sin forzar una segunda línea.
- `/alumno/entrenar/sesion/*`: `Sesión N · Nombre del día` usando el evento existente `vip:titulo-rutina`.
- `/alumno/comer*`: `Nutrición`.
- `/alumno/progreso*`: `Mi avance`.
- `/alumno/ranked*`: `Puntos VIP`.
- Rutas auxiliares: título corto derivado de la sección, nunca el logotipo horizontal completo.

### Reglas de comportamiento

- El cabezal permanece fuera de `.pantalla-scroll`; no rompas la solución actual para el rebote de Safari/iOS.
- En entrenamiento enfocado conserva la posición absoluta y el alto útil ya ajustado.
- En pantallas normales queda como hermano flex fijo del área que hace scroll.
- El saldo mostrado debe seguir sumando la previsualización de puntos en vivo de la sesión.
- No elimines `CampanaNoticias`, `MenuAlumno` ni sus estados accesibles.
- El título se trunca antes que el saldo. El saldo nunca usa puntos suspensivos.
- Mantén `safe-area-inset-top` y prueba con números de 4, 5 y 6 dígitos.
- No uses una imagen recortada para el escudo. Reutiliza `MarcaVipEntrenamiento` o conviértela en un componente compartido con nombre neutro, por ejemplo `MarcaVipPortal`.

### Cambios concretos sugeridos

- En `Logo.tsx`, elimina la bifurcación visual entre placa grande, marca cuadrada y marca de sesión.
- Conserva una única rama de render del cabezal para las rutas del alumno.
- Mantén el comportamiento dinámico de `tituloRutinaActiva` y `puntosEnVivo`.
- Permite que el título contextual venga de una tabla de rutas y que la sesión activa lo sobreescriba.
- No cambies el logo usado en login, impresión o panel de entrenador.

## 5. Especificación de Inicio

El orden funcional permanece. Cambia jerarquía y acabado, no los datos.

### 5.1 Estado de sesión abierta

Conserva la advertencia porque evita perder puntos, pero intégrala como una franja compacta:

- 36–42 px de alto cuando el texto cabe.
- Fondo grafito con borde rojo tenue; evita un bloque rojo lleno.
- Un punto/ícono rojo, título corto `Entrenamiento pendiente` y acción `Cerrar` o flecha.
- En pantallas angostas el detalle puede ocultarse; el mensaje accesible completo debe permanecer.
- La franja y la tarjeta principal pueden enlazar a la misma sesión, pero no deben competir como dos CTA grandes.

### 5.2 Identidad

Convierte “Membresía VIP” en una franja editorial breve, no otra tarjeta protagonista:

- saludo o nombre en una línea;
- objetivo y fecha en la segunda;
- sin diagonales ni halo;
- el rango puede quedar como insignia compacta, pero evita repetir el saldo completo si ya está en el cabezal;
- el progreso al siguiente rango puede conservarse como línea fina.

No elimines acceso a Ranked.

### 5.3 Tarjeta principal “Tu entrenamiento”

Debe ser la pieza visual dominante de Inicio.

Estructura:

1. Eyebrow `TU ENTRENAMIENTO`.
2. Día y número de sesión.
3. Grupo muscular como título principal.
4. Progreso `X / Y ejercicios`.
5. Foto de referencia alineada a la derecha, con degradado que la funda en negro.
6. Diagonales doradas discretas en el fondo, iguales al lenguaje de Entrenar.
7. Tira semanal de siete días.
8. Porcentaje y `N de M semanal` alineados a la derecha.
9. CTA principal de ancho completo: `Comenzar`, `Continuar` o `Ver entrenamiento`.
10. Constancia histórica plegada como acción terciaria.

Acabado:

- fondo `#0b0d0e` / `#111316`;
- borde dorado de 1 px con opacidad media, no glow grande;
- radio 17–18 px;
- la foto nunca reduce el contraste del texto;
- CTA oro sólido solo porque es la acción principal de la pantalla;
- no cambies la lógica que decide enlace o etiqueta.

### 5.4 Arena VIP

- Mantén Arena inmediatamente después del entrenamiento.
- Conserva podio, top 15, posición propia y acceso a Ranked.
- Reduce el fondo dorado y los brillos: superficie grafito y oro reservado para posiciones/puntos importantes.
- Mantén las medallas y datos reales; no inventes métricas.
- La tarjeta no debe superar visualmente a “Tu entrenamiento”.

### 5.5 Resúmenes, nutrición y seguimiento

- Mantén el orden actual y todas las funciones.
- Usa superficies grafito con borde neutral.
- Reserva el oro para valores primarios o CTA; no rodees todas las tarjetas de oro.
- No cambies consultas, `Suspense`, promesas, cálculo de rendimiento ni componentes de formulario.

## 6. Barra inferior universal

Lleva a todas las pantallas normales el acabado aprobado en entrenamiento activo:

- base grafito `#0e1012 → #08090a`;
- borde neutral de 1 px;
- radio 12–14 px;
- iconos de aproximadamente 19–20 px;
- etiquetas de 9–10 px según la escala de texto;
- destino activo: oro en icono, línea dorada superior corta y fondo oro casi transparente;
- destino inactivo: gris medio con contraste accesible;
- sin cápsula gris de alto contraste detrás del destino activo.

Conserva:

- los cinco destinos;
- el reenganche de Entrenar a `sesionEnProgresoId`;
- las etiquetas alternas del tema Espejo;
- la franja “Volver al panel de entrenador” cuando corresponde;
- `safe-area-inset-bottom`.

## 7. Nutrición — premium operativo

Nutrición ya está cerca del lenguaje correcto, pero hoy hereda la marca cuadrada, la navegación con cápsula gris y una lista horaria demasiado uniforme. No la conviertas en una pantalla decorativa: debe seguir siendo la sección de registro más rápida.

### Dirección visual

- Cabezal universal con escudo hexagonal, título `Nutrición` e instrumento de puntos/campana/ajustes.
- Selector semanal integrado como una banda grafito; el día activo usa borde oro fino y número verde solamente si “hoy” necesita esa señal.
- Resumen de macros como instrumento compacto: calorías dominantes, proteína/grasa/carbohidratos como lecturas secundarias.
- `Puntos provisionales de alimentación` como franja de recompensa fina, no una segunda tarjeta protagonista.
- Línea temporal más limpia: horas como etiquetas discretas, botón `+` táctil y nombre de la comida; evita que cada fila parezca una cápsula independiente.
- Buscador fijo conserva prioridad funcional, pero usa la misma superficie y borde que la barra inferior/campos de entrenamiento.
- Los estados registrados pueden iluminarse por macro o completado; el estado vacío permanece neutral.

### No cambiar

- Navegación por fechas y día actual.
- Registro por hora, buscador, cálculos de macros y puntos provisionales.
- Paneles, diálogos y escáner de alimentos.
- Posición fija del buscador si es necesaria para la operación.

## 8. Mi avance — premium analítico

Mi avance ya tiene una buena jerarquía general. El trabajo es alinear materiales, cabezal y densidad, no convertirlo en un dashboard distinto.

### Dirección visual

- Cabezal universal.
- Selector 7/14/30 días como control segmentado grafito con estado activo oro; `Imprimir / PDF` queda como acción secundaria delineada.
- Hero de adherencia con el mismo negro, borde fino y diagonales discretas de Entrenar. El color del estado (`Necesita atención`, progreso o éxito) debe conservar semántica.
- Cuatro indicadores de Entrenamiento, Nutrición, Seguimiento e Impulso VIP en superficies grafito homogéneas, sin brillos independientes.
- Promedios nutricionales como fila técnica legible, no tarjeta promocional.
- Señales del período y evolución mantienen la severidad y el significado de sus colores.
- Formularios de peso y fotos usan controles del mismo sistema: borde fino, radio 12–14 px, foco visible y CTA claramente priorizado.

### No cambiar

- Períodos, cálculos, impresión/PDF, señales, detalle diario, carga de peso/fotos ni privacidad.
- Significado de colores de advertencia, progreso y éxito.

## 9. Ranked — excepción iluminada dentro de la misma familia

Ranked **no debe ser tan sobrio como Inicio, Nutrición o Mi avance**. Debe sentirse como entrar al escenario competitivo de VIP: más luz, más profundidad y una recompensa visual clara.

### Lo que comparte con todo el portal

- Escudo hexagonal del cabezal.
- Instrumento de puntos/campana/ajustes.
- Altura, alineación, safe areas y comportamiento de scroll.
- Barra inferior universal.
- Tipografía base, accesibilidad, radios y calidad de bordes.

### Lo que puede ser distinto

- Hero `RANKED` con resplandor dorado contenido, haces diagonales y mayor contraste.
- Insignia de rango con luz propia, reflejo y profundidad.
- Bronce, plata, oro y rangos superiores conservan identidad cromática real.
- Podio, temporada y ascenso pueden usar animación breve y celebratoria.
- Fondos de sección pueden tener degradados más ricos que el resto del portal.

### Límites del brillo

- El brillo vive dentro del contenido Ranked; el cabezal y la barra no se transforman en neón.
- No uses glow detrás de texto largo.
- No ilumines todos los bordes simultáneamente.
- Mantén negro suficiente para que insignia, puntaje y rango sean los protagonistas.
- Respeta `prefers-reduced-motion` y evita animaciones perpetuas distractoras.

## 10. Regla de coherencia por sección

Piensa el portal como una familia con cuatro niveles de intensidad:

1. **Entrenamiento activo — instrumento:** máxima concentración, precisión, mínimo ruido.
2. **Inicio / Nutrición / Mi avance — premium cotidiano:** misma materia y exactitud, con contenido adaptado a cada tarea.
3. **Entrenar — preparación:** algo más editorial que la sesión, pero todavía sobrio.
4. **Ranked — escenario:** misma familia, máxima iluminación y celebración.

No copies literalmente la composición de peso/repeticiones a otras pantallas. Proyecta sus principios: jerarquía, material, borde, contraste, densidad y control del acento.

## 11. Archivos que debes inspeccionar y alcance permitido

### Obligatorios

- `src/app/alumno/layout.tsx`
- `src/components/Logo.tsx`
- `src/components/student/BottomNav.tsx`
- `src/app/alumno/inicio/page.tsx`
- `src/components/student/AvisoSesionSinCerrar.tsx`
- `src/components/student/ResumenSemanaCompacto.tsx`
- `src/components/student/RankedVipCard.tsx`
- `src/components/student/ResumenMetricasInicio.tsx`
- `src/components/student/AlimentacionHoyCuadro.tsx`
- `src/app/alumno/comer/page.tsx`
- componentes principales importados por `src/app/alumno/comer/page.tsx`
- `src/app/alumno/progreso/page.tsx`
- componentes principales importados por `src/app/alumno/progreso/page.tsx`
- `src/app/alumno/ranked/page.tsx`
- componentes principales importados por `src/app/alumno/ranked/page.tsx`
- `src/app/globals.css`

### Solo si es necesario

- `src/components/ui/Card.tsx`
- `src/components/student/BarraInferiorFija.tsx`
- componentes de campana, menú o insignia si el cabezal no puede unificarse sin una prop pequeña.

### No tocar salvo fallo demostrado

- `src/components/student/SesionEjercicioCard.tsx`
- `src/components/student/SesionGrupoCard.tsx`
- `src/components/student/SesionEjercicios.tsx`
- acciones, consultas, migraciones, reglas de puntos, Impulso VIP y temporizadores.

No hagas una reescritura general de `globals.css`. La hoja tiene capas históricas y reglas específicas de la sesión activa. Introduce una sección final claramente nombrada para el shell universal y luego elimina solamente las reglas anteriores que queden inequívocamente obsoletas. Evita duplicar la misma regla con más `!important`.

## 12. Estrategia técnica sugerida

1. Extrae la marca hexagonal a un componente reutilizable dentro de `Logo.tsx` o un archivo pequeño adyacente.
2. Define una sola estructura DOM para el cabezal del alumno.
3. Añade clases semánticas estables, por ejemplo:
   - `cabecera-portal-vip`
   - `marca-portal-vip`
   - `titulo-portal-vip`
   - `instrumento-portal-vip`
4. Usa el pathname solo para el texto y el contexto, no para cambiar completamente la marca o la geometría.
5. Extiende el acabado de navegación activo a la base general y conserva overrides mínimos para entrenamiento enfocado únicamente si necesita posición o espacio distinto.
6. Añade clases específicas a Inicio en vez de depender de selectores frágiles por orden de hijos.
7. Reutiliza tokens existentes. Si necesitas tokens nuevos, decláralos como variables del shell con nombres funcionales y no como colores aislados por componente.
8. Mantén `Logo` como Client Component si sigue usando `usePathname`, eventos y puntos en vivo. No conviertas el layout entero en cliente.
9. No muevas consultas de servidor al cliente.
10. No agregues dependencias.
11. Introduce una clase de contexto de sección o `data-seccion` solo si evita selectores frágiles; no multipliques variantes completas del shell.
12. Para Ranked, limita las reglas especiales a un contenedor propio como `.ranked-casino`; no contamines variables globales de Inicio, Nutrición o Mi avance.

## 13. Restricciones de producto

- No cambies textos, rutas o reglas de negocio salvo los textos visuales explícitamente indicados.
- No elimines la advertencia de sesión sin cerrar.
- No ocultes campana o Configuración.
- No elimines el saldo VIP ni el progreso de rango; evita solo la repetición innecesaria.
- No cambies el orden de Arena y resúmenes.
- No alteres el modo de solo lectura del entrenador.
- No rompas tema claro, tema masculino, tema femenino ni tema Espejo.
- No cambies la cápsula fusionada `Impulso VIP · sube a N kg`.
- No agregues de nuevo el botón de rayo separado.
- No agregues halos duplicados a la sesión activa.
- No publiques ni hagas push sin autorización explícita.
- No vuelvas sobrio o plano a Ranked: su iluminación es una decisión de producto.
- No conviertas Inicio, Nutrición o Mi avance en pantallas tipo casino.

## 14. Accesibilidad y adaptación

- Mantén un único `h1` por pantalla. Si el título del cabezal es un `h1`, el contenido de Inicio no debe repetir otro `h1`; usa la jerarquía semántica correcta.
- Los botones solo con icono deben conservar `aria-label`.
- Contraste mínimo AA para texto funcional.
- Área táctil mínima de 38 × 38 px; 44 px cuando haya espacio.
- No dependas solo del color para indicar el destino activo: conserva línea superior, icono y estado semántico.
- Respeta `prefers-reduced-motion`.
- Sin desbordamiento horizontal a 320 px.
- El saldo no se corta con `100.000`.
- El nombre largo y el título de sesión se truncan antes de invadir utilidades.
- Comprueba zoom de texto del portal en valores disponibles.

## 15. Criterios de aceptación visual

El trabajo se acepta solamente si se cumplen todos:

- Inicio ya no muestra la placa grande con el logotipo horizontal.
- Inicio, Entrenar y entrenamiento activo muestran el mismo escudo hexagonal.
- El cabezal mantiene la misma altura y alineación al navegar.
- Saldo, campana y Configuración forman un único instrumento visual.
- El saldo es legible con 1.113, 10.000 y 100.000.
- La tarjeta de entrenamiento es la protagonista de Inicio.
- Arena tiene menos presencia visual que entrenamiento, sin perder información.
- La barra inferior usa el mismo lenguaje grafito/oro en todas las pestañas.
- No aparece cápsula gris grande en el destino activo.
- No hay saltos del cabezal o la barra inferior al hacer scroll en iOS/Safari.
- No cambió ninguna lógica de sesión, puntos, ranking, nutrición o seguimiento.
- Impulso VIP sigue fusionado con su objetivo.
- Nutrición conserva velocidad de registro y ahora comparte materiales, cabezal y navegación con Entrenar.
- Mi avance conserva lectura analítica y ahora comparte materiales, cabezal y navegación con Entrenar.
- Ranked sigue siendo visiblemente más iluminado que las otras secciones, pero su shell no cambia de identidad.

## 16. Matriz de verificación manual

Prueba como mínimo:

| Pantalla | Estado | Tema | Ancho |
|---|---|---|---:|
| Inicio | sesión abierta | oscuro/Espejo | 390 px |
| Inicio | sin sesión abierta | oscuro/Espejo | 390 px |
| Inicio | sesión abierta | claro | 390 px |
| Entrenar | preparación | oscuro | 390 px |
| Sesión | ejercicio individual | oscuro | 390 px |
| Sesión | biserie/superserie | oscuro | 390 px |
| Nutrición | día vacío | oscuro | 390 px |
| Nutrición | comidas registradas | oscuro/claro | 390 px |
| Mi avance | 7 días | oscuro | 390 px |
| Mi avance | formularios y galería | oscuro/claro | 390 px |
| Ranked | hero + rango | oscuro | 390 px |
| Ranked | podio/listados cargados | oscuro | 390 px |
| Inicio | nombre largo + 100.000 puntos | oscuro | 320 px |
| Inicio | normal | oscuro | 430 px |

En cada caso revisa:

- captura inicial sin scroll;
- scroll hasta el medio y final;
- cabezal inmóvil;
- barra inferior inmóvil;
- ausencia de recortes y solapamientos;
- consola sin errores nuevos;
- foco visible con teclado;
- enlaces correctos.

## 17. Verificación automática obligatoria

Ejecuta, en este orden:

```bash
npx tsc --noEmit
npm run lint
npm test
npm run build
```

Si el lint general ya tenía fallos ajenos, identifica cuáles son previos, ejecuta lint sobre los archivos tocados y deja evidencia. No declares éxito si hay un fallo nuevo.

## 18. Entrega que debes dejar

Al terminar:

1. Resume los archivos modificados y el motivo de cada cambio.
2. Informa resultados exactos de TypeScript, lint, tests y build.
3. Enumera las pantallas y tamaños revisados visualmente.
4. Indica cualquier diferencia consciente respecto de esta especificación.
5. Deja abiertas en el navegador:
   - `/alumno/inicio` en 390 px;
   - `/alumno/comer` en 390 px;
   - `/alumno/progreso` en 390 px;
   - `/alumno/ranked` en 390 px;
   - una sesión individual;
   - una biserie o superserie.
6. No hagas commit, push ni despliegue sin autorización explícita.

## 19. Prompt corto para iniciar a Claude

Pega lo siguiente en Claude desde la raíz del repositorio:

> Lee completos `AGENTS.md`, `HANDOFF_1.27.md` e `INSTRUCTIVO_CLAUDE_REDISHENO_INICIO_CABEZAL.md`. Implementa exactamente el sistema visual premium para todo el Portal VIP descrito en el instructivo, usando entrenamiento activo como fuente de verdad. Proyéctalo a Inicio, Nutrición y Mi avance; conserva Ranked como una excepción deliberadamente más iluminada y competitiva, pero dentro del mismo shell. No cambies lógica de negocio ni la composición interna de la sesión. Lee antes las guías locales de Next.js indicadas, verifica TypeScript, lint, tests y build, y realiza la matriz visual completa. No hagas commit, push ni despliegue. Al final deja abiertas todas las pantallas indicadas y una sesión individual y una biserie/superserie.

## 20. Decisión final en una frase

**No diseñes una nueva identidad: extiende con disciplina la identidad aprobada del entrenamiento activo a todo el portal y permite que Ranked sea su versión iluminada de competencia y recompensa.**
