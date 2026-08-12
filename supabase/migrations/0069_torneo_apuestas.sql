-- Apuestas de Arena VIP — el público de la carrera de caballos.
--
-- El problema, en palabras de Alejandro: "hice un torneo y fue fome". Un duelo
-- entre dos personas le importa a dos personas; los otros 66 alumnos ni se
-- enteran. Acá el que NO compite pone algo suyo y por eso mira.
--
-- Reglas que impone esta tabla (la aritmética vive en lib/torneos/apuestas.ts):
--
--  * `unique (torneo_id, alumno_id)` — una sola apuesta por alumno y torneo. No
--    es una restricción cosmética: sin ella, un alumno podría apostar por los
--    dos lados y recuperar siempre, que es lo mismo que no apostar.
--  * `por_alumno_id` tiene que ser un PARTICIPANTE del torneo, y `alumno_id`
--    NO puede serlo. Un competidor que apuesta en su propio duelo tiene un
--    motivo para perder a propósito. Eso lo valida el servidor (necesita mirar
--    torneo_participantes), pero queda escrito acá para el que lea la tabla.
--  * `puntos > 0`. El descuento y el pago viven en puntos_vip_movimientos, con
--    categoría 'competencia', que ya existe desde 0036_arena_vip.sql:
--      clave 'apuesta:{torneoId}'      → el descuento, negativo, al apostar.
--      clave 'apuesta-pago:{torneoId}' → la devolución, positiva, al cerrar.
--    Dos claves y no una para que el libro de movimientos cuente la historia
--    completa ("apostaste 100" / "acertaste, recibes 250") en vez de un neto
--    que no explica nada.
--
-- Decisión de Alejandro, ya tomada: "que le cueste su saldo al alumno está
-- bien, lo hace más competitivo". Esto invierte la regla anterior de Arena VIP
-- (la bolsa de premios la sigue aportando VIP Fitness y nadie pierde puntos
-- por competir; lo que sí se arriesga es lo que uno apuesta por voluntad
-- propia). Los textos de la app se actualizaron junto con esta migración.

create table if not exists torneo_apuestas (
  id uuid primary key default gen_random_uuid(),
  torneo_id uuid not null references torneos(id) on delete cascade,
  -- Quien apuesta. No compite en este torneo.
  alumno_id uuid not null references perfiles(id) on delete cascade,
  -- Por quién apuesta. Sí compite en este torneo.
  por_alumno_id uuid not null references perfiles(id) on delete cascade,
  puntos integer not null check (puntos > 0),
  created_at timestamptz not null default now(),
  -- Se llena al cerrar el torneo: cuánto se le devolvió EN TOTAL (0 si falló).
  -- Sirve de candado contra el doble pago y para mostrar el historial sin
  -- tener que recalcular el reparto con reglas que quizá cambiaron después.
  devuelto integer,
  resuelta_en timestamptz,
  unique (torneo_id, alumno_id),
  -- Apostar por uno mismo no tiene sentido ni siquiera si el alumno no compite:
  -- sería regalarse la bolsa.
  check (alumno_id <> por_alumno_id)
);

create index if not exists torneo_apuestas_torneo_idx on torneo_apuestas (torneo_id);
create index if not exists torneo_apuestas_alumno_idx on torneo_apuestas (alumno_id);

alter table torneo_apuestas enable row level security;

-- Quién apostó por quién y cuánto es información PÚBLICA del gimnasio: esa es
-- justamente la gracia ("todos apostaron por ti"). Igual que torneos y
-- ranking, cualquier alumno logueado la ve.
create policy torneo_apuestas_select on torneo_apuestas for select
  using (auth.uid() is not null);

-- Nadie escribe desde el cliente. Apostar mueve Puntos VIP, así que pasa
-- siempre por el servidor con service_role (ver apostarEnTorneo en
-- app/alumno/ranked/actions.ts), que es el único que puede verificar saldo,
-- que el torneo siga abierto y que el alumno no sea participante.
create policy torneo_apuestas_admin on torneo_apuestas for all
  using (es_admin_o_entrenador())
  with check (es_admin_o_entrenador());

comment on table torneo_apuestas is
  'Apuestas del público en un torneo de Arena VIP. Reparto pari-mutuel: los que aciertan recuperan lo suyo y se reparten lo de los que fallaron. Sin casa que gane.';
comment on column torneo_apuestas.devuelto is
  'Total devuelto al cerrar (incluye lo apostado si acertó). NULL mientras el torneo siga abierto. Candado contra el doble pago.';
