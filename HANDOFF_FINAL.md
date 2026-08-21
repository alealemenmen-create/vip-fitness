# HANDOFF FINAL — VIP Fitness

Fecha de cierre: 2026-08-21
Línea principal: `main`
Estado: Portal V2, Generador de Rutinas y Estudio VIP reconciliados, publicados y verificados.

Este es el único handoff vigente. Los handoffs anteriores se conservan como historial y no deben usarse como estado actual.

## Resultado operativo

- Producción principal: https://vipfitness.cl
- Alias V2: https://vip-fitness-v2.vercel.app
- Rama canónica: `main`, sincronizada con `origin/main`.
- Despliegue de código validado: `dpl_97rrojbYovzCKoRUoR4Ron98rp8i` (`Ready`), publicado también en el alias V2.
- Portal V2 usa datos reales de alumnos, rutinas, progreso y nutrición. Se retiraron estados demostrativos que podían confundirse con información real.
- Estudio VIP quedó conectado al Portal V2 mediante una única configuración publicada en Supabase Storage.
- Generador conserva el motor determinista probado, las técnicas avanzadas y la lógica de Impulso VIP. Se agregó validación estricta antes de publicar.
- La biblioteca y el centro multimedia usan el mismo catálogo real de ejercicios.

## Commits funcionales reconciliados en `main`

- `d117c78` — calibración RIR en vivo para Impulso VIP en V2.
- `2deff05` — recuperación del último peso conocido y corrección de sugerencias sin base.
- `344800c` — Estudio VIP conectado a Portal V2 y mejoras de experiencia móvil.
- `195775d` — auditoría de rutinas, validación del generador y centro multimedia para entrenador/administrador.
- `4383b53` — portadas editoriales de los días de entrenamiento, preservación de originales y degradado adaptable.

El commit posterior que contiene este documento y `HANDOFF_1.33.md` es únicamente documental.

## Estudio VIP

Ruta: `/admin/estudio-vip`
Acceso: administrador y entrenador.

Permite administrar y previsualizar como alumno:

- nombre y subtítulo de marca;
- color de acento y fondo;
- portada global optimizada;
- etiqueta de fase y texto del botón principal;
- aviso global con botón opcional;
- nombres, orden y visibilidad de navegación inferior;
- textos y visibilidad de tarjetas de entrenamiento;
- borrador, publicación y versiones históricas;
- separación explícita entre ajustes globales y ajustes por alumno.

Persistencia:

- bucket privado `documentos`;
- `_estudio-vip/borrador.json`;
- `_estudio-vip/publicada.json`;
- snapshots históricos inmutables al reemplazar una publicación.

La versión 1 fue guardada y publicada desde la interfaz real con la cuenta administrativa de Alejandro. El Portal V2 consume solamente la versión publicada.

## Generador de rutinas

- Conserva el motor existente y sus decisiones deterministas; no se reemplazó por lógica improvisada.
- Crear, revisar, editar, asignar y reutilizar rutinas continúa sobre las entidades reales existentes.
- La validación de publicación exige ejercicios oficiales activos, bloquea IDs prohibidos, comprueba estructura y deja el cardio al final cuando corresponde.
- El fallback por nombre queda limitado a documentos PDF heredados.
- Cada borrador conserva auditoría y la publicación deja trazabilidad.
- La librería multimedia permite crear, actualizar, reparar, fusionar y restaurar ejercicios, además de administrar colas masivas de fotos y videos.
- El acceso al centro multimedia quedó disponible tanto para administrador como para entrenador.

## Portal V2 y móvil

- Las cinco jornadas del programa actual usan cuatro portadas editoriales no destructivas (press inclinado se comparte entre días 1 y 5): mantienen las identidades y escenas originales, con mejora corporal leve y realista. El bloque aplica un degradado inferior uniforme; biblioteca y fichas conservan las fotos técnicas originales.
- Revisión multimedia posterior: la rutina activa ya no amplía el iframe para llenar el cuadro. Fotos y videos grandes usan encaje completo, preservan cabeza, manos y pies, y aceptan material vertical u horizontal con franjas negras cuando la proporción lo requiere.
- El editor de ejercicios incorpora una vista vertical real de la rutina activa para alternar foto/video y revisar el archivo completo antes de publicarlo.
- Diseño comprobado en viewport iPhone `390x844` y Android `412x915`.
- Corregido el desplazamiento horizontal involuntario de la pantalla de entrenamiento.
- Zoom del navegador habilitado para accesibilidad (`maximumScale: 5`, `userScalable: true`).
- Portada y ficha prioritaria ajustadas para carga visual.
- Navegación y tarjetas consumen la configuración publicada por Estudio VIP.
- Biblioteca real: 134 ejercicios; 113 con foto y 21 pendientes de foto en el momento de la auditoría.
- Se comprobaron 131 imágenes cargadas sin roturas en la vista auditada.
- Producción abrió una demostración real mediante `customer-diajbtz0t1okibpd.cloudflarestream.com`, con iframe válido y sin error.

Capturas de QA: `C:\dev\vip-fitness-backups\2026-08-21-pre-reconciliacion`.

## Datos y Supabase

Auditoría de solo lectura realizada antes de modificar:

- 78 perfiles;
- 75 perfiles de alumno;
- 126 rutinas y 614 días;
- 4.260 ejercicios prescritos;
- 567 sesiones y 4.379 ejercicios de sesión;
- 12.480 series;
- 106 registros de peso y 8 fotos de progreso;
- 161 días nutricionales y 586 comidas;
- 2.901 puntos de progreso;
- 339 alimentos de catálogo;
- 9 alumnos habilitados para V2.

Todas las migraciones conocidas y las columnas/RPC requeridas, incluida `0118`, ya estaban presentes. No se aplicó SQL porque no existía una migración pendiente verificada; tampoco se alteraron ni borraron datos reales.

## Pruebas ejecutadas

- ESLint: aprobado, sin advertencias.
- TypeScript: `npx tsc --noEmit --incremental false`, aprobado.
- Tests enfocados: 85/85 aprobados.
- Suite completa: 82 archivos, 633/633 tests aprobados.
- Build de producción: Next.js 16.3.1, 72 páginas, aprobado.
- Revisión de encuadre multimedia: ESLint, TypeScript, 10 pruebas enfocadas, suite completa y build repetidos en verde.
- QA autenticada local: Estudio VIP guardar/publicar, Portal V2, Generador y centro multimedia, aprobada.
- QA autenticada en producción: Estudio VIP y video Cloudflare real, aprobada sin error de consola ni overlay.
- Accesibilidad automatizada: 0 infracciones confirmadas; algunos contrastes sobre gradientes quedaron como comprobación manual indeterminada.

## Respaldos y recuperación

- Tag anotado local y remoto: `respaldo/pre-reconciliacion-2026-08-21` en `0ab2478`.
- Directorio: `C:\dev\vip-fitness-backups\2026-08-21-pre-reconciliacion`.
- Bundle Git: `vip-fitness-main-portal-v2.bundle`.
- SHA-256 bundle: `91CE97B5D2CF23DA463D4A9535C58E1360F5D38D5E2579859FECE7EB240CE0C6`.
- Patch del trabajo desprendido del generador: SHA-256 `71CC72187B1763D2893A763F8A724FF157F1F6CFB79A2177095E527DE7C499BC`.
- Continuidad original respaldada como `VIP_FITNESS_CONTINUIDAD_NUEVO_CODEX_antes_de_cierre.md`, SHA-256 `2355828179023E8805C23BC26A7EDD52B6D3DB7EF7DA79EAAC62B048D95BCA74`.
- `HANDOFF_1.33.md` quedó incorporado al repositorio como registro histórico.
- No se borraron ramas, worktrees, respaldos ni cambios ajenos. No se usó `reset --hard`, force-push ni operaciones destructivas.

## Pendientes que requieren acción fuera del código

1. **Supabase Auth:** los enlaces mágicos solicitados con redirección de producción terminan en `localhost:3000`. En Supabase Dashboard se debe ajustar `Authentication > URL Configuration`: `Site URL` a `https://vipfitness.cl` y agregar `https://vipfitness.cl/**` y `https://vip-fitness-v2.vercel.app/**` a Redirect URLs. No se cambió porque la service role no administra esta configuración del proyecto.
2. **Dispositivos físicos:** la emulación iPhone/Android pasó. Conviene hacer una última pasada en un iPhone y un Android reales para vibración, sonido, teclado, cámara/subida de fotos y comportamiento PWA.
3. **Contenido multimedia:** quedan 21 ejercicios sin foto. No se presentaron como completos ni se rellenaron con material inventado; pueden resolverse desde el centro multimedia.
4. **Inventario de poleas:** antes de automatizar saltos de carga por equipo, registrar el incremento real del stack de las poleas. La mejora permanece documentada en `HANDOFF_1.33.md` y no fue improvisada.

## Regla de continuidad

Partir desde `main`, leer este archivo completo y auditar el estado real antes de cualquier cambio. Tratar `portal-v2` como rama histórica ya reconciliada; todo trabajo nuevo debe integrarse a `main` con respaldo, pruebas, commit y push.
