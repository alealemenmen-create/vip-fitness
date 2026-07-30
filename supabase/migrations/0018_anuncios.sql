-- Anuncios del gimnasio: el entrenador publica novedades generales (no por
-- alumno, a diferencia de notas_entrenador) que ven TODOS los alumnos en
-- "Noticias VIP". Se muestran junto a las noticias automáticas (torneos,
-- rangos, peso) pero son las únicas que el entrenador redacta a mano.
create table anuncios (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  mensaje text not null,
  creado_por uuid references perfiles(id),
  created_at timestamptz not null default now()
);

alter table anuncios enable row level security;

-- Cualquier usuario logueado (alumno o entrenador) puede leerlos.
create policy anuncios_select on anuncios for select
  using (auth.uid() is not null);

-- Solo entrenador/admin puede publicar, editar o borrar.
create policy anuncios_write on anuncios for all
  using (es_admin_o_entrenador())
  with check (es_admin_o_entrenador());

-- Marca de "hasta cuándo vio Noticias" cada alumno — con esto alcanza para
-- el punto rojo de aviso, sin necesitar una tabla de lecturas por anuncio.
alter table alumno_perfil add column noticias_vistas_en timestamptz;
