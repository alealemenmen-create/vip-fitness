-- Control VIP V2 (Fase 0) se habilita cuenta por cuenta durante el piloto,
-- igual que 0116_portal_v2_piloto.sql para alumnos. False por defecto: crear
-- el shell nuevo nunca cambia lo que ve un entrenador o admin que Alejandro
-- no invitó explícitamente a probarlo.
alter table public.perfiles
  add column if not exists control_vip_v2_habilitado boolean not null default false;

comment on column public.perfiles.control_vip_v2_habilitado is
  'Permite a un entrenador/admin entrar a /control-vip durante el piloto controlado.';
