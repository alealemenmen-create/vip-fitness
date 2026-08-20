# HANDOFF 1.32 — Publicar Portal VIP v2 en producción (vipfitness.cl)

Fecha: 2026-08-20

## Lo que pidió Alejandro

1. Levantar el portal v2 en local para probar el entrenamiento.
2. Unir la rama `portal-v2` (el rediseño grande) con `main`, para que al
   entrar a **vipfitness.cl** y activar el botón que habilita la v2 por
   alumno (desde su panel de administrador), el alumno vea la versión
   **actualizada** — la de anoche — y no una vieja.
3. No quiere tener que entrar a Vercel para nada de esto. Solo quiere
   entrar a vipfitness.cl y que funcione.
4. Pidió que quede un registro escrito de qué pidió y qué se hizo.

## Lo que se hizo (todo confirmado, no son suposiciones)

1. **Local**: servidor de desarrollo levantado en `localhost:3001`
   (`.claude/launch.json`, config `vip-fitness`, puerto 3001). Se probó
   `/portal-v2/entrenamiento` con datos reales, sin errores.
2. **Git — unir main dentro de portal-v2**: `git merge main` sobre
   `portal-v2`, sin conflictos (traía los 2 fixes de Impulso VIP que
   `main` tenía y `portal-v2` no: `9b71c15` y `f6e6153`).
3. **Push de portal-v2 a GitHub**: confirmado, rama remota actualizada.
4. **Verificación antes de tocar producción**:
   - Diferencia real entre `main` y `portal-v2`: 245 archivos,
     +24.456 / -1.771 líneas. Incluye 17 migraciones nuevas de Supabase
     (`0104` a `0117`: personalización de sesión v2, comunidad,
     recompensas VIP, catálogo nutricional, piloto portal v2, etc.).
   - Se confirmó por API (REST de Supabase, sin exponer claves) que esas
     17 migraciones **ya están aplicadas** en la base de datos real —
     dev y producción comparten la misma base (`iowu...`), no hay bases
     separadas. Cero riesgo de tablas faltantes.
   - Se corrió `npm run build` completo sobre `portal-v2`: compiló
     limpio, sin errores ni warnings, generó todas las rutas (las viejas
     de `/alumno` y `/admin`, y las nuevas de `/portal-v2/*`).
4. **`main` actualizado en GitHub**: `git push origin portal-v2:main`
   (fast-forward, sin merge commit adicional porque `main` ya era
   ancestro de `portal-v2`). Confirmado con `git ls-remote`: `main` y
   `portal-v2` apuntan al mismo commit (`9c6c4b0`).

## El problema que quedó pendiente — no es del código

Al revisar los despliegues de Vercel (`vercel ls`) se encontró que
**los últimos despliegues de producción vienen fallando desde hace
~15 horas**, con el mismo error, incluso en commits que no tienen nada
que ver con este trabajo:

```
Error: The NEXT_DEPLOYMENT_ID environment variable value "dpl_XXXX"
does not match the provided deploymentId "YYYY" in the config.
```

Esto pasó también en un despliegue de hace 3 horas (commit viejo,
`f6e6153`, antes de este trabajo) — confirma que es un problema de
**caché de build corrupta del lado de Vercel**, no algo que introdujo
este merge. No se encontró ninguna variable de entorno `NEXT_DEPLOYMENT_ID`
seteada a mano en el proyecto (se revisó con `vercel env ls`, es de
solo lectura) — es interno de la plataforma.

**Consecuencia real:** aunque `main` en GitHub ya tiene la v2 completa,
`vipfitness.cl` sigue sirviendo un build de hace ~15 horas hasta que se
resuelva ese error de caché.

## Causa real encontrada (no era caché de Vercel)

Alejandro hizo el redeploy manual sin caché que se sugería más abajo, y
**siguió fallando con el mismo error**. Eso descartó la teoría de la
caché corrupta y llevó a revisar el código.

La causa real estaba en `next.config.ts`:

```ts
deploymentId: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || process.env.NEXT_DEPLOYMENT_ID,
```

Este `deploymentId` personalizado (el SHA de git, recortado a 12
caracteres) se agregó antes para que Next detecte cuando el celular de
un alumno sigue con el JavaScript del despliegue anterior abierto, y
fuerce una recarga completa en vez de mezclar versiones. El comentario
original ya documentaba un incidente previo relacionado (el límite de
32 caracteres de Vercel), pero no bastaba: **Vercel exige que ese ID
coincida exactamente con su propio `NEXT_DEPLOYMENT_ID` interno**
(`dpl_...`). Como en Vercel `VERCEL_GIT_COMMIT_SHA` siempre existe, la
rama del SHA se usaba siempre y nunca coincidía con el ID real de
Vercel → build rechazado, cada vez, caché o no caché.

**Arreglo aplicado** (`next.config.ts`): se cambió a usar directamente
`process.env.NEXT_DEPLOYMENT_ID` (el ID que Vercel ya provee solo, sin
inventar uno propio). Logra el mismo objetivo — un ID distinto en cada
despliegue, fuerza recarga completa si el celular quedó con JS viejo —
sin chocar con la validación de Vercel. Verificado con `npm run build`
local: compila limpio, igual que antes.

## Despliegue confirmado en vivo

Después del arreglo, el push a `main` disparó un despliegue nuevo en
Vercel que salió **Ready** (verde) — el primero en salir bien en horas.
Se confirmó con `vercel inspect --logs` que el despliegue en Producción
corresponde exactamente a `main`, commit `a119645`. Se entró a
`https://vipfitness.cl` desde el navegador de Claude y el sitio
responde con esa versión (no se inició sesión — entrar contraseñas no
es algo que Claude deba hacer).

## Susto de acceso — revisado y descartado

Alejandro se preocupó al ver que se había "unido" todo: temió que al
entrar los alumnos, todos fueran a parar directo al portal nuevo sin
que él lo autorizara. Se revisó el código real (no una suposición) y
la protección está en 3 capas independientes, ninguna tocada por este
trabajo:

1. **Migración 0116**: la columna `alumno_perfil.portal_v2_habilitado`
   es `boolean not null default false` — por diseño, publicar la v2
   nunca cambia la experiencia de nadie que no fue invitado.
2. **Login** ([`src/app/login/actions.ts:45`](src/app/login/actions.ts:45)):
   si esa columna no está en `true`, el alumno entra a `/alumno/inicio`
   (el portal de siempre), no a la v2.
3. **Layout de portal-v2** ([`src/app/portal-v2/layout.tsx:27`](src/app/portal-v2/layout.tsx:27)):
   aunque alguien escriba a mano una URL de `/portal-v2/...`, si no
   tiene el permiso lo rebota a `/alumno/entrenar`.

Conclusión: **nadie ve el portal nuevo salvo el alumno puntual que
Alejandro habilite con su botón**, exactamente como se pidió.

## Estado final (2026-08-20)

- GitHub `main`: actualizado, con toda la v2, los 2 fixes de Impulso
  VIP, y el arreglo del `deploymentId`. ✅
- Base de datos: todas las migraciones que necesita v2 ya aplicadas. ✅
- Build de producción: probado en limpio, compila sin errores. ✅
- `vipfitness.cl` en vivo: **desplegado y confirmado**, sirviendo
  `main` commit `a119645`. ✅
- Acceso controlado por alumno: confirmado en el código, sin cambios
  respecto a lo diseñado — solo entra a v2 quien Alejandro habilita. ✅
- Pendiente para la próxima sesión: probar el entrenamiento con un
  alumno real o de prueba ya en producción, y revisar el panel nuevo
  de administrador/alumno en vivo.
