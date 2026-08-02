-- Arena VIP: convierte los torneos existentes en competencias oficiales,
-- transparentes y conectadas a Progreso VIP.

alter type torneo_metrica add value if not exists 'progreso_vip';

alter table torneos
  add column if not exists modalidad text not null default 'reto_coach',
  add column if not exists regla_publica text;

alter table torneos drop constraint if exists torneos_modalidad_check;
alter table torneos
  add constraint torneos_modalidad_check
  check (modalidad in ('duelo', 'reto_coach', 'copa_constancia'));

-- Los premios de Arena se registran en la misma fuente de verdad del ranking.
alter table puntos_vip_movimientos
  drop constraint if exists puntos_vip_movimientos_categoria_check;
alter table puntos_vip_movimientos
  add constraint puntos_vip_movimientos_categoria_check
  check (categoria in ('entrenamiento', 'alimentacion', 'progreso', 'constancia', 'competencia', 'ajuste'));

comment on column torneos.puntos_en_juego is
  'Bolsa de premio aportada por VIP Fitness; nunca se descuenta del saldo de los alumnos.';
comment on column torneos.regla_publica is
  'Regla visible e inmutable para los alumnos desde que aceptan la competencia.';
