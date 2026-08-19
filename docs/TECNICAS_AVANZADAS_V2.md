# Técnicas avanzadas en la sesión V2

## Objetivo obligatorio

La V2 debe ejecutar las técnicas como secuencias reales. Mostrar `Superserie`,
`FST-7` o `Drop set` al lado del ejercicio sin cambiar navegación, descansos y
registro se considera un error funcional.

## Lógica existente que se reutiliza

- `tecnica-grupo.ts`: reconoce y agrupa biseries, superseries, triseries,
  giant sets, circuitos, finalizadores, complejos, AMRAP y EMOM.
- `SesionGrupoCard.tsx`: ejecuta rondas intercaladas `A1 → B1 → C1 → descanso`.
- `tecnica-series.ts`: aplica una técnica individual solo a las series elegidas
  y protege la progresión histórica de datos contaminados por fatiga.
- `glosario-tecnicas.ts`: explicación y aviso de ayuda/supervisión.
- `tecnicas_entrenamiento`: nivel mínimo, fatiga, descansos, supervisión y
  máximo por sesión.
- Generador VIP: rotación semanal, límite por sesión, exclusión del primer
  compuesto, siete series reales para FST-7 y cuatro estaciones para giant set.
- Memoria e Impulso VIP: impiden apilar automáticamente otra técnica intensa y
  conservan resultados verificables.

## Modelo canónico

Hay dos familias que no se deben mezclar:

### Bloques encadenados

| Técnica | Estaciones | Secuencia | Descanso real |
| --- | ---: | --- | --- |
| Superserie | 2 | A1 → B1 | después de B |
| Biserie | 2 | A1 → B1 | después de B |
| Triserie | 3 | A1 → B1 → C1 | después de C |
| Serie gigante | 4 o más | A1 → B1 → C1 → D1… | al cerrar la ronda |
| Circuito | variable | estación 1 → 2 → 3… | al cerrar la vuelta |

La siguiente ronda vuelve a A. No se completan todas las series de A antes de
pasar a B. Un ejercicio con menos rondas simplemente deja de aparecer en las
rondas que excedan su cantidad programada.

### Técnicas dentro de una serie

| Técnica | Subpasos reales |
| --- | --- |
| Fallo técnico | trabajo hasta la última repetición limpia |
| Drop set | trabajo → bajar carga → trabajo sin descanso |
| Rest-pause | trabajo → microdescanso → trabajo adicional |
| Myo-reps | activación → pausa → mini-serie, repetido |
| Cluster | mini-bloque → pausa, repetido dentro de la serie |
| FST-7 | siete series externas reales, no siete segmentos ficticios |

Tempo, pausa isométrica y parciales modifican la ejecución del segmento de
trabajo; no crean por sí solos otro ejercicio o una ronda.

## Invariantes de ejecución

1. Existe un único paso activo: serie, ajuste de carga, microdescanso o descanso
   de bloque.
2. Completar un paso avanza al siguiente; nunca salta un integrante del bloque.
3. El descanso interno de una cadena es cero. El temporizador aparece una sola
   vez al cerrar la ronda.
4. Volver atrás no reinicia automáticamente un descanso ya consumido.
5. Solo el paso activo es editable. Los posteriores permanecen bloqueados.
6. Reordenar o sustituir mueve el bloque completo o conserva su posición.
7. Una molestia cancela los segmentos pendientes y bloquea nuevas técnicas
   intensas durante la sesión.
8. Impulso VIP no apila un reto sobre una serie que ya tiene técnica intensa.
9. Cada segmento registra carga, repeticiones, duración, RIR disponible,
   resultado y motivo de cancelación. El resumen externo sigue contando una
   sola serie cuando corresponde.
10. La finalización comprueba pasos reales, no solamente cantidad de checks.

## Compatibilidad de datos

La transición lee primero campos estructurados y, cuando no existan, conserva
compatibilidad con `tecnica_tipo`, `tecnica_instruccion`, `tecnica_series` y la
numeración `(posición/total)`. Antes de publicar V2 se debe añadir identidad de
bloque estable, slug canónico, posición, tamaño y configuración; depender para
siempre de texto libre permitiría fusionar dos biseries consecutivas por error.

## Seguridad y dosificación

- Principiante: cadenas simples o tempo; sin fallo automático.
- Intermedio: biseries/superseries y técnicas individuales autorizadas en dosis
  limitada.
- Avanzado: triseries, series gigantes, FST-7, myo-reps, rest-pause y cluster
  cuando objetivo, recuperación y dominio técnico lo permitan.
- Fallo absoluto se reserva para ejercicios estables y expresamente aprobados;
  el valor general es fallo técnico.
- La aplicación debe distinguir eficiencia de intensidad: las superseries
  antagonistas pueden mantener mejor el volumen que dos ejercicios similares.

La evidencia disponible apoya las superseries como herramienta eficiente, pero
también muestra mayor esfuerzo percibido; rest-pause y drop set no son
universalmente superiores cuando el volumen se iguala; los clusters suelen
conservar mejor velocidad y potencia. FST-7 se conserva como método programable
del Método VIP, no como una garantía científica de superioridad.

## Estado de implementación

- Motor puro: `src/lib/entrenamiento/motor-tecnicas-sesion.ts`.
- Pruebas: cadenas de 2–4 estaciones, drop set, rest-pause, myo-reps, cluster,
  fallo técnico y FST-7.
- Sesión V2: los bloques encadenados reales se mantienen unidos al reordenar,
  avanzan por rondas y descansan al cerrar cada ronda.
- Las técnicas individuales generan subpasos visibles por serie cuando su
  asignación las activa; series, técnica aplicada y trazabilidad se guardan en
  las tablas originales.
- Pendiente: piloto con rutinas reales de cada familia técnica, verificación RLS
  en preview y ajustes de texto/tiempos según observación directa del entrenador.
