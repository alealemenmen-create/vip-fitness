-- Generador de rutinas: datos que faltaban para calibrar volumen/intensidad
-- y para que el entrenador distribuya la semana a mano (estilo "vieja escuela").

alter table perfiles_entrenamiento
  add column if not exists ayudas_ergogenicas text not null default 'prefiere_no_decir'
    check (ayudas_ergogenicas in ('no', 'si', 'prefiere_no_decir')),
  add column if not exists categoria_competencia text not null default 'ninguna'
    check (categoria_competencia in
      ('ninguna', 'mens_physique', 'classic_physique', 'bodybuilding_open', 'bikini', 'wellness', 'womens_physique')),
  add column if not exists estilo_entrenamiento text not null default 'hibrido'
    check (estilo_entrenamiento in ('nueva_escuela', 'vieja_escuela', 'hibrido')),
  add column if not exists intensidad_deseada text not null default 'estandar'
    check (intensidad_deseada in ('estandar', 'alta', 'competitiva'));

comment on column perfiles_entrenamiento.ayudas_ergogenicas is
  'Solo para calibrar volumen/frecuencia tolerable en la rutina generada. Nunca se usa para sugerir sustancias ni dosis.';
