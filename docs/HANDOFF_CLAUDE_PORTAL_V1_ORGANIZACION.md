# Encargo para Claude Code — Portal VIP original (V1)

Copia desde “INICIO DEL MENSAJE” hasta “FIN DEL MENSAJE” en Claude Code.

Actualizado el **19 de agosto de 2026**. Este mensaje ya incorpora la separación
entre V1 y V2, el fallo crítico de Impulso VIP y las condiciones de entrega para
que Codex pueda auditar el resultado sin poner en riesgo a los alumnos activos.

---

## INICIO DEL MENSAJE

Trabajarás **exclusivamente en el Portal VIP Fitness original (V1)**. No trabajes
en Portal V2, no portes componentes desde V2 por inercia y no mezcles sus ramas.

### Seguridad obligatoria antes de editar

- Repositorio original y activo: `C:\dev\vip-fitness`.
- Ese `main` atiende a alumnos reales. No lo modifiques, no lo despliegues y no
  ejecutes migraciones ni escrituras de prueba contra Supabase activo.
- No borres, restaures ni incluyas cambios sucios preexistentes del propietario.
- Antes de tocar código, crea un trabajo aislado desde el `main` actual:
  `C:\dev\vip-fitness-v1-claude`, rama `claude/portal-v1-organizacion`.
- Si esa rama o carpeta ya existe, inspecciónala y continúa sin sobrescribir.
- No leas, copies, muestres ni alteres secretos de `.env*`.
- No hagas commit de archivos ajenos ni publiques a GitHub/Vercel.
- Portal V2 vive separado en `C:\dev\vip-fitness-v2`, rama `portal-v2`. Su
  corte verificado al redactar este encargo es `18a2777`. No edites esa carpeta,
  no mezcles commits y no intentes resolver allí las tareas de este mensaje.
- El temporizador de V2 ya distingue descanso en lista y descanso inmersivo de
  video. Ese antecedente sirve sólo como advertencia arquitectónica: no copies
  componentes ni estados de V2 hacia V1 sin demostrar compatibilidad.

### Objetivo general

Reorganiza la experiencia profesional del Portal VIP original para que sea
extraordinariamente clara, rápida y sencilla, **sin perder ninguna función ni
lógica probada**. Toma como referencia la jerarquía, limpieza, legibilidad y
coherencia visual alcanzadas en Portal V2, pero conserva la identidad y la base
funcional del Portal V1. Esto no es un borrado ni una reconstrucción a ciegas:
primero debes inventariar lo que existe y después mejorar su organización.

El propietario necesita operar el gimnasio desde el teléfono sin buscar las
acciones entre muchas pantallas. Cada botón visible debe llevar a una función
real, tener regreso claro y respetar permisos.

### Fase 1 — Auditoría antes de diseñar

1. Lee completamente la arquitectura de `src/app/admin`, los componentes
   administrativos, las acciones del servidor, `src/lib/auth.ts`, los flujos
   de rutinas y la vista segura “como alumno”.
2. Construye un inventario comprobable de todas las funciones actuales:
   alumnos, fichas, seguimiento, rutinas, generador, documentos, alimentos,
   ejercicios, Impulso VIP, puntos, ranking, comunidad, notificaciones,
   soporte, auditoría y configuración.
3. Detecta duplicados, callejones sin salida, acciones difíciles de descubrir,
   nombres confusos y tareas frecuentes que hoy exigen demasiados pasos.
4. No elimines nada sólo porque parezca poco usado. Si propones retirar algo,
   demuestra su reemplazo y déjalo documentado, no lo borres.
5. Antes de implementar, crea en el worktree aislado un archivo de control con
   una matriz `función → ruta → acción de servidor → tabla → rol → estado de
   prueba`. Actualízala a medida que verificas; no marques como operativo un
   botón sólo porque renderiza.

### Fase 2 — Nueva organización profesional

Construye una organización móvil primero, coherente y sobria:

- Inicio profesional con prioridades reales del día, alertas y accesos rápidos.
- Directorio completo, pero agrupado por intención y frecuencia de uso.
- Acciones frecuentes del alumno disponibles desde su ficha: editar/asignar
  rutina, revisar seguimiento, alimentación, progreso, Impulso, documentos y
  acceso a su portal.
- Botones claros y táctiles, tipografía legible, espaciado simétrico, jerarquía
  consistente y estados de carga/error/éxito honestos.
- El mismo lenguaje visual en todas las pantallas nuevas o migradas. No mezcles
  tarjetas viejas con tarjetas nuevas sin adaptación.
- Mantén escritorio funcional, pero prioriza iPhone y Android angostos.
- No conviertas el panel en una portada decorativa: debe reducir tiempo real de
  operación y conservar todos los destinos.

### Fase 3 — “Ver como alumno” con edición segura en contexto

El propietario necesita abrir el portal tal como lo ve un alumno y poder editar
lo pertinente desde allí, sin ir y volver continuamente al panel.

Diseña e implementa una capa profesional de edición en contexto con estas
garantías:

- Sólo `admin` puede editar; `entrenador` mantiene únicamente sus permisos.
- Aviso fijo y muy visible indicando qué alumno está siendo observado.
- Salida clara de regreso a la ficha o al panel profesional.
- Botones discretos de edición para rutina, día, ejercicio, instrucciones,
  descanso y contenido permitido, junto a la información que modifican.
- Las ediciones reutilizan las acciones, validaciones, publicación versionada,
  auditoría y reglas existentes. No escribas directamente desde el navegador.
- Nunca edites sesiones ya realizadas ni datos históricos como si fueran la
  prescripción actual.
- No permitas escrituras accidentales del alumno observado, duplicación de
  rutinas ni cambios sin confirmación del servidor.
- Si una función todavía no puede editarse de forma segura, enlaza a su editor
  existente con regreso al mismo contexto; no simules un botón funcional.

### Fase 4 — Error prioritario de Impulso VIP en V1

Reproduce y corrige este fallo antes de considerar terminado el trabajo:

1. En la última serie elegible aparece la encuesta de esfuerzo/RIR:
   “podía hacer una más”, “podía hacer dos más”, etc.
2. Después debe aparecer la pregunta de carga o dificultad: si estuvo pesado,
   correcto o fácil, según la lógica real existente.
3. Después debe mostrarse y confirmarse el resultado/logro de Impulso VIP.
4. **Sólo cuando toda esa secuencia termina** puede avanzar el ejercicio activo.

Actualmente el sistema cambia al ejercicio siguiente demasiado pronto. La
encuesta o el logro quedan asociados visualmente al ejercicio anterior y el
usuario debe retroceder para verlos. Eso es incorrecto.

Trata el flujo como una máquina de estados explícita, por ejemplo:

`serie finalizada → RIR pendiente → dificultad pendiente → resultado pendiente
→ Impulso resuelto → avance permitido`.

Requisitos de la corrección:

- No avances por índice, flecha, autoavance ni fin de descanso mientras exista
  una etapa pendiente del Impulso para el ejercicio actual.
- No dupliques respuestas si hay doble toque, recarga o red lenta.
- Si una pregunta no aplica, avanza explícitamente a la siguiente etapa válida;
  no saltes todo el flujo.
- El estado debe sobrevivir una recarga y reabrir exactamente en la etapa
  pendiente.
- El logro debe pertenecer al ejercicio/serie correctos y mostrarse una vez.
- Al terminar, avanzar al siguiente ejercicio una sola vez.
- Retroceder y volver no debe recrear encuestas ya resueltas.
- Conserva puntos, historial, calibración y automatizaciones existentes.
- Añade pruebas unitarias de transiciones y una prueba de integración del caso
  completo con última serie, RIR, dificultad, logro y avance.

### Calidad y verificación obligatorias

- Trabaja por fases pequeñas y revisa el diff después de cada una.
- Ejecuta TypeScript, ESLint, pruebas existentes, pruebas nuevas y build.
- Prueba recorridos reales en viewport móvil sin modificar alumnos activos.
- Verifica roles `alumno`, `entrenador` y `admin`, acceso por URL y modo lectura.
- Confirma que todos los botones nuevos tienen destino o acción y regreso.
- No declares éxito basándote sólo en que compila.
- No despliegues, no apliques SQL y no hagas pruebas destructivas.
- No uses datos demostrativos para ocultar fallos de lectura. Si una consulta
  real falla, muestra el error y documéntalo; si no hay datos, muestra un estado
  vacío honesto.
- Conserva un registro explícito de cada problema encontrado, su causa raíz,
  archivos afectados, decisión tomada, prueba que lo cubre y riesgo residual.

### Entrega obligatoria para revisión del martes

Deja el código únicamente en la rama aislada y crea:

`C:\dev\vip-fitness-v1-claude\HANDOFF_CLAUDE_PORTAL_V1_RESULTADO.md`

Ese handoff debe incluir:

- rama, commit base y commits creados;
- inventario de archivos modificados;
- qué reorganizaste y por qué mejora la operación diaria;
- diagrama o lista exacta de la máquina de estados de Impulso VIP;
- causa raíz del autoavance incorrecto y evidencia de la corrección;
- comandos y resultados completos de pruebas/build;
- recorridos móviles y roles comprobados;
- SQL propuesto pero **no aplicado**, si fuera imprescindible;
- riesgos, limitaciones y pendientes honestos;
- instrucciones exactas para que Codex audite e integre o rechace el trabajo.
- una sección `NO TERMINADO` con cualquier botón sin conexión, flujo no probado,
  dependencia externa, dato supuesto o decisión que necesite al propietario;
- una sección `NO TOCAR EN V2` que confirme que `C:\dev\vip-fitness-v2` y la
  rama `portal-v2` permanecieron sin cambios durante todo el encargo.

Si algo no está probado, escríbelo como pendiente. No toques Portal V2 y no
presentes una maqueta visual como una función terminada.

## FIN DEL MENSAJE
