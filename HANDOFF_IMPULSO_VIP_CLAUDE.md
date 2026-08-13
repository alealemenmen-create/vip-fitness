# Encargo para Claude — revisión y demostración de Impulso VIP En Vivo

Alejandro no puede hacer la revisión manual ahora porque le duelen las manos.
Haz tú la revisión completa, prueba el flujo y déjale la demostración abierta
en pantalla. No le delegues a él pasos de QA que puedas ejecutar tú.

## Estado recibido

- Rama compartida: `main`. Hay trabajo sin commit de Codex y puede haber
  cambios concurrentes de Claude; no descartes, restaures ni sobrescribas
  cambios ajenos.
- Supabase tiene aplicadas y verificadas las migraciones 0079–0084:
  - 0079: intervenciones dentro de la sesión.
  - 0080: trazabilidad por serie.
  - 0081: solicitudes de asistencia a Ale.
  - 0082: elegibilidad y seguridad por ejercicio.
  - 0083: memoria adaptativa por alumno/ejercicio/técnica.
  - 0084: indicaciones personales preparadas o enviadas en vivo.
- La tabla `impulso_vip_indicaciones_programadas` existe y comienza vacía.
- En la última validación: 392 pruebas, TypeScript y lint pasaron. El build de
  producción pasó en el segundo intento; el primero falló solo por un 404
  transitorio de Google Fonts.
- Los 121 ejercicios activos tienen perfil conservador y están pendientes de
  revisión manual; por diseño, ninguna técnica intensa debe habilitarse hasta
  revisar el ejercicio en la galería.

## Qué debes revisar

1. Lee el diff completo de Impulso VIP y busca errores de seguridad, carreras,
   relaciones PostgREST, estados imposibles y regresiones. No te limites al
   aspecto visual.
2. Verifica en `/admin/ejercicios` el editor “Seguridad de Impulso VIP”:
   intensidad máxima, técnicas permitidas, supervisión y estado revisado.
3. Verifica en la ficha de un alumno el panel “Indicación personal de Ale”:
   - carga todos los ejercicios de la rutina activa y sus series;
   - modo próxima sesión;
   - modo en vivo solo para ejercicios de la sesión activa;
   - cancelar una indicación pendiente;
   - una técnica intensa bloqueada si el ejercicio no está revisado;
   - bloqueo por ficha médica/dolor y por segunda técnica intensa.
4. Prueba una indicación segura (tempo o cierre controlado) de punta a punta:
   - preparada antes de entrenar y entregada al iniciar;
   - o enviada durante una sesión activa;
   - el alumno debe verla como “Mensaje personal de Ale” sin recargar
     manualmente (sincronización aproximada de 8 segundos);
   - debe tener prioridad sobre un momento automático aún no mostrado;
   - nunca debe reemplazar una intervención ya mostrada o resuelta.
5. Prueba el resultado de una intervención y confirma que la memoria 0083 se
   actualiza una sola vez. Una molestia debe marcar retroceso; no inventes
   historial ni dejes datos de prueba permanentes.
6. Repite `npx tsc --noEmit`, `npm test`, `npm run lint` y `npm run build`.
7. Si encuentras fallas, corrígelas con cambios mínimos, vuelve a verificar y
   documenta exactamente qué cambiaste. No hagas push ni publiques sin una
   autorización nueva y explícita de Alejandro.

## Entrega que espera Alejandro

- Déjale abierta en pantalla la vista más demostrativa del flujo funcionando.
- Explícale de forma breve qué probaste, qué viste y cualquier riesgo restante.
- Si todo queda correcto, indícale claramente que está verificado.
- Si una prueba necesita modificar datos reales, usa la alternativa menos
  invasiva y limpia todo dato temporal al terminar.

