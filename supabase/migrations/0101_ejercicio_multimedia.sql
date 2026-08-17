-- Instructivo de galería multimedia, Fase 3 (§8.3): biblioteca multimedia
-- normalizada. Hasta acá cada ejercicio tenía como máximo UNA foto y UN
-- video — las columnas de `ejercicios` (foto_miniatura_url, foto_completa_url,
-- video_cloudflare_uid...). Esta tabla no las reemplaza: sigue siendo la
-- fuente de verdad de lo que ve el alumno, y así se queda — cambiarla
-- rompería el portal y los 40+ archivos que ya la consumen. `ejercicio_multimedia`
-- es ADITIVA: guarda historial (fotos anteriores, videos archivados) y
-- ángulos extra (varias fotos de un mismo ejercicio), y cuando algo de acá
-- se elige como portada/video principal, recién ahí se copia a las columnas
-- de siempre.
--
-- `version_reemplazada_id` encadena versiones: una foto o video archivado
-- puede apuntar a cuál lo reemplazó, para poder mostrar "de qué versión
-- viene esta" sin adivinar por fecha.

create table if not exists ejercicio_multimedia (
  id uuid primary key default gen_random_uuid(),
  ejercicio_id uuid not null references ejercicios(id) on delete cascade,
  tipo text not null check (tipo in ('imagen', 'video')),
  rol text not null default 'galeria'
    check (rol in ('portada', 'galeria', 'demostracion', 'error_comun')),
  es_principal boolean not null default false,
  estado text not null default 'listo'
    check (estado in ('procesando', 'listo', 'error', 'archivado')),
  -- Imagen: URLs de Storage. Video: uid de Cloudflare Stream — sin URL
  -- directa, se reproduce con el iframe firmado de siempre (ver
  -- urlEmbedFirmada en lib/cloudflare/stream.ts).
  storage_path_miniatura text,
  storage_path_completa text,
  video_cloudflare_uid text,
  ancho int,
  alto int,
  duracion_seg numeric,
  tamano_bytes bigint,
  hash_sha256 text,
  orden int not null default 0,
  version_reemplazada_id uuid references ejercicio_multimedia(id) on delete set null,
  creado_por uuid references perfiles(id),
  creado_en timestamptz not null default now(),
  archivado_en timestamptz
);

create index if not exists ejercicio_multimedia_ejercicio_idx
  on ejercicio_multimedia (ejercicio_id, tipo, estado);
-- Como mucho una fila "principal" activa por ejercicio y tipo — es la
-- misma garantía que hoy da tener una sola columna, aplicada a una tabla
-- que puede tener varias filas.
create unique index if not exists ejercicio_multimedia_principal_unique
  on ejercicio_multimedia (ejercicio_id, tipo)
  where es_principal and estado <> 'archivado';

alter table ejercicio_multimedia enable row level security;

drop policy if exists ejercicio_multimedia_select on ejercicio_multimedia;
create policy ejercicio_multimedia_select on ejercicio_multimedia for select
  using (es_admin_o_entrenador());

drop policy if exists ejercicio_multimedia_write on ejercicio_multimedia;
create policy ejercicio_multimedia_write on ejercicio_multimedia for all
  using (es_admin_o_entrenador())
  with check (es_admin_o_entrenador());
