-- Técnicas que aparecen repetidamente en las rutinas reales de Alejandro
-- Mendoza almacenadas en Documentos. Se mantienen estructuradas para que el
-- motor pueda dosificarlas por nivel, fatiga y cantidad máxima por sesión.

insert into tecnicas_entrenamiento
  (nombre, slug, descripcion, tipo, cantidad_ejercicios, nivel_minimo, fatiga,
   requiere_supervision, descanso_interno_seg, descanso_final_seg, maximo_por_sesion)
values
  (
    'FST-7', 'fst-7',
    'Siete series de aislamiento con pausas cortas para un remate localizado.',
    'individual', null, 'avanzado', 'alta', true, 30, 90, 1
  ),
  (
    'Myo-reps', 'myo-reps',
    'Serie de activación seguida por mini-series con pausas breves.',
    'individual', null, 'avanzado', 'alta', true, 15, 120, 1
  ),
  (
    'Giant set', 'giant-set',
    'Tres o cuatro ejercicios encadenados para el mismo bloque muscular.',
    'encadenada', 4, 'avanzado', 'alta', true, 0, 120, 1
  )
on conflict (slug) do update set
  nombre = excluded.nombre,
  descripcion = excluded.descripcion,
  tipo = excluded.tipo,
  cantidad_ejercicios = excluded.cantidad_ejercicios,
  nivel_minimo = excluded.nivel_minimo,
  fatiga = excluded.fatiga,
  requiere_supervision = excluded.requiere_supervision,
  descanso_interno_seg = excluded.descanso_interno_seg,
  descanso_final_seg = excluded.descanso_final_seg,
  maximo_por_sesion = excluded.maximo_por_sesion,
  activa = true;
