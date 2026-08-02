-- Trae Open Food Facts al catálogo de alimentos, sumado a lo curado por el
-- entrenador (0001) y lo que crean los alumnos a mano (0030_alimentos_aprobacion).
--
-- Los productos importados de Open Food Facts entran directo al catálogo
-- compartido: `creado_por = null`, `aprobado = true`. A diferencia de un
-- alimento "Personalizado" (que nace pendiente de revisión), vienen de una
-- base de datos externa ya curada — no hace falta que el entrenador los
-- revise uno por uno.
--
-- `origen` distingue de dónde salió cada fila:
--   catalogo       -> lo de siempre (entrenador, o ya estaba antes de esto)
--   openfoodfacts  -> importado; se comporta como "catalogo" en aprobación,
--                     pero queda marcado por si hace falta filtrarlo después
--   personalizado  -> lo creó un alumno a mano (0030), pendiente de revisar

alter table alimentos add column if not exists origen text not null default 'catalogo';
alter table alimentos drop constraint if exists alimentos_origen_check;

-- Normaliza valores de un intento anterior de esta misma función (una
-- versión previa de esta migración, antes de que existiera 0030, usaba otro
-- rango: 'local'/'usuario'). Si nunca se corrió, estos updates no tocan nada.
update alimentos set origen = 'catalogo' where origen = 'local';
update alimentos set origen = 'personalizado' where origen = 'usuario';
update alimentos set origen = 'personalizado' where creado_por is not null and origen = 'catalogo';

alter table alimentos add constraint alimentos_origen_check
  check (origen in ('catalogo', 'openfoodfacts', 'personalizado'));

alter table alimentos add column if not exists off_id text;
alter table alimentos add column if not exists marca text;
alter table alimentos add column if not exists imagen_url text;

-- Un mismo producto de Open Food Facts no debería importarse dos veces.
create unique index if not exists alimentos_off_id_key on alimentos (off_id) where off_id is not null;

-- Limpieza de ese mismo intento anterior: el alta del alumno ahora pasa
-- siempre por el servidor con cliente admin (mismo patrón que
-- crearAlimentoPersonalizado, migración 0030), así que la política de RLS
-- que dejaba insertar directo desde el cliente ya no hace falta, y la
-- columna "verificado" quedó reemplazada por "aprobado".
drop policy if exists alimentos_insert_alumno on alimentos;
alter table alimentos drop column if exists verificado;
