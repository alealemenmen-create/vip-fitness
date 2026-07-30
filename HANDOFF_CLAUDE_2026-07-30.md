# Handoff — VIP Fitness (30 de julio de 2026)

Proyecto: `C:\Users\aleja\OneDrive\Escritorio\VIP`
Este handoff reemplaza a todos los anteriores (`HANDOFF_CLAUDE_2026-07-29.md`
y `HANDOFF_CLAUDE_2026-07-29_noche.md`, ya borrados) — acá está todo lo que
sigue vigente.

## Lo más importante: LA APP YA ESTÁ EN PRODUCCIÓN

- Desplegada en Vercel, proyecto `alealemenmen-creates-projects/vip-fitness-center`.
- Dominio propio conectado: **https://vipfitness.cl** (comprado en NIC).
- DNS: el dominio usa nameservers de **Cloudflare**, no los de Vercel. Hay un
  registro `A vipfitness.cl → 76.76.21.21` con el proxy de Cloudflare
  **desactivado** (nube gris, "DNS only") — tiene que quedar así para que
  Vercel sirva el sitio y el certificado. Si alguien reactiva el proxy
  naranja de Cloudflare, el sitio deja de funcionar.
- Certificado HTTPS y el sitio funcionando, confirmado con `curl` directo a
  la IP de Vercel. El DNS local de Alejandro (Movistar) tardó en propagar el
  cambio la primera vez — si alguna vez alguien no puede entrar recién
  después de un cambio de DNS, probar primero desde otra red antes de tocar
  la configuración.
- Variables de entorno cargadas en Vercel (Production y Preview) desde
  `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `ANTHROPIC_API_KEY`,
  `RESEND_API_KEY`, `RESEND_FROM_EMAIL`.
- `NEXT_PUBLIC_SITE_URL` = `https://vipfitness.cl` **ya cargada** en Production
  y Preview (30/07, tarde). Es la que arma el link de los correos de invitación
  a alumnos nuevos. Falta que un deploy la tome (ver abajo).
- **El repo ya está en GitHub** (30/07): `alealemenmen-create/vip-fitness`,
  privado. Antes no existía ningún `.git` — todo el proyecto vivía solo en el
  disco. GitHub y Vercel **no están conectados**: el sitio solo se actualiza
  corriendo `npx vercel --prod` a mano, hacer push NO despliega nada.
- **Desplegar desde un agente NO funciona en este proyecto.** Dos intentos de
  `npx vercel --prod` lanzados desde Claude Code subieron los 34 MB completos y
  después fallaron en la etapa de build con `{"status":"error","reason":
  "deploy_failed","message":"Not authorized"}`. Mientras tanto quedan en estado
  `UNKNOWN` (ni Ready ni Error), así que el CLI no delata el problema hasta que
  termina. Curioso: `vercel whoami`, `vercel env add` y `vercel ls` sí funcionan
  con esa misma sesión — o sea el CLI está autenticado, falla solo el build.
  Los deploys corridos por Alejandro en su propia PowerShell sí funcionan.
  Igual pasó con `git push` (necesita el login interactivo del navegador).
  **Conclusión: si hay que desplegar o pushear, pedírselo a Alejandro.**
- El primer deploy (`vercel` sin `--prod`) Vercel lo asigna automáticamente a
  producción la primera vez, sin importar el flag. Deploys posteriores sí
  respetan `--prod` vs preview normal.
- El cron semanal (`vercel.json`, `/api/cron/reconocimientos`) viaja con el
  deploy, sigue en el horario de siempre — no se tocó.
- Para volver a desplegar en cualquier momento: `npx vercel --prod` desde la
  raíz del proyecto (ya está vinculado, no hace falta reconfigurar nada).

## Rendimiento: la región de Vercel era el problema más grande (30/07, tarde)

Alejandro notó que `localhost` se sentía **3-4x más rápido que vipfitness.cl**,
lo cual es al revés de lo esperable (dev compila al vuelo, siempre debería ser
más lento). Ese fue el experimento que destapó la causa. Medido con TCP ping
desde Chile:

| Destino | Latencia |
|---|---|
| Consulta REST real al Supabase del proyecto | **95 ms** |
| Solo *llegar* a us-east-1 (Virginia) | **128 ms** |
| Solo *llegar* a sa-east-1 (São Paulo) | 62 ms |

Como 95 ms < 128 ms, **el Supabase del proyecto NO está en EE.UU.** — está en
Sudamérica. Pero las funciones de Vercel corrían en `iad1` (Virginia), porque
`vercel.json` no fijaba región y ese es el default. Cada carga de página hacía:

    celular (Chile) → Virginia → São Paulo → Virginia → celular

y el tramo Virginia↔São Paulo se paga **una vez por consulta**.

**Arreglo:** poner la región de las funciones en **São Paulo (`gru1`)**, que es
la más cercana tanto a Supabase como a los alumnos chilenos. Si algún día se
migra el proyecto de Supabase a otra región, hay que actualizar esto o el
problema vuelve al revés.

**Cómo aplicarlo: desde el panel de Vercel, NO desde `vercel.json`.**
Project Settings → Functions → Function Region → São Paulo, y redesplegar.
Se probó primero con `"regions": ["gru1"]` en `vercel.json` y se descartó: ese
campo está restringido a Pro/Enterprise y en plan Hobby puede hacer **fallar el
deploy completo**. El selector del panel funciona en cualquier plan.

Nota de método: `nslookup` al host de Supabase NO sirve para saber la región —
devuelve IPs de Cloudflare (el proxy), no del origen. La triangulación por
latencia contra endpoints de región conocida sí funciona; el script quedó
documentado en esta sección, no en el repo.

## Optimizaciones de autenticación (30/07, tarde)

El cuello de botella de "cambiar de pestaña" no estaban en las pantallas sino
en el camino de auth, que corría entero en CADA navegación:

- `getUser()` es una llamada HTTP al servidor de Auth de Supabase (~84 ms
  medidos). Se llamaba **dos veces** por navegación: una en el middleware
  (`src/lib/supabase/middleware.ts`) y otra en `requireAlumno()`.
- Después `perfiles` y `alumno_perfil` iban encadenadas (~190 ms).

Cambios:
1. **`getUser()` → `getClaims()`** en middleware y en `src/lib/auth.ts`. El
   proyecto firma los JWT con **ES256 (asimétrica)** — verificado leyendo
   `/auth/v1/.well-known/jwks.json` — así que `getClaims()` valida la firma
   localmente con WebCrypto, sin red. **Verificado en vivo** con
   `VIP_DEBUG_SQL=1`: el log muestra `AUTH .well-known/jwks.json` una sola vez
   (27 ms) y después CERO llamadas `AUTH user` por navegación. Es igual de
   seguro que `getUser()`; lo inseguro sería `getSession()`, que confía en la
   cookie sin verificar. **Si algún día se migra el proyecto a firma simétrica
   (HS256), `getClaims()` vuelve a salir a la red y esta optimización se
   pierde en silencio.**
2. `perfiles` + `alumno_perfil` en un solo select anidado (~190 → ~95 ms).
3. Quitadas las consultas redundantes de `perfiles` en `entrenar`, `comer` y
   `progreso`: las tres volvían a pedir el nombre que `requireAlumno()` ya
   devuelve.
4. `loading.tsx` en las 11 rutas de `/alumno/*` (+ `PantallaCargando.tsx`).
   Sin ese archivo, Next 16 **no prefetchea** rutas dinámicas: cada toque en la
   barra inferior quedaba en blanco esperando al servidor.
5. **N+1 en el panel del entrenador** (`src/app/admin/alumnos/data.ts`): se
   llamaba `obtenerPlanAlimentacion` una vez por alumno. El log mostró 10
   consultas a `planes_alimentacion` en paralelo que, al estorbarse entre sí,
   pasaban de ~108 ms a ~273 ms cada una. Reemplazado por una sola consulta
   que trae `kcal_objetivo` de todos (esta pantalla no usa las comidas del
   plan). El comentario viejo decía "son pocos y ya está resuelta" — no lo
   estaba.

Herramienta clave para medir: `VIP_DEBUG_SQL=1 npm run dev` deja en el log cada
viaje a Supabase con su tiempo y la tabla. Es la única forma de ver la cascada
real en vez de estimarla leyendo el código.

## Biblioteca de ejercicios (30/07, tarde) — FALTA CORRER LA MIGRACIÓN

Antes, cada ejercicio de una rutina era texto libre escrito por la IA al leer el
PDF: no había forma de saber que "Jalón al pecho" y "Jalón amplio" son el mismo
movimiento, ni de colgarles técnica, errores comunes ni una ilustración.

**Pendientes para que esto funcione (en orden):**
1. Correr `supabase/migrations/0026_biblioteca_ejercicios.sql`.
2. Correr `supabase/seeds/ejercicios_base.sql` (74 ejercicios, idempotente).
3. Las rutinas ya publicadas quedan con `ejercicio_id = null` — hay que volver
   a publicarlas desde el PDF para que se emparejen, o emparejarlas a mano.

**Arquitectura:**
- Tabla `ejercicios`: biblioteca maestra (slug, aliases, grupo principal y
  secundarios, categoría, equipo, nivel, técnica, errores, consejos,
  `ilustracion_slug`, `video_url` para el futuro).
- `rutina_dia_ejercicios.ejercicio_id` **nullable a propósito**. Alejandro pidió
  que fuera obligatorio ("nunca más ejercicios escritos a mano"); se hizo
  opcional porque con FK obligatoria, el día que la IA lea un nombre que no está
  en la biblioteca **la rutina entera no se podría publicar**. Así el ejercicio
  sin reconocer se publica igual con su nombre y se empareja después.
- `ilustracion_slug` va **separado** de `slug` para que varias variantes
  compartan dibujo (press banca / Smith / mancuernas → un solo dibujo).
  **74 ejercicios necesitan solo 59 ilustraciones.**
- `src/lib/ejercicios/emparejar.ts` cruza el nombre del PDF contra la
  biblioteca. Sin IA, igual que `alimentos/emparejar.ts`. **Verificado con 31
  casos reales, 31/31.** Dos reglas se endurecieron por falsos positivos que
  aparecieron en esa prueba: la contención exige que el nombre más corto sea
  ≥60% del más largo, y el puntaje por palabras divide por el nombre MÁS LARGO
  (con el más corto, "Trepar la cuerda" emparejaba con "Salto a la cuerda").
  Criterio de fondo: mostrar el dibujo de otro ejercicio es peor que no mostrar
  ninguno.

**Las ilustraciones NO existen todavía.** `src/lib/ejercicios/ilustracion.ts`
tiene una cadena de respaldo: ilustración → foto de grupo muscular (lo de hoy)
→ ícono. El set `ILUSTRACIONES_DISPONIBLES` está **vacío**; al agregar un SVG a
`public/ejercicios/` hay que sumar su nombre a ese set y aparece solo.

Sobre el arte: Claude **no puede dibujarlas** (serían monigotes, no el estilo
premium pedido). Se recomendó comprar un pack vectorial con licencia (~US$30-80)
por ser lo único que garantiza consistencia entre 59 piezas. Decisión de
Alejandro: arrancar sin arte y conseguirlo después.

## Bug de performance real que ya se resolvió — ojo si vuelve a pasar

Después de "quitarle el fondo negro" a una foto real (persona/producto), el
script de turno debe exportar en **WebP** (`sharp(...).webp({quality: 90})`),
nunca en PNG sin comprimir. Ya pasó una vez: las 7 fotos de grupos
musculares se procesaron como PNG y quedaron de 700KB a 1.4MB cada una (15x
el peso del JPG original) — eso hacía sentir toda la app lenta, porque esas
fotos se cargan en Inicio, Entrenar y cada sesión de ejercicio. Se corrigió
regenerándolas en WebP (94-168KB, calidad igual) — ver
`scripts/quitar-fondo-negro.mjs`. Si en el futuro se procesa alguna foto más
así, replicar ese mismo script (ya deja el patrón correcto) y no usar PNG
como salida para fotos reales.

## Estado de las fotos de grupo muscular en Entrenar

7 fotos reales, fondo transparente (sin el fondo negro original), en
`public/grupos-musculares/*.webp` — mapa en
`src/lib/grupos-musculares/fotos.ts`. Cardio sigue con el dibujo SVG de
siempre (no hay foto para ese grupo). Los `.jpg` originales (con fondo negro)
quedaron de respaldo en la misma carpeta, sin usarse en código.

Componentes en `src/components/student/GrupoMuscularIcon.tsx`:
- `FotoGrupoMuscular` — miniatura cuadrada (Inicio 68px, por-ejercicio 48px).
- `FotoDiaEntrenamiento` — foto grande de la tarjeta de Entrenar (principal a
  la derecha, `object-contain` para no cortar el cuerpo en poses anchas, con
  margen del borde derecho) + miniaturas circulares de grupos secundarios.

## Logo del tema Espejo

Los tres temas (Espejo/VIP/Lady) comparten el mismo archivo de logo
(`public/logo-vip-full.png`, wordmark "VIP FITNESS CENTER" gris/naranjo con
el rayo). Espejo lo muestra a color completo sobre placa negra sólida; VIP y
Lady lo tiñen de negro plano vía CSS (`filter: brightness(0)`) sobre su
propia placa de color. Todo en `src/components/Logo.tsx` +
`src/app/globals.css`. Tamaños de logo: compacto 44px, header 36px, grande de
Inicio 70px (el header de `/alumno/*` siempre usa `compact`, así que en la
práctica ese tamaño "grande" no se ve ahí — es preexistente, no tocar sin que
lo pidan).

## Resplandor de las medallas del ranking (Inicio)

En la tarjeta "RANKING VIP" de Inicio (`RankedVipCard.tsx`), cada medalla
(`EmblemaRango`) tiene un resplandor de su propio color que "respira"
(`filter: drop-shadow()` animado, sigue el contorno real del hexágono de la
medalla — NO es un `box-shadow` sobre un círculo, esa versión anterior dejaba
un disco/círculo visible detrás en las esquinas transparentes y Alejandro lo
pidió sacar explícitamente). Si hay que tocar este efecto de nuevo: el
`filter: drop-shadow` vive en `.emblema-rango-movimiento` (`globals.css`) +
las variables `--brillo-suave`/`--brillo-fuerte` que calcula el componente.
Lección para la próxima vez que pida sacar un "círculo" o brillo raro:
aislar y escalar el elemento 10-15x en el navegador (clonar el nodo a un
`div` a pantalla completa con `transform: scale()`) antes de asumir qué capa
de CSS es la culpable — ahorra una vuelta de ida y vuelta.

## Íconos de la app (Windows / Android / iPhone)

Ícono cuadrado con el glifo "V⚡P" recortado del logo, sobre placa negra,
generado con `scripts/generar-iconos-app.mjs` (usa `sharp` + `png-to-ico`,
instalado con `--no-save` — si hay que volver a correr el script, reinstalar
con `npm install --no-save png-to-ico`). Conectado vía convenciones de Next
App Router: `src/app/icon.png`, `src/app/apple-icon.png`,
`src/app/favicon.ico` (multi-res 16/32/48), `src/app/manifest.ts` (íconos
192/512/maskable en `public/icons/`).

## Ajustes menores de Inicio

- Tarjetas "COMIDAS DE HOY", "SESIONES DEL MES" y "ALIMENTACIÓN DE HOY" con
  más alto (padding vertical) que antes.
- Se eliminó la firma "by Alejandro Mendoza" (componente `Firma`) de Inicio.
  Quedó un espacio en blanco al final a propósito — Alejandro dijo que lo
  iba a resolver él mismo, no tocar sin que lo pida de nuevo.

## Pendientes para la próxima sesión

1. **`NEXT_PUBLIC_SITE_URL` en Vercel** (ver arriba) — es lo único que quedó
   sin terminar del deploy.
2. Confirmar que Alejandro ya puede entrar normal a `vipfitness.cl` desde su
   celular/PC (el DNS debería haber propagado del todo a esta altura).
3. Probar el flujo real en producción con datos reales: login de un alumno,
   creación de alumno nuevo, que el cron y los correos (Resend) funcionen
   desde el dominio real.
4. El proyecto grande de "Seguimiento Semanal / Mi Reporte Semanal" sigue
   solo diagnosticado (37 puntos, arquitectura propuesta: un cron, cálculo
   por código, lotes de ~10 alumnos, 1 llamada a IA por lote), no
   implementado. El detalle completo del diagnóstico vivía en handoffs
   anteriores ya borrados — si hace falta retomarlo y no está en el
   historial de chat disponible, hay que rehacer el diagnóstico o
   preguntarle a Alejandro por el resumen.
5. Alejandro mencionó una vez "necesito dos o tres cosas" y solo llegó a
   pedir el logo y los íconos de la app de esa lista — puede que le queden
   una o dos cosas más sin decir. Preguntarle si falta algo.

## Verificaciones de esta sesión

- `npx tsc --noEmit` y `npx eslint` limpios en cada cambio de código.
- `npm run build` (producción) corrido varias veces: 25 rutas, cero errores.
- Todo lo visual se verificó contra el servidor de desarrollo real
  (incluyendo el truco de clonar y escalar 15x un elemento en la consola del
  navegador para inspeccionar de cerca el resplandor de las medallas).
- El deploy a Vercel y el dominio se verificaron con `curl --resolve`
  apuntando directo a la IP de Vercel, sin depender del DNS local.
- El fix de performance (PNG→WebP) se verificó revisando el peso real de los
  archivos en disco y confirmando en las Network requests del navegador que
  Next Image sirve el `.webp` optimizado (no el archivo completo).
