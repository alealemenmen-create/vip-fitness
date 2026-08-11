# HANDOFF 1.15

## Punto de regreso

- Rama `main`, **a la par con `origin/main`**. Último commit: `5dc8884`.
- Producción: **https://vipfitness.cl verde y al día** (HTTP 200, `dpl-id 5dc88848b0eb`).
- Sin cambios en la base de datos. No se aplicó ninguna migración.
- Locales sin subir, sin cambios: `Rutinas Alejandro/`, `respaldo-cloud-ia-2026-08-09.bundle`, `tmp/`.

Verificación al cierre: `tsc` limpio · eslint limpio · **242 pruebas** (23 archivos) · build de producción OK.

---

## 1. Rendimiento de la revisión con IA (`dac1374`)

Alejandro: "la IA tarda mucho, no me gusta".

**Medido en vivo, tres revisiones reales contra la base de producción:**

```text
llamada 1: cache_write=8849 cache_read=0    entrada=3636 salida=6556  → 118 s
llamada 2: cache_write=0    cache_read=8849 entrada=3636 salida=8600  → 137 s
llamada 3: cache_write=8849 cache_read=0    (la caché de 5 min se venció)
```

**Hallazgo principal, que contradice el diagnóstico inicial: la caché ahorra
COSTO, no tiempo.** La latencia la manda la SALIDA (6.500-8.600 tokens de
auditoría), no la entrada. Con la caché leída al 100% el tiempo no bajó.

Qué se hizo:
- El catálogo (121 ejercicios) + inventario viajaban al FINAL del mensaje. La
  caché de Anthropic es por prefijo → no se cacheaba nunca. Movidos al bloque
  de sistema.
- TTL de 1 hora: con los 5 minutos por defecto se vencía entre una rutina y la
  siguiente, que es el uso real del entrenador.
- `effort` de `high` a `medium`. Las barreras deterministas
  (`detectarDeficienciasRutina`) siguen corriendo, así que la seguridad no
  depende de ese valor.
- `maxDuration = 300` en la página del generador. **La revisión tarda ~2
  minutos** y se cortaba sola con el límite por defecto.
- Log por revisión (`cache_write/cache_read/entrada/salida`). Sin él no se
  habría detectado el vencimiento de la caché. **No sacarlo.**

**Sigue sin resolverse: los ~2 minutos.** Las únicas dos palancas reales son
modo rápido de Opus 5 (~50 s, al doble de precio: ~US$0,48 por revisión contra
~US$0,24) o pedirle un informe más corto (gratis, pero achica la auditoría a
propósito). Alejandro no eligió ninguna todavía.

**Barra de progreso** (`ProgresoRevisionIA.tsx`): cronómetro real, barra
calibrada contra los 120 s medidos, tope en 95%, aviso a los 3 minutos, y las
8 capas como temario **sin marcar cuál corre** — la API no lo informa.
Si algún día la revisión se acelera, bajar `DURACION_TIPICA_SEG` o la barra
pasa a mentir al revés.

## 2. Armar rutina a mano (`1a58263` + `5dc8884`)

La tercera puerta, en `/admin/armar-rutina`. **Todavía NO está en el menú
lateral** — solo se llega por URL.

El generador pregunta todo antes (91 campos, 7 gavetas); acá se pregunta lo
mínimo y el trabajo fino se hace después, sobre la rutina ya armada.

- **Tres niveles** (`niveles-armado.ts`): Competitivo/Olympia, Estándar,
  Senior/recuperación. No es un motor nuevo: cada nivel es un brief
  preconfigurado para `generarRutinaPorReglas`. Senior apaga las técnicas a
  mano (no en "automático": el motor las habilita desde intermedio).
  Competitivo usa inspiración `volumen_tradicional`, que dispara una segunda
  técnica encadenada sobre los accesorios sueltos. **5 pruebas.**
- **La vista previa se exportó** con modo `expandida` (mesa de trabajo) en vez
  de duplicarse. En ese modo se esconde el editor por día.
- **Descansos** insertables entre los días que el entrenador quiera, con
  renumeración automática. El tipo "descanso" ya existía en el modelo.
- **Selector de técnicas real**: antes era texto libre donde había que
  escribir "Biserie (1/2)" de memoria; mal tipeada no la reconocía ni el color
  ni la IA. Al elegir una encadenada se etiquetan los N ejercicios y se crean
  los que falten. Lo escrito a mano en rutinas viejas se respeta.
- **La ficha del alumno arriba de la mesa de trabajo**: molestias, lesiones,
  operaciones, condiciones y ejercicios no deseados, en amarillo, MIENTRAS se
  eligen los ejercicios. El motor no lee texto libre y la IA llega dos minutos
  después; el entrenador puede actuar en el momento.
- Días (1-7) y minutos como botones. Sin encabezado grande.

**Verificado en vivo con clic real**: la página carga los 68 alumnos con su
plan, precarga 3 días desde el Plan Access de la alumna, arma 18 ejercicios
con sus lápices y "+", y en nivel Senior salieron 0 técnicas.
**NO verificado con clic real**: el encadenado de técnicas (biserie → dos
espacios). Pasa el typecheck, nada más.

---

## Cola pendiente, en el orden que pidió Alejandro

1. **Multi-selección de alumnos** en "¿Para quién?" — la misma rutina para
   dos o más. El motor ya lo soporta (`alumnoIds`); falta la pantalla.
2. **Que el cuadro "¿Para quién?" se pliegue** cuando ya se eligió.
3. **Pestañas en Generador**: armar-a-mano como PRINCIPAL, después Documentos,
   después el de la encuesta. Y la entrada en el menú lateral.
4. **Achicar cuadros y campos** para que entre más en la pantalla del celular.
5. **Micrófono** al lado de cada campo de escritura (dictado). Aviso dado: en
   iPhone el soporte es irregular; probarlo ahí antes de ponerlo en todos lados.
6. **"Rutinas generadas"**: elegir persona, ver todas sus rutinas, abrir una y
   editarla en armar-a-mano, republicar. Los borradores ya se guardan en
   `borradores_generador_rutinas`.
7. **Los tres perfiles de entrenador de verdad.** Pedido textual: que actúe
   como entrenador de élite de Mr. Olympia, como entrenador de personas
   mayores, y como entrenador de sala (vieja y nueva escuela). Hoy están
   APROXIMADOS con las perillas del brief; para que sean tres criterios
   distintos hay que tocar el motor. Es trabajo de una sesión completa.
8. **Auditoría del generador automático** — ya hecha, falta aplicarla:
   - Se quedan: alumno, grupos por día (marcado como indispensable), días/
     tiempo/ejercicios, obligatorios-preferidos-prohibidos, tope por grupo, cardio.
   - Se fusionan: Objetivo + Prioridad (repiten opciones); Estilo de
     entrenamiento se va (solo cambia la distribución por atrás);
     Intensidad + Técnicas + Inspiración → los tres niveles.
   - Se van (son datos del ALUMNO, ya están en su ficha): ayudas ergogénicas,
     categoría de competencia. Y "enfoque de forma", que adivina por el nombre.
   - Resultado: de 21 controles a ~8, el resto en "Ajustes avanzados".
9. **Contador de consumo y saldo.** Decisiones ya tomadas por Alejandro:
   saldo cargado A MANO en Configuración (la API de Anthropic **no expone el
   saldo de la cuenta** — solo el consumo por llamada), y contar **todo** lo
   que usa IA: revisión de rutinas, Asistente VIP, extracción de PDF y retos.
   Necesita tabla nueva → migración a escribir y que corra Alejandro.

**Dos propuestas mías esperando su sí o su no** (no las pidió él):
- Avisar en rojo EN EL MOMENTO cuando un ejercicio elegido choca con la ficha,
  sin esperar los 2 minutos de la IA. Los datos ya están.
- Guardar rutinas suyas como plantillas reutilizables ("Pecho pesado de
  Alejandro"), aplicables a cualquier alumno.

---

## Regla de continuidad

Leer este handoff y el 1.14. Preservar puntos históricos, sesiones, rutinas
publicadas, documentos, fotos, planes activos y `Rutinas Alejandro/`.
No aplicar migraciones ni escribir en masa sobre datos de alumnos sin
autorización expresa. **`main` despliega solo a producción**: no pushear sin
que Alejandro lo autorice.

Feedback explícito de esta sesión, a tener presente: *"siento que todas las
ideas son mías y no me ayudas"*. Corresponde proponer, no solo ejecutar.
