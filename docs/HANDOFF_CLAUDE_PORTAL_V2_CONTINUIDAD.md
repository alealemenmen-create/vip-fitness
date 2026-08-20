# Continuidad de Portal VIP Fitness V2 con Claude Code

Lee este documento completamente antes de ejecutar comandos o editar archivos.
Este encargo es para continuar **Portal V2**, no el Portal V1.

## 1. Ubicación, rama y límites

- Repositorio local de trabajo: `C:\dev\vip-fitness-v2`.
- Repositorio GitHub: `https://github.com/alealemenmen-create/vip-fitness.git`.
- Rama autorizada: `portal-v2`.
- Portal original activo: `C:\dev\vip-fitness`, rama `main`.
- No edites `C:\dev\vip-fitness`, no hagas merge a `main`, no hagas rebase de
  `main`, no uses `reset --hard` y no borres cambios ajenos.
- Puedes editar, probar, crear commits pequeños y hacer push **únicamente** a
  `origin/portal-v2`.
- No crees PR ni fusiones ramas sin autorización expresa del propietario.
- Supabase es el proyecto activo con alumnos reales. No apliques SQL, no borres
  datos y no hagas escrituras de prueba sobre alumnos reales sin autorización.
- No muestres, copies a mensajes ni confirmes valores de `.env*`. El worktree V2
  ya tiene su entorno local configurado.

## 2. Forma obligatoria de trabajar

Antes de cada bloque:

1. Ejecuta `git status --short --branch` y conserva cambios preexistentes.
2. Lee la implementación actual antes de modificarla.
3. Trabaja una sola causa o flujo por commit.
4. Ejecuta pruebas focalizadas, TypeScript, ESLint y `npm run build` según riesgo.
5. Revisa `git diff --check` y el diff exacto.
6. Crea un commit descriptivo y haz `git push origin portal-v2` sólo si todo pasa.
7. Nunca declares resuelto algo que no probaste funcionalmente.

Después de cada corte estable crea un bundle incremental en:

`C:\dev\vip-fitness-backups\2026-08-19-corte-portal-v2`

y registra su SHA-256 en `SHA256SUMS.txt`. No sobrescribas respaldos anteriores.

## 3. Cómo levantar y probar localmente

Desde `C:\dev\vip-fitness-v2`:

```powershell
npm install
npm run dev -- -p 3100
```

El propietario entra en `http://localhost:3100/login` con sus mismas
credenciales. El almacenamiento de sesión es independiente por origen, por lo
que puede necesitar iniciar sesión nuevamente. Al apuntar al Supabase activo,
cualquier asignación o registro real modifica información real; usa cuentas y
acciones de prueba sólo con autorización.

Enlace estable de prueba publicado:

`https://vip-fitness-v2.vercel.app/portal-v2/entrenamiento`

No uses enlaces inmutables antiguos con nombres aleatorios. No despliegues a
Vercel hasta que el propietario lo pida expresamente en esa sesión.

## 4. Estado técnico actual

La experiencia V2 vive bajo `/portal-v2` y reutiliza la autenticación, rutinas,
sesiones, alimentos, progreso y datos reales del portal original, adaptándolos
al lenguaje visual V2.

Implementado hasta este corte:

- Entrenamiento principal, rutina, programas, historial y sesión activa.
- Dos experiencias distintas: lista y video.
- Descanso en lista insertado entre series con `-15 s` y `+15 s`.
- Descanso inmersivo sólo para la vista de video.
- Corrección crítica: una sincronización/restauración ya no convierte el
  descanso inline en descanso inmersivo. La regla está en
  `resolverVistaAlRestaurarDescanso` y tiene prueba de regresión.
- Navegación serie por serie, con descanso intermedio.
- Cierre con continuar después, registrar entrenamiento o salir y descartar.
- Ficha técnica individual al tocar la miniatura; `Vista de video` continúa
  reservada a la rutina completa.
- Impulso automático “Alejandro”, técnicas avanzadas y persistencia parcial.
- Nutrición V2 con búsqueda, cantidades, eliminación y fallback de alimentos.
- Progreso, seguimiento, comunidad, ranking, Más, perfil, soporte y legales en
  distintos niveles de terminación.
- Acceso V2 controlado desde el panel y enlace estable de pruebas.

Commits críticos recientes que debes conservar:

- `18a2777`: mantener descanso inline al restaurar sesión.
- `b820ce2`: ficha técnica individual del ejercicio.
- `4027fdc`: flechas de navegación sin burbuja.
- `a6f8953`: separar descanso de lista y video.
- `2da7158`: descanso programado por ejercicio y ajustes de 15 segundos.

Comprueba el HEAD real de `origin/portal-v2`; este documento puede recibir un
commit posterior sin cambiar esas correcciones.

## 5. Reglas de producto y diseño

- Todo debe estar en español profesional.
- Fondo negro profundo, blancos claros y jerarquía legible para personas
  mayores; simetría, alineación y espaciado son requisitos, no adornos.
- La referencia visual y de interacción es Standrd, pero no copies marcas,
  textos ni activos protegidos. Mantén identidad VIP Fitness.
- Todo botón visible debe tener acción o destino real y una vía clara de vuelta.
- Lo traído desde V1 debe adoptar completamente el diseño V2.
- No reemplaces errores o ausencia de datos reales con datos demo engañosos.
- Prioriza iPhone 13 Pro Max y Android angosto, sin romper escritorio.

## 6. Orden de trabajo pendiente

### Prioridad 0 — sesión entrenable sin interrupciones

1. Reproduce en móvil real lista → check → descanso inline → siguiente serie.
2. Confirma que guardar, restaurar, cambiar de pestaña y volver no abren el
   descanso inmersivo cuando el origen fue lista.
3. Confirma video → check → descanso inmersivo → siguiente serie.
4. Comprueba sonido, vibración, aviso, `-15/+15`, saltar descanso y último check.
5. Comprueba continuar después, registrar y descartar sin pérdida o duplicación.
6. Revisa la ficha individual y que tocar la miniatura nunca active la rutina
   completa en video.

### Prioridad 1 — entrenamiento completo

- Verificar todas las técnicas: biserie, triserie, superserie, serie gigante de
  cuatro ejercicios, circuito, fallo, FST-7, dropset, rest-pause y demás lógica
  existente. Cada técnica requiere orden, descanso y persistencia correctos.
- Auditar Impulso Alejandro: automático, escaso y sorpresivo; usa historial,
  repeticiones, carga, RIR, constancia y tipo de equipo. No debe pedir respuesta
  en cada serie ni proponer incrementos absurdos.
- Completar conexiones de Consejo, Historial, Notas, Cambiar, Orden e Información.

### Prioridad 2 — nutrición operativa

- Mantén el diseño V2. Reutiliza la lógica válida de V1 sin portar sus tarjetas.
- Open Food Facts es complemento externo incompleto, no fuente única. Conserva
  caché/fallback y deja preparada una base curada chilena con marcas y productos
  reales. Existe material en `C:\dev\vipfitness_nutricion`.
- Verifica buscador, escáner, cálculos rápidos, copiar comidas, porciones,
  horarios de Chile, metas y diarios de hoy/ayer.

### Prioridad 3 — progreso, comunidad y ranked

- Recuperar progreso histórico real sin reiniciar puntos, pesos, fotos ni
  sesiones.
- Ranking con puntos auditables, límites contra trampas, retos y premios.
- Comunidad conectada con progreso y logros, sin publicaciones inventadas.
- Seguimiento y dashboard con estados vacíos/errores honestos.

### Prioridad 4 — Más, perfil, configuración y panel del entrenador

- Completar flujos de punta a punta y mantener diseño V2.
- El administrador debe poder entrar a V2 y habilitar V2 por alumno.
- El modo “ver como alumno” debe ser explícito, seguro y respetar permisos.
- No confirmes guardados si Supabase no afectó realmente una fila.

## 7. Migraciones y dependencias externas pendientes

- `supabase/migrations/0112_perfil_v2_consistente.sql`: preparada, no asumir que
  está aplicada. Requiere revisión y autorización antes de ejecutar.
- `0062_seguimiento_integral.sql`: Supabase activo no tenía
  `seguimiento_revisiones`; revisar antes de aplicar.
- Push necesita configuración VAPID para completarse.
- Términos y privacidad requieren revisión legal.
- Redes sociales necesitan URLs definitivas si se habilitan.

## 8. Entrega y handoff obligatorio

Mantén actualizado:

`C:\dev\vip-fitness-v2\HANDOFF_CLAUDE_PORTAL_V2_RESULTADO.md`

Debe incluir:

- commit inicial, commits creados y último push;
- archivos modificados y motivo;
- causa raíz de cada problema y prueba que evita su regreso;
- comandos y resultados de TypeScript, ESLint, tests y build;
- recorridos móviles comprobados y cuáles no;
- SQL propuesto pero no aplicado;
- riesgos, dependencias externas y sección `NO TERMINADO`;
- instrucciones exactas para que Codex revise, acepte o rechace cada bloque.

Cuando termines un bloque, no hagas merge a `main`. Pide al propietario que
diga a Codex: **“revisa el trabajo de Claude en portal-v2”**.
