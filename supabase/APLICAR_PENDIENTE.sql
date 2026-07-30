-- ============================================================
-- APLICAR TODO LO PENDIENTE — VIP Fitness, 30 de julio de 2026
-- ============================================================
--
-- Copiar este archivo COMPLETO y pegarlo en el SQL editor de Supabase.
-- Es seguro correrlo dos veces: todo es idempotente.
--
-- Contiene, en orden:
--   1. Migracion 0026 — biblioteca de ejercicios
--   2. Semilla — 103 ejercicios
--   3. Migracion 0027 — documentos y asignaciones
--
-- Al terminar tiene que decir "Success". Si algo falla, avisar ANTES de
-- desplegar: la app nueva espera estas tablas.
-- ============================================================


-- ============================================================
-- 1 de 3 — MIGRACION 0026
-- ============================================================

-- Biblioteca maestra de ejercicios.
--
-- Hasta ahora `rutina_dia_ejercicios.nombre` era texto libre que escribía la IA
-- al leer el PDF de la rutina: no había forma de saber que "Jalón al pecho" y
-- "Jalón amplio" son el mismo movimiento, ni de colgarles técnica, errores
-- comunes o una ilustración. Esta tabla es el catálogo central; las rutinas
-- pasan a apuntarle.
--
-- Decisiones de diseño que conviene no perder:
--
-- 1. `ilustracion_slug` va SEPARADO de `slug`. Varios ejercicios comparten
--    dibujo a propósito (press banca y press en Smith, curl con barra y curl
--    EZ, jalón amplio y jalón supino). Si la ilustración se dedujera del slug
--    del ejercicio harían falta ~80 dibujos en vez de ~45, todos casi iguales.
--
-- 2. `aliases` es lo que hace que el emparejado automático funcione. El PDF de
--    cada entrenador nombra distinto el mismo movimiento; acá se juntan todas
--    las formas conocidas de decirle.
--
-- 3. `rutina_dia_ejercicios.ejercicio_id` es NULLABLE y se conserva `nombre`.
--    Es deliberado: si fuera obligatorio, el día que la IA lea un nombre que no
--    está en la biblioteca la rutina entera no se podría publicar. Así el
--    ejercicio sin reconocer se publica igual con su nombre, y el entrenador lo
--    empareja cuando quiera. Además las 160 filas que ya existen siguen
--    funcionando sin migración de datos.

create table if not exists ejercicios (
  id uuid primary key default gen_random_uuid(),

  -- Identidad
  slug text not null unique,
  nombre text not null,
  -- Otras formas de nombrar el mismo movimiento, para el emparejado por PDF.
  aliases text[] not null default '{}',

  -- Clasificación
  grupo_muscular text not null
    check (grupo_muscular in ('pecho','espalda','piernas','hombros','brazos','core','cardio')),
  grupos_secundarios text[] not null default '{}',
  -- Patrón de movimiento: sirve para armar rutinas equilibradas y para filtrar.
  categoria text not null
    check (categoria in ('empuje','traccion','pierna','core','cardio','aislamiento','full_body')),
  equipo text not null
    check (equipo in ('barra','mancuerna','polea','maquina','smith','peso_corporal','kettlebell','banda','banco','otro')),
  nivel text not null default 'intermedio'
    check (nivel in ('principiante','intermedio','avanzado')),

  -- Contenido para el alumno
  descripcion_corta text,
  tecnica text,
  errores_comunes text[] not null default '{}',
  consejos text[] not null default '{}',

  -- Medios. La ilustración es un archivo estático servido desde /public
  -- (public/ejercicios/<ilustracion_slug>.svg), nunca se genera al vuelo.
  ilustracion_slug text,
  video_url text,

  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- El emparejador busca por nombre y por alias en cada importación de rutina.
create index if not exists ejercicios_slug_idx on ejercicios (slug);
create index if not exists ejercicios_grupo_idx on ejercicios (grupo_muscular) where activo;
create index if not exists ejercicios_aliases_idx on ejercicios using gin (aliases);

-- Enlace desde la rutina. Nullable a propósito (ver nota 3 arriba).
-- `on delete set null`: desactivar o borrar un ejercicio de la biblioteca no
-- puede romper rutinas ya publicadas — se cae al `nombre` que ya está guardado.
alter table rutina_dia_ejercicios
  add column if not exists ejercicio_id uuid references ejercicios(id) on delete set null;

create index if not exists rutina_dia_ejercicios_ejercicio_idx
  on rutina_dia_ejercicios (ejercicio_id);

-- RLS: catálogo global, mismo criterio que `alimentos` (migración 0001) —
-- cualquier autenticado lee, solo entrenador/admin escribe.
alter table ejercicios enable row level security;

drop policy if exists ejercicios_select on ejercicios;
create policy ejercicios_select on ejercicios for select
  using (auth.uid() is not null);

drop policy if exists ejercicios_write on ejercicios;
create policy ejercicios_write on ejercicios for all
  using (es_admin_o_entrenador())
  with check (es_admin_o_entrenador());


-- ============================================================
-- 2 de 3 — SEMILLA DE EJERCICIOS
-- ============================================================

-- Biblioteca inicial de ejercicios de VIP Fitness.
--
-- Idempotente: se puede re-correr sin duplicar (on conflict sobre `slug`).
-- Al reaplicarla se actualiza el contenido pero NO se pisa `activo`, para no
-- reactivar algo que el entrenador desactivó a propósito.
--
-- Sobre `ilustracion_slug`: varias filas comparten dibujo deliberadamente.
-- **Los 102 ejercicios de acá necesitan solo 70 ilustraciones.**
--
-- La regla para compartir: misma postura del cuerpo, cambia solo el implemento
-- o el agarre (press banca / press en Smith / press con mancuernas; curl con
-- barra recta / con barra EZ; jalón amplio / jalón supino; abductores /
-- aductores, que son la misma máquina al revés).
--
-- Y la regla para NO compartir, que importa más: si el movimiento se ve
-- distinto, va dibujo propio. Un dibujo que muestra otro movimiento es peor
-- que no tener dibujo — el punto de la ilustración es que el alumno entienda
-- la ejecución sin preguntar.
--
-- Los archivos van en public/ejercicios/<ilustracion_slug>.svg. Mientras no
-- existan, la app cae automáticamente a la foto del grupo muscular — ver
-- src/lib/ejercicios/ilustracion.ts.

insert into ejercicios
  (slug, nombre, aliases, grupo_muscular, grupos_secundarios, categoria, equipo, nivel,
   descripcion_corta, tecnica, errores_comunes, consejos, ilustracion_slug)
values

-- ── PECHO ────────────────────────────────────────────────────────────────
('press-banca', 'Press de banca', array['press banca plano','press pecho','bench press','press horizontal'],
 'pecho', array['hombros','brazos'], 'empuje', 'barra', 'intermedio',
 'El empuje horizontal clásico para pecho.',
 'Acostado en el banco, pies firmes en el suelo y omóplatos juntos. Baja la barra controlada hasta la mitad del pecho y empuja hasta estirar los codos sin bloquearlos de golpe.',
 array['Rebotar la barra en el pecho','Despegar la espalda baja del banco','Abrir los codos a 90 grados'],
 array['Baja en 2 segundos y sube con intención','Mantén las muñecas alineadas con los antebrazos'],
 'press-banca'),

('press-banca-smith', 'Press de banca en Smith', array['press smith','press multipower','press banca maquina smith'],
 'pecho', array['hombros','brazos'], 'empuje', 'smith', 'principiante',
 'Igual que el press de banca pero con la barra guiada.',
 'La barra va sobre rieles, así que no tienes que estabilizarla. Ideal para aprender el movimiento o para trabajar pesado sin ayudante.',
 array['Colocar el banco muy adelantado o muy atrasado'],
 array['Sirve para acostumbrarte al recorrido antes de pasar a la barra libre'],
 'press-banca'),

('press-inclinado-barra', 'Press inclinado con barra', array['press inclinado','press superior','incline press'],
 'pecho', array['hombros','brazos'], 'empuje', 'barra', 'intermedio',
 'Empuje en banco inclinado, carga la parte alta del pecho.',
 'Banco entre 30 y 45 grados. Baja la barra a la altura de las clavículas y empuja hacia arriba y ligeramente atrás.',
 array['Inclinar el banco más de 45 grados y convertirlo en press de hombro'],
 array['30 grados suele ser suficiente para sentir el pecho alto'],
 'press-inclinado'),

('press-inclinado-mancuernas', 'Press inclinado con mancuernas', array['press inclinado mancuerna','incline dumbbell press'],
 'pecho', array['hombros','brazos'], 'empuje', 'mancuerna', 'intermedio',
 'Versión con mancuernas: más recorrido y cada lado trabaja solo.',
 'Sube llevando las mancuernas una hacia la otra sin golpearlas. Baja hasta sentir el estiramiento del pecho, sin forzar el hombro.',
 array['Bajar demasiado y comprometer el hombro'],
 array['Permite corregir descompensaciones entre un lado y el otro'],
 'press-inclinado'),

('press-plano-mancuernas', 'Press plano con mancuernas', array['press mancuernas','dumbbell bench press'],
 'pecho', array['hombros','brazos'], 'empuje', 'mancuerna', 'intermedio',
 'Empuje horizontal con mancuernas.',
 'Mismo patrón que el press de banca, con más rango de movimiento y más exigencia de estabilidad.',
 array['Perder la posición de los omóplatos'],
 array['Empieza más liviano que en barra: cuesta más estabilizar'],
 'press-banca'),

('aperturas-mancuernas', 'Aperturas con mancuernas', array['aperturas','vuelos pecho','flyes','aperturas planas'],
 'pecho', array['hombros'], 'aislamiento', 'mancuerna', 'intermedio',
 'Aislamiento de pecho con los brazos casi extendidos.',
 'Codos levemente flexionados y fijos durante todo el recorrido. Abre hasta sentir el estiramiento y cierra como si abrazaras un barril.',
 array['Flexionar los codos y convertirlo en un press','Bajar más allá de la línea del hombro'],
 array['Es un ejercicio de sensación, no de peso máximo'],
 'aperturas'),

('aperturas-polea', 'Aperturas en polea', array['cruces en polea','cruce poleas','cable crossover','cruces'],
 'pecho', array['hombros'], 'aislamiento', 'polea', 'intermedio',
 'Aperturas con tensión constante de principio a fin.',
 'De pie, un paso adelante y torso levemente inclinado. Junta las manos al frente y controla la vuelta.',
 array['Usar el peso del cuerpo para empujar'],
 array['La polea mantiene tensión incluso al final, a diferencia de las mancuernas'],
 'aperturas-polea'),

('press-maquina-pecho', 'Press de pecho en máquina', array['press maquina','chest press','pecho maquina'],
 'pecho', array['hombros','brazos'], 'empuje', 'maquina', 'principiante',
 'Empuje guiado, el más simple para empezar.',
 'Ajusta el asiento de modo que las manijas queden a la altura media del pecho. Empuja sin bloquear los codos.',
 array['Dejar el asiento muy alto y empujar hacia arriba'],
 array['Buena opción para las últimas series, cuando ya estás cansado'],
 'press-maquina'),

('fondos-pecho', 'Fondos en paralelas', array['fondos','dips','paralelas'],
 'pecho', array['brazos','hombros'], 'empuje', 'peso_corporal', 'avanzado',
 'Empuje vertical con el peso del cuerpo.',
 'Inclina el torso hacia adelante para cargar más el pecho. Baja hasta que los codos queden en 90 grados.',
 array['Bajar demasiado y forzar el hombro','Quedarse totalmente vertical (eso lo pasa a tríceps)'],
 array['Si no logras ninguno, empieza en máquina asistida'],
 'fondos'),

('flexiones', 'Flexiones de brazos', array['push ups','lagartijas','flexiones de pecho','planchas pecho'],
 'pecho', array['brazos','core'], 'empuje', 'peso_corporal', 'principiante',
 'El empuje básico sin equipamiento.',
 'Cuerpo en línea recta de la cabeza a los talones. Baja hasta casi tocar el suelo con el pecho.',
 array['Hundir la cadera','Abrir los codos en exceso'],
 array['Apoya las rodillas si todavía no salen completas'],
 'flexiones'),

-- ── ESPALDA ──────────────────────────────────────────────────────────────
('jalon-pecho', 'Jalón al pecho', array['jalon amplio','jalon frontal','lat pulldown','jalon polea alta','dorsalera'],
 'espalda', array['brazos'], 'traccion', 'polea', 'principiante',
 'Tracción vertical, el básico de espalda.',
 'Agarre algo más ancho que los hombros. Lleva la barra al pecho bajando los codos, no tirando con las manos.',
 array['Echar el cuerpo muy atrás','Llevar la barra detrás de la nuca'],
 array['Piensa en meter los codos al bolsillo'],
 'jalon-pecho'),

('jalon-supino', 'Jalón supino', array['jalon agarre supino','jalon inverso','jalon estrecho supino'],
 'espalda', array['brazos'], 'traccion', 'polea', 'principiante',
 'Mismo jalón con las palmas hacia ti: más bíceps.',
 'Agarre al ancho de los hombros con las palmas mirando hacia el cuerpo. El recorrido es el mismo que el jalón al pecho.',
 array['Balancear el torso para ayudarse'],
 array['El agarre supino permite algo más de carga que el prono'],
 'jalon-pecho'),

('dominadas', 'Dominadas', array['pull ups','barra fija','dominadas pronas'],
 'espalda', array['brazos','core'], 'traccion', 'peso_corporal', 'avanzado',
 'Tracción vertical con el peso del cuerpo.',
 'Cuelga con los brazos estirados y sube hasta pasar la barbilla por encima de la barra, sin balancearte.',
 array['Hacer medio recorrido','Tomar impulso con las piernas'],
 array['Si no salen, usa la máquina asistida o banda elástica'],
 'dominadas'),

('remo-barra', 'Remo con barra', array['remo pendlay','barbell row','remo inclinado'],
 'espalda', array['brazos','core'], 'traccion', 'barra', 'intermedio',
 'Tracción horizontal, construye grosor de espalda.',
 'Torso inclinado cerca de 45 grados, espalda recta. Lleva la barra al ombligo y baja controlado.',
 array['Redondear la espalda baja','Erguirse durante la serie'],
 array['Menos peso y espalda recta rinde mucho más que al revés'],
 'remo-barra'),

('remo-mancuerna', 'Remo con mancuerna', array['remo unilateral','remo a una mano','dumbbell row','remo serrucho'],
 'espalda', array['brazos'], 'traccion', 'mancuerna', 'principiante',
 'Remo de un brazo apoyado en el banco.',
 'Una rodilla y una mano en el banco, espalda plana. Sube la mancuerna pegada al cuerpo hasta la cadera.',
 array['Rotar el torso para levantar más peso'],
 array['Muy útil para igualar diferencias entre los dos lados'],
 'remo-mancuerna'),

('remo-polea-baja', 'Remo en polea baja', array['remo sentado','remo cable','seated row','remo polea'],
 'espalda', array['brazos'], 'traccion', 'polea', 'principiante',
 'Tracción horizontal sentado, muy fácil de controlar.',
 'Sentado con las rodillas algo flexionadas y espalda recta. Tira hacia el abdomen juntando los omóplatos.',
 array['Tirar con la espalda baja balanceándose','Encoger los hombros'],
 array['Aguanta medio segundo con los omóplatos juntos'],
 'remo-sentado'),

('remo-maquina', 'Remo en máquina', array['remo sentado maquina','machine row'],
 'espalda', array['brazos'], 'traccion', 'maquina', 'principiante',
 'Remo guiado con apoyo para el pecho.',
 'El apoyo del pecho evita que uses impulso, así que trabaja bastante aislada la espalda.',
 array['Separar el pecho del apoyo para tirar más'],
 array['Ideal cuando la espalda baja está cargada'],
 'remo-sentado'),

('pullover-polea', 'Pullover en polea', array['pullover','jalon brazo recto','straight arm pulldown'],
 'espalda', array['core'], 'aislamiento', 'polea', 'intermedio',
 'Aislamiento de dorsal con los brazos estirados.',
 'De pie frente a la polea alta, brazos casi rectos. Baja la barra hasta los muslos usando solo el dorsal.',
 array['Flexionar los codos y convertirlo en tríceps'],
 array['Excelente para aprender a sentir el dorsal'],
 'pullover'),

('peso-muerto', 'Peso muerto', array['deadlift','peso muerto convencional'],
 'espalda', array['piernas','core'], 'traccion', 'barra', 'avanzado',
 'Levantamiento de cuerpo completo desde el suelo.',
 'Barra pegada a las canillas, espalda recta y pecho arriba. Empuja el suelo con los pies y extiende cadera y rodillas a la vez.',
 array['Redondear la espalda','Tirar con los brazos','Separar la barra del cuerpo'],
 array['Domina la técnica con poco peso antes de cargar'],
 'peso-muerto'),

('peso-muerto-rumano', 'Peso muerto rumano', array['rumano','RDL','peso muerto piernas rectas','romanian deadlift'],
 'espalda', array['piernas'], 'traccion', 'barra', 'intermedio',
 'Bisagra de cadera enfocada en femoral y glúteo.',
 'Piernas casi rectas. Lleva la cadera hacia atrás bajando la barra pegada a las piernas hasta sentir el estiramiento atrás.',
 array['Flexionar mucho las rodillas','Bajar más allá de lo que permite tu flexibilidad'],
 array['El movimiento es de cadera, no de espalda'],
 'peso-muerto-rumano'),

('hiperextensiones', 'Hiperextensiones', array['extensiones lumbares','back extension','banco romano','lumbares'],
 'espalda', array['piernas','core'], 'aislamiento', 'peso_corporal', 'principiante',
 'Fortalece la zona lumbar.',
 'Cadera apoyada en el soporte. Baja el torso y sube hasta alinear el cuerpo, sin pasarte de la línea recta.',
 array['Hiperextender la espalda al final'],
 array['Sube solo hasta quedar recto, no más'],
 'hiperextensiones'),

('encogimientos', 'Encogimientos de hombros', array['shrugs','trapecio','encogimientos trapecio'],
 'espalda', array['hombros'], 'aislamiento', 'mancuerna', 'principiante',
 'Aislamiento de trapecio.',
 'De pie con mancuernas a los lados. Sube los hombros hacia las orejas y baja controlado.',
 array['Rotar los hombros en círculo'],
 array['Sube recto, aguanta arriba un segundo'],
 'encogimientos'),

-- ── PIERNAS ──────────────────────────────────────────────────────────────
('sentadilla', 'Sentadilla', array['sentadilla libre','squat','sentadilla trasera','back squat'],
 'piernas', array['core'], 'pierna', 'barra', 'intermedio',
 'El ejercicio base de piernas.',
 'Barra sobre los trapecios, pies al ancho de los hombros. Baja llevando la cadera atrás hasta que los muslos queden paralelos al suelo.',
 array['Juntar las rodillas al subir','Levantar los talones','Redondear la espalda abajo'],
 array['Mira al frente y abre las rodillas hacia afuera'],
 'sentadilla'),

('sentadilla-smith', 'Sentadilla en Smith', array['sentadilla multipower','smith squat'],
 'piernas', array['core'], 'pierna', 'smith', 'principiante',
 'Sentadilla guiada, más fácil de estabilizar.',
 'Al estar guiada puedes adelantar un poco los pies y cargar más el cuádriceps.',
 array['Poner los pies muy adelante y forzar la rodilla'],
 array['Buena entrada antes de pasar a la sentadilla libre'],
 'sentadilla'),

('sentadilla-goblet', 'Sentadilla goblet', array['goblet squat','sentadilla con mancuerna','sentadilla copa'],
 'piernas', array['core'], 'pierna', 'mancuerna', 'principiante',
 'Sentadilla sosteniendo una mancuerna al pecho.',
 'El contrapeso adelante te ayuda a mantener el torso erguido. Excelente para aprender la técnica.',
 array['Dejar caer el peso hacia adelante'],
 array['Es la mejor forma de aprender a sentarse derecho'],
 'sentadilla-goblet'),

('prensa', 'Prensa de piernas', array['leg press','prensa 45','prensa inclinada'],
 'piernas', array[]::text[], 'pierna', 'maquina', 'principiante',
 'Empuje de piernas guiado, permite mucha carga.',
 'Pies al ancho de los hombros en la plataforma. Baja hasta 90 grados y empuja sin bloquear las rodillas.',
 array['Bajar tanto que la cadera se despegue del respaldo','Bloquear las rodillas de golpe'],
 array['Subir los pies en la plataforma carga más glúteo y femoral'],
 'prensa'),

('extension-cuadriceps', 'Extensión de cuádriceps', array['extensiones','leg extension','cuadriceps maquina','silla romana'],
 'piernas', array[]::text[], 'aislamiento', 'maquina', 'principiante',
 'Aislamiento puro de cuádriceps.',
 'Sentado con la espalda apoyada. Estira las rodillas completamente y baja controlado.',
 array['Usar impulso','Soltar el peso de golpe al bajar'],
 array['Aguanta un segundo arriba, con la pierna estirada'],
 'extension-cuadriceps'),

('curl-femoral', 'Curl femoral', array['curl piernas','leg curl','femoral tumbado','femoral maquina'],
 'piernas', array[]::text[], 'aislamiento', 'maquina', 'principiante',
 'Aislamiento de isquiotibiales.',
 'Tumbado o sentado según la máquina. Flexiona la rodilla llevando el talón al glúteo.',
 array['Despegar la cadera del apoyo'],
 array['Baja lento: la parte negativa es la que más trabaja'],
 'curl-femoral'),

('zancadas', 'Zancadas', array['lunges','estocadas','desplantes','zancadas caminando'],
 'piernas', array['core'], 'pierna', 'mancuerna', 'intermedio',
 'Trabajo de una pierna a la vez.',
 'Da un paso adelante y baja hasta que la rodilla de atrás casi toque el suelo. Empuja con el talón de adelante.',
 array['Pasar la rodilla muy por delante del pie','Dar pasos demasiado cortos'],
 array['Torso recto y mirada al frente'],
 'zancadas'),

('bulgara', 'Sentadilla búlgara', array['bulgaras','bulgarian split squat','sentadilla split','zancada bulgara'],
 'piernas', array['core'], 'pierna', 'mancuerna', 'avanzado',
 'Sentadilla a una pierna con el pie trasero elevado.',
 'Pie de atrás sobre un banco. Baja recto, cargando el peso en la pierna de adelante.',
 array['Apoyarse en la pierna de atrás','Elegir un banco demasiado alto'],
 array['Uno de los mejores para glúteo y equilibrio'],
 'bulgara'),

('hip-thrust', 'Hip thrust', array['empuje de cadera','puente de gluteo con barra','elevacion de cadera'],
 'piernas', array['core'], 'pierna', 'barra', 'intermedio',
 'El más directo para glúteo.',
 'Espalda alta apoyada en el banco, barra sobre la cadera. Empuja hasta alinear el cuerpo y aprieta el glúteo arriba.',
 array['Hiperextender la espalda al subir','Empujar con la punta de los pies'],
 array['Aguanta dos segundos arriba en cada repetición'],
 'hip-thrust'),

('peso-muerto-sumo', 'Peso muerto sumo', array['sumo deadlift','sumo'],
 'piernas', array['espalda','core'], 'pierna', 'barra', 'avanzado',
 'Peso muerto con las piernas muy abiertas.',
 'Piernas anchas y manos por dentro de las rodillas. Carga más cuádriceps y aductor que el convencional.',
 array['Redondear la espalda','Abrir demasiado y perder fuerza'],
 array['Sirve si tienes poca movilidad de cadera para el convencional'],
 'peso-muerto'),

('gemelos-pie', 'Elevación de gemelos de pie', array['gemelos','pantorrillas','calf raise','gemelos de pie','pantorrilla de pie','pantorrilla'],
 'piernas', array[]::text[], 'aislamiento', 'maquina', 'principiante',
 'Aislamiento de pantorrilla.',
 'De pie, sube sobre las puntas lo más alto posible y baja hasta estirar el gemelo.',
 array['Hacer rebotes cortos sin rango completo'],
 array['Rango completo y pausa arriba valen más que el peso'],
 'gemelos'),

('gemelos-sentado', 'Elevación de gemelos sentado', array['gemelos sentado','soleo','seated calf raise'],
 'piernas', array[]::text[], 'aislamiento', 'maquina', 'principiante',
 'Gemelo con la rodilla flexionada: carga el sóleo.',
 'Sentado con el peso sobre las rodillas. Mismo movimiento que de pie pero enfoca la parte profunda.',
 array['Rango de movimiento corto'],
 array['Complementa al de pie, no lo reemplaza'],
 'gemelos-sentado'),

('sentadilla-hack', 'Hack squat', array['hack','sentadilla hack','maquina hack'],
 'piernas', array[]::text[], 'pierna', 'maquina', 'intermedio',
 'Sentadilla guiada en máquina inclinada.',
 'Espalda apoyada en el respaldo. Baja controlado hasta 90 grados y empuja.',
 array['Despegar la espalda baja del respaldo'],
 array['Muy buena para cuádriceps sin cargar la espalda'],
 'hack-squat'),

('abductores', 'Abductores en máquina', array['abductor','abduccion','abduccion de cadera','apertura de piernas','gluteo medio maquina'],
 'piernas', array[]::text[], 'aislamiento', 'maquina', 'principiante',
 'Aislamiento de glúteo medio.',
 'Sentado, abre las piernas contra la resistencia y vuelve controlado.',
 array['Usar impulso y soltar de golpe'],
 array['Inclinar el torso adelante carga más el glúteo'],
 'maquina-aductores'),

('aductores', 'Aductores en máquina', array['aductor','cierre de piernas'],
 'piernas', array[]::text[], 'aislamiento', 'maquina', 'principiante',
 'Aislamiento de la cara interna del muslo.',
 'Sentado, junta las piernas contra la resistencia y abre controlado.',
 array['Abrir más de lo que permite tu movilidad'],
 array['Controla la vuelta, es donde más trabaja'],
 'maquina-aductores'),

('sentadilla-frontal', 'Sentadilla frontal', array['front squat','sentadilla adelante'],
 'piernas', array['core'], 'pierna', 'barra', 'avanzado',
 'Sentadilla con la barra al frente: más cuádriceps y más torso recto.',
 'Barra apoyada sobre los deltoides frontales, codos altos. Baja manteniendo el torso vertical.',
 array['Bajar los codos y perder la barra'],
 array['Exige movilidad de muñeca y de tobillo'],
 'sentadilla-goblet'),

('subida-cajon', 'Subida al cajón', array['step up','subidas al banco','box step up'],
 'piernas', array['core'], 'pierna', 'mancuerna', 'principiante',
 'Subir a un cajón alternando piernas.',
 'Apoya el pie completo arriba y sube empujando con esa pierna, sin impulsarte con la de abajo.',
 array['Impulsarse con la pierna de apoyo del suelo'],
 array['Elige una altura donde la rodilla quede en 90 grados'],
 'subida-cajon'),

-- ── HOMBROS ──────────────────────────────────────────────────────────────
('press-militar', 'Press militar', array['press hombro','overhead press','press militar de pie','press sobre cabeza'],
 'hombros', array['brazos','core'], 'empuje', 'barra', 'intermedio',
 'Empuje vertical, el básico de hombro.',
 'De pie, barra a la altura de las clavículas. Empuja sobre la cabeza sin arquear la espalda.',
 array['Arquear mucho la espalda baja','No pasar la barra por la línea de la cara'],
 array['Aprieta glúteos y abdomen para no arquearte'],
 'press-militar'),

('press-hombro-mancuernas', 'Press de hombro con mancuernas', array['press mancuernas hombro','shoulder press','press sentado mancuernas'],
 'hombros', array['brazos'], 'empuje', 'mancuerna', 'principiante',
 'Empuje vertical con mancuernas.',
 'Sentado con respaldo o de pie. Sube hasta casi juntar las mancuernas arriba.',
 array['Bajar demasiado y forzar el hombro'],
 array['Más amable con el hombro que la barra'],
 'press-militar'),

('elevaciones-laterales', 'Elevaciones laterales', array['laterales','vuelos laterales','lateral raise','elevacion lateral'],
 'hombros', array[]::text[], 'aislamiento', 'mancuerna', 'principiante',
 'Aislamiento del deltoides medio, el que da ancho.',
 'Brazos casi rectos a los lados. Sube hasta la altura del hombro guiando con el codo, no con la mano.',
 array['Subir por encima del hombro','Usar impulso de cadera','Demasiado peso'],
 array['Es de peso liviano y control: piensa en verter agua de una jarra'],
 'elevaciones-laterales'),

('elevaciones-frontales', 'Elevaciones frontales', array['frontales','front raise','elevacion frontal'],
 'hombros', array[]::text[], 'aislamiento', 'mancuerna', 'principiante',
 'Aislamiento del deltoides anterior.',
 'Sube el brazo estirado al frente hasta la altura del hombro y baja controlado.',
 array['Balancear el cuerpo'],
 array['El deltoides frontal ya trabaja en todos los press: no necesita mucho volumen'],
 'elevaciones-frontales'),

('pajaros', 'Pájaros', array['vuelos posteriores','deltoides posterior','reverse fly','aperturas inversas','posteriores'],
 'hombros', array['espalda'], 'aislamiento', 'mancuerna', 'intermedio',
 'Aislamiento del deltoides posterior.',
 'Torso inclinado hacia adelante. Abre los brazos a los lados sin juntar los omóplatos.',
 array['Convertirlo en un remo juntando omóplatos'],
 array['La parte más olvidada del hombro y la que más equilibra la postura'],
 'pajaros'),

('face-pull', 'Face pull', array['jalon a la cara','facepull','tiron a la cara'],
 'hombros', array['espalda'], 'traccion', 'polea', 'intermedio',
 'Tracción a la altura de la cara, salud de hombro.',
 'Polea a la altura de los ojos con cuerda. Tira hacia la frente separando las manos y rotando los hombros hacia afuera.',
 array['Tirar muy abajo, a la altura del pecho'],
 array['Uno de los mejores ejercicios preventivos para el hombro'],
 'face-pull'),

('press-arnold', 'Press Arnold', array['arnold press'],
 'hombros', array['brazos'], 'empuje', 'mancuerna', 'intermedio',
 'Press de hombro con giro de muñeca.',
 'Empieza con las palmas hacia ti y gira mientras subes hasta terminar con las palmas al frente.',
 array['Girar de golpe en vez de acompañar el movimiento'],
 array['El giro suma trabajo del deltoides frontal'],
 'press-militar'),

('remo-menton', 'Remo al mentón', array['remo vertical','upright row','remo alto'],
 'hombros', array['espalda','brazos'], 'traccion', 'barra', 'intermedio',
 'Tracción vertical para hombro y trapecio.',
 'Sube la barra pegada al cuerpo hasta la altura del pecho, con los codos por encima de las manos.',
 array['Subir por encima de las clavículas y pinzar el hombro'],
 array['Si te molesta el hombro, cámbialo por elevaciones laterales'],
 'remo-menton'),

-- ── BRAZOS ───────────────────────────────────────────────────────────────
('curl-barra', 'Curl con barra', array['curl biceps barra','barbell curl','curl de pie'],
 'brazos', array[]::text[], 'aislamiento', 'barra', 'principiante',
 'El básico de bíceps.',
 'De pie, codos pegados al cuerpo. Sube la barra sin mover los codos y baja controlado.',
 array['Balancear el torso','Mover los codos hacia adelante'],
 array['Si necesitas impulso, es que hay demasiado peso'],
 'curl-barra'),

('curl-ez', 'Curl con barra EZ', array['curl ez','curl barra z','ez curl'],
 'brazos', array[]::text[], 'aislamiento', 'barra', 'principiante',
 'Curl con barra en zigzag, más cómodo para la muñeca.',
 'Mismo movimiento que el curl con barra. El agarre angulado reduce la tensión en muñecas y codos.',
 array['Balancear el cuerpo'],
 array['Buena alternativa si la barra recta te molesta la muñeca'],
 'curl-barra'),

('curl-mancuernas', 'Curl con mancuernas', array['curl biceps mancuerna','dumbbell curl','curl alternado'],
 'brazos', array[]::text[], 'aislamiento', 'mancuerna', 'principiante',
 'Curl de bíceps con mancuernas, alternando o a la vez.',
 'Codos fijos al costado. Puedes girar la muñeca al subir para sumar supinación.',
 array['Abrir los codos hacia afuera'],
 array['Alternar permite concentrarse mejor en cada brazo'],
 'curl-mancuernas'),

('curl-martillo', 'Curl martillo', array['hammer curl','curl neutro','martillo'],
 'brazos', array[]::text[], 'aislamiento', 'mancuerna', 'principiante',
 'Curl con agarre neutro: braquial y antebrazo.',
 'Palmas enfrentadas todo el recorrido, como si sostuvieras dos martillos.',
 array['Balancear las mancuernas'],
 array['Ayuda a engrosar el brazo por debajo del bíceps'],
 'curl-mancuernas'),

('curl-predicador', 'Curl en banco predicador', array['predicador','scott curl','banco scott','preacher curl'],
 'brazos', array[]::text[], 'aislamiento', 'barra', 'intermedio',
 'Curl con el brazo apoyado: imposible hacer trampa.',
 'Axilas apoyadas en el respaldo inclinado. Sube y baja sin despegar los brazos.',
 array['Estirar el codo de golpe abajo'],
 array['Controla mucho la bajada, es donde más se estira el bíceps'],
 'curl-predicador'),

('curl-polea', 'Curl en polea', array['curl cable','curl biceps polea'],
 'brazos', array[]::text[], 'aislamiento', 'polea', 'principiante',
 'Curl con tensión constante.',
 'De pie frente a la polea baja. La tensión no se pierde en ningún punto del recorrido.',
 array['Retroceder para ayudarse con el cuerpo'],
 array['Bueno para terminar el bíceps al final de la sesión'],
 'curl-polea'),

('extension-triceps-polea', 'Extensión de tríceps en polea', array['triceps polea','pushdown','jalon triceps','extension polea alta'],
 'brazos', array[]::text[], 'aislamiento', 'polea', 'principiante',
 'El básico de tríceps.',
 'Codos pegados al cuerpo y fijos. Estira los brazos hacia abajo y vuelve controlado.',
 array['Despegar los codos del cuerpo','Inclinarse para empujar con el peso corporal'],
 array['Solo se mueve el antebrazo'],
 'triceps-polea'),

('press-frances', 'Press francés', array['skull crusher','rompecraneos','extension triceps acostado','frances'],
 'brazos', array[]::text[], 'aislamiento', 'barra', 'intermedio',
 'Extensión de tríceps acostado.',
 'Acostado, baja la barra hacia la frente flexionando solo los codos.',
 array['Mover los hombros hacia atrás','Abrir los codos'],
 array['La barra EZ es más amable con los codos'],
 'press-frances'),

('fondos-triceps', 'Fondos de tríceps', array['fondos en banco','dips triceps','fondos banco'],
 'brazos', array['hombros'], 'empuje', 'peso_corporal', 'principiante',
 'Fondos con el cuerpo vertical: carga el tríceps.',
 'Manos en el banco detrás de ti. Baja hasta 90 grados manteniendo el cuerpo pegado al banco.',
 array['Alejar demasiado la cadera del banco','Bajar más de 90 grados'],
 array['A diferencia de los fondos de pecho, aquí el torso va vertical'],
 'fondos-triceps'),

('extension-triceps-sobre-cabeza', 'Extensión de tríceps sobre la cabeza', array['triceps sobre cabeza','overhead triceps','extension tras nuca','frances de pie'],
 'brazos', array[]::text[], 'aislamiento', 'mancuerna', 'intermedio',
 'Tríceps con el brazo por encima de la cabeza.',
 'Mancuerna sostenida con las dos manos sobre la cabeza. Baja detrás de la nuca y estira.',
 array['Abrir los codos','Arquear la espalda'],
 array['Es la posición donde más se estira la cabeza larga del tríceps'],
 'triceps-sobre-cabeza'),

('patada-triceps', 'Patada de tríceps', array['kickback','extension triceps inclinado','patada'],
 'brazos', array[]::text[], 'aislamiento', 'mancuerna', 'principiante',
 'Extensión de tríceps con el torso inclinado.',
 'Torso inclinado y codo alto y fijo. Estira el brazo hacia atrás y aguanta un instante.',
 array['Mover el hombro en vez del codo'],
 array['Es de poco peso y mucha contracción'],
 'patada-triceps'),

('curl-muneca', 'Curl de muñeca', array['antebrazo','wrist curl','flexion de muneca'],
 'brazos', array[]::text[], 'aislamiento', 'barra', 'principiante',
 'Aislamiento de antebrazo.',
 'Antebrazos apoyados en el banco o los muslos. Flexiona solo la muñeca.',
 array['Mover el codo'],
 array['Rango corto y repeticiones altas funcionan mejor acá'],
 'curl-muneca'),

-- ── CORE ─────────────────────────────────────────────────────────────────
('plancha', 'Plancha', array['plank','plancha abdominal','plancha frontal','plancha isometrica'],
 'core', array['hombros'], 'core', 'peso_corporal', 'principiante',
 'Isométrico básico de abdomen.',
 'Apoyo en antebrazos y puntas de los pies. Cuerpo en línea recta, abdomen y glúteos apretados.',
 array['Subir la cadera','Hundir la espalda baja'],
 array['Mejor 30 segundos bien hechos que 2 minutos mal'],
 'plancha'),

('plancha-lateral', 'Plancha lateral', array['side plank','plancha de lado','oblicuos plancha'],
 'core', array['hombros'], 'core', 'peso_corporal', 'principiante',
 'Isométrico para oblicuos.',
 'Apoyo en un antebrazo y el canto del pie. Cadera arriba, cuerpo en línea.',
 array['Dejar caer la cadera'],
 array['Trabaja los dos lados el mismo tiempo'],
 'plancha-lateral'),

('crunch', 'Crunch abdominal', array['abdominales','encogimiento abdominal','crunches','abdominal corto','crunch en banco','crunch banco'],
 'core', array[]::text[], 'core', 'peso_corporal', 'principiante',
 'Flexión corta de la columna.',
 'Acostado con las rodillas dobladas. Despega solo los omóplatos del suelo, sin tirar del cuello.',
 array['Tirar de la nuca con las manos','Hacer el recorrido completo hasta sentarse'],
 array['Las manos solo acompañan la cabeza, no empujan'],
 'crunch'),

('elevacion-piernas', 'Elevación de piernas', array['leg raise','elevaciones de pierna','abdominal inferior','elevacion piernas colgado'],
 'core', array[]::text[], 'core', 'peso_corporal', 'intermedio',
 'Abdomen bajo, acostado o colgado.',
 'Sube las piernas rectas o con rodillas flexionadas sin arquear la espalda baja.',
 array['Despegar la espalda baja del suelo','Usar impulso'],
 array['Si te duele la espalda, dobla más las rodillas'],
 'elevacion-piernas'),

('russian-twist', 'Giro ruso', array['russian twist','giros rusos','oblicuos sentado','torsiones'],
 'core', array[]::text[], 'core', 'peso_corporal', 'intermedio',
 'Rotación de tronco para oblicuos.',
 'Sentado con el torso inclinado atrás y los pies elevados. Gira de lado a lado controlando.',
 array['Girar solo los brazos sin mover el tronco'],
 array['El giro nace del tronco, no de los hombros'],
 'russian-twist'),

('mountain-climbers', 'Escaladores', array['mountain climbers','escalador','montañista'],
 'core', array['piernas','cardio'], 'core', 'peso_corporal', 'principiante',
 'Core dinámico con componente cardiovascular.',
 'En posición de plancha alta, lleva las rodillas al pecho alternando rápido.',
 array['Subir la cadera','Perder la línea del cuerpo'],
 array['Mantén los hombros sobre las manos todo el tiempo'],
 'mountain-climbers'),

('rueda-abdominal', 'Rueda abdominal', array['ab wheel','rueda','ab roller'],
 'core', array['hombros','espalda'], 'core', 'otro', 'avanzado',
 'Uno de los más exigentes para el abdomen.',
 'De rodillas, rueda hacia adelante manteniendo la espalda recta y vuelve con el abdomen.',
 array['Arquear la espalda baja','Ir más lejos de lo que puedes volver'],
 array['Empieza con recorridos cortos'],
 'rueda-abdominal'),

('elevacion-rodillas-silla', 'Elevación de rodillas en paralelas', array['captain chair','silla romana abdominal','elevacion rodillas'],
 'core', array[]::text[], 'core', 'maquina', 'intermedio',
 'Abdomen bajo con la espalda apoyada.',
 'Apoyado en los antebrazos, sube las rodillas al pecho sin balancearte.',
 array['Tomar impulso con las piernas'],
 array['Sube lento y baja más lento todavía'],
 'elevacion-piernas'),

-- ── CARDIO ───────────────────────────────────────────────────────────────
('caminadora', 'Caminadora', array['trotadora','cinta','treadmill','correr','trote'],
 'cardio', array['piernas'], 'cardio', 'maquina', 'principiante',
 'Caminar o correr en cinta.',
 'Mantén el torso erguido y no te agarres del pasamanos: eso reduce bastante el gasto real.',
 array['Sujetarse de las barras todo el tiempo'],
 array['Un poco de inclinación sube la intensidad sin tener que correr'],
 'caminadora'),

('bicicleta', 'Bicicleta estática', array['bici','spinning','ciclismo','bicicleta','bicicleta spinning','bici spinning'],
 'cardio', array['piernas'], 'cardio', 'maquina', 'principiante',
 'Cardio de bajo impacto.',
 'Ajusta el asiento de modo que la rodilla quede casi estirada abajo.',
 array['Asiento demasiado bajo, que carga la rodilla'],
 array['Buena opción si tienes molestias articulares'],
 'bicicleta'),

('eliptica', 'Elíptica', array['eliptico','cross trainer'],
 'cardio', array['piernas'], 'cardio', 'maquina', 'principiante',
 'Cardio sin impacto que suma tren superior.',
 'Usa también los brazos para repartir el trabajo.',
 array['Apoyarse en el panel sin usar los brazos'],
 array['Cambiar el sentido del pedaleo varía el trabajo de la pierna'],
 'eliptica'),

('remo-ergometro', 'Remo ergómetro', array['remo maquina cardio','rowing','remoergometro'],
 'cardio', array['espalda','piernas'], 'cardio', 'maquina', 'intermedio',
 'Cardio de cuerpo completo.',
 'El orden es piernas, tronco y brazos al tirar; a la inversa al volver.',
 array['Tirar primero con los brazos'],
 array['La potencia sale de las piernas, no de la espalda'],
 'remo-ergometro'),

('cuerda', 'Salto a la cuerda', array['saltar la cuerda','comba','jump rope','cuerda de saltar'],
 'cardio', array['piernas'], 'cardio', 'otro', 'intermedio',
 'Cardio intenso y portátil.',
 'Saltos bajos, sobre las puntas, girando la cuerda con las muñecas.',
 array['Saltar demasiado alto y cansarse enseguida'],
 array['Empieza con intervalos cortos'],
 'cuerda'),

('burpees', 'Burpees', array['burpee'],
 'cardio', array['piernas','pecho','core'], 'full_body', 'peso_corporal', 'avanzado',
 'Ejercicio de cuerpo completo muy demandante.',
 'Sentadilla, plancha, flexión, vuelta y salto. Encadena sin pausas.',
 array['Perder la línea del cuerpo en la plancha por ir rápido'],
 array['Puedes sacar la flexión o el salto para bajar la intensidad'],
 'burpees'),

('escaladora', 'Escaladora', array['stepper','simulador de escaleras','escalera'],
 'cardio', array['piernas'], 'cardio', 'maquina', 'intermedio',
 'Cardio con mucho trabajo de glúteo y pierna.',
 'Torso erguido, sin colgarte de las manijas.',
 array['Apoyar todo el peso en los brazos'],
 array['Apoya el pie completo en cada escalón'],
 'escaladora')

,

-- ── AGREGADOS DESDE LAS RUTINAS REALES ───────────────────────────────────
-- Estos NO salieron de una lista genérica: se sacaron de los 137 nombres
-- distintos que ya estaban cargados en `rutina_dia_ejercicios` de rutinas
-- reales del gimnasio. La primera versión de esta semilla solo reconocía el
-- 47% de lo que el entrenador usa de verdad.

('pec-deck', 'Pec deck', array['contractora','peck deck','maquina de aperturas','pec fly'],
 'pecho', array['hombros'], 'aislamiento', 'maquina', 'principiante',
 'Aperturas en máquina, con el recorrido guiado.',
 'Sentado con la espalda apoyada y los codos a la altura del pecho. Junta los brazos al frente sin encoger los hombros.',
 array['Subir los hombros hacia las orejas'],
 array['Muy buena para sentir el pecho sin preocuparse por estabilizar'],
 'pec-deck'),

('reverse-pec-deck', 'Reverse pec deck', array['pec deck inverso','contractora inversa','maquina deltoide posterior','peck deck inverso'],
 'hombros', array['espalda'], 'aislamiento', 'maquina', 'principiante',
 'Deltoides posterior en máquina.',
 'Sentado de frente al respaldo. Abre los brazos hacia atrás guiando con los codos.',
 array['Juntar los omóplatos y convertirlo en remo'],
 array['La versión guiada de los pájaros, más fácil de sentir'],
 'reverse-pec-deck'),

('fondos-inclinados', 'Fondos inclinados', array['fondos inclinado','dips inclinados','fondos pecho inclinado'],
 'pecho', array['brazos','hombros'], 'empuje', 'peso_corporal', 'intermedio',
 'Fondos con el torso más inclinado, para cargar pecho.',
 'Cuanto más inclinas el torso hacia adelante, más trabaja el pecho y menos el tríceps.',
 array['Enderezarse durante la serie y perder el énfasis'],
 array['Mantén la inclinación constante en todas las repeticiones'],
 'fondos'),

('press-cerrado', 'Press cerrado', array['press cerrado smith','close grip bench','press agarre cerrado','press estrecho'],
 'brazos', array['pecho','hombros'], 'empuje', 'barra', 'intermedio',
 'Press con agarre estrecho: el empuje que más carga el tríceps.',
 'Manos al ancho de los hombros y codos pegados al cuerpo al bajar.',
 array['Cerrar tanto el agarre que se cargue la muñeca'],
 array['El mejor ejercicio de tríceps que permite peso alto'],
 'press-cerrado'),

('t-bar-row', 'Remo en T', array['t bar row','remo en t con apoyo','remo t','barra t','remo hammer','remo pecho apoyado','remo con pecho apoyado'],
 'espalda', array['brazos'], 'traccion', 'maquina', 'intermedio',
 'Remo con el pecho apoyado o con barra en T.',
 'El apoyo del pecho saca de la ecuación a la espalda baja, así que el dorsal trabaja más aislado.',
 array['Despegar el pecho del apoyo para tirar más peso'],
 array['Ideal los días que la espalda baja está cargada del peso muerto'],
 'remo-maquina-apoyo'),

('belt-squat', 'Belt squat', array['sentadilla con cinturon','belt squat maquina','sentadilla cinturon'],
 'piernas', array[]::text[], 'pierna', 'maquina', 'intermedio',
 'Sentadilla con la carga colgada de la cadera, sin comprimir la columna.',
 'El peso cuelga de un cinturón, así que la espalda no recibe carga axial. Permite entrenar pierna fuerte con la espalda cansada.',
 array['Inclinarse demasiado hacia adelante'],
 array['Excelente alternativa cuando la zona lumbar está sobrecargada'],
 'belt-squat'),

('prensa-inclinada', 'Prensa inclinada', array['prensa 45 grados','leg press inclinado','prensa inclinada 45'],
 'piernas', array[]::text[], 'pierna', 'maquina', 'principiante',
 'La prensa clásica a 45 grados.',
 'Espalda y cadera bien apoyadas. Baja hasta donde la cadera no se despegue del respaldo.',
 array['Bajar tanto que la cadera se levante'],
 array['La posición de los pies cambia bastante qué músculo trabaja más'],
 'prensa'),

('curl-inclinado', 'Curl inclinado', array['curl banco inclinado','incline curl','curl en banco inclinado'],
 'brazos', array[]::text[], 'aislamiento', 'mancuerna', 'intermedio',
 'Curl sentado en banco inclinado, con el brazo por detrás del cuerpo.',
 'La inclinación deja el bíceps estirado desde el inicio, que es donde más trabaja.',
 array['Balancear el hombro hacia adelante para ayudarse'],
 array['Se siente mucho más exigente que el curl de pie con el mismo peso'],
 'curl-inclinado'),

('pushdown-cuerda', 'Pushdown con cuerda', array['extension cuerda','triceps cuerda','pushdown prono','pushdown supino','extension triceps cuerda','pushdown parciales'],
 'brazos', array[]::text[], 'aislamiento', 'polea', 'principiante',
 'Extensión de tríceps con cuerda, separando las manos al final.',
 'Igual que el pushdown con barra, pero al final abres la cuerda para cerrar más el tríceps.',
 array['No separar la cuerda al final','Despegar los codos'],
 array['La apertura del final es la que hace la diferencia'],
 'triceps-polea'),

('extension-overhead-cuerda', 'Extensión overhead con cuerda', array['overhead cuerda','triceps overhead polea','extension overhead','overhead unilateral'],
 'brazos', array[]::text[], 'aislamiento', 'polea', 'intermedio',
 'Tríceps sobre la cabeza en polea, con tensión constante.',
 'De espaldas a la polea, brazos arriba. Estira hacia adelante sin mover los codos.',
 array['Dejar caer los codos'],
 array['La posición overhead es la que más estira la cabeza larga'],
 'triceps-sobre-cabeza'),

('walking-lunges', 'Zancadas caminando', array['walking lunges','zancadas caminando','estocadas caminando','lunges caminando'],
 'piernas', array['core'], 'pierna', 'mancuerna', 'intermedio',
 'Zancadas avanzando paso a paso.',
 'Cada paso es una repetición. Mantén el torso erguido y controla la bajada.',
 array['Dar pasos muy cortos','Apoyar con la punta del pie'],
 array['Más exigente en equilibrio que las zancadas en el lugar'],
 'zancadas'),

('battle-rope', 'Battle rope', array['cuerdas de batalla','sogas','battle ropes'],
 'cardio', array['hombros','core'], 'cardio', 'otro', 'intermedio',
 'Ondas con cuerdas pesadas.',
 'Semisentadilla, brazos generando ondas continuas. Trabaja por tiempo, no por repeticiones.',
 array['Quedarse rígido y usar solo los brazos'],
 array['Intervalos cortos e intensos rinden más que series largas'],
 'battle-rope'),

('step', 'Step', array['step aerobico','cajon step','subida step'],
 'cardio', array['piernas'], 'cardio', 'otro', 'principiante',
 'Subidas y bajadas a un escalón.',
 'Apoya el pie completo. Puedes variar el ritmo para subir o bajar la intensidad.',
 array['Apoyar solo la punta del pie'],
 array['Buena entrada en calor para el día de pierna'],
 'subida-cajon'),

('vacuum', 'Vacuum abdominal', array['vacuum','abdominal vacuum','vacio abdominal'],
 'core', array[]::text[], 'core', 'peso_corporal', 'intermedio',
 'Trabajo del transverso abdominal, sin movimiento visible.',
 'Exhala todo el aire y mete el ombligo hacia adentro y arriba. Aguanta y respira superficial.',
 array['Contener la respiración por completo'],
 array['Trabaja la faja profunda, la que aplana la cintura'],
 'vacuum'),

('crunch-polea', 'Crunch en polea', array['crunch cable','abdominal en polea','crunch arrodillado','abdominal polea'],
 'core', array[]::text[], 'core', 'polea', 'intermedio',
 'Crunch de rodillas con la polea alta, permite progresar en carga.',
 'De rodillas frente a la polea. Enrolla la columna llevando los codos a los muslos, sin tirar con los brazos.',
 array['Tirar con los brazos en vez de con el abdomen','Flexionar la cadera'],
 array['Es de los pocos abdominales donde puedes aumentar peso de verdad'],
 'crunch-polea'),

('multi-hip', 'Extensión de cadera en máquina', array['multi hip','multi hip extension de cadera','extension de cadera maquina','patada gluteo maquina','patada de gluteo','patada gluteo','patada de cadera'],
 'piernas', array[]::text[], 'aislamiento', 'maquina', 'principiante',
 'Extensión de cadera guiada, para glúteo.',
 'De pie en la máquina, lleva la pierna hacia atrás manteniendo el torso quieto.',
 array['Arquear la espalda para llegar más atrás'],
 array['El recorrido es corto: lo que cuenta es apretar el glúteo'],
 'multi-hip'),

('jalon-neutro', 'Jalón agarre neutro', array['jalon al pecho agarre neutro','jalon neutro','pull down unilateral','jalon unilateral'],
 'espalda', array['brazos'], 'traccion', 'polea', 'principiante',
 'Jalón con las palmas enfrentadas.',
 'El agarre neutro suele ser el más cómodo para el hombro y permite buen recorrido.',
 array['Encoger los hombros al tirar'],
 array['Buena opción si el agarre prono te molesta el hombro'],
 'jalon-pecho'),

('remo-bajo-estrecho', 'Remo bajo estrecho', array['remo estrecho','remo bajo','remo agarre estrecho','remo sentado estrecho'],
 'espalda', array['brazos'], 'traccion', 'polea', 'principiante',
 'Remo en polea baja con agarre cerrado.',
 'El agarre estrecho lleva el trabajo a la parte interna de la espalda.',
 array['Balancear el torso'],
 array['Aguanta un segundo con los omóplatos juntos'],
 'remo-polea'),

('pullover-cable', 'Pullover en cable', array['pull over cable','pullover polea alta','pullover cable'],
 'espalda', array['core'], 'aislamiento', 'polea', 'intermedio',
 'Pullover con tensión constante en polea.',
 'Brazos casi rectos, baja desde arriba hasta los muslos usando el dorsal.',
 array['Flexionar los codos'],
 array['Permite sentir el dorsal sin que intervengan los bíceps'],
 'pullover'),

('elevaciones-laterales-polea', 'Elevaciones laterales en polea', array['laterales en polea','elevacion lateral en polea unilateral','lateral polea','laterales cable'],
 'hombros', array[]::text[], 'aislamiento', 'polea', 'intermedio',
 'Laterales con tensión constante, normalmente de a un brazo.',
 'Polea baja cruzada por detrás del cuerpo. Sube hasta la altura del hombro.',
 array['Usar impulso del cuerpo'],
 array['La polea mantiene tensión abajo, donde la mancuerna la pierde'],
 'elevaciones-laterales'),

('pajaros-banco-inclinado', 'Pájaros en banco inclinado', array['pajaros banco inclinado','posteriores en banco','deltoide posterior inclinado'],
 'hombros', array['espalda'], 'aislamiento', 'mancuerna', 'intermedio',
 'Pájaros con el pecho apoyado en un banco inclinado.',
 'El apoyo impide balancearse, así que el deltoides posterior trabaja limpio.',
 array['Despegar el pecho del banco'],
 array['La versión más estricta de los pájaros'],
 'pajaros'),

('femoral-unilateral', 'Femoral unilateral', array['curl femoral unilateral','femoral una pierna','curl femoral a una pierna'],
 'piernas', array[]::text[], 'aislamiento', 'maquina', 'intermedio',
 'Curl femoral de a una pierna.',
 'Mismo movimiento que el bilateral, pero permite corregir diferencias entre piernas.',
 array['Compensar con la cadera'],
 array['Suele revelar que una pierna está bastante más floja que la otra'],
 'curl-femoral'),

('extension-unilateral', 'Extensión unilateral de cuádriceps', array['extension unilateral','cuadriceps unilateral','extension una pierna'],
 'piernas', array[]::text[], 'aislamiento', 'maquina', 'intermedio',
 'Extensión de cuádriceps de a una pierna.',
 'Igual que la bilateral pero de a una, para igualar diferencias.',
 array['Ayudarse con la otra pierna'],
 array['Aguanta arriba y baja lento'],
 'extension-cuadriceps'),

('peso-muerto-parcial', 'Peso muerto parcial', array['rack pull','peso muerto desde rack','peso muerto parcial'],
 'espalda', array['piernas'], 'traccion', 'barra', 'avanzado',
 'Peso muerto con recorrido corto, desde soportes.',
 'La barra arranca a la altura de las rodillas. Permite cargar más que el completo.',
 array['Redondear la espalda por exceso de peso'],
 array['Sirve para trabajar la parte alta del recorrido'],
 'peso-muerto'),

('press-inclinado-maquina', 'Press inclinado en máquina', array['press inclinado maquina','hammer inclinado','press inclinado multipower','press inclinado hammer'],
 'pecho', array['hombros','brazos'], 'empuje', 'maquina', 'principiante',
 'Press inclinado guiado.',
 'Ajusta el asiento para que las manijas queden a la altura del pecho alto.',
 array['Asiento mal regulado'],
 array['Permite llevar el pecho alto al fallo sin riesgo'],
 'press-inclinado'),

('cruces-polea-alta', 'Cruces de polea alta a baja', array['cruces alta a baja','cruce poleas alto','fly cable','fly polea alta'],
 'pecho', array['hombros'], 'aislamiento', 'polea', 'intermedio',
 'Cruces desde arriba: carga la parte baja del pecho.',
 'Poleas arriba, cruza las manos por delante a la altura de la cadera.',
 array['Usar el peso del cuerpo'],
 array['Cruzar las manos al final suma un poco de recorrido'],
 'aperturas-polea'),

('cruces-polea-baja', 'Cruces de polea baja a alta', array['cruce poleas bajo a alto','cruces bajo a alto','fly polea baja','fly inclinado'],
 'pecho', array['hombros'], 'aislamiento', 'polea', 'intermedio',
 'Cruces desde abajo: carga la parte alta del pecho.',
 'Poleas abajo, sube las manos juntándolas a la altura de la cara.',
 array['Encoger los hombros al subir'],
 array['Complementa bien al press inclinado'],
 'aperturas-polea'),

('farmer-walk', 'Farmer walk', array['farmer walk','caminata del granjero','paseo del granjero','farmers walk','carry'],
 'core', array['brazos','piernas'], 'full_body', 'mancuerna', 'intermedio',
 'Caminar cargando peso a los costados.',
 'Toma una mancuerna o kettlebell pesada en cada mano y camina erguido, hombros atrás y abdomen firme. Se mide por distancia o por tiempo, no por repeticiones.',
 array['Encorvar la espalda por el peso','Caminar a pasos muy largos'],
 array['Trabaja agarre, core y postura todo junto','Si se te escapa de las manos, es la señal de que el agarre llegó al límite'],
 'farmer-walk'),

('sentadilla-libre-trasera', 'Sentadilla libre trasera', array['sentadilla libre','back squat','super squat','sentadilla trasera libre'],
 'piernas', array['core'], 'pierna', 'barra', 'intermedio',
 'La sentadilla con barra atrás, sin guías.',
 'Barra sobre los trapecios. Es la versión que más exige de estabilidad y core.',
 array['Juntar las rodillas','Levantar los talones'],
 array['Si te cuesta la profundidad, prueba con calzado de talón elevado'],
 'sentadilla')

on conflict (slug) do update set
  nombre = excluded.nombre,
  aliases = excluded.aliases,
  grupo_muscular = excluded.grupo_muscular,
  grupos_secundarios = excluded.grupos_secundarios,
  categoria = excluded.categoria,
  equipo = excluded.equipo,
  nivel = excluded.nivel,
  descripcion_corta = excluded.descripcion_corta,
  tecnica = excluded.tecnica,
  errores_comunes = excluded.errores_comunes,
  consejos = excluded.consejos,
  ilustracion_slug = excluded.ilustracion_slug;
  -- `activo` NO se toca: si el entrenador desactivó un ejercicio, se respeta.


-- ============================================================
-- 3 de 3 — MIGRACION 0027
-- ============================================================

-- Separa el ARCHIVO de la ASIGNACIÓN.
--
-- `documentos` mezclaba las dos cosas: `alumno_id` era obligatorio, así que una
-- fila era "este archivo, para este alumno". Por eso había que entrar al perfil
-- de cada alumno para subir algo, y el mismo PDF para 10 alumnos eran 10 filas.
-- Ya se había visto la fragilidad del modelo: cuando `subirGuiaCompleta` empezó
-- a registrar un mismo archivo con dos tipos, hubo que blindar el borrado para
-- que eliminar una fila no dejara la otra apuntando a un archivo inexistente.
--
-- Desde acá:
--   documentos             = el archivo (uno por archivo real)
--   documento_asignaciones = a qué alumnos está asignado
--
-- MIGRACIÓN ADITIVA A PROPÓSITO. `documentos.alumno_id` NO se borra, solo pasa
-- a aceptar null. Así el código viejo sigue funcionando después de correr esto,
-- y se puede aplicar la migración primero y desplegar el código después sin una
-- ventana en la que la app quede rota. La columna queda obsoleta: el código
-- nuevo no la lee. Se puede eliminar en una migración futura, una vez que en
-- producción no quede nada leyéndola.

-- ── 1. Tabla de asignaciones ─────────────────────────────────────────────

create table if not exists documento_asignaciones (
  documento_id uuid not null references documentos(id) on delete cascade,
  alumno_id uuid not null references perfiles(id) on delete cascade,
  fecha_asignacion date not null default current_date,
  asignado_por uuid references perfiles(id),
  created_at timestamptz not null default now(),
  primary key (documento_id, alumno_id)
);

-- La consulta más frecuente es "los documentos de este alumno".
create index if not exists documento_asignaciones_alumno_idx
  on documento_asignaciones (alumno_id);

-- ── 2. Copiar las asignaciones que ya existen ────────────────────────────
-- Cada fila actual de `documentos` es, por definición, una asignación.
-- `on conflict do nothing` la vuelve reaplicable sin duplicar.

insert into documento_asignaciones (documento_id, alumno_id, fecha_asignacion, asignado_por)
select id, alumno_id, fecha_asignacion, entrenador_id
from documentos
where alumno_id is not null
on conflict (documento_id, alumno_id) do nothing;

-- ── 3. El archivo deja de exigir alumno ──────────────────────────────────

alter table documentos alter column alumno_id drop not null;

-- ── 4. Un tercer tipo, para lo que no es rutina ni dieta ─────────────────

alter table documentos drop constraint if exists documentos_tipo_check;
alter table documentos add constraint documentos_tipo_check
  check (tipo in ('rutina', 'alimentacion', 'otro'));

-- ── 5. RLS ───────────────────────────────────────────────────────────────

alter table documento_asignaciones enable row level security;

-- El alumno ve sus propias asignaciones; el entrenador, las de sus alumnos.
drop policy if exists documento_asignaciones_select on documento_asignaciones;
create policy documento_asignaciones_select on documento_asignaciones for select
  using (alumno_id = auth.uid() or es_entrenador_de(alumno_id));

drop policy if exists documento_asignaciones_write on documento_asignaciones;
create policy documento_asignaciones_write on documento_asignaciones for all
  using (es_admin_o_entrenador())
  with check (es_admin_o_entrenador());

-- Las políticas viejas de `documentos` filtran por `alumno_id`, que ahora puede
-- ser null: con ellas, un archivo recién subido y todavía sin asignar sería
-- invisible incluso para quien lo subió. Se reescriben en términos de las
-- asignaciones.
drop policy if exists documentos_select on documentos;
create policy documentos_select on documentos for select
  using (
    es_admin_o_entrenador()
    or exists (
      select 1 from documento_asignaciones a
      where a.documento_id = documentos.id and a.alumno_id = auth.uid()
    )
  );

drop policy if exists documentos_write on documentos;
create policy documentos_write on documentos for all
  using (es_admin_o_entrenador())
  with check (es_admin_o_entrenador());
