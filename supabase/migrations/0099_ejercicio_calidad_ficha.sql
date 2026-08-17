-- Instructivo de galería multimedia (§7.3, "ficha incompleta segura"): el
-- alta rápida hoy exige nombre + grupo muscular + categoría + equipo + tipo
-- de movimiento, todo en el peor momento posible (el entrenador con el
-- teléfono en la mano, en el gimnasio). Esta migración permite crear un
-- ejercicio con SOLO el nombre y clasificarlo después, sin bloquear la
-- captura del material.
--
-- grupo_muscular/categoria/equipo pasan a admitir NULL. El check existente
-- de cada columna (`check (col in (...))`, 0026_biblioteca_ejercicios.sql)
-- no hace falta tocarlo: en Postgres, un CHECK que evalúa NULL (no FALSE) se
-- considera cumplido — "NULL in (...)" da NULL, nunca FALSE — así que sacar
-- el NOT NULL alcanza para permitir la fila sin clasificar sin aflojar la
-- validación de los valores que sí se cargan.
--
-- calidad_ficha marca qué ejercicios todavía no tienen clasificación
-- confiable. Por default 'completa' — así toda la biblioteca actual queda
-- clasificada como está, sin backfill manual. Los nuevos ejercicios creados
-- sin clasificar entran como 'requiere_clasificacion': obtenerBiblioteca()
-- (src/lib/ejercicios/data.ts) los deja afuera de la lista que ve el resto
-- de la app —generador de rutinas, Mesa, Carga masiva— hasta que alguien
-- complete el grupo/categoría/equipo desde la cola "Completar ficha".

alter table ejercicios
  alter column grupo_muscular drop not null;
alter table ejercicios
  alter column categoria drop not null;
alter table ejercicios
  alter column equipo drop not null;

alter table ejercicios
  add column if not exists calidad_ficha text not null default 'completa'
    check (calidad_ficha in ('completa','requiere_clasificacion'));

create index if not exists ejercicios_calidad_ficha_idx
  on ejercicios (calidad_ficha) where calidad_ficha <> 'completa';
