-- Portal VIP V2 se habilita alumno por alumno durante el piloto.
-- False por defecto: publicar la V2 nunca cambia la experiencia de quienes
-- todavía no fueron invitados por Alejandro.
alter table public.alumno_perfil
  add column if not exists portal_v2_habilitado boolean not null default false;

comment on column public.alumno_perfil.portal_v2_habilitado is
  'Permite al alumno entrar al Portal VIP V2 durante el piloto controlado.';
