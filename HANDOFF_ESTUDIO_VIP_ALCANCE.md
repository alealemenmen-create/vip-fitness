# Estudio VIP — alcance para la próxima sesión (no empezado)

Fecha: 2026-08-20. Este documento NO es una implementación — es lo que
Alejandro pidió: dejar estipulado el alcance para retomarlo en otra
sesión, sin construir nada todavía.

## De dónde sale esto

Alejandro recordaba haber pedido, al arrancar el proyecto v2, tres
cosas: el portal del alumno, el panel del administrador, y una tercera
que no recordaba cómo se llamaba. Está en
[`docs/PORTAL_VIP_V2_VISION.md`](docs/PORTAL_VIP_V2_VISION.md), la
definición inicial aprobada del 2026-08-18 — **se llama "Estudio VIP"**:

> Puede entrar a `Estudio VIP`, el espacio de administración global y
> diseño. [...] Tiene control sobre roles, contenidos globales,
> configuración y publicación.

Y en la "Etapa 5" de ese mismo documento (la última etapa planeada,
todavía no arrancada):

> Separación completa de entrenador y superadministrador. Vista como
> alumno y edición en contexto. **Configuración visual y de
> contenidos.** Auditoría y publicación controlada.

Es decir: esto ya estaba pensado desde el día 1, con este nombre, como
la etapa final del proyecto — nunca se llegó a construir porque las
etapas anteriores (entrenamiento, nutrición, progreso) vinieron primero,
como estaba planeado.

## Lo que Alejandro pidió hoy, en criollo

Poder configurar la pantalla de la app **para todos los alumnos a la
vez** (no alumno por alumno) — fotos, nombres, botones, "todo lo que es
configuración" — y entender si eso va adentro del panel del
entrenador/administrador que ya existe, o es algo aparte.

Coincide exactamente con "Estudio VIP": es justamente el espacio
pensado para configuración *global*, separado del panel de
entrenador/administrador que ya existe (que trabaja alumno por alumno).

## Lo que hay que resolver ANTES de escribir código

1. **Rol**: la visión original habla de un rol "Superadministrador",
   distinto de "admin" y "entrenador". Hoy la base de datos solo tiene
   esos dos roles (más "alumno") — no existe un cuarto rol literal.
   Además, hoy en toda la base **solo una cuenta tiene rol `admin`** (la
   de prueba QA) — la cuenta real de Alejandro es `entrenador` (ver
   [`HANDOFF_1.32.md`](HANDOFF_1.32.md), arreglado hoy para el botón de
   acceso a V2). Hay que decidir: ¿Estudio VIP es para `admin`
   únicamente, o también para `entrenador`? ¿Hace falta un rol nuevo, o
   alcanza con reutilizar `admin`?
2. **Qué es "configurable" y qué no** — la visión dice "fotos, nombres,
   botones" pero no está definido con precisión. Antes de tocar código
   hay que armar una lista concreta, pantalla por pantalla de v2, de qué
   se puede cambiar (¿textos fijos? ¿fotos de portada? ¿colores del
   tema, ya cubiertos por el sistema de 4 temas existente? ¿orden de
   botones del menú?) y qué se mantiene fijo (identidad VIP, estructura
   de navegación de 4 destinos, lógica de negocio).
3. **Dónde vive** — ¿una sección nueva dentro de `/admin` existente, o
   una ruta aparte (`/portal-v2/estudio` o similar) con su propio
   diseño, como plantea la visión original ("espacio de administración
   global y diseño", separado del panel de entrenador)?
4. **Alcance real vs. capricho de diseño** — la visión pide que cada
   etapa se apruebe antes de ampliarse (sección 10, "Criterio de
   avance"). Antes de construir, conviene que Alejandro traiga ejemplos
   concretos de qué pantalla/elemento quiere poder cambiar y por qué,
   igual que hizo con las capturas de la app de referencia al empezar
   v2.

## Próximo paso sugerido

Una sesión aparte, empezando por una conversación de alcance (no
código): repasar juntos las pantallas de `/portal-v2/*` una por una y
marcar qué querría poder cambiar Alejandro sin tocar código cada vez.
Recién con esa lista concreta conviene diseñar la estructura técnica
(tabla de configuración global, cómo se sirve a cada pantalla, permisos,
versionado/publicación como pide la visión original).
