# Handoff — 2026-08-02 — Tarjetas con fondo negro y limpieza de respaldos

## Dónde está todo

- **Repo**: `C:\dev\VIP` — esta es la carpeta correcta. Si abrís el proyecto
  desde otro lado, primero hacé `git log -1` y comparalo con el commit de
  abajo antes de tocar nada.
- **Rama**: `fix/tarjetas-modelo-fondo-negro`
- **Último commit**: `659ffe9`
- **Tag de respaldo de fin de sesión**: `respaldo-2026-08-02-fin-sesion`
  (apunta a `659ffe9`, ya está en GitHub)
- **Preview en Vercel** (deploy `Ready`, no toca producción/`main`):
  https://vip-fitness-center-git-fix-98b01a-alealemenmen-creates-projects.vercel.app
  Esta URL de "alias de rama" se actualiza sola con cada push a esta rama —
  no hace falta pedir una nueva cada vez.

## Qué se hizo hoy (resumen)

1. **Arreglo real de un bug**: en el portal del alumno, un `padding-top` en
   el contenedor que scrollea hacía que la cabecera `sticky` no llegara al
   borde real — por esa rendija de 4px pasaba contenido al deslizar. Se
   sacó el padding; el aire lo pone la cabecera misma.
2. **Panel del entrenador**: cabecera (logo + botones) y título de cada
   pestaña quedan fijos arriba al scrollear, mismo criterio que el punto 1
   pero con la cabecera como hermano `fixed`, no `sticky`, para que un
   padding futuro no rompa lo mismo de nuevo.
3. **Tarjetas con el modelo (fondo negro fijo)**: las fotos de grupo
   muscular son de estudio sobre fondo negro; sobre el tema claro se veían
   manchas. En vez de perseguir el recorte, la tarjeta del día en Entrenar y
   la de "Tu Entrenamiento" en Inicio quedan siempre en oscuro
   (`.tarjeta-modelo-oscura` en `globals.css`), sea cual sea el tema.
4. **Dos rondas de limpieza de las fotos** (`public/grupos-musculares/*.webp`):
   - Reconstrucción de color desde las `.jpg` originales + relleno de
     agujeros internos (agujeros del recorte que no llegan al borde).
   - Componentes conexas: se detectaron manchas de color SUELTAS,
     desconectadas del cuerpo (restos del recorte original, sobre todo cerca
     del short) — se borran, conservando solo la silueta principal. Scripts:
     `scripts/rehacer-recorte-fotos-grupos.mjs` y
     `scripts/limpiar-manchas-sueltas.mjs`.
5. **Tarjeta "Tu Entrenamiento" en Inicio**: probamos versión centrada y
   grande, no convenció. Se volvió al layout viejo (texto a la izquierda,
   modelo a la derecha, sin círculo negro) y se achicó la tarjeta completa
   ~27% de alto (pedían 30%; agrandar el modelo y achicar la tarjeta tiran
   para lados opuestos, se priorizó la tarjeta compacta — está documentado
   en el mensaje del commit `659ffe9`).
6. **Se recuperó y respaldó trabajo disperso**: había tres copias del
   proyecto en la máquina (`C:/dev/VIP`, una carpeta de Codex con 8 commits
   sin subir, y un worktree viejo en OneDrive). Los 8 commits de Codex ya
   están en GitHub como rama `codex/progreso-vip-implementation` — **no
   están integrados con lo de hoy**, son dos líneas de trabajo separadas. El
   worktree de OneDrive (sin nada propio) se borró.

## Pendiente — en orden de importancia

1. **Fusionar `codex/progreso-vip-implementation` con `fix/tarjetas-modelo-fondo-negro`.**
   55 archivos se tocan en ambas ramas (asistente IA, torneos, ranking,
   admin) — no es un merge trivial, hacerlo como tarea propia, de a
   bloques, con build real después de cada uno. Esto es lo más importante
   pendiente: esa rama tiene funcionalidad real (Asistente VIP, Arena,
   ranking) que no existe en la que quedó como base hoy.
2. Recién después de integrar esas dos ramas y probarlas juntas, fusionar a
   `main` (producción real).
3. Bug de scroll en Nutrición, diagnosticado pero sin corregir —
   `INFORME_ERROR_SCROLL_NUTRICION.md`, en la raíz del repo.
4. Dos carpetas sin commitear en la copia de Codex
   (`src/app/preview-asistente-vip/`, `src/app/preview-progreso-vip/`) —
   revisar si son features terminadas antes de subirlas.
5. Fotos crudas sin procesar en `_fotos_ejercicios_staging/`, con la lista
   de duplicados a resolver en `_pendientes_procesamiento.md`.

## Regla para la próxima sesión

La única copia que importa es la que está en GitHub. Si en algún momento no
estás seguro de qué versión estás viendo, pedí explícitamente: **"Volvé al
respaldo `respaldo-2026-08-02-fin-sesion`"** — es inequívoco, apunta a un
commit exacto, y funciona aunque sea otra cuenta, otra compu, otra carpeta.
