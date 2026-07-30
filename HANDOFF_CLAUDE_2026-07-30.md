# Handoff — VIP Fitness (30 de julio de 2026)

Proyecto: `C:\Users\aleja\OneDrive\Escritorio\VIP`
Reemplaza a todos los handoffs anteriores. Está ordenado por **lo que hay que
hacer**, no por orden cronológico.

---

# 0. ESTADO AL CIERRE (30/07, noche)

**Deploy lanzado y en construcción** por Alejandro desde su PowerShell, después
de resolver el token vencido con `vercel login`:

```
https://vip-fitness-center-9e0tq9iez-alealemenmen-creates-projects.vercel.app
```

**Verificar que haya terminado bien** — `npx vercel ls` tiene que mostrarlo en
`● Ready`, y `npx vercel alias ls` que `vipfitness.cl` apunte a ÉL y no al
deployment viejo (`7in2wbezs`).

⚠️ **No se sabe si los pasos 1 y 2 de abajo se hicieron antes de este deploy.**
Si las migraciones NO se corrieron, la app no se rompe (todo tiene respaldo),
pero la biblioteca de ejercicios y la sección Documentos no van a funcionar.
Confirmarlo con Alejandro antes de dar nada por terminado.

---

# 1. LO PRIMERO AL VOLVER

Hay trabajo **terminado y commiteado**. Este es el orden correcto; saltarse
pasos rompe cosas.

### Paso 1 — Región de las funciones (el arreglo de rendimiento más grande)

En el panel de Vercel: **Project Settings → Functions → Function Region → São
Paulo (`gru1`)**.

NO ponerlo en `vercel.json`: el campo `regions` está restringido a
Pro/Enterprise y en plan Hobby puede hacer fallar el deploy completo. Ya se
probó y se descartó por eso.

### Paso 2 — Migraciones, en este orden

Desde el SQL editor del panel de Supabase (así las corre Alejandro), todas
idempotentes:

1. `supabase/migrations/0026_biblioteca_ejercicios.sql`
2. `supabase/seeds/ejercicios_base.sql` — 103 ejercicios
3. `supabase/migrations/0027_documentos_asignaciones.sql`

**0027 es aditiva a propósito**: no borra `documentos.alumno_id`, solo lo vuelve
opcional. Por eso el orden seguro es *migración primero, código después* — entre
una cosa y la otra la app sigue funcionando.

### Paso 3 — Desplegar

```
npx vercel login     # solo si da "The specified token is not valid"
npx vercel --prod
```

**Tiene que correrlo Alejandro en su PowerShell** (el login abre el navegador).
Ver sección 2 para el caso "Not authorized".

### Paso 4 — Probar en el celular lo que no se pudo verificar

- **Persistencia**: empezar una sesión, cargar peso y reps, tocar "Listo" en una
  serie, minimizar la app o cambiar de aplicación, volver. Los datos tienen que
  estar. Repetir con modo avión para probar el respaldo local.
- **Guía en un solo PDF**: subir una guía real con rutina + dieta y ver si la IA
  extrae bien la rutina.
- **Navegación entre pestañas**: comparar con cómo se sentía antes.

---

# 2. Producción

- Vercel, proyecto `alealemenmen-creates-projects/vip-fitness-center`.
- Dominio **https://vipfitness.cl** (comprado en NIC).
- DNS por **Cloudflare**, no por Vercel: registro `A vipfitness.cl →
  76.76.21.21` con el proxy **desactivado** (nube gris, "DNS only"). Si alguien
  activa el proxy naranja, el sitio deja de funcionar.
- Repo en GitHub: `alealemenmen-create/vip-fitness`, privado. **GitHub y Vercel
  NO están conectados**: hacer push no despliega nada.
- Variables cargadas (Production y Preview): `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`,
  `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`,
  `NEXT_PUBLIC_SITE_URL`.
- Cron semanal en `vercel.json` (`/api/cron/reconocimientos`), sin tocar.

### Si el deploy falla con "Not authorized": el token venció

Pasó el 30/07. Dos intentos de `npx vercel --prod` desde Claude Code subieron los
34 MB completos y fallaron en la etapa de build con:

```json
{"status":"error","reason":"deploy_failed","message":"Not authorized"}
```

Mientras tanto quedaban en estado `UNKNOWN` (ni Ready ni Error), así que el CLI
no delataba el problema hasta terminar.

**Diagnóstico inicial equivocado:** se concluyó que era algo del entorno del
agente, porque `vercel whoami`, `vercel env add` y `vercel ls` **sí** funcionaban.
Falso. Cuando Alejandro corrió el mismo comando en su PowerShell obtuvo:

```
Error: The specified token is not valid. Use `vercel login` to generate a new token.
```

El token estaba vencido para todos; esos otros comandos leen de otra caché y por
eso engañaban. **Solución: `npx vercel login` y volver a desplegar.**

Lección: que unos comandos del CLI funcionen no prueba que la sesión sea válida.
Ante un "Not authorized" en el build, probar `vercel login` antes de buscar
causas exóticas.

`git push` sí necesita el login interactivo del navegador, y eso sí tiene que
hacerlo Alejandro.

---

# 3. Rendimiento

## La región de Vercel era el problema más grande

Alejandro notó que `localhost` se sentía **3-4x más rápido que vipfitness.cl**,
lo cual es al revés de lo esperable (dev compila al vuelo). Ese fue el
experimento que destapó la causa. Medido con TCP ping desde Chile:

| Destino | Latencia |
|---|---|
| Consulta REST real al Supabase del proyecto | **95 ms** |
| Solo *llegar* a us-east-1 (Virginia) | **128 ms** |
| Solo *llegar* a sa-east-1 (São Paulo) | 62 ms |

Como 95 ms < 128 ms, **el Supabase del proyecto NO está en EE.UU.** Pero las
funciones corrían en `iad1` (Virginia), que es el default cuando `vercel.json`
no fija región. Cada carga de página hacía:

```
celular (Chile) → Virginia → São Paulo → Virginia → celular
```

y el tramo Virginia↔São Paulo se paga **una vez por consulta**.

Nota de método: `nslookup` al host de Supabase NO sirve para saber la región,
devuelve IPs de Cloudflare (el proxy). La triangulación por latencia contra
endpoints de región conocida sí.

## Autenticación: se sacaron dos viajes de red por navegación

El cuello de botella de "cambiar de pestaña" no estaba en las pantallas sino en
el camino de auth, que corría entero en CADA navegación (~358 ms antes de pedir
un solo dato útil).

1. **`getUser()` → `getClaims()`** en `src/lib/supabase/middleware.ts` y
   `src/lib/auth.ts`. `getUser()` es una llamada HTTP al servidor de Auth
   (~84 ms) y se hacía **dos veces** por navegación. El proyecto firma los JWT
   con **ES256 (asimétrica)** — verificado leyendo
   `/auth/v1/.well-known/jwks.json` — así que `getClaims()` valida la firma
   localmente con WebCrypto, sin red.
   **Verificado en vivo** con `VIP_DEBUG_SQL=1`: el log muestra
   `AUTH .well-known/jwks.json` una sola vez (27 ms) y después CERO llamadas
   `AUTH user` por navegación.
   Es igual de seguro que `getUser()`; lo inseguro sería `getSession()`, que
   confía en la cookie sin verificar.
   ⚠️ **Si algún día se migra el proyecto a firma simétrica (HS256),
   `getClaims()` vuelve a salir a la red y esta optimización se pierde en
   silencio.**
2. `perfiles` + `alumno_perfil` en un solo select anidado (~190 → ~95 ms).
3. Quitadas las consultas redundantes de `perfiles` en `entrenar`, `comer` y
   `progreso`: las tres volvían a pedir el nombre que `requireAlumno()` ya
   devuelve.
4. **`loading.tsx` en las 11 rutas de `/alumno/*`** (+ `PantallaCargando.tsx`).
   Sin ese archivo, Next 16 **no prefetchea** rutas dinámicas: cada toque en la
   barra inferior quedaba en blanco esperando al servidor.
5. **N+1 en el panel del entrenador** (`src/app/admin/alumnos/data.ts`): se
   llamaba `obtenerPlanAlimentacion` una vez por alumno. El log mostró 10
   consultas a `planes_alimentacion` en paralelo que, al estorbarse entre sí,
   pasaban de ~108 ms a ~273 ms cada una. Ahora es una sola consulta. El
   comentario viejo decía "son pocos y ya está resuelta" — no lo estaba.

**Herramienta clave:** `VIP_DEBUG_SQL=1 npm run dev` deja en el log cada viaje a
Supabase con su tiempo y la tabla. Es la única forma de ver la cascada real en
vez de estimarla leyendo el código.

## Migración de índices ya aplicada

`0025_indices_rendimiento.sql` ya la corrió Alejandro (dos veces, sin efecto
porque es idempotente).

---

# 4. Biblioteca de ejercicios (migración 0026)

Antes, cada ejercicio de una rutina era texto libre escrito por la IA al leer el
PDF: no había forma de saber que "Jalón al pecho" y "Jalón amplio" son el mismo
movimiento, ni de colgarles técnica o ilustración.

## Arquitectura

- Tabla `ejercicios`: slug, aliases, grupo principal y secundarios, categoría,
  equipo, nivel, técnica, errores comunes, consejos, `ilustracion_slug`,
  `video_url` (para el futuro).
- `rutina_dia_ejercicios.ejercicio_id` es **NULLABLE a propósito**. Alejandro
  pidió que fuera obligatorio ("nunca más ejercicios escritos a mano"); se hizo
  opcional porque con FK obligatoria, el día que la IA lea un nombre que no está
  en la biblioteca **la rutina entera no se podría publicar**.
- `ilustracion_slug` va **separado** de `slug` para que las variantes compartan
  dibujo (press banca / Smith / mancuernas → un solo dibujo).
  **103 ejercicios necesitan ~70 ilustraciones.**

## El emparejador es lo más delicado

`src/lib/ejercicios/emparejar.ts` cruza el nombre del PDF contra la biblioteca.
Sin IA, igual que `alimentos/emparejar.ts`.

**Criterio de fondo: mostrar el dibujo de otro ejercicio es PEOR que no mostrar
ninguno.** Todas las reglas salen de casos reales que fallaron:

| Regla | El caso que la obligó |
|---|---|
| Contención exige que el nombre corto sea ≥60% del largo | "Trepar la cuerda" emparejaba con "Salto a la cuerda" |
| El puntaje divide por el nombre MÁS LARGO | Con el más corto, cualquier ejercicio de una palabra puntúa perfecto |
| Umbral 0.66 (no 0.67) | 2 de 3 palabras da 0.6666 y quedaba afuera por centésimas |
| **Desempate por equipo** | "Press banca con mancuernas" daba `press-banca` (barra) |

El **desempate por equipo es la regla más importante**: si el nombre del PDF
menciona un equipo (mancuerna, barra, polea, smith, máquina…), gana el ejercicio
cuyo campo `equipo` coincide. Ni el puntaje ni contar palabras sueltas
resolvían ese caso — las dos candidatas dejaban exactamente una palabra sin
compartir. Se resolvió con el dato estructurado en vez de más heurísticas de
texto. **Antes de tocar el emparejador, revisar que ese caso siga funcionando.**

## Cómo se calibró (importante para ampliarla)

Alejandro señaló que hacía falta la lista de ejercicios que él usa de verdad. No
hizo falta que la escribiera: **ya estaba en la base**, en
`rutina_dia_ejercicios` (154 filas, 137 nombres distintos de rutinas reales).

| Versión | Cobertura sobre rutinas reales |
|---|---|
| Biblioteca genérica inicial (74 ejercicios) | **47%** |
| + 28 ejercicios sacados de sus rutinas | 87% |
| + variantes del nombre ("A o B", paréntesis, adjetivos) | 94% |
| + plurales en los adjetivos y alias sueltos | **97%** |

Los 4 que no emparejan ("Abdomen", "Abdomen / vacuum", "Brazos completos",
"Pulsos") **no son ejercicios**, son encabezados de sección: que queden sin
emparejar es lo correcto.

Después Alejandro pasó su **lista canónica de 35 ejercicios** (cómo los nombra
él). Quedó en **35/35** tras agregar Farmer Walk y alias para "Abducción" y
"Bicicleta Spinning".

**Método para volver a medir:** exportar los nombres reales desde
`rutina_dia_ejercicios`, parsear la semilla a JSON, y correr el emparejador con
`node --experimental-strip-types` sobre copias con los imports reescritos (el
proyecto no tiene runner de TS instalado).

## Las ilustraciones NO existen todavía

`src/lib/ejercicios/ilustracion.ts` tiene cadena de respaldo: ilustración → foto
de grupo muscular (lo de hoy) → ícono. El set `ILUSTRACIONES_DISPONIBLES` está
**vacío**; al agregar un SVG a `public/ejercicios/` hay que sumar su nombre a ese
set y aparece solo.

Sobre el arte: **Claude no puede dibujarlas** (serían monigotes, no el estilo
premium pedido). Se recomendó comprar un pack vectorial con licencia
(~US$30-80), lo único que garantiza consistencia entre ~70 piezas. Decisión de
Alejandro: arrancar sin arte y conseguirlo después.

---

# 5. Documentos

## Guía del alumno en un solo PDF

El entrenador arma la guía en un archivo, así que pedirle dos subidas separadas
era trabajo inventado. Hay un recuadro principal que sube **un** PDF y lo
registra dos veces en `documentos` (tipo `rutina` y tipo `alimentacion`)
apuntando al mismo `storage_path`.

La IA hace **una sola llamada y extrae solo la rutina**, por decisión explícita
de Alejandro: la dieta no se analiza, se adjunta para que el alumno la lea. Se
agregó el enlace al PDF en la pantalla de Comer. Los dos formularios anteriores
quedan como respaldo detrás de un enlace.

## Sección Documentos centralizada (migración 0027)

`documentos` mezclaba el ARCHIVO con la ASIGNACIÓN: `alumno_id` era obligatorio,
así que una fila era "este archivo, para este alumno". De ahí venía tener que
entrar al perfil de cada alumno, y que el mismo PDF para 10 alumnos fueran 10
filas.

```
documentos             = el archivo (uno por archivo real)
documento_asignaciones = a qué alumnos está asignado
```

- **`/admin/documentos`** (`DocumentosManager.tsx`): subir un archivo una vez,
  elegir tipo, marcar uno/varios/todos los alumnos, asignar en una acción.
  Biblioteca con quién lo tiene, asignar, quitar, reemplazar archivo
  (conservando asignaciones) y eliminar.
- Nueva pestaña **Docs** en `AdminTabs`. La subida desde el perfil de cada
  alumno sigue intacta.
- Se agregó el tipo `'otro'`.
- El alumno lee sus documentos desde las asignaciones, **con respaldo** a la
  consulta vieja por si el código llegara antes que la migración.
- `obtenerDocumentoDieta` reusa `obtenerDocumentos` en vez de tener su propia
  consulta, para que no puedan quedar desincronizadas.

⚠️ **Trampa que costó dos builds:** `src/lib/documentos/data.ts` lleva
`server-only` y `DocumentosManager` es un componente cliente. Importar de ahí
rompe el build con un error poco claro (*"Ecmascript file had an error"*). Por
eso los tipos y `ETIQUETA_TIPO` viven en `src/lib/documentos/tipos.ts`, sin
`server-only`. Mismo patrón que `src/lib/ejercicios/tipos.ts`. **Si aparece ese
error de build, mirar primero si un componente cliente está importando de un
módulo `server-only`.**

⚠️ Al compartir un archivo entre varias filas, borrar una no puede eliminar el
objeto de Storage sin antes revisar que ninguna otra lo use. Está cubierto en
`eliminarDocumento` y `eliminarDocumentoBiblioteca`.

---

# 6. Persistencia del entrenamiento — pérdida de datos corregida

El bug: al tocar "Listo" en una serie **no se guardaba nada**. El envío
(`requestSubmit`) solo se disparaba al completar TODAS las series, así que
minimizar la app o cambiar de aplicación en el medio perdía todo lo cargado.

Ahora cada "Listo":
1. Respalda en `localStorage` (instantáneo, no depende de la red).
2. Manda al servidor.

Escribir peso o reps también respalda local, enganchado al `onChange` del
`<form>` (los eventos de los inputs burbujean). Al servidor se manda solo al
tocar "Listo", para no disparar una petición por tecla.

- `src/lib/entrenamiento/borrador.ts` — **regla de precedencia: el borrador
  existe SOLO mientras hay algo sin confirmar y se borra cuando el servidor
  responde.** Sin eso, un borrador viejo podría restaurarse encima de datos más
  nuevos. Vence a las 24 h.
- `src/lib/entrenamiento/reps.ts` — precarga el campo de repeticiones con el
  objetivo de la rutina (el techo si es rango: "10-12" → 12). Devuelve null para
  "al fallo" o "30 seg", donde inventar un número sería un dato falso.
  **Probado con 18 casos, 18/18.**
- Los duplicados ya estaban cubiertos: `guardarSeries` hace upsert sobre
  `(sesion_ejercicio_id, numero_serie)`.

Detalle: los campos son **no controlados** (`defaultValue`), así que para
restaurar un borrador la fila se re-monta cambiando su `key`
(`${n}-${borradorLeido}`). Leer `localStorage` durante el render rompería la
hidratación, por eso se lee en un efecto.

---

# 7. Decisiones de producto tomadas con Alejandro

- **Retención de 6 meses: NO se implementó, por recomendación.** La base tiene
  **853 filas en total** y el plan gratis da 500 MB (~0,04% usado). Además
  borrar historial rompería: las fotos "Primera / Actual" (el corazón de
  Progreso), los pesos de referencia de `obtenerUltimoRegistro`, y los rangos
  acumulados del ranking. Si algún día hace falta, la salida es **archivar**, no
  borrar.
- Al asignar una rutina a varios alumnos, **la rutina activa anterior se
  reemplaza** y pasa a histórico (igual que hoy).
- La dieta **no se analiza con IA**, solo se adjunta.

---

# 8. Lo que NO está hecho

1. **Analizar con IA una vez y publicar a varios alumnos.** Es la pieza que
   falta de la sección Documentos. `confirmarYPublicarRutina` ya recibe
   `alumnoId`, así que alcanza con recorrer los seleccionados desde el borrador
   que ya está en memoria. Ahorra N-1 llamadas a la IA.
2. **Las ~70 ilustraciones** (ver sección 4).
3. **Telegram** (tareas 3 y 6 del roadmap): notificaciones de entrenamiento y
   recordatorios de alimentación. Necesitan bot token, forma de vincular
   alumno↔chat_id y un disparador programado (Vercel Cron).
4. **"Seguimiento Semanal / Mi Reporte Semanal"**: solo diagnosticado
   (arquitectura propuesta: un cron, cálculo por código, lotes de ~10 alumnos,
   1 llamada a IA por lote). El detalle vivía en handoffs ya borrados.
5. Probar en producción con datos reales: alta de alumno, correos de Resend y el
   cron desde el dominio real.

---

# 9. Referencia que sigue vigente

## Fotos de grupo muscular

7 fotos reales con fondo transparente en `public/grupos-musculares/*.webp`, mapa
en `src/lib/grupos-musculares/fotos.ts`. Cardio sigue con dibujo SVG. Los `.jpg`
originales quedaron de respaldo sin usarse.

Componentes en `src/components/student/GrupoMuscularIcon.tsx`:
`FotoGrupoMuscular` (miniatura) y `FotoDiaEntrenamiento` (foto grande de
Entrenar, `object-contain` para no cortar el cuerpo).

⚠️ **Al procesar fotos reales, exportar en WebP** (`sharp(...).webp({quality:
90})`), nunca PNG. Ya pasó: 7 fotos como PNG quedaron de 700KB a 1.4MB cada una
(15x el JPG original) y hacían sentir lenta toda la app. Ver
`scripts/quitar-fondo-negro.mjs`, que ya deja el patrón correcto.

## Logo

Los tres temas (Espejo/VIP/Lady) comparten `public/logo-vip-full.png`. Espejo lo
muestra a color sobre placa negra; VIP y Lady lo tiñen de negro plano vía CSS
(`filter: brightness(0)`). En `src/components/Logo.tsx` + `globals.css`. Tamaños:
compacto 44px, header 36px, grande 70px (el header de `/alumno/*` siempre usa
`compact`).

## Resplandor de las medallas (Inicio)

En `RankedVipCard.tsx`, cada medalla tiene un resplandor de su color que
"respira": `filter: drop-shadow()` animado en `.emblema-rango-movimiento`
(`globals.css`) + variables `--brillo-suave` / `--brillo-fuerte`.
**NO es un `box-shadow`** — esa versión dejaba un disco visible en las esquinas
transparentes y Alejandro pidió sacarlo explícitamente.

Lección: para depurar un brillo o "círculo" raro, clonar el nodo a un `div` a
pantalla completa con `transform: scale()` 10-15x antes de asumir qué capa de
CSS es la culpable.

## Íconos de la app

Glifo "V⚡P" sobre placa negra, generado con `scripts/generar-iconos-app.mjs`
(`sharp` + `png-to-ico`, instalado con `--no-save`; reinstalar con
`npm install --no-save png-to-ico` si hay que correrlo). Conectado por
convenciones de Next: `src/app/icon.png`, `apple-icon.png`, `favicon.ico`,
`manifest.ts`.

## Detalles de Inicio

Se eliminó la firma "by Alejandro Mendoza". Quedó un espacio en blanco al final
**a propósito** — Alejandro dijo que lo resolvería él, no tocar sin que lo pida.

## Entorno de desarrollo

- `.claude/launch.json` apunta al puerto 3001. El 3000 puede estar ocupado por
  otra herramienta del usuario — no tocarlo.
- Para probar desde el celular en la misma WiFi: `http://<ip-lan>:3001`.
  `next.config.ts` tiene `allowedDevOrigins: ["192.168.1.*"]`; si cambia el
  rango de la red, actualizarlo.
- Para levantar un server sin pisar el de otra sesión:
  `VIP_DIST_DIR=.next-loquesea npm run dev -- -p 3005`.
  ⚠️ Esto ensucia el `include` de `tsconfig.json` — revisarlo antes de commitear.

---

# 10. Cómo se verificó todo esto

- `npx tsc --noEmit` y `npx eslint` limpios en cada cambio.
- `npm run build` (producción) corrido en cada feature: 25+ rutas, cero errores.
- **Emparejador de ejercicios**: 31 casos de regresión + 137 nombres reales +
  la lista canónica de 35. Todo re-corrido después de cada cambio de reglas.
- **Parser de repeticiones**: 18 casos.
- **Latencia**: medida con TCP ping y con consultas REST reales, no estimada.
- **`getClaims()`**: verificado en vivo con `VIP_DEBUG_SQL=1` sobre una sesión
  real, contando las llamadas al servidor de Auth antes y después.

**Lo que NO se pudo verificar** (requiere celular real o sesión de alumno):
persistencia al minimizar la app, calidad de la extracción de la guía en un solo
PDF, y la sección Documentos funcionando de punta a punta.
