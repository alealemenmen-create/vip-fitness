# Portal VIP Fitness v2 — visión y reglas del producto

Actualizado: 2026-08-18  
Estado: definición inicial aprobada por el propietario  
Base de código: rama local `portal-v2`, nacida del commit `2c5996f`

## 1. Visión

Portal VIP Fitness v2 tomará a STNDRD como referencia mínima de calidad de
producto, simplicidad y experiencia inmersiva. La meta no es construir una
versión reducida de STNDRD, sino alcanzar ese estándar y superarlo mediante las
fortalezas propias de VIP Fitness: entrenador real, personalización, seguimiento,
Impulso VIP, control profesional, comunidad local y evolución continua.

La rutina y el entrenamiento del día serán el centro de la experiencia. La
interfaz aprovechará la pantalla completa, reducirá elementos decorativos que
compitan con la tarea principal y usará fotografías o videos con capas discretas
cuando aporten contexto.

Todo el producto estará en español neutro profesional, con vocabulario claro,
preciso y natural para usuarios latinoamericanos.

## 2. Requisitos no negociables

1. El portal actual no se destruye ni se sustituye de forma irreversible.
2. La nueva experiencia se construye y prueba sin afectar a los alumnos reales.
3. Durante el piloto convivirán `Vista v2` y `Vista clásica`.
4. Cambiar de vista no puede duplicar, perder ni alterar datos del entrenamiento.
5. Impulso VIP se conserva y debe destacar dentro de la nueva experiencia.
6. El entrenamiento del día seguirá siendo el contenido principal al entrar.
7. La navegación y los gestos deben sentirse simples, fluidos e inmersivos.
8. La v2 conservará los datos, funcionalidades útiles y servicios ya pagados.
9. La publicación final utilizará el proyecto, dominio e infraestructura actuales.
10. Ningún servicio adicional de pago se contratará sin autorización expresa.

## 3. Respaldo funcional: Vista clásica

La interfaz de entrenamiento vigente se preservará como `Vista clásica` durante
el período de evaluación de la v2.

- La preferencia será individual por usuario y persistente entre sesiones.
- El selector será pequeño, claro y fácil de encontrar, sin dominar la pantalla.
- Ambas vistas usarán la misma fuente de datos y las mismas acciones del servidor.
- No se duplicará el motor de entrenamiento, los puntos ni Impulso VIP.
- La Vista clásica no se eliminará hasta recibir una orden expresa del propietario,
  después de evaluar la aceptación de la v2 durante al menos una semana.
- El uso de cada vista podrá medirse para apoyar la decisión de retiro.

La implementación debe separar la lógica compartida de las dos presentaciones:

```text
Datos y motor de entrenamiento compartidos
                   |
          +--------+--------+
          |                 |
     Vista clásica       Vista v2
```

## 4. Modelo de acceso

### Alumno

- Ve su rutina, entrenamiento, nutrición, progreso, puntos y comunidad.
- No accede a controles administrativos ni datos de otros alumnos.

### Entrenador

- Gestiona únicamente los alumnos, rutinas, seguimientos y contenidos que le
  correspondan.
- Puede tener además un perfil personal de alumno para realizar su propia rutina.
- No modifica configuración global, diseño, permisos ni infraestructura.

### Superadministrador / Propietario

- Puede usar su propio espacio de entrenamiento como alumno.
- Puede entrar al Panel del Entrenador.
- Puede entrar a `Estudio VIP`, el espacio de administración global y diseño.
- Puede visualizar la experiencia como alumno y editar en contexto.
- Tiene control sobre roles, contenidos globales, configuración y publicación.

### Estudio VIP y edición en contexto

El propietario dispondrá de una vista equivalente a la del alumno con un modo de
edición seguro. Los controles de edición se mostrarán solamente al
superadministrador y nunca se incluirán en la experiencia normal del alumno.

Cuando se visualice la cuenta o experiencia de otra persona debe existir:

- un aviso permanente de que se está en modo de vista/edición;
- una salida clara para volver a la cuenta propia;
- autorización verificada en el servidor;
- registro de auditoría para los cambios importantes.

## 5. Principios de experiencia

- Pantalla completa y contenido principal dominante.
- Marca VIP presente de manera sutil, no ocupando espacio útil innecesario.
- Jerarquía visual basada en imagen, rutina, progreso y siguiente acción.
- Navegación inferior breve y estable.
- Menús secundarios contextuales, preferentemente laterales o en paneles
  inferiores.
- Gestos naturales y transiciones con propósito, nunca decorativas o confusas.
- Acciones principales grandes y evidentes; opciones avanzadas progresivamente
  reveladas.
- Estados vacíos, carga, error y confirmación diseñados desde el comienzo.
- Accesibilidad, contraste, legibilidad y uso con una sola mano en celular.

## 6. Estructura de referencia observada en STNDRD

La referencia utiliza cuatro destinos principales:

1. Entrenamiento.
2. Nutrición.
3. Dashboard / Progreso.
4. Más / Cuenta.

La adaptación VIP debe conservar esa simplicidad sin perder capacidades actuales.
La portada muestra programa activo, progreso semanal, día seleccionado,
entrenamiento principal, biblioteca, constructor y entrenamientos bajo demanda.

Los patrones a adaptar incluyen:

- catálogo visual de programas por objetivo;
- detalle, cambio, reinicio y reordenamiento de un programa;
- entrenamiento inmersivo con video, series, descanso y siguiente ejercicio;
- registro nutricional por fecha y hora;
- progreso, peso, estadísticas, logros, medallas y clasificación;
- configuración concentrada y sin saturar la navegación principal.

No se copiarán marcas, textos, imágenes, videos ni recursos propietarios de
STNDRD. VIP Fitness tendrá recursos, contenido y expresión visual propios.

## 7. Impulso VIP en la v2

Impulso VIP es una ventaja competitiva y no un añadido secundario.

- Debe integrarse en el flujo natural de la serie, sin parecer otra aplicación.
- Debe anticipar el reto, explicar la decisión y mostrar el resultado.
- No debe tapar permanentemente el video, los datos de la serie ni la acción
  principal.
- Mantendrá calibración, elegibilidad, memoria adaptativa, puntos y comunicación
  con el entrenador que ya existen.
- La nueva presentación deberá hacer que el alumno entienda por qué aparece y qué
  gana al aceptarlo.

## 8. Comunidad vinculada al progreso

La comunidad se proyecta como una extensión del avance real, no como una red
social genérica.

Posibles eventos compartibles, sujetos a privacidad y elección del alumno:

- entrenamiento completado;
- racha o constancia;
- logro, medalla o ascenso;
- progreso dentro de un programa;
- desafío completado;
- reconocimiento del entrenador;
- transformación o foto autorizada por el alumno.

La comunidad requerirá controles de privacidad, moderación, reportes y permisos
antes de publicarse para alumnos reales.

## 9. Estrategia de construcción

### Etapa 0 — Seguridad y cimientos

- Proteger el punto exacto del portal actual.
- Preparar entorno de datos y despliegue de pruebas.
- Diseñar la preferencia Vista v2 / Vista clásica.
- Definir roles Alumno, Entrenador y Superadministrador.

### Etapa 1 — Estructura e Inicio

- Nuevo marco móvil a pantalla completa.
- Navegación principal simplificada.
- Inicio centrado en rutina activa, semana y entrenamiento del día.
- Menú contextual del programa.
- Acceso a Vista clásica.

### Etapa 2 — Entrenamiento v2

- Vista previa del entrenamiento.
- Ejecución inmersiva de ejercicios y series.
- Video, historial, sustitución, descanso y resumen.
- Integración completa de Impulso VIP.
- Pruebas comparativas con la Vista clásica.

### Etapa 3 — Nutrición y Progreso

- Registro diario simplificado.
- Macros, alimentos, escáner y planes existentes adaptados.
- Dashboard, peso, fotos, estadísticas, puntos, logros y medallas.

### Etapa 4 — Comunidad y programas

- Catálogo de programas VIP.
- Entrenamientos bajo demanda.
- Desafíos y eventos de progreso compartibles.
- Comunidad con privacidad y moderación.

### Etapa 5 — Estudio VIP

- Separación completa de entrenador y superadministrador.
- Vista como alumno y edición en contexto.
- Configuración visual y de contenidos.
- Auditoría y publicación controlada.

## 10. Criterio de avance

Se construirá una etapa por vez. Cada etapa debe poder probarse en celular sin
afectar producción y deberá ser aprobada antes de ampliar el alcance. La intuición
de diseño puede orientar decisiones menores, pero los cambios que afecten datos,
roles, cobros, publicación o comportamiento central se presentarán antes de
activarse.

