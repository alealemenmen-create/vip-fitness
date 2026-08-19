# Alejandro · Impulso VIP

## Definición del producto

Alejandro es el entrenador inteligente del Método VIP dentro de la sesión. No
es un botón que siempre sube peso ni un reemplazo del entrenador. Convierte la
serie que acaba de registrar el alumno, su respuesta en lenguaje natural y su
historial en una decisión breve, explicable y reversible.

La experiencia conserva el nombre **Impulso VIP**, pero la voz visible para el
alumno es **Alejandro**.

## Arquitectura

1. **Motor histórico existente:** analiza las últimas sesiones válidas, dolor,
   estancamiento, caídas de rendimiento y progresión doble. Su recomendación se
   congela y queda auditable.
2. **Alejandro en vivo:** prepara la siguiente serie sin aumentarla y adapta
   repeticiones o carga cuando recibe una señal del alumno.
3. **Supervisión profesional:** una molestia bloquea la progresión y deriva a
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

## Lenguaje del alumno

No se exige conocer RIR o RPE. Las respuestas son: muy fácil, fácil, podía hacer
una más, justo, demasiado difícil, no la completé, perdí la técnica y sentí una
molestia. Internamente se conserva compatibilidad con la dificultad ya guardada
por el Impulso VIP original.

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

El motor puro vive en `src/lib/impulso-vip/alejandro.ts`. Devuelve versión,
acción, confianza, carga, repeticiones, bloqueo, mensaje y motivos auditables.
La sesión V2 lo consume sin duplicar las reglas.

En la demostración actual, las señales se conservan durante la sesión. Al
conectar la pantalla V2 a las asignaciones reales, debe enviarse al motor el
objetivo del alumno y la racha histórica que ya calcula el Impulso VIP original,
y persistir respuesta, versión y motivos en las tablas existentes.
