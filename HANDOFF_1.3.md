# HANDOFF 1.3 — Asistente VIP puede borrar datos puntuales (verificado, listo para commitear)

**Fecha:** 3 de agosto de 2026
**Estado:** rama `fix/tarjetas-modelo-fondo-negro`, feature completa y **verificada
en vivo de punta a punta**. Sin commitear todavía.

---

## PUNTO DE REGRESO

| | |
|---|---|
| Rama | `fix/tarjetas-modelo-fondo-negro` |
| Último commit | `b931088` — "Muestra Ver entrenamiento tambien cuando el dia no se inicio" (ya en GitHub) |
| Trabajo nuevo | **sin commitear**, verificado en vivo, listo para commit + push + tag de respaldo |

Archivos sin commitear ahora mismo:

```
M  src/app/admin/asistente/actions.ts
M  src/components/admin/AsistenteVipPanel.tsx
M  src/lib/ai/asistenteConsultas.ts
M  src/lib/asistente/tipos.ts
M  src/lib/supabase/types.ts
?? src/lib/asistente/eliminacion.ts
?? supabase/migrations/0041_solicitudes_eliminacion_datos.sql
```

**Migración 0041 — el dueño ya la corrió en Supabase.** El código ya la usa.

---

## QUÉ SE HIZO (esta sesión, resumen — para el detalle de diseño de Inicio/
Entrenar/Progreso/Ranked/Historial/política de privacidad, y de los ajustes
de cronómetro de rutina + temporizador de descanso, ver el commit `61f7133`
y `b931088`, ya en GitHub)

### El Asistente VIP (admin) puede armar una solicitud de borrado de datos — VERIFICADO

Pedido del dueño: el entrenador le escribe al chat de IA, por ejemplo, *"borra
el historial de entrenamiento de Alejandro Mendoza"*, y el asistente lo
prepara para borrar.

**Diseño de seguridad (no tocar sin pensarlo):** la IA **nunca borra nada
directamente**. Clasifica alumno + categoría
(entrenamiento/comida/progreso/ranking), cuenta en modo solo-lectura, y graba
una fila `pendiente` en `solicitudes_eliminacion_datos` (migración 0041,
mismo patrón que `borradores_noticias`). Recién ahí `AsistenteVipPanel.tsx`
muestra una tarjeta roja con el detalle y reusa `EliminarPerfilBoton`
(confirmación en dos pasos, el mismo componente que ya usa "Eliminar
alumno") para el borrado real, vía `confirmarEliminacionDatos`
(`admin/asistente/actions.ts`).

Decisión ya tomada con el dueño: borrar `entrenamiento`/`comida`/`progreso`
**no** toca los Puntos VIP — son categorías independientes.

**Probado en vivo, contra datos reales de Alejandro Mendoza, todo funcionó:**
1. Pedido concreto → propuso "12 sesiones de entrenamiento" sin borrar nada.
2. Confirmación en dos pasos → borró de verdad: historial y sesión en curso
   desaparecieron, calendario volvió a estado limpio.
3. Puntos VIP intactos (756 pts, sin cambios) — confirma que las categorías
   son independientes.
4. Pedido ambiguo ("borra su historial", sin categoría) → pidió que aclare,
   no adivinó.

`npm run build` limpio.

Archivos nuevos/tocados: `src/lib/asistente/eliminacion.ts` (conteo + borrado
real por categoría, incluye limpiar el archivo de Storage de fotos de
progreso), `src/lib/ai/asistenteConsultas.ts` (rama `eliminar_datos` en el
clasificador), `src/lib/asistente/tipos.ts`, `src/lib/supabase/types.ts`
(tipos de la tabla nueva), `admin/asistente/actions.ts`
(`confirmarEliminacionDatos`/`cancelarEliminacionDatos`), `AsistenteVipPanel.tsx`.

---

## PENDIENTE (no bloqueante)

1. **Commitear + push + tag de respaldo** de todo lo de arriba (mismo
   criterio que `respaldo-2026-08-03-fin-sesion`).
2. **Bug menor de UI, ya detectado, sin arreglar todavía:** después de
   confirmar un borrado, la tarjeta de `EliminarPerfilBoton` se queda en su
   estado "¿Confirmás?" (con los botones "Sí, eliminar definitivamente" /
   "Cancelar" visibles) en vez de mostrar un mensaje claro de "listo, se
   borró". El borrado funciona bien igual — es solo que no queda visualmente
   claro que ya terminó. Causa: `confirmarEliminacionDatos` no hace
   `redirect()` (a propósito, se queda en la misma pantalla del chat), y
   `EliminarPerfilBoton` no tiene un estado "éxito" — solo vuelve a
   `confirmando: false` si el usuario toca "Cancelar" a mano. Si se retoma:
   la opción más simple es que el panel oculte la tarjeta roja entera cuando
   `state.ok` sea `true` (agregar ese caso en `AsistenteVipPanel.tsx`,
   pasándole el `state` de vuelta o levantando un mensaje de éxito propio en
   vez de reusar `EliminarPerfilBoton` tal cual).
3. `cancelarEliminacionDatos` existe (marca la solicitud como `cancelado`)
   pero no está conectado a ningún botón todavía — el "Cancelar" de
   `EliminarPerfilBoton` hoy es solo un cierre de UI local, no llama a esa
   acción. No es un bug (nada se borra sin confirmar), pero la fila queda
   `pendiente` para siempre en vez de `cancelado` si el entrenador se
   arrepiente. Cosmético/de auditoría, no urgente.

---

## DECISIONES QUE CONVIENE NO PERDER

- **Cronómetro de rutina** vive en `entrenar/sesion/[id]/page.tsx`, ancla su
  hora de inicio a `rutina_iniciada_en` (migración 0040, ya aplicada) — NO a
  `hora_inicio` de la sesión. La rutina queda bloqueada hasta tocar "Iniciar
  rutina" en esa pantalla.
- **Temporizador de descanso** ("Recupérate") ancla su fin a una hora real en
  `localStorage` (`lib/entrenamiento/descanso.ts`) — sobrevive cambiar de
  pestaña.
- **El Asistente VIP nunca ejecuta un borrado él solo.** Cualquier categoría
  nueva que se agregue en el futuro tiene que seguir el mismo molde:
  proponer → fila `pendiente` → confirmación humana aparte, con
  `EliminarPerfilBoton` o equivalente.

---

## CONVENCIÓN DE HANDOFFS

Este es **HANDOFF 1.3**. El siguiente va `HANDOFF_1.4.md`. Cuando el dueño
pida "lee el handoff", se lee **el último** (el de número más alto) — que
ahora es este. `HANDOFF_1.2.md` se borró por pedido explícito del dueño: era
un punto de regreso a mitad de verificación, ya superado por este.
