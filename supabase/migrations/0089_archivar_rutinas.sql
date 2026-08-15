-- Permite archivar/ocultar una rutina publicada del listado de "Rutinas
-- hechas" sin borrar nada: las sesiones de entrenamiento ya hechas y los
-- puntos VIP (que no dependen de rutina_id, ver puntos_vip_movimientos) no
-- se tocan. Reversible.

alter table rutinas add column if not exists archivada boolean not null default false;

comment on column rutinas.archivada is
  'Oculta la rutina del listado normal de "Rutinas hechas" sin borrar nada. No afecta sesiones ni puntos.';
