# HANDOFF 1.4 — Todo commiteado, fusionado a main y en producción real

**Fecha:** 3 de agosto de 2026
**Estado:** limpio. `main` y `fix/tarjetas-modelo-fondo-negro` apuntan al mismo
commit, ya en GitHub, ya desplegado en producción por Vercel.

---

## PUNTO DE REGRESO

| | |
|---|---|
| Rama | `fix/tarjetas-modelo-fondo-negro` (== `main`, mismo commit) |
| Último commit | `f738037` — "El Asistente VIP puede armar solicitudes de borrado de datos, con confirmacion humana" |
| Trabajo pendiente sin commitear | **ninguno** — `git status` limpio |
| Producción | `main` ya tiene este commit en `origin/main`, Vercel lo despliega solo (1-3 min desde el push) |

Para volver a este punto exacto en cualquier máquina/cuenta:
```bash
git fetch origin
git checkout f738037
```

---

## QUÉ SE HIZO (resumen de toda la sesión — el detalle línea por línea está
en los mensajes de commit de `61f7133`, `b931088` y `f738037`)

### Diseño (Inicio, Entrenar, Progreso, Ranked) — commit `61f7133`
Tarjeta "Tu Entrenamiento" más llena (texto y modelo más grandes), headers
compactos iguales a Entrenar/Nutrición en Progreso y Ranked, campanita de
noticias convertida en toggle real, "Mi Historial" (entrenamiento + comida +
puntos, con impresión), Ranking VIP interactivo (tocar a un alumno muestra en
qué categoría ganó puntos, sin exponer alimentación ajena), política de uso y
privacidad (borrador), canal de "Sugerencias de hoy" en `/admin/alumnos`,
scrollbar del ranking reemplazada por un riel animado propio, y un warning de
consola preexistente corregido (`next/script` con `beforeInteractive`).

### Cronómetro de rutina + temporizador de descanso — commit `b931088`
- El cronómetro vive en `entrenar/sesion/[id]/page.tsx`, junto al título,
  ANCLADO a `rutina_iniciada_en` (migración 0040) — no a la hora de creación
  de la sesión. La rutina queda bloqueada (no se puede marcar nada) hasta
  tocar "Iniciar rutina" ahí mismo.
- Botón "Iniciar entrenamiento" ahora tiene un segundo botón "Ver
  entrenamiento" al lado (mismo form, misma acción) — antes solo aparecía
  cuando el estado era "en progreso", faltaba para "no iniciado".
- El temporizador de descanso ("Recupérate") ancla su fin a una hora real en
  `localStorage` (`lib/entrenamiento/descanso.ts`) — sobrevive cambiar de
  pestaña sin pausarse ni reiniciar.

### El Asistente VIP puede armar solicitudes de borrado de datos — commit `f738037`
El entrenador le pide al chat de IA (`/admin/asistente`, "Pregúntale a la
IA"), por ejemplo, *"borra el historial de entrenamiento de Fulano"*.

**La IA nunca borra nada directamente.** Clasifica alumno + categoría
(entrenamiento/comida/progreso/ranking), cuenta en modo solo-lectura, y arma
una fila `pendiente` en `solicitudes_eliminacion_datos` (migración 0041,
mismo patrón que `borradores_noticias`: propone, un humano confirma aparte).
La tarjeta roja de confirmación reusa `EliminarPerfilBoton` (el mismo
componente de confirmación en dos pasos de "Eliminar alumno"). Pedidos
ambiguos (sin alumno, o sin categoría clara) piden que se aclare, nunca
adivinan. Borrar una categoría no toca los Puntos VIP de otra (decisión
explícita del dueño).

**Verificado en vivo de punta a punta contra datos reales** (Alejandro
Mendoza): propuesta con conteo real → confirmación → borrado real → Puntos
VIP intactos → caso ambiguo pide aclaración. `npm run build` limpio.

---

## FUSIÓN A PRODUCCIÓN (esta sesión)

`main` no se había movido desde que arrancó esta rama (ni un commit de
diferencia), así que el merge fue **fast-forward puro, sin conflictos**:

```bash
git checkout main
git merge --ff-only origin/fix/tarjetas-modelo-fondo-negro
git push origin main
git checkout fix/tarjetas-modelo-fondo-negro
```

Confirmado con `git fetch origin main`: `origin/main` quedó en `f738037`,
mismo commit que la rama de trabajo. El dueño lo corrió él mismo en su
propia terminal (no yo) — importante: **el dueño pidió explícitamente correr
estos comandos de git él mismo**, no que Claude los ejecute directo.

---

## PENDIENTE (no bloqueante, liviano)

1. **Bug menor de UI ya detectado, sin arreglar:** tras confirmar un borrado
   de datos, la tarjeta de `EliminarPerfilBoton` se queda en su estado
   "¿Confirmás?" en vez de mostrar un mensaje de "listo, se borró" — el
   borrado funciona bien igual, es solo cosmético. Ver el detalle de la
   causa y la solución sugerida en el mensaje de este handoff en la sesión
   anterior (o preguntar, se puede re-explicar rápido).
2. `cancelarEliminacionDatos` existe pero no está conectado a ningún botón
   real todavía — el "Cancelar" de `EliminarPerfilBoton` hoy es solo un
   cierre de UI local. La fila queda `pendiente` en vez de `cancelado` si el
   entrenador se arrepiente. Cosmético/de auditoría, no urgente.
3. Confirmar que el deploy de producción en Vercel terminó en estado
   "Ready" y probar ahí mismo (con datos reales del gimnasio) que todo
   funciona — se hizo el push, pero no se verificó la URL de producción real
   desde esta sesión (no se tenía guardada la URL exacta).

---

## DECISIONES QUE CONVIENE NO PERDER

- **Cronómetro de rutina** ancla a `rutina_iniciada_en`, no a `hora_inicio`
  de la sesión.
- **Temporizador de descanso** ancla a una hora real en `localStorage`, no a
  un contador en memoria.
- **El Asistente VIP nunca ejecuta un borrado él solo** — cualquier
  categoría nueva que se agregue en el futuro tiene que seguir el mismo
  molde: proponer → fila `pendiente` → confirmación humana aparte.
- **Comandos de git que tocan `main`/producción: el dueño los corre él
  mismo**, Claude solo los redacta. Quedó explícito esta sesión después de
  una confusión — no volver a ejecutar `git checkout main` / merge / push a
  `main` directamente sin que el dueño lo pida así.

---

## CONVENCIÓN DE HANDOFFS

Este es **HANDOFF 1.4**. El siguiente va `HANDOFF_1.5.md`. Cuando el dueño
pida "lee el handoff", se lee **el último** (el de número más alto) — que
ahora es este. `HANDOFF_1.3.md` se borró por pedido explícito del dueño.
