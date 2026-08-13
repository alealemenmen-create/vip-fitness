-- Corregir un registro deja de reabrir la rutina.
--
-- "Corregir registro" ponía la sesión de vuelta en `en_progreso`. El efecto no
-- era corregir: era volver a entrenar. La sesión pasaba a ser la activa del
-- alumno (bloqueando cualquier otra), reaparecía el cronómetro, el aviso al
-- salir y el "Entrenamiento en curso" arriba. Alejandro: "corregir registro
-- inicia nuevamente la rutina, y no es la idea, es corregir el registro. Y si
-- lo quiero hacer de nuevo, le pido al entrenador que lo borre y la hago de
-- nuevo".
--
-- Con esta columna la sesión se queda **cerrada** (`completada` o
-- `finalizada_incompleta`) y solo se abre para editar los números. No ocupa el
-- cupo de sesión activa, no corre ningún reloj y no vuelve a sumar puntos.
--
-- `null` = no se está corrigiendo, que es el estado de todas las filas de hoy
-- y el comportamiento de siempre para todo lo que no pase por acá.
--
-- Es una marca de trabajo en curso, no un dato histórico: se pone al abrir la
-- corrección y se limpia al terminarla. Que quede colgada no rompe nada — la
-- sesión sigue cerrada y contando igual — solo deja los campos editables.

alter table sesiones_entrenamiento
  add column if not exists corrigiendo_desde timestamptz;

comment on column sesiones_entrenamiento.corrigiendo_desde is
  'No null mientras el alumno está editando un registro ya cerrado. No cambia el estado de la sesión ni sus puntos: solo habilita la escritura de series. Ver reabrirSesion / terminarCorreccion.';
