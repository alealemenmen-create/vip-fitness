# HANDOFF FINAL — VIP Fitness

Fecha de cierre: 2026-08-21
Línea principal: `main`
Estado: Portal V2, Generador de Rutinas y Estudio VIP reconciliados, publicados y verificados.

Este es el único handoff vigente. Los handoffs anteriores se conservan como historial y no deben usarse como estado actual.

## Resultado operativo

- Producción principal: https://vipfitness.cl
- Alias V2: https://vip-fitness-v2.vercel.app
- Rama canónica: `main`, sincronizada con `origin/main`.
- Despliegue funcional validado: `dpl_4JgbchRtwpXALH4JWnLFiCC3LBvv` (`Ready`), publicado tanto en `vipfitness.cl` como en el alias V2; ambos dominios fueron inspeccionados y resuelven al mismo artefacto.
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
- `a1491f6` — biblioteca de dos portadas por grupo muscular y selección estable por día.
- `678da09` — descanso automático de Fabiola reactivado, acción clara para activar la cuenta regresiva y bloqueo de zoom limitado a la sesión activa.
- `ba42ff4` — edición libre y autoguardado ordenado de cargas, recuperación del último peso real y progreso por ejercicio.

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

- La pantalla principal de Entrenar usa una biblioteca no destructiva de 16 portadas: dos por cada familia editorial (`pecho`, `espalda`, `hombros`, `brazos`, `piernas`, `glúteos`, `core` y `cardio`). Mantienen las identidades y escenas originales, con mejora corporal leve y realista. La elección depende del grupo principal real del día, alterna de forma estable y reconoce glúteos aunque el esquema histórico los agrupe dentro de piernas. El bloque aplica un degradado inferior uniforme; biblioteca y fichas conservan las fotos técnicas originales.
- Revisión multimedia posterior: la rutina activa ya no amplía el iframe para llenar el cuadro. Fotos y videos grandes usan encaje completo, preservan cabeza, manos y pies, y aceptan material vertical u horizontal con franjas negras cuando la proporción lo requiere.
- El editor de ejercicios incorpora una vista vertical real de la rutina activa para alternar foto/video y revisar el archivo completo antes de publicarlo.
- Diseño comprobado en viewport iPhone `390x844` y Android `412x915`.
- Corregido el desplazamiento horizontal involuntario de la pantalla de entrenamiento.
- Zoom del navegador habilitado para accesibilidad en el portal general (`maximumScale: 5`, `userScalable: true`) y bloqueado únicamente en la rutina activa (`maximumScale: 1`, `userScalable: false`) para evitar pinzas accidentales mientras se entrena. La sesión conserva sus escalas visuales internas.
- Incidencia Fabiola Galleguillos: se confirmó que el reloj general funcionaba y que su descanso estaba guardado como referencia libre (`temporizador_descanso=false`), por eso el número era estático. Se reactivó la preferencia real sin tocar sesión, series, pesos, repeticiones ni progreso. Si cualquier alumno elige descanso libre, la interfaz ahora dice claramente que no hay conteo y ofrece `Activar cuenta regresiva` en las vistas de lista e inmersiva.
- El service worker fue auditado: no intercepta `fetch` ni cachea páginas, por lo que una PWA instalada no puede conservar una versión vieja de la sesión.
- Todos los campos de peso y repeticiones de la sesión activa son editables aunque la serie aún no esté seleccionada ni marcada. El borrador continúa protegiéndose localmente y, además, se sincroniza automáticamente con Supabase tras 650 ms o al salir del campo. Los guardados por ejercicio se serializan para impedir que una respuesta antigua sobrescriba un valor nuevo; la pantalla muestra `Guardando…`, `Guardado` o `En dispositivo`.
- La carga inicial reutiliza la prioridad compartida con V1: valor ya guardado en la sesión, luego sugerencia aprobada/modificada de Impulso VIP y, en ausencia de ella, último peso real del alumno. Las recomendaciones propuestas, bloqueadas o de peso corporal no inventan una carga.
- Cada nombre de ejercicio muestra el avance de sus propias series (`1 de 3`, etc.) en vista de lista, contraída y de video. Al completar todas cambia a check verde y `Realizado`.
- Teclado móvil reforzado en todos los inputs de sesión: las series no activas ya no usan `readOnly`, el input conserva el toque/foco sin que lo intercepte la fila o el arrastre, repeticiones abre teclado numérico y peso teclado decimal. En pantallas táctiles se usa fuente de 16 px para evitar zoom de enfoque en iOS y margen inferior para que el teclado no cubra el campo.
- Vista inmersiva refinada contra la referencia visual entregada: foto y video conservan el cuerpo completo sin recorte, el reproductor queda por debajo del degradado superior/inferior, el lienzo se limita al ancho móvil y Ajustes/Vista de lista se reubicaron junto a la identidad del ejercicio. Los chips de acciones mantienen todas sus funciones, con mejor área táctil y desplazamiento horizontal estable.
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
- Suite completa: 82 archivos, 636/636 tests aprobados.
- Build de producción: Next.js 16.3.1, 72 páginas, aprobado.
- Corrección de sesión activa (`678da09`): ESLint aprobado; TypeScript aprobado; suite completa 82 archivos y 635/635 tests; build de 72 páginas aprobado.
- Autoguardado de cargas (`ba42ff4`): ESLint y TypeScript aprobados; 12/12 pruebas enfocadas; suite completa 82 archivos y 636/636 tests; build de 72 páginas aprobado. Consulta posterior de solo lectura confirmó la geometría real de 13 ejercicios y 17 series ya guardadas de la sesión activa auditada, sin modificar sus datos.
- QA posterior al despliegue: viewport publicado `width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, interactive-widget=resizes-visual`; sin overflow horizontal, overlay ni errores/advertencias de consola. Logs de Vercel sin errores durante la comprobación.
- Refinamiento visual de sesión inmersiva: ESLint, TypeScript, suite completa 82 archivos/636 tests y build de 72 páginas aprobados.
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
