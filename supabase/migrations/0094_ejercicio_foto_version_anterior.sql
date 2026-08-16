-- Versionado y recuperación de la foto de un ejercicio (instructivo de
-- reorganización del panel, sección 8.7 / item 5 del audit de Galería).
--
-- `subirFotoEjercicio` (app/admin/ejercicios/actions.ts) borraba el archivo
-- viejo de Storage apenas confirmaba el nuevo — si el entrenador se
-- equivocaba de foto, la anterior ya no existía en ningún lado. Ahora, antes
-- de borrar, la foto que se está reemplazando se guarda acá.
--
-- Se guarda UNA sola versión anterior por ejercicio (no un historial
-- completo): es lo que pide el instructivo ("mantener temporalmente la
-- versión anterior"), y evita que el Storage crezca sin límite con cada
-- reemplazo — mismo cuidado por el que la galería de fotos de progreso del
-- alumno quedó en quincenal en vez de ilimitada. Restaurar borra la fila; un
-- segundo reemplazo sin restaurar de por medio descarta la versión vieja (se
-- borra su archivo de Storage) y guarda la nueva en su lugar.

create table if not exists ejercicio_foto_version_anterior (
  ejercicio_id uuid primary key references ejercicios(id) on delete cascade,
  foto_miniatura_url text not null,
  foto_completa_url text not null,
  foto_panorama_x real not null default 50,
  foto_panorama_y real not null default 50,
  foto_cuadrada_x real not null default 50,
  foto_cuadrada_y real not null default 50,
  reemplazada_por uuid not null references perfiles(id),
  reemplazada_en timestamptz not null default now()
);

alter table ejercicio_foto_version_anterior enable row level security;

drop policy if exists ejercicio_foto_version_anterior_select on ejercicio_foto_version_anterior;
create policy ejercicio_foto_version_anterior_select on ejercicio_foto_version_anterior for select
  using (es_admin_o_entrenador());

drop policy if exists ejercicio_foto_version_anterior_write on ejercicio_foto_version_anterior;
create policy ejercicio_foto_version_anterior_write on ejercicio_foto_version_anterior for all
  using (es_admin_o_entrenador())
  with check (es_admin_o_entrenador());
