-- Contador de consumo y saldo de IA.
--
-- Decisiones ya tomadas por el entrenador (handoff 1.15 y 1.16):
--
--  * El SALDO se carga A MANO. La API de Anthropic informa el consumo por
--    llamada, pero no el saldo de la cuenta: no hay forma de leerlo solo. El
--    entrenador escribe cuánto cargó y desde ahí se descuenta lo gastado.
--  * Se cuenta TODO lo que usa IA, no solo el Asistente VIP: la revisión de
--    rutinas, la extracción de PDF y los retos. Hasta ahora `asistente_uso_ia`
--    solo aceptaba las herramientas del asistente, así que el gasto más caro
--    de todos —la revisión de rutinas, ~US$0,24 cada una— no figuraba en
--    ningún lado.
--
-- No aplica a producción por sí sola: la corre el entrenador cuando decida.

alter table configuracion_gimnasio
  add column if not exists saldo_ia_cargado_usd numeric(10, 2) not null default 0
    check (saldo_ia_cargado_usd >= 0),
  add column if not exists saldo_ia_cargado_en timestamptz;

comment on column configuracion_gimnasio.saldo_ia_cargado_usd is
  'Saldo que el entrenador cargó a mano en la cuenta de Anthropic. La API no expone el saldo real, así que este es el punto de partida contra el que se descuenta lo gastado desde saldo_ia_cargado_en.';
comment on column configuracion_gimnasio.saldo_ia_cargado_en is
  'Cuándo se cargó ese saldo. Lo gastado se suma desde esta fecha, no desde el inicio del mes: si no, una carga a mitad de mes descontaría gasto que ya estaba pagado.';

-- Se suman las herramientas que faltaban. Se conservan todas las anteriores:
-- las filas ya escritas tienen que seguir cumpliendo la restricción.
alter table asistente_uso_ia drop constraint if exists asistente_uso_ia_herramienta_check;
alter table asistente_uso_ia add constraint asistente_uso_ia_herramienta_check
  check (herramienta in (
    'atencion', 'nutricion', 'entrenamiento', 'progreso', 'noticia', 'alumno',
    'eliminar_datos',
    -- Nuevas:
    'revision_rutina',      -- auditoría de IA sobre una rutina generada
    'extraccion_documento', -- leer un PDF de rutina o de plan alimentario
    'reto'                  -- retos y reconocimientos semanales
  ));

-- `usuario_id` es NOT NULL y apunta a `perfiles`: para la revisión de rutinas
-- y la extracción de PDF, quien la dispara es el entrenador, así que siempre
-- hay un perfil real que registrar. No se relaja la restricción.

-- Índice por herramienta: el desglose "en qué se fue el saldo" agrupa por acá.
create index if not exists asistente_uso_ia_herramienta_idx
  on asistente_uso_ia (herramienta, created_at desc);
