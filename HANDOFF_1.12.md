# HANDOFF 1.12

## Punto de regreso

- Proyecto: VIP Fitness Portal.
- Carpeta: `C:\dev\vip-fitness`.
- Rama activa: `main`.
- Último commit funcional al comenzar este handoff: `b046057 feat: estructura rutinas con metodo VIP`.
- Remoto: `https://github.com/alealemenmen-create/vip-fitness.git`.
- `main` está sincronizada con GitHub.
- Aplicación local: `http://localhost:3000`.
- El servidor de desarrollo quedó iniciado en segundo plano.

Archivos locales que se conservaron sin subir al repositorio:

```text
Rutinas Alejandro/
respaldo-cloud-ia-2026-08-09.bundle
tmp/
```

`Rutinas Alejandro/` es material fuente del entrenador. No borrar, no publicar y
no mezclar automáticamente con el código. Contiene rutinas y también documentos
personales que deben tratarse con cuidado.

---

## Estado general desde HANDOFF 1.11

Lo que en 1.11 estaba sin commit ya fue guardado. Después se incorporaron y
subieron estos bloques principales:

```text
87f6150 Revisión de IA, ficha obligatoria y generador avanzado
81c7eee Precarga del objetivo y duración en historial
16e9bbd Refuerzo integral del portal, seguimiento, alimentación y Método VIP
e341a5d Protección de puntos y escritura de entrenamientos solo desde servidor
dd33498 Planes mensuales y organización de sesiones por semana
7767ff1 Recuperación del editor después de despliegues
b046057 Arquitectura biomecánica del Método VIP y vista previa profesional
```

El repositorio contiene migraciones hasta `0064_planes_entrenamiento_mensuales.sql`.
Antes de ejecutar una migración en otra base, verificar primero si ya fue
aplicada; no repetir SQL a ciegas.

---

## 1. Generador: la primera fase ahora construye la rutina

La decisión central de Alejandro quedó establecida: la IA no debe rescatar un
borrador malo. El motor determinista tiene que entregar una rutina excelente y
la IA actúa como segundo control.

Se creó `src/lib/rutinas/patrones.ts`, una clasificación biomecánica temporal por
nombre. Distingue, entre otros:

- Press horizontal/inclinado y aislamiento de pecho.
- Tracción vertical, remo horizontal, pullover, bisagra y trapecio.
- Press de hombro, lateral y posterior.
- Bíceps supinado, neutro y con hombro flexionado.
- Tríceps hacia abajo, sobre la cabeza y compuesto.
- Dominante de rodilla, bisagra, empuje de cadera, curl femoral, extensión,
  abducción, aducción y pantorrilla.

### Reglas estructurales activas

- Pecho normal de tres ejercicios: press cargable + segundo empuje + aislamiento.
- Tres aperturas/cruces ya no pueden representar un entrenamiento completo.
- Espalda cubre jalón/dominada + remo antes de buenos días, hiperextensiones,
  encogimientos o accesorios.
- Hombros cubre press vertical + lateral + posterior antes de repetir variantes.
- Pierna parte de una base de rodilla o cadera; aductor/abductor no abre la
  sesión salvo una activación deliberada.
- Bíceps y tríceps cambian patrón real; una traducción distinta no cuenta como
  ejercicio diferente.
- `overhead` y `sobre la cabeza` se reconocen como el mismo patrón.
- Dos jalones con diferente agarre no sustituyen un remo.
- El orden interno prioriza base mecánica, complemento y aislamiento.

Los ejercicios obligatorios que marque Alejandro siguen teniendo prioridad. Si
un obligatorio rompe la estructura ideal, entra, pero el validador muestra la
deficiencia para que sea una decisión consciente.

---

## 2. Técnicas de intensidad

Las técnicas siguen siendo parte de la firma de Alejandro, pero ahora se
controla su función:

- Biseries/superseries no enlazan dos traducciones del mismo patrón.
- Se reparten durante la semana según intensidad y nivel.
- FST-7 transforma el ejercicio en siete series reales.
- FST-7 quedó limitado a accesorios/aislamientos; no debe caer sobre un press
  pesado u otra base multiarticular.
- Drop set, rest-pause, myo-reps, fallo, cluster y giant set conservan sus
  instrucciones concretas.
- La cercanía al fallo se mantiene como rasgo VIP, sin convertir todos los
  compuestos complejos en fallo absoluto indiscriminado.

---

## 3. Auditoría con IA: revisión completa

`src/lib/ai/revisarRutina.ts` ya no le pide a la IA “pocos cambios”. Esa frase era
la causa directa de revisiones superficiales que detectaban diez problemas pero
proponían cinco cambios o menos.

La IA ahora debe revisar ocho capas:

1. Perfil.
2. Estructura del split.
3. Cobertura por patrón muscular.
4. Redundancias y traducciones equivalentes.
5. Orden de ejercicios.
6. Volumen y recuperación.
7. Técnicas de intensidad.
8. Seguridad y antecedentes de la ficha.

La respuesta informa cuántos días y ejercicios revisó y cuántas capas completó.
El servidor verifica esos totales. Si la auditoría está incompleta, no permite
mostrarla como aprobada.

Cada hallazgo alto o medio debe tener cambios concretos, salvo que requiera una
decisión clínica o no exista alternativa real en el catálogo.

Las barreras deterministas del motor también se pasan a la IA para que las
compruebe y explique, pero la IA igualmente debe revisar toda la rutina.

### Limitación conocida de la revisión IA

Los cambios automáticos actuales permiten `reemplazar`, `quitar` y `ajustar`.
Todavía no existe la acción estructurada `agregar ejercicio`. Si la IA detecta
que falta un ejercicio completo, hoy debe resolverlo reemplazando una redundancia
o dejar la indicación para edición manual. Agregar esa acción requiere definir
posición de inserción y soporte en `RutinaDraftEditor`.

---

## 4. Vista previa y editor del borrador

La vista previa dejó de ser un bloque de texto uniforme. Ahora muestra:

- Día destacado y en negrita.
- Una tarjeta compacta por ejercicio.
- Nombre del ejercicio en negrita.
- Borde, nombre y etiqueta por grupo muscular.
- Series, repeticiones y descanso visibles.
- Técnica e instrucción visibles.
- Firma `Alejandro Mendoza · Método VIP Fitness`.

Paleta actual:

```text
Pecho    rojo
Espalda  azul
Piernas  verde
Hombros  ámbar
Bíceps   celeste
Tríceps  morado
Core     rosado
Cardio   turquesa
```

Las biseries mantienen señal morada; superseries, triseries, giant sets y
circuitos conservan los colores de familia ya definidos en `globals.css`.

El editor de cada ejercicio también quedó más compacto:

- Menos padding vertical.
- Nombre fuerte y coloreado.
- Borde por grupo muscular.
- Técnica encadenada visible como etiqueta.
- Observaciones, técnica detallada y configuración de Impulso VIP empiezan
  cerradas y se abren con el chevrón.

Importante: esta es la vista de revisión del entrenador. El contenido que se
guarda sigue siendo el mismo; no se cambió el formato final del documento solo
por colorear el editor.

---

## 5. Barreras de publicación

`src/lib/rutinas/validacion.ts` ahora bloquea o reporta:

- Día vacío.
- Más de diez ejercicios en un día.
- Brazos semanalmente desbalanceados.
- Volumen crítico por grupo.
- Ejercicio exactamente repetido en el mismo día.
- Pecho sin press.
- Pecho con dos aislamientos y base insuficiente.
- Espalda de tres ejercicios sin jalón o sin remo.
- Múltiples jalones sin remo.
- Día enfocado de hombros sin press, lateral y posterior.
- Dos extensiones de tríceps overhead/sobre la cabeza.

---

## 6. Entrenamiento del alumno, guardado y puntos

La sección Entrenar recibió correcciones importantes antes de este handoff:

- Escritura de series solo por Server Actions.
- Persistencia inmediata de pesos y repeticiones.
- Reanudación de sesiones en curso.
- Diferenciación entre sesión del plan y “día” ambiguo.
- Avisos al repetir una sesión ya terminada.
- Una repetición no vuelve a entregar puntos.
- Sesiones cerradas no se sobrescriben directamente.
- Reapertura controlada para corregir errores legítimos.
- Ranking calculado desde movimientos válidos del servidor.
- Migración `0063_entrenamiento_escritura_solo_servidor.sql` endurece la
  escritura contra manipulación directa desde el cliente.

Los puntos históricos de alumnos no se reiniciaron ni se recalcularon. Las
correcciones fueron aditivas y se diseñaron para conservar los acumulados.

No adjudicar manualmente puntos sin revisar antes el historial del alumno y los
movimientos existentes; evitar dobles compensaciones.

---

## 7. Planes mensuales y orden semanal

Se incorporaron los planes principales:

```text
Access  12 sesiones/mes · 3 recomendadas/semana
Select  12 sesiones/mes · 3 recomendadas/semana
Pro     16 sesiones/mes · 4 recomendadas/semana
Élite   20 sesiones/mes · 5 recomendadas/semana
```

- El alumno ve el nombre del plan y sesiones restantes, no el precio.
- El entrenador elige el plan antes de publicar la rutina.
- La pantalla Entrenar divide la secuencia según días recomendados por semana.
- Las sesiones pueden recuperarse dentro del mes sin alterar el orden de la
  rutina.
- Existe pausa administrativa del plan.
- El reinicio mensual depende del ciclo del plan, no de renombrar ejercicios
  como Día 1/Día 2.
- Migración: `0064_planes_entrenamiento_mensuales.sql`.

---

## 8. Seguimiento integral y PDF

Se creó la sección de seguimiento del alumno:

- Resumen de 7/14/30 días o período.
- Adherencia general.
- Sesiones realizadas y omitidas.
- Pesos, repeticiones y evolución.
- Alimentación registrada frente a objetivos.
- Peso, medidas, fotografías y observaciones.
- Alertas de inactividad o bajo cumplimiento.
- Observación/revisión del entrenador.
- Informe imprimible con identidad VIP Fitness y firma del entrenador.

Rutas principales:

```text
/admin/alumnos/[id]/seguimiento
/admin/alumnos/[id]/seguimiento/imprimir
/alumno/progreso
/alumno/progreso/imprimir
```

Migración: `0062_seguimiento_integral.sql`.

---

## 9. Alimentación

La lógica nutricional ahora centraliza objetivos y coherencia de macros:

- Objetivos diarios derivados del plan activo.
- Reconciliación de macros de planes activos.
- Estado de coherencia visible en el panel del entrenador.
- Corrección central para no arreglar alumno por alumno el mismo defecto.
- Migración: `0061_reconciliar_macros_planes_activos.sql`.

Antes de cambiar fórmulas nutricionales, verificar `src/lib/alimentacion/objetivos.ts`
y sus pruebas. Evitar duplicar cálculos en componentes.

---

## 10. Organización del panel del entrenador

El panel quedó reorganizado con:

- Barra lateral persistente en escritorio.
- Navegación inferior en móvil.
- Cabecera superior reducida.
- Tarjetas de estadísticas accionables.
- Filtros reales para alumnos sin rutina, ficha lista y otras categorías.
- Accesos a documentos, ejercicios, alimentos, ingresos, solicitudes,
  seguimiento, auditoría y configuración.
- Formularios y perfiles con secciones más claras y rutas de regreso.

No convertir tarjetas informativas nuevas en elementos clicables sin asignarles
una acción real y verificable.

---

## 11. Fuentes del Método VIP

Se analizaron rutinas representativas dentro de `Rutinas Alejandro/`, incluyendo
planes Classic Physique, VIP de cinco días, Pro, Wellness, Bikini, rutinas de
tres días y planes femeninos/masculinos.

Patrones repetidos encontrados:

- Base pesada o de tensión antes del aislamiento.
- Pecho con press y luego aperturas/cruces.
- Espalda con jalón + remo y, después, pullover/face pull.
- Pierna dividida por cuádriceps, cadena posterior, glúteos o sesión global.
- Técnicas al final o dentro de bloques intencionados.
- Fallo técnico, pirámides, drop sets, biseries y remates metabólicos.
- Mayor especialización según objetivo/categoría sin asumir el objetivo por sexo.

El texto operativo para IA está en:

```text
src/lib/generador-rutinas/metodo-vip.ts
docs/VIP_METHOD_RULEBOOK.md
```

### Limitación estructural pendiente

La columna `patron_movimiento` de la biblioteca existe, pero estaba vacía en los
ejercicios reales revisados. Por eso el motor usa heurísticas por nombre. El paso
correcto a futuro es clasificar la biblioteca con datos estructurados y usar la
heurística solo como respaldo.

---

## Verificación al cierre

```text
Vitest:     22 archivos, 229 pruebas aprobadas
TypeScript: tsc --noEmit limpio
Build:      Next.js 16.2.12 compiló correctamente
Navegador:  borrador real generado y vista previa por colores comprobada
Git:        main sincronizada con origin/main
```

Se verificó visualmente:

- Pecho rojo y nombre con peso 800.
- Bíceps celeste y nombre con peso 800.
- Tríceps morado.
- Biserie identificable.
- Cero paneles de progresión abiertos por defecto.
- Borrador nuevo con press de banca, aperturas, jalón, remo y separación real
  entre bíceps/tríceps.

---

## Próximos pasos recomendados

1. Alejandro debe generar y revisar varias rutinas reales con objetivos
   distintos: hipertrofia, recomposición, Wellness, Bikini, Men's Physique,
   principiante y alumno con restricciones.
2. Registrar cada corrección del entrenador como una regla general solo cuando
   se repita; no sobreajustar el motor a un único alumno.
3. Clasificar la biblioteca con `patron_movimiento`, músculo objetivo y rol de
   sesión, reduciendo dependencia de nombres.
4. Agregar la acción IA `agregar ejercicio` con posición de inserción segura.
5. Continuar extrayendo patrones de las rutinas PDF claramente identificadas,
   sin procesar documentos personales ajenos al entrenamiento.
6. Probar el PDF final de seguimiento e impresión en móvil y escritorio.
7. Mantener vigilancia sobre sesiones, puntos y ranking con alumnos reales; no
   ejecutar correcciones masivas de puntos sin respaldo previo.
8. Cuando se toque alimentación, corregir el generador/objetivo común y no solo
   planes ya existentes.

---

## Regla de continuidad

No rehacer lo ya terminado. Partir desde `main`, leer este handoff, comprobar
`git status`, ejecutar pruebas relacionadas con el área que se vaya a tocar y
preservar siempre:

- Puntos históricos.
- Sesiones completadas.
- Planes activos.
- Rutinas publicadas.
- Documentos y fotografías.
- Carpeta local `Rutinas Alejandro/`.

