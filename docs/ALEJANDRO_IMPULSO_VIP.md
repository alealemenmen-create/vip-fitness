# Alejandro · Impulso VIP

## Definición del producto

Alejandro es el entrenador inteligente del Método VIP dentro de la sesión. No
es un botón que siempre sube peso ni un reemplazo del entrenador. Convierte la
serie que acaba de registrar el alumno y su historial en una decisión breve,
explicable y reversible, sin esperar que el alumno solicite la progresión.

La experiencia conserva el nombre **Impulso VIP**, pero la voz visible para el
alumno es **Alejandro**.

## Arquitectura

1. **Motor histórico existente:** analiza las últimas sesiones válidas, dolor,
   estancamiento, caídas de rendimiento y progresión doble. Su recomendación se
   congela y queda auditable.
2. **Progresión silenciosa:** prepara la siguiente sesión con la carga o las
   repeticiones que correspondan. No obliga al alumno a cambiar discos después
   de cada serie y no consume atención durante el entrenamiento.
3. **Momento Alejandro:** irrumpe automáticamente solo en una última serie
   estratégica. Es escaso, sorpresivo, breve y queda bloqueando la pantalla
   hasta que el alumno haya visto la instrucción.
4. **Supervisión profesional:** una molestia bloquea la progresión y deriva a
   revisión. Las decisiones del entrenador prevalecen sobre la automatización.

## Jerarquía de decisión

El orden no puede invertirse:

1. Molestia o dolor: detener la progresión y revisar.
2. Técnica inestable: bajar un nivel y recuperar control.
3. Serie no completada: reducir estímulo.
4. Caída clara dentro del ejercicio: mantener y controlar fatiga.
5. Completar el mínimo del rango.
6. Completar el techo del rango aumentando repeticiones.
7. Subir carga solamente con técnica limpia y señales positivas.

Esto sigue la jerarquía del Método VIP: seguridad, compatibilidad, adherencia,
distribución, progresión, estímulo y técnicas.

## Frecuencia y selección

El modo automático está encendido por defecto y se puede desactivar desde el
panel de Alejandro o los ajustes de la sesión.

- Inicial o con pocos datos confiables: 1 momento.
- Intermedio constante: 2 momentos.
- Avanzado con historial y retos verificados: 2–3 momentos.
- Experto, constante y autorizado para intensidad alta: hasta 4 momentos.
- Dolor o restricción activa: 0 momentos intensos.

El motor estudia nivel, sesiones válidas, constancia reciente, historial de
carga y repeticiones, resultados de retos, restricciones y autorización. Evita
ejercicios con otra técnica programada, distribuye los momentos dentro de la
sesión y concentra técnicas exigentes en ejercicios seguros y revisados.

El alumno no pulsa un botón para pedir el Impulso. La prescripción ya está
activa cuando aparece; `VOY` solo confirma que leyó la instrucción. Siempre se
mantiene una salida visible para reportar molestia.

## Progresión por equipo

Los saltos son límites, no aumentos obligatorios:

| Equipo | Primera señal | Patrón confirmado | Máximo de una decisión |
| --- | ---: | ---: | ---: |
| Mancuernas | 2,5 kg | 2,5 kg | 2,5 kg |
| Barra | 5 kg | 5–10 kg | 10 kg |
| Máquina | 5 kg | 10–15 kg | 15 kg |
| Peso corporal | Repeticiones | Repeticiones | Sin carga automática |

En libras se usan saltos prácticos de 5 lb. Los objetivos de salud general o
pérdida de grasa quedan limitados al escalón base aunque exista confianza alta.

## Confianza

- **Aprendiendo:** una señal aislada. Solo permite el salto base.
- **Confirmando:** dos señales positivas consecutivas o evidencia equivalente.
- **Patrón confirmado:** tres señales positivas o combinación de sesión actual
  e historial reciente.

La confianza autoriza el tamaño máximo del ajuste; nunca anula las reglas de
seguridad ni obliga a aumentar.

## RIR y lenguaje del alumno

No se exige responder una encuesta en cada serie. El RIR solo se infiere cuando
existen suficientes muestras comparables y consistentes; peso y repeticiones
por sí solos no permiten conocerlo con precisión. Cuando falte confianza se
hace una única pregunta rápida, cerca del esfuerzo que se necesita calibrar.

La instrucción visible usa una frase imperativa, generalmente de 5–10 palabras,
tipografía grande y alto contraste. Ejemplos: `SUPERA TU MARCA POR 1` y
`BAJA 20%. SUMA 6–8 REPETICIONES`.

## Fundamento de diseño

- La actualización 2026 de ACSM prioriza la constancia y una prescripción
  específica al objetivo; no encuentra que entrenar siempre al fallo o usar una
  periodización compleja sea imprescindible para la mayoría de adultos:
  <https://pubmed.ncbi.nlm.nih.gov/41843416/>.
- La cercanía al fallo parece importar más para hipertrofia que para fuerza,
  pero la relación observada requiere cautela y no justifica perseguir el fallo
  en todas las series: <https://pubmed.ncbi.nlm.nih.gov/38970765/>.
- Una revisión no encontró superioridad clara del fallo momentáneo frente al no
  fallo: <https://pubmed.ncbi.nlm.nih.gov/36334240/>.
- La estimación de repeticiones en reserva pierde precisión con cargas ligeras;
  por eso Alejandro usa lenguaje natural y combina varias señales:
  <https://pubmed.ncbi.nlm.nih.gov/33337690/>.
- La autorregulación práctica debe combinar rendimiento, disposición y
  percepción, observando fitness y fatiga en varias escalas temporales:
  <https://pubmed.ncbi.nlm.nih.gov/33312273/> y
  <https://pubmed.ncbi.nlm.nih.gov/39864040/>.

## Implementación V2

La progresión por equipo permanece en `src/lib/impulso-vip/alejandro.ts`. La
orquestación escasa de la sesión vive en
`src/lib/impulso-vip/alejandro-sesion.ts`: resuelve cupo, selecciona ejercicios,
redacta la instrucción y decide si el RIR puede inferirse o debe preguntarse.

La demostración V2 usa dos momentos estratégicos y conserva su estado durante
la sesión. En una sesión autenticada, la misma interfaz consume recomendaciones,
intervenciones y memoria adaptativa reales del Impulso VIP original; las
respuestas y resultados se guardan con identificadores de sesión y serie.

Queda por validar en preview la política RLS de las migraciones nuevas y reunir
suficientes sesiones longitudinales por ejercicio sustituido antes de habilitar
progresiones automáticas sobre ese sustituto.
