# Instructivo maestro para Claude — Impulso VIP V2 de punta a punta

Fecha de entrega: 2026-08-21  
Responsable de producto: Alejandro Mendoza  
Proyecto: `C:\dev\vip-fitness`  
Estado: listo para ejecutar por fases; no autoriza despliegue ni cambios destructivos en producción.

## 0. Mandato para Claude

Trabaja de manera autónoma hasta completar una versión verificable de este
proyecto. No entregues solamente propuestas, pseudocódigo o un rediseño visual:
implementa la lógica, las migraciones locales, la interfaz, las pruebas, la
auditoría y la demostración de punta a punta.

Antes de escribir código:

1. Lee completos `AGENTS.md`, `CLAUDE.md`, este instructivo,
   `HANDOFF_IMPULSO_VIP_CLAUDE.md`, `docs/ALEJANDRO_IMPULSO_VIP.md`,
   `docs/VIP_METHOD_RULEBOOK.md` y las instrucciones vigentes de Next.js dentro
   de `node_modules/next/dist/docs/` para cada API que vayas a tocar.
2. Revisa `git status` y `git diff`. La rama es compartida y contiene trabajo
   local de Codex. No lo descartes, restaures ni sobrescribas.
3. Confirma el estado real de Supabase y consulta el changelog/documentación
   vigente antes de implementar. No supongas que una API o política funciona
   por memoria.
4. Construye una línea base con pruebas, TypeScript, lint y build. Si algo ya
   falla, diferencia claramente la falla previa de una regresión nueva.
5. No hagas `push`, despliegue, migración en producción ni corrección masiva de
   datos sin autorización expresa de Alejandro.
6. No le delegues a Alejandro pasos de QA que puedas ejecutar tú. Al finalizar,
   deja abierta la demostración más representativa si el entorno lo permite.

Si una decisión menor no está especificada, elige la opción más segura,
reversible, auditable y compatible con la lógica actual. Solo detente a
preguntar cuando la elección cambie de manera material el comportamiento del
Método VIP o requiera alterar datos reales.

## 1. Resultado esperado

Transformar Impulso VIP desde un único reto de última serie en un entrenador de
sesión que pueda:

- preparar al alumno antes de un ejercicio;
- orientar sin interrumpir innecesariamente;
- adaptar carga o repeticiones durante la sesión;
- proteger ante dolor, técnica inestable o fatiga;
- proponer un reto seguro cuando corresponda;
- reconocer una mejora real;
- aprender del resultado sin inventar evidencia;
- explicar cada decisión al alumno y al entrenador;
- conservar trazabilidad e idempotencia de punta a punta.

No se busca llenar la sesión de modales. Se busca que cada intervención tenga
una función concreta.

## 2. Decisiones de producto obligatorias

### 2.1 Más inteligencia, no más interrupciones

Impulso VIP podrá producir cinco clases visibles de intervención:

1. `orientacion`: preparación, tempo, recorrido, descanso o foco técnico. No
   requiere respuesta y normalmente no bloquea la pantalla.
2. `adaptacion`: mantener, subir repeticiones, bajar carga o ajustar el objetivo
   de la siguiente serie. Debe indicar qué cambió y por qué.
3. `seguridad`: detener, reducir, reportar molestia o pedir asistencia. Tiene
   prioridad absoluta sobre cualquier reto.
4. `reto`: repetición objetivo, cierre controlado, pausa, drop set, rest-pause o
   fallo técnico permitido. Requiere resultado cuando modifica el estímulo.
5. `reconocimiento`: comunica una marca, mejora de volumen, consistencia o mejor
   ejecución. Nunca puede declarar un récord con datos incomparables.

Una sesión puede contener varias orientaciones o reconocimientos discretos,
pero los retos intensos deben seguir siendo escasos:

- alumno inicial, historial poco confiable o sin check-in: máximo 1 reto;
- alumno estable: 1 reto base;
- segundo reto: solo con cuatro resultados recientes logrados y verificados,
  recuperación compatible y ejercicios revisados;
- nunca más de 2 retos intensos automáticos por sesión;
- las referencias antiguas a 3–4 “momentos” se interpretan como interacciones
  totales, no como 3–4 técnicas intensas;
- dolor, restricción, sueño menor de 5 horas o energía 1–2: cero retos intensos.

### 2.2 Jerarquía inalterable

La decisión siempre respeta este orden:

1. dolor o molestia;
2. técnica inestable;
3. serie no completada;
4. caída de rendimiento o fatiga;
5. recuperar el mínimo del rango;
6. completar el máximo del rango;
7. subir carga;
8. agregar una técnica de intensidad.

Ninguna puntuación, racha, nivel o solicitud visual puede saltarse los primeros
cuatro puntos.

### 2.3 Regla inequívoca para mancuernas

Esta regla reemplaza cualquier interpretación ambigua anterior:

- En ejercicios realizados con dos mancuernas, `peso_kg` representa el peso de
  **una mancuerna**, no la suma del par.
- La interfaz debe mostrar `kg c/u` o `kg por mancuerna`.
- No se duplica el valor para mostrar volumen al alumno.
- El volumen analítico puede calcular el total movido usando la cantidad de
  implementos, pero debe conservar también el valor unitario original.
- En ejercicios unilaterales con una mancuerna, `peso_kg` también representa
  esa mancuerna y la UI debe aclararlo.
- La siguiente carga debe ser una carga realmente disponible en el gimnasio.
- La progresión nunca salta automáticamente de 15 kg a 20 kg por una
  configuración genérica de `incremento_kg = 5`.
- Si están disponibles 15, 16 y 18 kg, después de completar 15 kg la primera
  candidata es 16 kg. El motor puede mantener 15 según esfuerzo, pero no saltar
  directamente a 20.
- Si falta inventario confiable, el máximo teórico para mancuernas es +2,5 kg
  por decisión; si ese peso no existe, se mantiene la carga o se deriva a
  revisión, nunca se inventa una carga.

### 2.4 Una sola fuente de verdad para carga

No deben seguir existiendo dos reglas desconectadas:

- `src/lib/impulso-vip/motor.ts` actualmente usa el `incremento_kg` de la
  asignación.
- `src/lib/impulso-vip/alejandro.ts` detecta el equipo y limita las mancuernas a
  2,5 kg, pero esa decisión no está integrada en el flujo histórico real.

Extrae o crea una política compartida y pura —por ejemplo
`src/lib/impulso-vip/politica-carga.ts`— consumida tanto por el motor histórico
como por la adaptación en vivo. No copies la regla en dos archivos.

La política debe recibir como mínimo:

- equipo canónico;
- modalidad de registro de carga;
- peso anterior unitario;
- cargas disponibles;
- incremento configurado por el entrenador;
- dificultad/RIR disponible;
- confianza;
- objetivo del alumno;
- tipo de progresión;
- restricciones o anomalías activas.

Debe devolver una decisión explicable: mantener, siguiente carga disponible,
subir repeticiones, reducir, bloquear o requerir revisión.

## 3. Diagnóstico confirmado que no debe redescubrirse desde cero

### 3.1 Impulso se siente como una sola acción

`src/lib/impulso-vip/en-vivo.ts` declara ocho tipos posibles, pero
`calcularIntervencionEnVivo` convierte prácticamente toda recomendación
automática compatible en `cierre_controlado` sobre la última serie. La variedad
de tipos existe en el modelo, pero no en la experiencia automática real.

### 3.2 Caso real de Nicolás Albornoz

Datos confirmados en producción el 2026-08-21 mediante consultas de solo
lectura:

- Ejercicio: `Elevaciones laterales`, biblioteca `equipo = mancuerna`, categoría
  `aislamiento`.
- Programa: 4 series de 12–15 repeticiones.
- El 2026-08-14 registró 4 × 15 con 15 kg y dificultad `justo`.
- La configuración de esa asignación tiene `incremento_kg = 5`.
- La recomendación congelada del 2026-08-21 fue `B_subir_peso`, 20 kg,
  calculada desde los 15 kg anteriores.
- Nicolás finalmente registró 4 × 12 con 16 kg.
- El salto sugerido 15 → 20 es incorrecto para mancuernas.

También existen registros históricos de elevaciones laterales con 15, 16, 20,
32 y 35 kg. No los reescribas automáticamente: pueden mezclar peso por
mancuerna, suma del par, correcciones o registros de distintas convenciones.
Primero clasifícalos y déjalos disponibles para revisión humana.

### 3.3 Historial fragmentado por asignación

`obtenerHistorialParaMotor` utiliza `dia_ejercicio_id`. Esto conserva la
configuración de una asignación, pero puede ignorar el mismo movimiento hecho
en otro día o rutina aunque esté vinculado al mismo `ejercicio_id` de la
biblioteca.

La nueva regla debe ser:

- configuración y autorización: permanecen por asignación;
- historial de rendimiento: se agrupa por alumno + ejercicio canónico cuando
  el vínculo y la modalidad de carga son compatibles;
- si no existe `ejercicio_id`, usar la asignación como respaldo y marcar menor
  confianza;
- no comparar automáticamente barra contra mancuernas, máquina contra peso
  libre, sustituciones no equivalentes ni modalidades de carga distintas;
- una decisión siempre registra exactamente qué sesiones fueron consideradas.

### 3.4 Incidente de idempotencia ya corregido localmente

Hay cambios locales de Codex que evitan que una serie corregida vuelva a abrir
la encuesta de un Impulso ya resuelto y convierten los reintentos del servidor
en éxito idempotente. No descartarlos:

- `src/app/alumno/entrenar/impulso-actions.ts`;
- `src/components/v2/SesionActivaV2.tsx`;
- `src/lib/impulso-vip/alejandro-sesion.ts`;
- `src/lib/impulso-vip/alejandro-sesion.test.ts`;
- `src/lib/impulso-vip/resolucion-intervencion.ts`;
- `src/lib/impulso-vip/resolucion-intervencion.test.ts`.

En la última validación local: 83 archivos de prueba y 645 pruebas pasaron,
TypeScript y lint quedaron limpios y el build de producción compiló. Vuelve a
validar; no asumas que la rama sigue idéntica.

## 4. Arquitectura objetivo

### 4.1 Capas

Mantén estas responsabilidades separadas:

1. **Normalización de carga**: interpreta unidad, equipo, peso unitario,
   cantidad de implementos e inventario.
2. **Historial comparable**: decide qué series pueden compararse y explica por
   qué se incluyen o excluyen.
3. **Política de progresión**: produce mantener/subir reps/subir carga/reducir/
   consultar sin conocer React ni Supabase.
4. **Orquestador de sesión**: decide cuándo y dónde intervenir, respetando cupo,
   preparación diaria, técnica programada y seguridad.
5. **Persistencia**: congela la decisión, guarda evidencia y resuelve de forma
   idempotente.
6. **Presentación**: muestra una interacción proporcional a su clase.
7. **Control del entrenador**: permite revisar, explicar, ajustar, bloquear y
   auditar.

No mezcles consultas de base de datos dentro del motor puro. No uses un prompt
libre o una IA generativa para reemplazar reglas de seguridad o progresión.

### 4.2 Identidad y comparabilidad del ejercicio

Crea un resolvedor puro de identidad comparable. Debe considerar:

- `ejercicio_id` canónico;
- equipo;
- modalidad de carga;
- unilateral/bilateral;
- técnica aplicada;
- sustitución realizada;
- series realmente válidas;
- correcciones posteriores;
- anomalías de carga.

El resultado debe incluir `comparable: boolean`, `confianza` y `motivos`.
Persistir los motivos en `decision_data` para auditoría.

### 4.3 Modelo de carga

Diseña una migración mínima y reversible. Los nombres exactos pueden ajustarse
si el esquema existente ofrece una opción mejor, pero el dominio debe cubrir:

- modalidad de carga del ejercicio:
  `por_implemento`, `carga_total`, `peso_corporal`, `peso_corporal_con_lastre`,
  `asistencia`, `sin_carga`;
- cantidad habitual de implementos;
- etiqueta visible (`kg c/u`, `kg totales`, `kg de lastre`, etc.);
- inventario o escalones de carga disponibles;
- excepción por asignación cuando el entrenador la defina;
- señal de registro histórico dudoso que no destruya el dato original.

Prioriza una tabla normalizada para cargas disponibles si el inventario cambia
o necesita orden y activación. Evita almacenar reglas críticas solo en texto o
JSON opaco.

No cambies el significado histórico de `series_realizadas.peso_kg` en masa.
Si agregas metadatos nuevos, los registros anteriores deben quedar como
`desconocido` hasta poder inferirse con alta confianza o revisarse.

### 4.4 Registro de decisiones

Cada recomendación o intervención debe poder responder:

- qué observó;
- qué sesiones comparó;
- qué descartó y por qué;
- qué regla ganó;
- qué carga anterior tomó;
- qué inventario estaba disponible;
- qué límite de seguridad aplicó;
- qué nivel de confianza tuvo;
- si el entrenador la modificó;
- qué resultado declaró el alumno;
- qué evidencia verificable existió.

Usa columnas tipadas para estados consultados con frecuencia y `decision_data`
para el detalle explicativo. No escondas todo el estado del flujo en JSON.

## 5. Plan de implementación obligatorio

### Fase 0 — Auditoría y línea base

1. Revisa todo el flujo de creación de sesión, generación de recomendación,
   creación de intervención, presentación, guardado de serie, resolución y
   memoria adaptativa.
2. Dibuja en el informe final el flujo real encontrado y lista diferencias con
   este documento.
3. Verifica migraciones 0043 y 0079–0084 y cualquier migración posterior que
   toque Impulso.
4. Ejecuta consultas de solo lectura para medir:
   - ejercicios por equipo;
   - asignaciones con incrementos incompatibles;
   - series de mancuernas con saltos sospechosos;
   - recomendaciones B de subida de peso;
   - registros sin `ejercicio_id`;
   - intervenciones resueltas, canceladas o duplicadas.
5. No cambies datos todavía. Guarda un informe reproducible de la auditoría.

Entregable: diagnóstico actualizado y pruebas de línea base.

### Fase 1 — Política canónica de carga (P0)

1. Implementa el modelo de carga y la migración local.
2. Crea la política pura compartida de carga.
3. Haz que el motor histórico reciba equipo, modalidad e inventario.
4. Elimina la divergencia funcional con `alejandro.ts`; reutiliza la política
   compartida desde ambas capas.
5. Mantén el override del entrenador, pero valida que no viole un límite duro.
   Si existe conflicto, no lo apliques silenciosamente: muestra “requiere
   revisión” y registra el motivo.
6. Actualiza tipos Supabase y documentación.

Caso obligatorio: 15 kg por mancuerna, 4 × 15, dificultad `justo`, cargas
disponibles 15/16/18 → mantener 15 o proponer 16 según la política de esfuerzo;
nunca 20.

Entregable: reglas unitarias y deterministas de carga.

### Fase 2 — Historial comparable por movimiento (P0)

1. Separa configuración por asignación de historial por ejercicio canónico.
2. Incorpora historial compatible de otros días/rutinas.
3. Excluye técnicas que invalidan comparación siguiendo
   `seriesLimpiasParaProgresion`.
4. Excluye o reduce confianza ante cargas históricas dudosas.
5. Registra los identificadores y motivos de las sesiones consideradas.
6. Mantén respaldo seguro para ejercicios no vinculados.

Entregable: Nicolás y cualquier alumno reciben una decisión coherente aunque el
mismo ejercicio esté repetido en dos días o haya cambiado de rutina.

### Fase 3 — Orquestador de intervenciones variadas (P1)

1. Introduce la clase de intervención sin romper los tipos existentes.
2. Conserva compatibilidad con filas antiguas.
3. Convierte las reglas actuales en estrategias explícitas:
   - preparar carga/reps;
   - subir repeticiones;
   - mantener y consolidar;
   - reducir por esfuerzo o técnica;
   - tempo o pausa técnica;
   - cierre controlado;
   - repetición objetivo;
   - serie de descarga;
   - drop set/rest-pause solo si está permitido;
   - detener/consultar;
   - reconocer mejora verificable.
4. Selecciona la estrategia según equipo, categoría, estabilidad, experiencia,
   recuperación, técnica programada, supervisión y memoria adaptativa.
5. No conviertas todas las recomendaciones en última-serie.
6. No apiles una técnica automática sobre una técnica programada.
7. Conserva idempotencia y prioridad de indicaciones personales de Ale.

Entregable: al menos cuatro clases de interacción observables en escenarios de
prueba, sin aumentar indiscriminadamente la intensidad.

### Fase 4 — Experiencia Portal V2 (P1)

Diseña cada clase con el peso visual adecuado:

- orientación: banda o tarjeta discreta, descartable, sin encuesta;
- adaptación: mensaje antes de la próxima serie con cambio y razón;
- seguridad: aviso prioritario y acción clara;
- reto: Momento Impulso destacado, confirmación de lectura y resultado al
  terminar;
- reconocimiento: confirmación breve después del guardado, sin bloquear.

Requisitos:

- mantener el diseño visual del Portal V2;
- mostrar `kg c/u` para mancuernas;
- nunca mostrar una meta sin su unidad y modalidad;
- indicar “Mantén”, “Sube reps”, “Prueba X kg” o “Consulta a Ale”; evitar frases
  vagas;
- no repetir una intervención resuelta al corregir una serie;
- soportar reintentos de red sin error falso ni doble notificación;
- accesibilidad, foco, teclado móvil y botones con estados de guardado;
- una intervención no puede desaparecer sin dejar estado: registrada,
  verificada, omitida, cancelada o pendiente.

Entregable: flujo móvil de sesión completo y entendible sin explicación externa.

### Fase 5 — Control del entrenador (P1)

En el panel de entrenador/admin agrega o completa:

1. **Configuración de carga del ejercicio**: modalidad, etiqueta, cantidad de
   implementos, cargas disponibles y límites.
2. **Configuración por asignación**: progresión, autorización, RIR y override.
3. **Explicación de la decisión**: historial usado, regla, confianza y motivos.
4. **Anomalías de carga**: cola para revisar valores incompatibles sin borrar.
5. **Intervención personal**: preparar, enviar, cancelar y ver resultado.
6. **Vista de sesión**: línea de tiempo de orientaciones, retos, seguridad y
   respuestas.
7. **Simulador**: antes de guardar una regla, mostrar qué recomendaría para el
   historial actual.

No expongas controles técnicos innecesarios al alumno. El entrenador sí debe
tener auditoría y capacidad de corregir.

Entregable: el entrenador puede entender y controlar el sistema sin consultar
la base de datos.

### Fase 6 — Auditoría de datos históricos (P1)

Construye primero detección, no corrección automática.

Marcar como sospechoso cuando, entre sesiones comparables:

- el peso se duplica aproximadamente sin una explicación de modalidad;
- el salto supera límites por equipo;
- el peso no coincide con inventario;
- cambia repetidamente entre valores unitarios y totales;
- el mismo día aparecen convenciones incompatibles;
- una corrección posterior altera todas las series con un patrón artificial.

Para Nicolás, muestra los registros 15/16/20/32/35 en una revisión y permite al
entrenador clasificarlos. No edites su historial sin confirmación.

Toda corrección futura debe:

- conservar valor anterior;
- registrar actor, fecha y motivo;
- recalcular solamente futuras recomendaciones o una recomendación pendiente
  autorizada;
- no reescribir silenciosamente recomendaciones congeladas ya mostradas.

Entregable: informe y cola de revisión, con cero pérdida de datos.

### Fase 7 — Despliegue gradual (P2)

1. Protege el nuevo motor con feature flag por alumno o porcentaje.
2. Ejecuta modo sombra: calcula decisión nueva sin mostrársela al alumno y
   compara con la actual.
3. Mide divergencias, bloqueos, reintentos, resultados y overrides.
4. Activa primero para alumnos piloto revisados.
5. Mantén rollback sin migración destructiva.
6. Solo despliega con autorización expresa de Alejandro.

Entregable: activación reversible y observada.

## 6. Pruebas obligatorias

### 6.1 Política de carga

Incluye pruebas para:

- mancuernas 15 kg c/u con inventario 15/16/18;
- mancuernas sin inventario y límite de +2,5 kg;
- máquina con escalón real de 5 kg;
- barra con salto de 5 kg y límite por confianza;
- peso corporal sin subida automática de carga;
- ejercicio unilateral;
- override válido e inválido del entrenador;
- libras con escalones prácticos;
- reducción de carga sin producir valores inexistentes;
- ausencia de peso de referencia.

### 6.2 Historial

Incluye pruebas para:

- mismo `ejercicio_id` en dos asignaciones distintas;
- ejercicios con el mismo nombre pero equipos distintos;
- ejercicio no vinculado;
- sustitución;
- técnica parcial y series limpias;
- sesión corregida;
- dato anómalo 16 → 32;
- historial sin dificultad;
- historial con dolor;
- recomendaciones congeladas.

### 6.3 Intervenciones

Incluye pruebas para:

- orientación sin encuesta;
- adaptación antes de siguiente serie;
- reto con resultado;
- seguridad que cancela reto;
- reconocimiento solo con evidencia;
- segundo reto únicamente tras cuatro éxitos verificados;
- preparación diaria baja;
- ejercicio no revisado;
- técnica programada;
- indicación personal que gana prioridad;
- doble tap y reintento concurrente;
- desmarcar/corregir/volver a marcar una serie resuelta;
- notificación al entrenador exactamente una vez.

### 6.4 Integración y UI

Verifica en móvil:

1. iniciar sesión;
2. ver orientación;
3. completar una serie;
4. recibir adaptación;
5. ejecutar un reto;
6. responder resultado;
7. corregir la serie sin repetir encuesta;
8. reportar molestia y comprobar bloqueo;
9. finalizar sesión;
10. revisar auditoría desde entrenador.

Comprueba consola, red, estados de espera, navegación, persistencia tras recarga
y ausencia de errores visibles falsos.

### 6.5 Verificación técnica final

Ejecuta, como mínimo:

```bash
npx eslint <archivos modificados>
npx tsc --noEmit --incremental false
npm test
npm run build
```

Si se modifica el esquema:

- crea la migración con el flujo vigente de Supabase;
- verifica lista/estado de migraciones;
- revisa RLS, `USING` y `WITH CHECK`;
- ejecuta advisors si están disponibles;
- regenera y revisa tipos;
- realiza consultas de prueba con alumno y entrenador;
- nunca expongas `service_role` al cliente.

## 7. Criterios de aceptación

El proyecto no está terminado hasta que se cumpla todo lo siguiente:

- 15 kg en elevaciones laterales no produce automáticamente 20 kg.
- La interfaz aclara `kg c/u` en ejercicios de dos mancuernas.
- La carga sugerida pertenece al inventario o se mantiene/deriva a revisión.
- El motor histórico y el motor en vivo comparten la misma política de carga.
- El historial puede usar el mismo ejercicio canónico a través de rutinas
  distintas sin comparar equipos incompatibles.
- Una anomalía histórica no genera una progresión automática agresiva.
- Existen orientaciones, adaptaciones, seguridad, retos y reconocimientos con
  comportamientos visuales distintos.
- No hay más de dos retos intensos automáticos por sesión.
- Dolor o baja recuperación bloquean intensidad.
- Ningún reto se duplica al corregir una serie o reintentar una petición.
- El entrenador puede ver por qué se tomó cada decisión.
- Las recomendaciones ya mostradas permanecen auditables e inmutables.
- Todas las pruebas, TypeScript, lint y build pasan.
- Se entrega demostración y reporte de riesgos restantes.

## 8. Lo que no se debe hacer

- No convertir Impulso en una lluvia de ventanas.
- No aumentar peso por gamificación, puntos o rachas.
- No usar kilos absolutos para comparar alumnos.
- No tratar `justo` como autorización automática para un salto grande.
- No sumar el par de mancuernas en unas pantallas y usar peso unitario en otras.
- No confiar solamente en el nombre del ejercicio cuando existe vínculo de
  biblioteca.
- No comparar historial incompatible solo para obtener más muestras.
- No activar drop set, rest-pause o fallo en ejercicios no revisados.
- No sustituir reglas deterministas por una respuesta libre de IA.
- No corregir en masa los datos 15/16/20/32/35 de Nicolás.
- No borrar migraciones, datos, cambios locales ni archivos ajenos.
- No hacer push o deploy sin autorización.

## 9. Orden recomendado de archivos a revisar

Empieza por:

- `src/lib/impulso-vip/motor.ts`
- `src/lib/impulso-vip/data.ts`
- `src/lib/impulso-vip/congelar.ts`
- `src/lib/impulso-vip/alejandro.ts`
- `src/lib/impulso-vip/alejandro-sesion.ts`
- `src/lib/impulso-vip/en-vivo.ts`
- `src/lib/impulso-vip/en-vivo-data.ts`
- `src/lib/impulso-vip/elegibilidad.ts`
- `src/lib/impulso-vip/preparacion-diaria.ts`
- `src/app/alumno/entrenar/impulso-actions.ts`
- `src/app/alumno/entrenar/actions.ts`
- `src/app/portal-v2/entrenamiento/sesion/page.tsx`
- `src/components/v2/SesionActivaV2.tsx`
- `src/app/admin/ejercicios/*`
- `src/app/admin/alumnos/[id]/*`
- `src/lib/supabase/types.ts`
- `supabase/migrations/0043_impulso_vip.sql`
- `supabase/migrations/0079_impulso_vip_en_vivo.sql`
- `supabase/migrations/0080_trazabilidad_serie_impulso.sql`
- `supabase/migrations/0081_asistencia_ale_en_vivo.sql`
- `supabase/migrations/0082_elegibilidad_tecnicas_impulso.sql`
- `supabase/migrations/0083_memoria_adaptativa_impulso.sql`
- `supabase/migrations/0084_indicaciones_personales_ale.sql`

Busca los nombres reales si alguna ruta cambió. No inventes una ruta paralela
sin comprobar primero el código existente.

## 10. Formato de entrega de Claude

Al finalizar cada fase informa:

1. resultado obtenido;
2. evidencia concreta;
3. archivos y migraciones modificados;
4. pruebas ejecutadas;
5. datos reales tocados, si hubo autorización;
6. riesgos y decisiones pendientes;
7. siguiente fase.

La entrega final debe incluir:

- resumen no técnico para Alejandro;
- explicación del caso Nicolás antes/después;
- diagrama pequeño del flujo de decisión;
- inventario de reglas implementadas;
- capturas o demostración visual;
- resultado completo de pruebas;
- instrucciones de despliegue y rollback;
- confirmación explícita de si producción fue modificada o no.

No declares completado el proyecto si solo existe el modelo de datos, solo la
interfaz o solo las pruebas unitarias. “Punta a punta” significa decisión,
persistencia, experiencia del alumno, control del entrenador, auditoría y
verificación real funcionando juntos.
